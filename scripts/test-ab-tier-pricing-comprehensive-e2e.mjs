// Comprehensive E2E: AB-tier pricing + 3% buffer + legacy 3*6 cross-checks.
//
// Source of truth: supabase/migrations/20260720090000_panel_prices_ab_buffer_2026.sql
// This test parses the seed VALUES from that migration and cross-checks every
// row against the live DB, then routes representative combos through the
// actual `calculatePrice` used by the app.
//
// Coverage:
//   [AB]     Every seeded (thickness, size, price) glossy row is active in DB
//            with the exact AB+3% buffered price.
//   [BUFFER] Every active glossy price and every active option surcharge is a
//            multiple of 100 KRW (3%-then-ceil-to-100 invariant).
//   [LEGACY] All rows with size_name = '3*6' in panel_sizes AND in
//            panel_option_surcharges are is_active=false. calculatePrice
//            refuses to price legacy '3*6' from active pricing.
//   [CALC]   calculatePrice(single/double, bright_pigment, satin_astel)
//            reproduces sheet + surcharge exactly. Satin/Astel size limits
//            enforce "not calculable" on disallowed sizes.
//
// Requires managed Supabase psql (PG* env vars) — Lovable Cloud sandbox.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const AB_VERSION_NAME = 'A/B 원판 상한 2026-06-01 + 3%';
const MIGRATION_PATH = 'supabase/migrations/20260720090000_panel_prices_ab_buffer_2026.sql';

if (!process.env.PGHOST) {
  console.error('SKIP: PGHOST not set. Requires managed Supabase psql access.');
  process.exit(2);
}

const psqlJson = (sql) => {
  const out = execFileSync(
    'psql',
    ['-Atqc', `SELECT COALESCE(json_agg(t), '[]'::json) FROM (${sql}) t`],
    { encoding: 'utf8' },
  );
  return JSON.parse(out.trim() || '[]');
};

// ----- 1. Parse seed VALUES from the migration ------------------------------

const sql = readFileSync(MIGRATION_PATH, 'utf8');

/** Extract the tuple list between `seed(...) AS ( VALUES ... )` for a given seed signature. */
const extractSeed = (columnsRegex) => {
  const re = new RegExp(
    String.raw`seed\(\s*${columnsRegex}\s*\)\s*AS\s*\(\s*VALUES\s*([\s\S]*?)\)\s*INSERT`,
    'g',
  );
  const chunks = [];
  let m;
  while ((m = re.exec(sql)) !== null) chunks.push(m[1]);
  return chunks;
};

const parseTuples = (block) => {
  const tuples = [];
  const rowRe = /\(([^()]*)\)/g;
  let m;
  while ((m = rowRe.exec(block)) !== null) {
    const parts = [];
    let buf = '';
    let inStr = false;
    for (const ch of m[1]) {
      if (ch === "'") { inStr = !inStr; buf += ch; continue; }
      if (ch === ',' && !inStr) { parts.push(buf.trim()); buf = ''; continue; }
      buf += ch;
    }
    if (buf.trim()) parts.push(buf.trim());
    tuples.push(parts.map(p => {
      if (p.startsWith("'") && p.endsWith("'")) return p.slice(1, -1).replace(/''/g, "'");
      const n = Number(p);
      return Number.isFinite(n) ? n : p;
    }));
  }
  return tuples;
};

const panelSeedBlocks = extractSeed('thickness,\\s*size_name,\\s*actual_width,\\s*actual_height,\\s*price');
assert.equal(panelSeedBlocks.length, 1, 'expected exactly one glossy panel seed block');
const panelSeed = parseTuples(panelSeedBlocks[0]).map(([thickness, size_name, w, h, price]) =>
  ({ thickness, size_name, actual_width: w, actual_height: h, price }));

const surchargeGlobalBlocks = extractSeed('surcharge_type,\\s*size_name,\\s*cost,\\s*notes');
assert.equal(surchargeGlobalBlocks.length, 1, 'expected exactly one global surcharge seed block');
const surchargeGlobalSeed = parseTuples(surchargeGlobalBlocks[0]).map(([t, s, c]) =>
  ({ quality_id: 'global', surcharge_type: t, size_name: s, cost: c }));

const surchargeQualityBlocks = extractSeed('quality_id,\\s*surcharge_type,\\s*size_name,\\s*cost,\\s*notes');
assert.equal(surchargeQualityBlocks.length, 1, 'expected exactly one quality-scoped surcharge seed block');
const surchargeQualitySeed = parseTuples(surchargeQualityBlocks[0]).map(([q, t, s, c]) =>
  ({ quality_id: q, surcharge_type: t, size_name: s, cost: c }));

