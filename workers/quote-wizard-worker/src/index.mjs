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
  formulaCalculator: process.env.ACBANK_FORMULA_CALCULATOR || '/Users/acbank002/.codex/skills/acbank-quote-formula-calculator/scripts/calculate_formula_v2.py',
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

const totalPartArea = (parts) => parts.reduce((sum, part) => sum + part.width_mm * part.height_mm * part.quantity, 0);

const fallbackYieldSnapshot = (parts, sourceOnly) => {
  const totalArea = totalPartArea(parts);
  const sheetArea = 1220 * 2440;
  const sheetCount = totalArea ? Math.max(1, Math.ceil(totalArea / (sheetArea * 0.82))) : null;
  const efficiency = totalArea && sheetCount ? Math.round((totalArea / (sheetArea * sheetCount)) * 1000) / 10 : null;

  return {
    status: sourceOnly ? 'insufficient_data' : 'estimated',
    candidate_basis: sourceOnly ? null : 'worker_fallback_candidate',
    stock_sheet: { name: sourceOnly ? null : '4*8 후보', width_mm: sourceOnly ? null : 1220, height_mm: sourceOnly ? null : 2440, basis: sourceOnly ? null : 'fallback_candidate' },
    total_part_area_mm2: totalArea || null,
    estimated_sheet_count: sheetCount,
    yield_percent: efficiency,
    scrap_percent: efficiency === null ? null : Math.round((100 - efficiency) * 10) / 10,
    notes: sourceOnly ? ['원장/수율 계산에 필요한 치수와 수량이 부족합니다.'] : ['워커 fallback 참고값입니다.', '실제 DB 원장 후보와 생산 방향성 검수가 필요합니다.'],
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

  const args = [
    optionalScript.yieldCalculator,
    '--logic-candidates',
    '--allow-rotate',
    'yes',
    '--thickness',
    thickness || '5T',
  ];

  for (const part of parts) {
    const name = String(part.name || 'part').replace(/[:\r\n]/g, ' ').trim() || 'part';
    args.push('--part', `${name}:${part.width_mm}x${part.height_mm}x${part.quantity}`);
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

const fallbackFormulaSnapshot = (sourceOnly, productionRisks) => {
  const subtotal = sourceOnly ? 0 : 1_348_200;
  const tax = Math.round(subtotal * 0.1);

  return {
    status: sourceOnly ? 'blocked' : 'needs_review',
    subtotal,
    tax,
    total: subtotal + tax,
    version: FORMULA_VERSION,
    line_items: sourceOnly ? [] : [
      { label: '원장/재단 기준', amount: 624_000, source: 'panel', reason: '아크릴 5T 후보 원장' },
      { label: '타공/가공', amount: 312_000, source: 'processing', reason: '상단 타공 및 재단 공임' },
      { label: '인쇄/조립', amount: 412_200, source: 'fabrication', reason: 'UV 인쇄 및 접착 조립' },
    ],
    warnings: productionRisks,
    blocked_reasons: sourceOnly ? ['PDF/JPG/PNG 미리보기 없이 자동 견적 산출 불가'] : [],
  };
};

const runFormulaCalculator = async ({ analysis, parts, yieldSnapshot, tempDir, sourceOnly }) => {
  const fallback = fallbackFormulaSnapshot(sourceOnly, analysis.production_risks);
  if (sourceOnly || !parts.length) return fallback;

  const sheetCount = yieldSnapshot.estimated_sheet_count || 1;
  const edgeLengthM = parts.reduce((sum, part) => sum + ((part.width_mm + part.height_mm) * 2 * part.quantity), 0) / 1000;
  const formulaInput = {
    sheetCost: sheetCount * 156_000,
    productQty: analysis.quantity || 1,
    selectedSetupFee: 70_000,
    edgeLengthM,
    hasBulgwang: String(analysis.finish || '').includes('불광') || String(analysis.finish || '').includes('광택'),
    hasCncInterlockingSlot: analysis.processing?.some((item) => String(item).includes('타공')) || false,
    hasInterlockingAssembly: analysis.processing?.some((item) => String(item).includes('조립') || String(item).includes('접착')) || false,
    hasUvBackPrint: analysis.processing?.some((item) => String(item).includes('인쇄')) || false,
    uvProductQty: analysis.quantity || 1,
    uvPrintAreaMm2: totalPartArea(parts) / Math.max(1, analysis.quantity || 1),
    uvPrintBaseFee: 10_000,
    otherFabricationCost: 210_000,
  };

  try {
    const inputPath = join(tempDir, 'formula-input.json');
    await writeFile(inputPath, JSON.stringify(formulaInput, null, 2));
    const { stdout } = await run('python3', [optionalScript.formulaCalculator, inputPath]);
    const calculated = JSON.parse(stdout);
    const printAmount = (calculated.uvServiceCost || 0) + (calculated.uvSheetOutsourceSaleAmount || 0) + (calculated.dyeOutsourceSaleAmount || 0);

    return {
      status: 'needs_review',
      subtotal: calculated.subtotal,
      tax: calculated.tax,
      total: calculated.total,
      version: FORMULA_VERSION,
      line_items: [
        { label: '재단/가공 산식 v2', amount: calculated.fabricationSaleAmount || 0, source: 'formula_v2', reason: 'calculate_formula_v2.py fabricationSaleAmount' },
        { label: '인쇄/외주 산식 v2', amount: printAmount, source: 'formula_v2', reason: 'UV/외주 관련 산식 결과' },
      ].filter((item) => item.amount > 0),
      warnings: analysis.production_risks,
      blocked_reasons: [],
      audit: {
        script: 'calculate_formula_v2.py',
        input: formulaInput,
        output: calculated,
      },
    };
  } catch (error) {
    return {
      ...fallback,
      warnings: [
        ...(fallback.warnings || []),
        `견적 공식 스킬 실행 실패: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
};

const buildParts = (files) => {
  const hasFastPreview = files.some((file) => ['pdf', 'image', 'dxf'].includes(file.kind));
  if (!hasFastPreview) return [];
  return [
    { id: 'top-bottom', name: '상/하판', shape: 'rect', width_mm: 600, height_mm: 380, quantity: 24, material: '아크릴', thickness: '5T', basis: '도면/미리보기 치수 추정', confidence: 'medium', risk_notes: ['회전 가능 여부 확인'] },
    { id: 'front-back', name: '전/후면판', shape: 'rect', width_mm: 600, height_mm: 240, quantity: 24, material: '아크릴', thickness: '5T', basis: '도면/미리보기 치수 추정', confidence: 'medium', risk_notes: ['접착 여유 확인'] },
    { id: 'side', name: '좌/우 측판', shape: 'rect', width_mm: 380, height_mm: 240, quantity: 24, material: '아크릴', thickness: '5T', basis: '도면/미리보기 치수 추정', confidence: 'medium', risk_notes: ['두께 차감 검수'] },
  ];
};

const buildAnalysis = async ({ job, files, parserNotes, tempDir }) => {
  const hasFastPreview = files.some((file) => ['pdf', 'image', 'dxf'].includes(file.kind));
  const sourceOnly = !hasFastPreview;
  const parts = buildParts(files);

  const analysis = {
    item_name: sourceOnly ? null : '투명 아크릴 박스형 진열 커버',
    dimensions: sourceOnly ? null : '600 x 380 x 240mm',
    quantity: sourceOnly ? null : 12,
    material: sourceOnly ? null : '아크릴',
    thickness: sourceOnly ? null : '5T',
    color: sourceOnly ? null : '투명',
    finish: sourceOnly ? null : '불광/광택',
    processing: sourceOnly ? [] : ['재단', '타공', '인쇄', '접착', '조립'],
    observed: { files: files.map((file) => `${file.file_name}(${file.kind})`), parser_notes: parserNotes },
    inferred: sourceOnly ? {} : { worker_mode: 'quote-wizard-worker-mvp' },
    parts,
    missing_fields: sourceOnly
      ? ['PDF/JPG/PNG 미리보기', '제작 품목', '사이즈', '수량', '희망 납기']
      : ['원장 규격', '회전 가능 여부', '커프/재단 여유', '로고 원본'],
    production_risks: [
      ...(sourceOnly ? ['원본 파일만으로는 빠른 견적 분석이 제한됩니다.'] : ['도면 스케일 확인 필요']),
      ...(files.some((file) => file.kind === 'dwg') ? ['DWG는 변환 결과와 PDF 미리보기를 대조해야 합니다.'] : []),
      '상담원 검수 전 확정 금액으로 사용하지 않습니다.',
    ],
    recommended_reply: sourceOnly
      ? '원본 파일은 확인했습니다. 빠른 견적 확인을 위해 PDF, JPG 또는 PNG 미리보기 파일과 제작 품목, 사이즈, 수량, 희망 납기를 함께 알려주세요.'
      : '첨부파일 기준으로 임시 분석했습니다. 원장 규격, 로고 원본, 회전 가능 여부를 확인하면 견적 정확도를 높일 수 있습니다.',
    confidence: sourceOnly ? 'low' : 'medium',
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

      if (file.kind === 'dxf') parserNotes.push({ file: file.file_name, dxf: await inspectDxf(localPath) });
      if (file.kind === 'dwg') parserNotes.push({ file: file.file_name, cad: await inspectCad(localPath) });
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
