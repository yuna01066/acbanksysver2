import { createServer } from 'node:http';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || 8788);
const HOST = process.env.HOST || '127.0.0.1';
const FORMULA_VERSION = 'pricing-engine-v2-core-260520';
const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || 'https://ai.gateway.lovable.dev/v1/chat/completions';
const AI_MODEL = process.env.QUOTE_WIZARD_AI_MODEL || 'google/gemini-2.5-flash';
const PDF_RENDER_PAGE_LIMIT = Number(process.env.QUOTE_WIZARD_PDF_RENDER_PAGE_LIMIT || 4);
const __dirname = dirname(fileURLToPath(import.meta.url));
const bundledScript = (name) => join(__dirname, '..', 'scripts', name);

const optionalScript = {
  dxfParser: process.env.ACBANK_DXF_PARSER || bundledScript('parse_dxf_ascii.py'),
  cadInspector: process.env.ACBANK_CAD_INSPECTOR || bundledScript('inspect_cad.py'),
  yieldCalculator: process.env.ACBANK_YIELD_CALCULATOR || bundledScript('acrylic_yield_calculator.py'),
  formulaCalculator: process.env.ACBANK_FORMULA_CALCULATOR || bundledScript('calculate_formula_v2.py'),
};

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
};

const run = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const out = [];
  const err = [];
  child.stdout.on('data', (chunk) => out.push(chunk));
  child.stderr.on('data', (chunk) => err.push(chunk));
  child.on('error', reject);
  child.on('close', (code) => {
    const stdout = Buffer.concat(out).toString('utf8');
    const stderr = Buffer.concat(err).toString('utf8');
    if (code === 0) resolve({ stdout, stderr });
    else reject(new Error(`${command} exited ${code}: ${stderr || stdout}`));
  });
});

const commandExists = async (command) => {
  try {
    await run('which', [command]);
    return true;
  } catch {
    return false;
  }
};

const safeFileName = (file) => String(file.file_name || file.file_path || 'quote-wizard-file')
  .split(/[\\/]/)
  .pop()
  .replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ .()[\]-]+/g, '_')
  .slice(0, 180) || 'quote-wizard-file';

const writeDownloadedFile = async (file, directory, arrayBuffer) => {
  const localPath = join(directory, safeFileName(file));
  await writeFile(localPath, Buffer.from(arrayBuffer));
  return localPath;
};

const downloadStorageFile = async (file, bucket, directory) => {
  if (file.signed_url) {
    const response = await fetch(file.signed_url);
    if (!response.ok) throw new Error(`Failed to download signed URL for ${file.file_name}: ${response.status}`);
    return writeDownloadedFile(file, directory, await response.arrayBuffer());
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  const path = file.file_path;

  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  });
  if (!response.ok) throw new Error(`Failed to download ${path}: ${response.status}`);

  return writeDownloadedFile(file, directory, await response.arrayBuffer());
};

const inspectDxf = async (filePath) => {
  const outPath = `${filePath}.observations.json`;
  try {
    await run('python3', [optionalScript.dxfParser, filePath, '--json-out', outPath]);
    const raw = await readFile(outPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};

const inspectCad = async (filePath) => {
  const outPath = `${filePath}.inspect.json`;
  try {
    await run('python3', [optionalScript.cadInspector, filePath, '--json-out', outPath]);
    const raw = await readFile(outPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};

const compactText = (text, limit = 7000) => text.replace(/\s+/g, ' ').trim().slice(0, limit);

const decodePdfLiteral = (raw) => raw
  .replace(/\\n/g, '\n')
  .replace(/\\r/g, '\r')
  .replace(/\\t/g, '\t')
  .replace(/\\\(/g, '(')
  .replace(/\\\)/g, ')')
  .replace(/\\\\/g, '\\');

const extractRawPdfText = async (filePath) => {
  const buffer = await readFile(filePath);
  const raw = buffer.toString('latin1');
  const fragments = [];

  for (const match of raw.matchAll(/\((?:\\.|[^\\)]){1,500}\)\s*Tj/g)) {
    fragments.push(decodePdfLiteral(match[0].replace(/\)\s*Tj$/, '').slice(1)));
  }

  for (const match of raw.matchAll(/\[((?:\((?:\\.|[^\\)]){1,500}\)\s*)+)\]\s*TJ/g)) {
    for (const stringMatch of match[1].matchAll(/\((?:\\.|[^\\)]){1,500}\)/g)) {
      fragments.push(decodePdfLiteral(stringMatch[0].slice(1, -1)));
    }
  }

  const fallback = raw
    .replace(/[^\x20-\x7E가-힣ㄱ-ㅎㅏ-ㅣ]/g, ' ')
    .match(/[A-Za-z가-힣0-9][A-Za-z가-힣0-9\s.,:;()xX*×/+-]{3,}/g);

  return compactText([...fragments, ...(fallback || [])].join(' '), 10000);
};

const extractPdfText = async (filePath) => {
  if (await commandExists('pdftotext')) {
    try {
      const { stdout } = await run('pdftotext', ['-layout', '-enc', 'UTF-8', filePath, '-']);
      const text = compactText(stdout, 16000);
      if (text) return { text, method: 'pdftotext' };
    } catch (error) {
      // Fall through to the raw text extractor. Some customer PDFs are image-only
      // or have malformed text streams.
    }
  }

  return { text: await extractRawPdfText(filePath), method: 'raw_pdf_stream' };
};