// Allowed satin/astel sizes come from the "allowed_sizes(quality, size_name)" CTE.
const allowedBlock = /allowed_sizes\(quality,\s*size_name\)\s*AS\s*\(\s*VALUES\s*([\s\S]*?)\)\s*UPDATE\s+public\.panel_sizes/.exec(sql);
assert.ok(allowedBlock, 'allowed satin/astel sizes block not found in migration');
const allowedSizes = parseTuples(allowedBlock[1]).map(([quality, size_name]) => ({ quality, size_name }));

// ----- 2. Fetch live DB state ----------------------------------------------

const [version] = psqlJson(
  `SELECT id, version_name, is_active FROM public.panel_pricing_versions
   WHERE version_name = '${AB_VERSION_NAME}'`,
);
assert.ok(version, `Pricing version "${AB_VERSION_NAME}" must exist`);
assert.equal(version.is_active, true, 'AB version must be the active one');

const masters = psqlJson(
  `SELECT id, quality::text AS quality FROM public.panel_masters
   WHERE quality::text IN ('glossy-color','satin-color','astel-color')`,
);
const masterByQuality = Object.fromEntries(masters.map(m => [m.quality, m.id]));
assert.ok(masterByQuality['glossy-color'], 'glossy-color master required');

const glossySizes = psqlJson(
  `SELECT thickness, size_name, price, is_active
   FROM public.panel_sizes
   WHERE panel_master_id = '${masterByQuality['glossy-color']}'`,
);
const satinSizes = masterByQuality['satin-color'] ? psqlJson(
  `SELECT thickness, size_name, price, is_active FROM public.panel_sizes
   WHERE panel_master_id = '${masterByQuality['satin-color']}'`) : [];
const astelSizes = masterByQuality['astel-color'] ? psqlJson(
  `SELECT thickness, size_name, price, is_active FROM public.panel_sizes
   WHERE panel_master_id = '${masterByQuality['astel-color']}'`) : [];

const optionSurchargesData = psqlJson(
  `SELECT quality_id, surcharge_type, size_name, cost, is_active
   FROM public.panel_option_surcharges`,
);

// ----- 3. [AB] Cross-check every seed row against DB -----------------------

const panelByKey = new Map(
  glossySizes.map(r => [`${r.thickness}|${r.size_name}`, r]),
);
const abFailures = [];
for (const seed of panelSeed) {
  const key = `${seed.thickness}|${seed.size_name}`;
  const row = panelByKey.get(key);
  if (!row) { abFailures.push({ key, reason: 'missing in DB' }); continue; }
  if (row.price !== seed.price) {
    abFailures.push({ key, reason: `price mismatch: seed=${seed.price} db=${row.price}` });
  }
  // Legacy 3*6 in seed exists but must be deactivated by the tail UPDATE.
  const expectActive = seed.size_name !== '3*6';
  if (row.is_active !== expectActive) {
    abFailures.push({ key, reason: `is_active=${row.is_active} expected ${expectActive}` });
  }
}
assert.equal(abFailures.length, 0,
  `[AB] seed→DB cross-check failed:\n${JSON.stringify(abFailures.slice(0, 10), null, 2)}`);

// Every global surcharge seed row must be in DB and active (except size_name='3*6' which is deactivated).
const surchargeByKey = new Map(
  optionSurchargesData.map(r => [`${r.quality_id}|${r.surcharge_type}|${r.size_name}`, r]),
);
const surchargeFailures = [];
for (const seed of [...surchargeGlobalSeed, ...surchargeQualitySeed]) {
  const key = `${seed.quality_id}|${seed.surcharge_type}|${seed.size_name}`;
  const row = surchargeByKey.get(key);
  if (!row) { surchargeFailures.push({ key, reason: 'missing' }); continue; }
  if (row.cost !== seed.cost) {
    surchargeFailures.push({ key, reason: `cost mismatch: seed=${seed.cost} db=${row.cost}` });
  }
  const expectActive = seed.size_name !== '3*6';
  if (row.is_active !== expectActive) {
    surchargeFailures.push({ key, reason: `is_active=${row.is_active} expected ${expectActive}` });
  }
}
assert.equal(surchargeFailures.length, 0,
  `[AB] surcharge seed→DB cross-check failed:\n${JSON.stringify(surchargeFailures.slice(0, 10), null, 2)}`);

// ----- 4. [BUFFER] Every active AB price/surcharge rounded to 100 KRW ------

const nonRoundedPanels = glossySizes.filter(r => r.is_active && r.price % 100 !== 0);
assert.equal(nonRoundedPanels.length, 0,
  `[BUFFER] active glossy prices must be multiples of 100 KRW (3%-then-ceil invariant): ${JSON.stringify(nonRoundedPanels.slice(0, 5))}`);

