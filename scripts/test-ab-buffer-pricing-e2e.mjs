// E2E test: verify that new quote calculations use AB+3% buffered panel prices
// loaded from the production Supabase DB (pricing version "A/B 원판 상한 2026-06-01 + 3%").
//
// Flow:
//   1. Fetch active pricing version + glossy-color panel_sizes + option_surcharges from DB.
//   2. Feed the DB rows into `calculatePrice` (same path used by the app).
//   3. Assert that specific (thickness, size) combos produce the AB+3% price
//      exactly as defined in migration 20260720090000_panel_prices_ab_buffer_2026.sql.
//   4. Also assert that legacy `3*6` size is inactive (no longer selectable).

import assert from 'node:assert/strict';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zwloyqcwyfkimwkohpnd.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || process.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3bG95cWN3eWZraW13a29ocG5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMzgyMDQsImV4cCI6MjA3NDgxNDIwNH0.f9j4PBCLXoNxn7L97d19xYYuKM3ZSzkOkxrgklyeb0I';

const AB_VERSION_NAME = 'A/B 원판 상한 2026-06-01 + 3%';

const restSelect = async (table, params) => {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`REST ${table} ${res.status}: ${await res.text()}`);
  }
  return res.json();
};

// Bundle the TS calculator to node ESM so we can call it as the app does.
const projectRoot = process.cwd();
const tempDir = await mkdtemp(path.join(tmpdir(), 'acbank-ab-e2e-'));
const outfile = path.join(tempDir, 'calc.mjs');
const require = createRequire(import.meta.url);

const loadEsbuild = async () => {
  try { return await import('esbuild'); }
  catch (error) {
    try {
      const taggerPkg = require.resolve('lovable-tagger/package.json');
      const fallback = path.join(path.dirname(taggerPkg), 'node_modules', 'esbuild', 'lib', 'main.js');
      return await import(pathToFileURL(fallback).href);
    } catch { throw error; }
  }
};

const resolveSourcePath = async (p) => {
  for (const c of [p, `${p}.ts`, `${p}.tsx`, `${p}.js`, path.join(p, 'index.ts'), path.join(p, 'index.tsx')]) {
    try { await access(c); return c; } catch {}
  }
  return p;
};