const renderPdfPages = async (filePath, directory) => {
  if (!(await commandExists('pdftoppm'))) return [];

  const prefix = join(directory, 'quote-wizard-page');
  await run('pdftoppm', [
    '-png',
    '-r',
    '160',
    '-f',
    '1',
    '-l',
    String(Math.max(1, PDF_RENDER_PAGE_LIMIT)),
    filePath,
    prefix,
  ]);

  const files = await readdir(directory);
  return files
    .filter((name) => name.startsWith('quote-wizard-page') && name.endsWith('.png'))
    .sort()
    .map((name) => join(directory, name));
};

const ocrImage = async (filePath) => {
  if (!(await commandExists('tesseract'))) return { text: '', method: 'missing_tesseract' };

  try {
    const { stdout } = await run('tesseract', [filePath, 'stdout', '-l', process.env.TESSERACT_LANG || 'kor+eng']);
    return { text: compactText(stdout, 8000), method: 'tesseract' };
  } catch (error) {
    return { text: '', method: `tesseract_failed: ${error instanceof Error ? error.message : String(error)}` };
  }
};

const imagePayloadFromFile = async (filePath, mimeType, label) => ({
  mimeType: mimeType || 'image/png',
  base64: (await readFile(filePath)).toString('base64'),
  fileName: label,
});

const normalizeUnit = (value, unit = 'mm') => {
  const normalized = String(unit || 'mm').toLowerCase();
  if (normalized === 'm') return value * 1000;
  if (normalized === 'cm' || normalized === '센티') return value * 10;
  return value;
};

const inferQuantity = (text, matchIndex) => {
  const windowText = text.slice(Math.max(0, matchIndex - 80), matchIndex + 120);
  const quantityMatch = windowText.match(/(?:수량|qty|quantity|ea|set|세트|개수)?\s*[:：]?\s*(\d{1,5})\s*(?:개|ea|EA|set|SET|세트)/);
  return quantityMatch ? Number(quantityMatch[1]) : null;
};

const inferLabel = (text, matchIndex, index) => {
  const before = text.slice(Math.max(0, matchIndex - 48), matchIndex).replace(/\s+/g, ' ').trim();
  const labelMatch = before.match(/([가-힣A-Za-z0-9_/-]{2,24})\s*[:：-]?\s*$/);
  return labelMatch ? labelMatch[1] : `추출 파트 ${index + 1}`;
};

const extractThickness = (text) => {
  const match = text.match(/(\d+(?:\.\d+)?)\s*T\b/i);
  return match ? `${match[1].replace(/\.0$/, '')}T` : null;
};

const extractMaterial = (text) => {
  if (/아크릴|acrylic|pmma/i.test(text)) return '아크릴';
  if (/포맥스|폼보드|foam/i.test(text)) return '포맥스';
  if (/알루미늄|aluminum|aluminium/i.test(text)) return '알루미늄';
  if (/스테인리스|스텐|sus|stainless/i.test(text)) return '스테인리스';
  return null;
};

const extractProcessing = (text) => {
  const candidates = [
    ['재단', /재단|cut/i],
    ['CNC', /cnc/i],
    ['레이저', /레이저|laser/i],
    ['타공', /타공|홀|hole|drill/i],
    ['인쇄', /인쇄|출력|uv|print/i],
    ['접착', /접착|본딩|bond/i],
    ['조립', /조립|assembly/i],
    ['절곡', /절곡|bending/i],
  ];
  return candidates.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
};

const toText = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

const toNumber = (value) => {
  const parsed = typeof value === 'number' ? value : Number(String(value || '').replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 10) / 10 : null;
};