const nonRoundedSurcharges = optionSurchargesData.filter(r => r.is_active && r.cost % 100 !== 0);
assert.equal(nonRoundedSurcharges.length, 0,
  `[BUFFER] active surcharges must be multiples of 100 KRW: ${JSON.stringify(nonRoundedSurcharges.slice(0, 5))}`);

// ----- 5. [LEGACY] 3*6 fully deactivated -----------------------------------

const legacyPanels = glossySizes.filter(r => r.size_name === '3*6' && r.is_active);
assert.equal(legacyPanels.length, 0,
  `[LEGACY] legacy '3*6' panel_sizes rows must be deactivated. Found active: ${legacyPanels.length}`);

const legacySurcharges = optionSurchargesData.filter(r => r.size_name === '3*6' && r.is_active);
assert.equal(legacySurcharges.length, 0,
  `[LEGACY] legacy '3*6' surcharges must be deactivated. Found active: ${legacySurcharges.length}`);

// Also verify that at least 소3*6 / 대3*6 are the replacement selections.
const active36Replacements = new Set(
  glossySizes.filter(r => r.is_active && /3\*6$/.test(r.size_name)).map(r => r.size_name),
);
assert.ok(active36Replacements.has('소3*6') && active36Replacements.has('대3*6'),
  `[LEGACY] active replacements 소3*6 and 대3*6 must exist. Got: ${[...active36Replacements].join(',')}`);
assert.ok(!active36Replacements.has('3*6'),
  `[LEGACY] '3*6' must not be in active replacement set`);

// ----- 6. Bundle calculatePrice and route representative combos -----------

const projectRoot = process.cwd();
const tempDir = await mkdtemp(path.join(tmpdir(), 'acbank-ab-comp-'));
const outfile = path.join(tempDir, 'calc.mjs');
const require = createRequire(import.meta.url);

const loadEsbuild = async () => {
  try { return await import('esbuild'); }
  catch (e) {
    try {
      const p = require.resolve('lovable-tagger/package.json');
      return await import(pathToFileURL(path.join(path.dirname(p), 'node_modules', 'esbuild', 'lib', 'main.js')).href);
    } catch { throw e; }
  }
};

const resolveSourcePath = async (p) => {
  for (const c of [p, `${p}.ts`, `${p}.tsx`, `${p}.js`, path.join(p, 'index.ts'), path.join(p, 'index.tsx')]) {
    try { await access(c); return c; } catch {}
  }
  return p;
};