let calculatePrice;
try {
  const { build } = await loadEsbuild();
  await build({
    entryPoints: [path.join(projectRoot, 'src/utils/priceCalculations.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent',
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

  // --- Fetch live DB state ------------------------------------------------
  const versions = await restSelect('panel_pricing_versions', {
    select: 'id,version_name,is_active',
    version_name: `eq.${AB_VERSION_NAME}`,
  });
  assert.ok(versions.length > 0, `Pricing version "${AB_VERSION_NAME}" must exist in DB`);
  const version = versions[0];
  assert.equal(version.is_active, true, `Pricing version "${AB_VERSION_NAME}" must be the active version`);

  const masters = await restSelect('panel_masters', {
    select: 'id,quality',
    quality: 'eq.glossy-color',
  });
  assert.ok(masters.length > 0, 'glossy-color panel_master must exist');
  const glossyMasterId = masters[0].id;

  const panelSizesRaw = await restSelect('panel_sizes', {
    select: 'size_name,thickness,price,is_active,pricing_version_id',
    panel_master_id: `eq.${glossyMasterId}`,
    is_active: 'eq.true',
    limit: '1000',
  });
  const panelSizesData = panelSizesRaw.map(r => ({
    size_name: r.size_name,
    thickness: r.thickness,
    price: r.price,
    is_active: r.is_active,
  }));

  const surchargesRaw = await restSelect('panel_option_surcharges', {
    select: 'quality_id,surcharge_type,size_name,cost,is_active',
    is_active: 'eq.true',
    limit: '1000',
  });
  const optionSurchargesData = surchargesRaw.map(r => ({
    quality_id: r.quality_id,
    surcharge_type: r.surcharge_type,
    size_name: r.size_name,
    cost: r.cost,
    is_active: r.is_active,
  }));

  // --- Assertions on DB pricing shape ------------------------------------
  const findPanel = (thickness, size) => panelSizesData.find(p => p.thickness === thickness && p.size_name === size);

  // Legacy 3*6 must be inactive (i.e. absent from active set).
  const legacy36 = panelSizesData.filter(p => p.size_name === '3*6');
  assert.equal(legacy36.length, 0, 'Legacy "3*6" panel size must be deactivated (not present in active set)');

  // Sample AB+3% expected prices from migration seed values.
  const expectedPanelPrices = [
    ['5T', '소3*6', 46_400],
    ['5T', '대3*6', 53_100],
    ['5T', '4*8',   92_700],
    ['3T', '대3*6', 32_000],
    ['3T', '4*8',   55_700],
    ['10T', '대3*6', 106_700],
    ['10T', '4*8',   185_400],
  ];
  for (const [t, s, expected] of expectedPanelPrices) {
    const row = findPanel(t, s);
    assert.ok(row, `panel_sizes row for ${t} ${s} must exist and be active`);
    assert.equal(row.price, expected, `AB+3% price for ${t} ${s} must be ${expected} (got ${row.price})`);
  }

  // --- Assertions through calculatePrice ---------------------------------
  // Single-sided panel: total should equal the AB+3% sheet price.
  const runSingle = (t, s, expected, label) => {
    const result = calculatePrice(
      'casting', 'glossy-color', t, s, '단면',
      undefined, undefined, 0,
      { panelSizesData, optionSurchargesData },
    );
    assert.equal(result.status, 'calculable', `${label}: expected calculable`);
    assert.equal(result.totalPrice, expected, `${label}: total should be AB+3% price ${expected} (got ${result.totalPrice})`);
    const sheetItem = result.lineItems.find(i => i.source === 'panel');
    assert.ok(sheetItem, `${label}: must have a panel line item`);
    assert.equal(sheetItem.amount, expected, `${label}: panel line item must equal AB+3% price`);
  };

  runSingle('5T', '대3*6', 53_100, 'glossy 5T 대3*6 single');
  runSingle('5T', '4*8',   92_700, 'glossy 5T 4*8 single');
  runSingle('3T', '대3*6', 32_000, 'glossy 3T 대3*6 single');

  // Double-sided panel: total = AB+3% sheet + AB+3% double_surface surcharge.
  const runDouble = (t, s, sheet, surcharge, label) => {
    const result = calculatePrice(
      'casting', 'glossy-color', t, s, '양면',
      undefined, undefined, 0,
      { panelSizesData, optionSurchargesData },
    );
    assert.equal(result.status, 'calculable', `${label}: expected calculable`);
    assert.equal(result.totalPrice, sheet + surcharge,
      `${label}: total should be AB+3% sheet(${sheet}) + double surcharge(${surcharge})`);
  };

  runDouble('5T', '대3*6', 53_100, 3_100, 'glossy 5T 대3*6 double');
  runDouble('5T', '4*8',   92_700, 5_200, 'glossy 5T 4*8 double');

  // Sanity: legacy 3*6 request must fail (deactivated) — calculator falls back
  // to static price or blocks. It must not silently reuse a stale AB price.
  const legacyResult = calculatePrice(
    'casting', 'glossy-color', '5T', '3*6', '단면',
    undefined, undefined, 0,
    { panelSizesData, optionSurchargesData },
  );
  assert.notEqual(legacyResult.status, 'calculable',
    'legacy "3*6" size must not be calculable from active DB pricing (should block or fall back)');

  console.log('AB+3% buffer pricing E2E: all assertions passed');
  console.log(`  - version: ${version.version_name} (active=${version.is_active})`);
  console.log(`  - active glossy-color panel_sizes rows: ${panelSizesData.length}`);
  console.log(`  - active panel_option_surcharges rows: ${optionSurchargesData.length}`);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