const dedupeParts = (parts) => {
  const seen = new Set();
  return parts.filter((part) => {
    const key = [part.name, part.width_mm, part.height_mm, part.quantity].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeAiParts = (value) => {
  if (!Array.isArray(value)) return [];

  return value.map((item, index) => {
    const record = item && typeof item === 'object' ? item : {};
    return {
      id: toText(record.id) || `ai-part-${index + 1}`,
      name: toText(record.name) || `AI 추출 파트 ${index + 1}`,
      shape: ['rect', 'trapezoid', 'irregular', 'unknown'].includes(String(record.shape)) ? record.shape : 'unknown',
      width_mm: toNumber(record.width_mm),
      height_mm: toNumber(record.height_mm),
      quantity: toNumber(record.quantity),
      material: toText(record.material),
      thickness: toText(record.thickness),
      basis: toText(record.basis) || 'AI Gateway 파일 분석 결과',
      confidence: ['low', 'medium', 'high'].includes(String(record.confidence)) ? record.confidence : 'low',
      risk_notes: Array.isArray(record.risk_notes) ? record.risk_notes.map(String).filter(Boolean) : ['AI 추출값은 상담원 검수가 필요합니다.'],
    };
  }).filter((part) => part.width_mm && part.height_mm);
};

const parseAiJson = (content) => {
  const jsonMatch = String(content || '').match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
};

const runAiAnalysis = async ({ job, parserNotes, imagePayloads }) => {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;

  const content = [
    {
      type: 'text',
      text: `ACBANK 견적 마법사 워커 분석입니다. 첨부 파일 텍스트/OCR/렌더링 이미지에서 실제로 보이는 내용만 근거로 JSON을 반환하세요.

절대 샘플 치수, 일반적인 박스 구조, 임의 수량, 임의 금액을 만들지 마세요.
치수/수량/소재/파트가 보이지 않으면 null 또는 빈 배열로 두세요.

응답 JSON 스키마:
{
  "item_name": string | null,
  "dimensions": string | null,
  "quantity": number | null,
  "material": string | null,
  "thickness": string | null,
  "color": string | null,
  "finish": string | null,
  "processing": string[],
  "parts": [
    {"name": string, "shape": "rect"|"trapezoid"|"irregular"|"unknown", "width_mm": number|null, "height_mm": number|null, "quantity": number|null, "material": string|null, "thickness": string|null, "basis": string, "confidence": "low"|"medium"|"high", "risk_notes": string[]}
  ],
  "missing_fields": string[],
  "production_risks": string[],
  "recommended_reply": string,
  "confidence": "low"|"medium"|"high"
}

고객 메모: ${job?.customer_note || '없음'}
파일 관찰값:
${JSON.stringify(parserNotes.map((note) => ({
  file: note.file,
  kind: note.kind,
  text_excerpt: note.text_excerpt,
  ocr_excerpt: note.ocr_excerpt,
  extracted_parts: note.parts,
  dxf_summary: note.dxf?.summary || note.dxf?.entity_counts || null,
  cad: note.cad || null,
  note: note.note,
  error: note.error,
})), null, 2)}`,
    },
  ];

  for (const image of imagePayloads.slice(0, 6)) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
    });
  }

  const response = await fetch(AI_GATEWAY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: 'user', content }],
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    return {
      error: `AI Gateway failed: ${response.status} ${errorText}`,
    };
  }

  const result = await response.json();
  return parseAiJson(result.choices?.[0]?.message?.content || '');
};

const extractDimensionParts = (text, sourceLabel) => {
  const parts = [];
  const dimensionPattern = /(\d{2,5}(?:\.\d+)?)\s*(?:mm|㎜|미리|cm|m)?\s*(?:x|X|×|\*)\s*(\d{2,5}(?:\.\d+)?)\s*(?:mm|㎜|미리|cm|m)?(?:\s*(?:x|X|×|\*)\s*(\d{1,4}(?:\.\d+)?)\s*(?:T|t|mm|㎜|미리)?)?/g;
  const material = extractMaterial(text);
  const thickness = extractThickness(text);
  let index = 0;

  for (const match of text.matchAll(dimensionPattern)) {
    const unitMatch = match[0].match(/\b(mm|cm|m|㎜|미리)\b/i)?.[1] || 'mm';
    const width = normalizeUnit(Number(match[1]), unitMatch);
    const height = normalizeUnit(Number(match[2]), unitMatch);
    if (!Number.isFinite(width) || !Number.isFinite(height)) continue;
    if (width < 10 || height < 10 || width > 20000 || height > 20000) continue;
    const quantity = inferQuantity(text, match.index || 0);
    parts.push({
      id: `${sourceLabel}-${index + 1}`,
      name: inferLabel(text, match.index || 0, index),
      shape: 'rect',
      width_mm: Math.round(width * 10) / 10,
      height_mm: Math.round(height * 10) / 10,
      quantity,
      material,
      thickness: match[3] ? `${match[3].replace(/\.0$/, '')}T` : thickness,
      basis: `${sourceLabel} 텍스트에서 치수 패턴 직접 추출`,
      confidence: quantity ? 'medium' : 'low',
      risk_notes: [
        '텍스트 기반 자동 추출값입니다. 도면 스케일과 실제 수량 검수가 필요합니다.',
        ...(quantity ? [] : ['수량 표기가 명확하지 않습니다.']),
      ],
    });
    index += 1;
    if (parts.length >= 24) break;
  }

  return dedupeParts(parts);
};

const parseDxfTextParts = (text, sourceLabel) => {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const parts = [];
  let index = 0;

  for (let i = 0; i < lines.length - 1; i += 2) {
    if (lines[i] !== '0' || lines[i + 1] !== 'LWPOLYLINE') continue;
    const entity = [];
    i += 2;
    while (i < lines.length - 1 && !(lines[i] === '0' && lines[i + 1])) {
      entity.push([lines[i], lines[i + 1]]);
      i += 2;
    }
    i -= 2;

    const closed = entity.some(([code, value]) => code === '70' && (Number(value) & 1) === 1);
    const xs = entity.filter(([code]) => code === '10').map(([, value]) => Number(value)).filter(Number.isFinite);
    const ys = entity.filter(([code]) => code === '20').map(([, value]) => Number(value)).filter(Number.isFinite);
    if (!closed || xs.length < 4 || ys.length < 4) continue;
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    if (width < 10 || height < 10 || width > 20000 || height > 20000) continue;
    parts.push({
      id: `${sourceLabel}-polyline-${index + 1}`,
      name: `DXF 폐합 외곽 ${index + 1}`,
      shape: 'rect',
      width_mm: Math.round(width * 10) / 10,
      height_mm: Math.round(height * 10) / 10,
      quantity: 1,
      material: null,
      thickness: null,
      basis: 'DXF LWPOLYLINE 폐합 외곽 bounding box 기준',
      confidence: 'low',
      risk_notes: ['DXF 단위와 스케일 확인이 필요합니다.', '폐합 외곽의 실제 파트 여부는 상담원 검수가 필요합니다.'],
    });
    index += 1;
    if (parts.length >= 24) break;
  }

  return dedupeParts(parts);
};

