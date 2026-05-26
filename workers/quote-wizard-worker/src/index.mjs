import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT || 8788);
const HOST = process.env.HOST || '127.0.0.1';
const FORMULA_VERSION = 'pricing-engine-v2-core-260520';

const optionalScript = {
  dxfParser: process.env.ACBANK_DXF_PARSER || '/Users/acbank002/.codex/skills/dwg-cad-analyzer/scripts/parse_dxf_ascii.py',
  cadInspector: process.env.ACBANK_CAD_INSPECTOR || '/Users/acbank002/.codex/skills/dwg-cad-analyzer/scripts/inspect_cad.py',
  yieldCalculator: process.env.ACBANK_YIELD_CALCULATOR || '/Users/acbank002/.codex/skills/acbank-drawing-quote-analyzer/scripts/acrylic_yield_calculator.py',
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

const downloadStorageFile = async (bucket, path, directory) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  });
  if (!response.ok) throw new Error(`Failed to download ${path}: ${response.status}`);

  const localPath = join(directory, path.split('/').pop() || 'quote-wizard-file');
  await writeFile(localPath, Buffer.from(await response.arrayBuffer()));
  return localPath;
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

const extractPdfText = async (filePath) => {
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

const dedupeParts = (parts) => {
  const seen = new Set();
  return parts.filter((part) => {
    const key = [part.name, part.width_mm, part.height_mm, part.quantity].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

const compactYieldResult = (result, parts) => {
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
      'DB panel_sizes가 워커로 전달되지 않으면 스킬 fallback 원장 후보를 사용합니다.',
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

const runYieldCalculator = async (parts, thickness, fallback) => {
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
    '--logic-candidates',
    '--allow-rotate',
    'yes',
    '--thickness',
    thickness,
  ];

  for (const part of parts) {
    const name = String(part.name || 'part').replace(/[:\r\n]/g, ' ').trim() || 'part';
    const quantity = Number(part.quantity) || 1;
    args.push('--part', `${name}:${part.width_mm}x${part.height_mm}x${quantity}`);
  }

  try {
    const { stdout } = await run('python3', args);
    return compactYieldResult(JSON.parse(stdout), parts);
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

const runFormulaCalculator = async ({ analysis, parts, yieldSnapshot, tempDir, sourceOnly }) => {
  const fallback = fallbackFormulaSnapshot(sourceOnly, analysis.production_risks, parts);
  return {
    ...fallback,
    blocked_reasons: [
      ...(fallback.blocked_reasons || []),
      '분석 워커는 파일 관찰값만 반환하며 임의 단가/공임으로 견적 금액을 계산하지 않습니다.',
    ],
  };
};

const buildParts = (parserNotes) => dedupeParts(
  parserNotes.flatMap((note) => Array.isArray(note.parts) ? note.parts : []),
);

const buildAnalysis = async ({ job, files, parserNotes, tempDir }) => {
  const hasFastPreview = files.some((file) => ['pdf', 'image', 'dxf'].includes(file.kind));
  const sourceOnly = !hasFastPreview;
  const parts = buildParts(parserNotes);
  const combinedText = compactText(parserNotes.map((note) => note.text || note.text_excerpt || '').join('\n'), 16000);
  const material = extractMaterial(combinedText);
  const thickness = extractThickness(combinedText);
  const processing = extractProcessing(combinedText);
  const risks = [
    ...(sourceOnly ? ['원본 파일만으로는 자동 분석이 제한됩니다. PDF/DXF 또는 이미지 미리보기가 필요합니다.'] : []),
    ...(parts.length ? ['자동 추출 치수는 도면 스케일과 실제 파트 여부 검수가 필요합니다.'] : ['파일에서 명확한 파트 치수와 수량을 추출하지 못했습니다.']),
    ...(files.some((file) => file.kind === 'dwg') ? ['DWG는 변환 결과와 PDF/DXF 미리보기를 대조해야 합니다.'] : []),
    '상담원 검수 전 확정 금액으로 사용하지 않습니다.',
  ];

  const analysis = {
    item_name: null,
    dimensions: null,
    quantity: null,
    material,
    thickness,
    color: null,
    finish: null,
    processing,
    observed: { files: files.map((file) => `${file.file_name}(${file.kind})`), parser_notes: parserNotes },
    inferred: {
      engine_status: parts.length ? 'limited' : 'needs_review',
      extraction_mode: 'quote_wizard_worker_text',
      worker_mode: 'quote-wizard-worker-mvp',
      note: '워커가 PDF 텍스트/DXF 엔티티에서 관찰 가능한 치수만 추출했습니다. 샘플 파트나 샘플 금액은 생성하지 않습니다.',
    },
    parts,
    missing_fields: [
      ...(parts.length ? [] : ['파트별 치수', '수량']),
      ...(material ? [] : ['소재']),
      ...(thickness ? [] : ['두께']),
      '제작 품목',
      '원장 규격',
      '커프/재단 여유',
    ],
    production_risks: risks,
    recommended_reply: parts.length
      ? '첨부파일에서 자동 추출 가능한 파트 치수만 정리했습니다. 제작 품목, 수량, 소재/두께, 원장 규격을 확인하면 견적 산출을 진행할 수 있습니다.'
      : '첨부파일은 접수했지만 자동으로 확정 가능한 파트 치수를 찾지 못했습니다. PDF/DXF 미리보기, 제작 품목, 파트별 치수, 수량, 소재/두께를 확인해주세요.',
    confidence: parts.length ? 'medium' : 'low',
  };

  const yieldSnapshot = await runYieldCalculator(parts, analysis.thickness, fallbackYieldSnapshot(parts, sourceOnly));
  const formula = await runFormulaCalculator({ analysis, parts, yieldSnapshot, tempDir, sourceOnly });

  return { analysis, yield: yieldSnapshot, formula, status: formula.status };
};

const handleAnalyze = async (body) => {
  const files = Array.isArray(body.files) ? body.files : [];
  const tempDir = await mkdtemp(join(tmpdir(), 'quote-wizard-'));
  const parserNotes = [];

  try {
    await mkdir(tempDir, { recursive: true });
    for (const file of files) {
      const localPath = await downloadStorageFile(body.bucket, file.file_path, tempDir).catch((error) => {
        parserNotes.push({ file: file.file_name, stage: 'download', error: error.message });
        return null;
      });
      if (!localPath) continue;

      if (file.kind === 'pdf') {
        const text = await extractPdfText(localPath);
        parserNotes.push({
          file: file.file_name,
          kind: 'pdf',
          text,
          text_excerpt: compactText(text, 1200),
          parts: extractDimensionParts(text, `${file.file_name} PDF`),
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
        parserNotes.push({
          file: file.file_name,
          kind: 'image',
          note: '현재 독립 워커는 이미지 OCR/비전 분석을 수행하지 않습니다. Lovable AI Gateway 또는 PDF/DXF 미리보기가 필요합니다.',
        });
      } else {
        parserNotes.push({
          file: file.file_name,
          kind: file.kind || 'unknown',
          note: '현재 독립 워커가 지원하지 않는 파일 형식입니다.',
        });
      }
    }

    return buildAnalysis({ job: body.job, files, parserNotes, tempDir });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

createServer(async (req, res) => {
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