let calculatePrice;
let failed = false;
try {
  const { build } = await loadEsbuild();
  await build({
    entryPoints: [path.join(projectRoot, 'src/utils/priceCalculations.ts')],
    outfile, bundle: true, platform: 'node', format: 'esm', target: 'node20', logLevel: 'silent',
    plugins: [{
      name: 'tsconfig-paths-lite',
      setup(b) {
        b.onResolve({ filter: /^@\// }, async args => ({
          path: await resolveSourcePath(path.join(projectRoot, 'src', args.path.slice(2))),
        }));
      },
    }],
  });
  ({ calculatePrice } = await import(pathToFileURL(outfile).href));

  const panelSizesData = glossySizes;

  // 6a. [AB+CALC] Sweep every active glossy seed row through the calculator.
  let calcMismatches = [];
  for (const seed of panelSeed) {
    if (seed.size_name === '3*6') continue; // deactivated
    const r = calculatePrice(
      'casting', 'glossy-color', seed.thickness, seed.size_name, '단면',
      undefined, undefined, 0,
      { panelSizesData, optionSurchargesData },
    );
    if (r.status !== 'calculable' || r.totalPrice !== seed.price) {
      calcMismatches.push({ ...seed, status: r.status, total: r.totalPrice });
    }
  }
  assert.equal(calcMismatches.length, 0,
    `[CALC] glossy single-side sweep mismatch (first 5): ${JSON.stringify(calcMismatches.slice(0, 5), null, 2)}`);
  console.log(`[CALC] glossy single-side sweep: ${panelSeed.filter(s => s.size_name !== '3*6').length} combos ok`);

  // 6b. [CALC] Double surface adds the exact global double_surface surcharge.
  const doubleCases = [
    ['5T', '대3*6'], ['5T', '4*8'], ['10T', '대3*6'], ['3T', '4*8'],
  ];
  for (const [t, s] of doubleCases) {
    const sheet = panelSeed.find(p => p.thickness === t && p.size_name === s).price;
    const surcharge = surchargeGlobalSeed.find(x => x.surcharge_type === 'double_surface' && x.size_name === s).cost;
    const r = calculatePrice('casting', 'glossy-color', t, s, '양면', undefined, undefined, 0,
      { panelSizesData, optionSurchargesData });
    assert.equal(r.status, 'calculable', `[CALC] double ${t} ${s} status`);
    assert.equal(r.totalPrice, sheet + surcharge,
      `[CALC] double ${t} ${s}: expected ${sheet}+${surcharge}=${sheet + surcharge}, got ${r.totalPrice}`);
  }

  // 6c. [CALC] Bright pigment surcharge applied for bright color type.
  const brightSize = '대3*6', brightThk = '5T';
  const brightSheet = panelSeed.find(p => p.thickness === brightThk && p.size_name === brightSize).price;
  const brightSurcharge = surchargeGlobalSeed.find(
    x => x.surcharge_type === 'bright_pigment' && x.size_name === brightSize,
  ).cost;
  const brightRes = calculatePrice(
    'casting', 'glossy-color', brightThk, brightSize, '단면',
    '진백', undefined, 0,
    { panelSizesData, optionSurchargesData },
  );
  assert.equal(brightRes.status, 'calculable', '[CALC] bright pigment status');
  assert.ok(
    brightRes.totalPrice >= brightSheet + brightSurcharge,
    `[CALC] bright pigment: expected total >= ${brightSheet + brightSurcharge}, got ${brightRes.totalPrice}`,
  );
  assert.ok(
    brightRes.lineItems.some(li => li.amount === brightSurcharge),
    `[CALC] bright pigment surcharge line item ${brightSurcharge} not found`,
  );

  // 6d. [LEGACY+CALC] legacy 3*6 must not be calculable from active pricing.
  const legacyRes = calculatePrice(
    'casting', 'glossy-color', '5T', '3*6', '단면', undefined, undefined, 0,
    { panelSizesData, optionSurchargesData },
  );
  assert.notEqual(legacyRes.status, 'calculable',
    '[LEGACY] legacy 3*6 must not be calculable');

  // 6e. [CALC] Satin/Astel size restriction — allowed vs disallowed.
  if (masterByQuality['satin-color']) {
    const satinAllowed = allowedSizes.filter(a => a.quality === 'satin-color').map(a => a.size_name);
    const satinActiveSizes = new Set(satinSizes.filter(r => r.is_active).map(r => r.size_name));
    for (const s of satinAllowed) {
      assert.ok(satinActiveSizes.has(s), `[CALC] satin-color size ${s} must be active in DB`);
    }
    const disallowedSatin = satinSizes.filter(r => r.is_active && !satinAllowed.includes(r.size_name));
    assert.equal(disallowedSatin.length, 0,
      `[CALC] satin-color must not have active sizes outside allowed list: ${JSON.stringify(disallowedSatin.slice(0, 5))}`);
  }
  if (masterByQuality['astel-color']) {
    const astelAllowed = allowedSizes.filter(a => a.quality === 'astel-color').map(a => a.size_name);
    const astelActiveSizes = new Set(astelSizes.filter(r => r.is_active).map(r => r.size_name));
    for (const s of astelAllowed) {
      assert.ok(astelActiveSizes.has(s), `[CALC] astel-color size ${s} must be active in DB`);
    }
    const disallowedAstel = astelSizes.filter(r => r.is_active && !astelAllowed.includes(r.size_name));
    assert.equal(disallowedAstel.length, 0,
      `[CALC] astel-color must not have active sizes outside allowed list: ${JSON.stringify(disallowedAstel.slice(0, 5))}`);
  }

  // ----- Summary -----------------------------------------------------------
  console.log('\nAB-tier + buffer + legacy 3*6 comprehensive E2E: ALL PASSED');
  console.log(`  version:                   ${version.version_name} (active=${version.is_active})`);
  console.log(`  seed → DB glossy rows:     ${panelSeed.length} verified`);
  console.log(`  seed → DB surcharge rows:  ${surchargeGlobalSeed.length + surchargeQualitySeed.length} verified`);
  console.log(`  buffer 100-KRW rounded:    ${glossySizes.filter(r => r.is_active).length} panels + ${optionSurchargesData.filter(r => r.is_active).length} surcharges`);
  console.log(`  legacy 3*6 deactivated:    panel_sizes=${glossySizes.filter(r => r.size_name === '3*6').length} rows, option_surcharges=${optionSurchargesData.filter(r => r.size_name === '3*6').length} rows (all is_active=false)`);
} catch (err) {
  failed = true;
  console.error('\nAB-tier comprehensive E2E FAILED');
  console.error(err instanceof Error ? err.stack || err.message : err);
} finally {
  await rm(tempDir, { recursive: true, force: true });
  if (failed) process.exit(1);
}