const totalPartArea = (parts) => parts.reduce((sum, part) => (
  sum + (Number(part.width_mm) || 0) * (Number(part.height_mm) || 0) * (Number(part.quantity) || 1)
), 0);

const normalizeThickness = (value) => {
  const match = String(value || '').match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const numeric = Number(match[0]);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return `${String(numeric).replace(/\.0$/, '')}T`;
};

const normalizeSearchText = (...values) => values
  .map((value) => String(value || '').toLowerCase())
  .join(' ');

const inferAcrylicQuality = (analysis, parserNotes = []) => {
  const text = normalizeSearchText(
    analysis.material,
    analysis.color,
    analysis.finish,
    analysis.item_name,
    analysis.processing?.join(' '),
    parserNotes.map((note) => `${note.text_excerpt || ''} ${note.ocr_excerpt || ''}`).join(' '),
  );

  if (!/아크릴|acrylic|pmma|투명|clear|클리어|미러|mirror|사틴|satin|아스텔|astel|브라이트|bright|보급/.test(text)) {
    return {
      qualityId: null,
      qualityLabel: null,
      confidence: 'low',
      warnings: ['아크릴 판재 재질로 확정할 수 없어 자동 금액 산출을 보류했습니다.'],
    };
  }

  if (/사틴.*미러|satin.*mirror|mirror.*satin|미러.*사틴/.test(text)) {
    return { qualityId: 'satin-mirror', qualityLabel: 'Satin Mirror', confidence: 'medium', warnings: ['사틴 미러 재질은 상담원 단가 검수가 필요합니다.'] };
  }
  if (/아스텔.*미러|astel.*mirror|mirror.*astel|미러.*아스텔/.test(text)) {
    return { qualityId: 'astel-mirror', qualityLabel: 'Astel Mirror', confidence: 'medium', warnings: ['아스텔 미러 재질은 상담원 단가 검수가 필요합니다.'] };
  }
  if (/미러|mirror/.test(text)) {
    return { qualityId: 'acrylic-mirror', qualityLabel: 'Mirror', confidence: 'medium', warnings: ['미러 재질은 색상/증착 단가 검수가 필요합니다.'] };
  }
  if (/사틴|satin/.test(text)) return { qualityId: 'satin-color', qualityLabel: 'Satin', confidence: 'medium', warnings: [] };
  if (/아스텔|astel/.test(text)) return { qualityId: 'astel-color', qualityLabel: 'Astel', confidence: 'medium', warnings: [] };
  if (/브라이트|bright|진백|스리/.test(text)) return { qualityId: 'bright-color', qualityLabel: 'Bright', confidence: 'medium', warnings: ['브라이트/진백/스리 안료 추가금은 상담원 검수가 필요합니다.'] };
  if (/보급/.test(text)) return { qualityId: 'glossy-standard', qualityLabel: '유광 보급판', confidence: 'medium', warnings: [] };

  return {
    qualityId: 'glossy-color',
    qualityLabel: 'Clear',
    confidence: /투명|clear|클리어|glossy/.test(text) ? 'medium' : 'low',
    warnings: /투명|clear|클리어|glossy/.test(text)
      ? []
      : ['재질 세부값이 명확하지 않아 Clear 기준 임시 금액으로 계산했습니다.'],
  };
};

const pricingPanelsFor = (pricingContext, qualityId, thickness) => {
  if (!pricingContext || !qualityId || !thickness) return [];
  const masters = Array.isArray(pricingContext.panel_masters) ? pricingContext.panel_masters : [];
  const sizes = Array.isArray(pricingContext.panel_sizes) ? pricingContext.panel_sizes : [];
  const masterIds = new Set(
    masters
      .filter((master) => String(master.quality) === qualityId)
      .map((master) => master.id),
  );

  return sizes
    .filter((size) => (
      masterIds.has(size.panel_master_id) &&
      String(size.thickness) === thickness &&
      size.is_active !== false &&
      Number(size.price) > 0 &&
      Number(size.actual_width) > 0 &&
      Number(size.actual_height) > 0
    ))
    .map((size) => ({
      name: String(size.size_name || `${size.actual_width}x${size.actual_height}`).replace(/[:\r\n]/g, ' ').trim(),
      width_mm: Number(size.actual_width),
      height_mm: Number(size.actual_height),
      price: Number(size.price),
      pricing_version_id: size.pricing_version_id || null,
      panel_master_id: size.panel_master_id,
    }))
    .sort((a, b) => (a.width_mm * a.height_mm) - (b.width_mm * b.height_mm));
};

const fallbackYieldSnapshot = (parts, sourceOnly) => {
  const totalArea = totalPartArea(parts);

  return {
    status: 'insufficient_data',
    candidate_basis: null,
    stock_sheet: { name: null, width_mm: null, height_mm: null, basis: null },
    total_part_area_mm2: totalArea || null,
    estimated_sheet_count: null,
    yield_percent: null,
    scrap_percent: null,
    notes: totalArea && !sourceOnly
      ? ['파일에서 파트 면적은 추출했지만 원장 규격/방향/커프 정보가 없어 수율은 계산하지 않았습니다.']
      : ['원장/수율 계산에 필요한 파트 치수와 수량이 부족합니다.'],
  };
};

const compactYieldResult = (result, parts, usedDbPanels = false) => {
  const scenario = result.rotation_scenarios?.rotation_allowed || result;
  const recommendation = Array.isArray(scenario.recommendations) ? scenario.recommendations[0] : null;
  if (!recommendation) throw new Error('Yield calculator returned no recommendation');

  return {
    status: recommendation.canFitAll ? 'estimated' : 'needs_review',
    candidate_basis: result.candidate_basis?.mode || 'skill_acrylic_yield_calculator',
    stock_sheet: {
      name: recommendation.panel?.name || null,
      width_mm: recommendation.panel?.width_mm || null,
      height_mm: recommendation.panel?.height_mm || null,
      basis: recommendation.panel?.basis || 'yield_calculator',
    },
    total_part_area_mm2: totalPartArea(parts),
    estimated_sheet_count: recommendation.estimated_sheet_count || recommendation.panelsNeeded || null,
    yield_percent: recommendation.yield_percent || recommendation.efficiency || null,
    scrap_percent: recommendation.yield_percent ? Math.round((100 - recommendation.yield_percent) * 10) / 10 : null,
    notes: [
      'acrylic_yield_calculator.py 실행 결과입니다.',
      usedDbPanels
        ? 'Lovable DB panel_sizes 단가 후보로 원장/수율을 계산했습니다.'
        : 'DB panel_sizes가 워커로 전달되지 않아 스킬 fallback 원장 후보를 사용했습니다.',
    ],
    audit: {
      script: 'acrylic_yield_calculator.py',
      spacing_mm: result.spacing_mm,
      spacing_basis: result.spacing_basis,
      rotation_mode: scenario.rotation_mode || 'yes',
      strategy: recommendation.strategy,
      placed_counts: recommendation.placedCounts || null,
      evaluated_panel_count: Array.isArray(result.evaluated_panels) ? result.evaluated_panels.length : null,
    },
  };
};

const runYieldCalculator = async (parts, thickness, fallback, panelCandidates = []) => {
  if (!parts.length) return fallback;
  if (!thickness) {
    return {
      ...fallback,
      notes: [
        ...(fallback.notes || []),
        '두께 정보가 없어 원장 후보 계산은 보류했습니다.',
      ],
    };
  }

  const args = [
    optionalScript.yieldCalculator,
    '--allow-rotate',
    'yes',
    '--thickness',
    thickness,
  ];

  if (panelCandidates.length) {
    for (const panel of panelCandidates) {
      args.push('--panel', `${panel.name}:${panel.width_mm}x${panel.height_mm}`);
    }
  } else {
    args.push('--logic-candidates');
  }

  for (const part of parts) {
    const name = String(part.name || 'part').replace(/[:\r\n]/g, ' ').trim() || 'part';
    const quantity = Number(part.quantity) || 1;
    args.push('--part', `${name}:${part.width_mm}x${part.height_mm}x${quantity}`);
  }

  try {
    const { stdout } = await run('python3', args);
    return compactYieldResult(JSON.parse(stdout), parts, panelCandidates.length > 0);
  } catch (error) {
    return {
      ...fallback,
      notes: [
        ...(fallback.notes || []),
        `수율 스킬 실행 실패: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
};

const fallbackFormulaSnapshot = (sourceOnly, productionRisks, parts = []) => {
  return {
    status: 'blocked',
    subtotal: 0,
    tax: 0,
    total: 0,
    version: FORMULA_VERSION,
    line_items: [],
    warnings: productionRisks,
    blocked_reasons: [
      ...(sourceOnly || !parts.length ? ['파일에서 견적 산출 가능한 파트 치수를 추출하지 못했습니다.'] : []),
      '원장 규격, 소재 단가, 가공 조건 검수 전에는 임시 금액을 산출하지 않습니다.',
    ],
  };
};

const findRecommendedPanel = (yieldSnapshot, panelCandidates) => {
  if (!yieldSnapshot?.stock_sheet || !panelCandidates.length) return null;
  const stock = yieldSnapshot.stock_sheet;
  const name = String(stock.name || '');
  const width = Number(stock.width_mm) || 0;
  const height = Number(stock.height_mm) || 0;

  return panelCandidates.find((panel) => panel.name === name) ||
    panelCandidates.find((panel) => (
      Math.abs(panel.width_mm - width) <= 1 &&
      Math.abs(panel.height_mm - height) <= 1
    )) ||
    null;
};

const inferFormulaSetup = (analysis, parts, yieldSnapshot) => {
  const text = normalizeSearchText(
    analysis.processing?.join(' '),
    analysis.item_name,
    analysis.recommended_reply,
    analysis.production_risks?.join(' '),
  );
  const warnings = [];
  let selectedSetupFee = 0;
  let fabricationBaseMultiplier = 1.3;

  if (/cnc|씨엔씨|홈|슬롯|끼움/.test(text)) {
    selectedSetupFee = 70_000;
    warnings.push('CNC/끼움 홈 가능성이 있어 기본 세팅비 70,000원을 적용했습니다.');
  } else if (/레이저|laser/.test(text)) {
    selectedSetupFee = 50_000;
    warnings.push('레이저 가공 가능성이 있어 기본 세팅비 50,000원을 적용했습니다.');
  } else if (/복잡|다중|타공|홀|hole/.test(text) || parts.length >= 8) {
    selectedSetupFee = 70_000;
    warnings.push('복합/다중 재단 가능성이 있어 기본 세팅비 70,000원을 적용했습니다.');
  }

  if (/단순|simple/.test(text) && parts.length <= 3) {
    warnings.push('단순 재단 여부는 상담원 검수 후 확정해야 합니다.');
  }

  if (/접착|본딩|무기포|bond|조립/.test(text)) {
    warnings.push('접착/조립 공정은 접착선 길이와 코너 수 확인 전 임시 금액입니다.');
  }
  if (/인쇄|uv|print|염색/.test(text)) {
    warnings.push('인쇄/염색 공정은 도수, 인쇄 면적, 외주비 확인 전 임시 금액입니다.');
  }
  if (yieldSnapshot?.status !== 'estimated' && yieldSnapshot?.status !== 'calculated') {
    warnings.push('수율 계산이 확정 상태가 아니므로 원장 수량 검수가 필요합니다.');
  }

  return { selectedSetupFee, fabricationBaseMultiplier, warnings };
};

const runFormulaCalculator = async ({ analysis, parts, yieldSnapshot, tempDir, sourceOnly, pricingContext, qualityMatch, panelCandidates }) => {
  const fallback = fallbackFormulaSnapshot(sourceOnly, analysis.production_risks, parts);
  const warnings = [...(analysis.production_risks || []), ...(qualityMatch?.warnings || [])];
  const blockedReasons = [];

  if (sourceOnly || !parts.length) blockedReasons.push('파일에서 견적 산출 가능한 파트 치수를 추출하지 못했습니다.');
  if (!qualityMatch?.qualityId) blockedReasons.push('아크릴 재질/품질을 기존 단가표 품목으로 매핑하지 못했습니다.');
  const thickness = normalizeThickness(analysis.thickness);
  if (!thickness) blockedReasons.push('두께를 기존 단가표 형식으로 확정하지 못했습니다.');

  const panel = findRecommendedPanel(yieldSnapshot, panelCandidates);
  const sheetCount = Number(yieldSnapshot?.estimated_sheet_count) || 0;
  if (!panel) blockedReasons.push('추천 원장을 기존 panel_sizes 단가와 매칭하지 못했습니다.');
  if (!sheetCount) blockedReasons.push('필요 원장 수량을 산출하지 못했습니다.');

  if (blockedReasons.length) {
    return {
      ...fallback,
      warnings,
      blocked_reasons: [...new Set([...blockedReasons, ...(fallback.blocked_reasons || [])])],
    };
  }

  const sheetCost = Math.round(panel.price * sheetCount);
  const setup = inferFormulaSetup(analysis, parts, yieldSnapshot);
  warnings.push(...setup.warnings);

  const formulaInput = {
    sheetCost,
    fabricationBaseMultiplier: setup.fabricationBaseMultiplier,
    selectedSetupFee: setup.selectedSetupFee,
    targetGrossMarginRate: 0.30,
    productQty: analysis.quantity || Math.max(1, ...parts.map((part) => Number(part.quantity) || 1)),
    hasInterlockingAssembly: /끼움|조립|interlocking/i.test(normalizeSearchText(analysis.processing?.join(' '), analysis.item_name)),
    hasCncInterlockingSlot: /cnc|씨엔씨|홈|슬롯/i.test(normalizeSearchText(analysis.processing?.join(' '), analysis.item_name)),
    taxRate: 0.10,
  };

  try {
    const inputPath = join(tempDir, 'quote-wizard-formula-input.json');
    await writeFile(inputPath, JSON.stringify(formulaInput, null, 2));
    const { stdout } = await run('python3', [optionalScript.formulaCalculator, inputPath]);
    const result = JSON.parse(stdout);
    const subtotal = Number(result.subtotal) || 0;
    const tax = Number(result.tax) || Math.round(subtotal * 0.1);
    const total = Number(result.total) || subtotal + tax;
    const status = warnings.length ? 'needs_review' : 'calculable';

    return {
      status,
      subtotal,
      tax,
      total,
      version: FORMULA_VERSION,
      line_items: [
        {
          label: `${qualityMatch.qualityLabel || qualityMatch.qualityId} ${thickness} ${panel.name} ${sheetCount}장 기준 임시 공급가`,
          amount: subtotal,
          source: 'processing',
          reason: `panel_sizes 단가 ${panel.price.toLocaleString()}원 × ${sheetCount}장, fabricationBaseMultiplier ${setup.fabricationBaseMultiplier}, setupFee ${setup.selectedSetupFee.toLocaleString()}원, targetGrossMarginRate 30%`,
        },
      ],
      warnings: [...new Set(warnings)],
      blocked_reasons: [],
      audit: {
        adapter: 'quote_wizard_formula_v2_adapter',
        formula_input: formulaInput,
        formula_result: result,
        quality_match: qualityMatch,
        panel,
        pricing_context: {
          panel_candidate_count: panelCandidates.length,
          pricing_version_id: panel.pricing_version_id,
        },
      },
    };
  } catch (error) {
    return {
      ...fallback,
      warnings,
      blocked_reasons: [
        ...new Set([
          ...(fallback.blocked_reasons || []),
          `공식 v2 helper 실행 실패: ${error instanceof Error ? error.message : String(error)}`,
        ]),
      ],
    };
  }
};

const buildParts = (parserNotes, aiResult) => dedupeParts(
  [
    ...normalizeAiParts(aiResult?.parts),
    ...parserNotes.flatMap((note) => Array.isArray(note.parts) ? note.parts : []),
  ],
);

const buildAnalysis = async ({ job, files, parserNotes, imagePayloads, tempDir, pricingContext }) => {
  const hasFastPreview = files.some((file) => ['pdf', 'image', 'dxf'].includes(file.kind));
  const sourceOnly = !hasFastPreview;
  const aiResult = await runAiAnalysis({ job, parserNotes, imagePayloads });
  const aiError = aiResult?.error || null;
  const parts = buildParts(parserNotes, aiError ? null : aiResult);
  const combinedText = compactText(parserNotes.map((note) => note.text || note.text_excerpt || '').join('\n'), 16000);
  const material = toText(aiResult?.material) || extractMaterial(combinedText);
  const thickness = toText(aiResult?.thickness) || extractThickness(combinedText);
  const processing = Array.isArray(aiResult?.processing) && aiResult.processing.length
    ? aiResult.processing.map(String).filter(Boolean)
    : extractProcessing(combinedText);
  const risks = [
    ...((Array.isArray(aiResult?.production_risks) ? aiResult.production_risks.map(String) : []) || []),
    ...(aiError ? [aiError] : []),
    ...(sourceOnly ? ['원본 파일만으로는 자동 분석이 제한됩니다. PDF/DXF 또는 이미지 미리보기가 필요합니다.'] : []),
    ...(parts.length ? ['자동 추출 치수는 도면 스케일과 실제 파트 여부 검수가 필요합니다.'] : ['파일에서 명확한 파트 치수와 수량을 추출하지 못했습니다.']),
    ...(files.some((file) => file.kind === 'dwg') ? ['DWG는 변환 결과와 PDF/DXF 미리보기를 대조해야 합니다.'] : []),
    '상담원 검수 전 확정 금액으로 사용하지 않습니다.',
  ];

  const analysis = {
    item_name: toText(aiResult?.item_name),
    dimensions: toText(aiResult?.dimensions),
    quantity: toNumber(aiResult?.quantity),
    material,
    thickness,
    color: toText(aiResult?.color),
    finish: toText(aiResult?.finish),
    processing,
    observed: { files: files.map((file) => `${file.file_name}(${file.kind})`), parser_notes: parserNotes },
    inferred: {
      engine_status: parts.length ? 'limited' : 'needs_review',
      extraction_mode: aiResult && !aiError ? 'quote_wizard_worker_ai' : 'quote_wizard_worker_text',
      worker_status: 'connected',
      worker_mode: 'quote-wizard-worker-render-ocr-ai',
      ai_gateway_status: process.env.LOVABLE_API_KEY ? (aiError ? 'failed' : 'available') : 'missing',
      pdf_render_status: parserNotes.some((note) => note.rendered_pages?.length) ? 'available' : 'not_used_or_missing_pdftoppm',
      ocr_status: parserNotes.some((note) => note.ocr_excerpt) ? 'available' : 'not_used_or_missing_tesseract',
      pricing_adapter: 'quote_wizard_formula_v2_adapter',
      note: '워커가 PDF 텍스트, 가능 시 PDF 렌더링/OCR/이미지 비전, DXF 엔티티에서 관찰 가능한 값만 추출했습니다. 샘플 파트나 샘플 금액은 생성하지 않습니다.',
    },
    parts,
    missing_fields: [
      ...((Array.isArray(aiResult?.missing_fields) ? aiResult.missing_fields.map(String) : []) || []),
      ...(parts.length ? [] : ['파트별 치수', '수량']),
      ...(material ? [] : ['소재']),
      ...(thickness ? [] : ['두께']),
      ...(toText(aiResult?.item_name) ? [] : ['제작 품목']),
      '원장 규격',
      '커프/재단 여유',
    ],
    production_risks: risks,
    recommended_reply: toText(aiResult?.recommended_reply) || (parts.length
      ? '첨부파일에서 자동 추출 가능한 파트 치수만 정리했습니다. 제작 품목, 수량, 소재/두께, 원장 규격을 확인하면 견적 산출을 진행할 수 있습니다.'
      : '첨부파일은 접수했지만 자동으로 확정 가능한 파트 치수를 찾지 못했습니다. PDF/DXF 미리보기, 제작 품목, 파트별 치수, 수량, 소재/두께를 확인해주세요.'),
    confidence: ['low', 'medium', 'high'].includes(String(aiResult?.confidence)) ? aiResult.confidence : (parts.length ? 'medium' : 'low'),
  };

  const qualityMatch = inferAcrylicQuality(analysis, parserNotes);
  const normalizedThickness = normalizeThickness(analysis.thickness);
  const panelCandidates = pricingPanelsFor(pricingContext, qualityMatch.qualityId, normalizedThickness);
  const yieldSnapshot = await runYieldCalculator(parts, normalizedThickness, fallbackYieldSnapshot(parts, sourceOnly), panelCandidates);
  const formula = await runFormulaCalculator({
    analysis,
    parts,
    yieldSnapshot,
    tempDir,
    sourceOnly,
    pricingContext,
    qualityMatch,
    panelCandidates,
  });

  return { analysis, yield: yieldSnapshot, formula, status: formula.status };
};

const handleAnalyze = async (body) => {
  const files = Array.isArray(body.files) ? body.files : [];
  const tempDir = await mkdtemp(join(tmpdir(), 'quote-wizard-'));
  const parserNotes = [];
  const imagePayloads = [];

  try {
    await mkdir(tempDir, { recursive: true });
    for (const file of files) {
      const localPath = await downloadStorageFile(file, body.bucket, tempDir).catch((error) => {
        parserNotes.push({ file: file.file_name, stage: 'download', error: error.message });
        return null;
      });
      if (!localPath) continue;

      if (file.kind === 'pdf') {
        const { text, method } = await extractPdfText(localPath);
        const renderedPages = await renderPdfPages(localPath, tempDir).catch((error) => {
          parserNotes.push({
            file: file.file_name,
            kind: 'pdf',
            stage: 'render',
            error: error instanceof Error ? error.message : String(error),
          });
          return [];
        });
        const ocrTexts = [];
        for (const [index, pagePath] of renderedPages.entries()) {
          const ocr = await ocrImage(pagePath);
          if (ocr.text) ocrTexts.push(ocr.text);
          imagePayloads.push(await imagePayloadFromFile(pagePath, 'image/png', `${file.file_name} page ${index + 1}`));
        }
        const fullText = compactText([text, ...ocrTexts].filter(Boolean).join('\n'), 20000);
        parserNotes.push({
          file: file.file_name,
          kind: 'pdf',
          text: fullText,
          text_excerpt: compactText(fullText, 1200),
          ocr_excerpt: compactText(ocrTexts.join('\n'), 1200),
          extraction_method: method,
          rendered_pages: renderedPages.map((page) => page.split('/').pop()),
          parts: extractDimensionParts(fullText, `${file.file_name} PDF`),
        });
      } else if (file.kind === 'dxf') {
        const text = await readFile(localPath, 'utf8').catch(() => '');
        parserNotes.push({
          file: file.file_name,
          kind: 'dxf',
          text_excerpt: compactText(text, 1200),
          parts: dedupeParts([
            ...parseDxfTextParts(text, file.file_name),
            ...extractDimensionParts(text, `${file.file_name} DXF`),
          ]),
          dxf: await inspectDxf(localPath),
        });
      } else if (file.kind === 'dwg') {
        parserNotes.push({
          file: file.file_name,
          kind: 'dwg',
          note: 'DWG는 워커에서 직접 분석을 시도했지만 변환기 또는 미리보기와 대조가 필요합니다.',
          cad: await inspectCad(localPath),
        });
      } else if (file.kind === 'image') {
        const ocr = await ocrImage(localPath);
        imagePayloads.push(await imagePayloadFromFile(localPath, file.mime_type || 'image/png', file.file_name));
        parserNotes.push({
          file: file.file_name,
          kind: 'image',
          text: ocr.text,
          text_excerpt: compactText(ocr.text, 1200),
          ocr_excerpt: compactText(ocr.text, 1200),
          ocr_method: ocr.method,
          parts: extractDimensionParts(ocr.text, `${file.file_name} OCR`),
          note: '이미지는 OCR 및 AI Gateway 비전 분석 대상으로 전달했습니다.',
        });
      } else {
        parserNotes.push({
          file: file.file_name,
          kind: file.kind || 'unknown',
          note: '현재 독립 워커가 지원하지 않는 파일 형식입니다.',
        });
      }
    }

    return await buildAnalysis({ job: body.job, files, parserNotes, imagePayloads, tempDir, pricingContext: body.pricing_context });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

createServer(async (req, res) => {
  if (req.method === 'GET' && req.url?.includes('/health')) {
    return json(res, 200, {
      ok: true,
      worker: 'quote-wizard-worker',
      mode: 'render-ocr-ai',
      tools: {
        pdftotext: await commandExists('pdftotext'),
        pdftoppm: await commandExists('pdftoppm'),
        tesseract: await commandExists('tesseract'),
        aiGateway: Boolean(process.env.LOVABLE_API_KEY),
      },
    });
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const expectedSecret = process.env.QUOTE_WIZARD_WORKER_SECRET;
  if (expectedSecret && req.headers.authorization !== `Bearer ${expectedSecret}`) {
    return json(res, 401, { error: 'Unauthorized' });
  }

  try {
    const body = await readBody(req);
    return json(res, 200, await handleAnalyze(body));
  } catch (error) {
    console.error('quote-wizard-worker error:', error);
    return json(res, 500, { error: error instanceof Error ? error.message : 'Worker failed' });
  }
}).listen(PORT, HOST, () => {
  console.log(`quote-wizard-worker listening on http://${HOST}:${PORT}`);
});
