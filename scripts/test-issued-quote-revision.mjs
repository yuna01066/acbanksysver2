// Synthetic data only. Does not read environment credentials or contact Supabase.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const esbuild = await import(pathToFileURL(path.join(path.dirname(require.resolve('lovable-tagger/package.json')), 'node_modules/esbuild/lib/main.js')));
const temp = await mkdtemp(path.join(tmpdir(), 'issued-revision-test-'));
const src = path.resolve('src');
try {
  await esbuild.build({ entryPoints: [path.join(src, 'utils/issuedQuoteRevision.ts')], outfile: path.join(temp, 'revision.mjs'), bundle: true, format: 'esm', platform: 'node', alias: { '@': src } });
  const { restorePanelCalculation, hasPanelCalculationChanges, hasQuotePriceChanges, hasQuoteSpecChanges, calculateQuoteTotals, quoteSpecNames } = await import(pathToFileURL(path.join(temp, 'revision.mjs')));
  const sizes = [{ size: '4*8 (1220*2440)', quantity: 2, surface: '양면', colorMixingCost: 30000 }, { size: '대3*6 (920*1820)', quantity: 1, surface: '단면', colorMixingCost: 0 }];
  const item = { id: 'one', material: '아크릴 판', quality: 'Clear (클리어)', thickness: '5T', selectedColor: 'AC-A001', colorType: '',
    size: sizes.map(s => `${s.size} (${s.quantity}개)`).join(', '), surface: sizes.map(s => `${s.size}: ${s.surface}`).join(', '),
    processing: 'raw-only', totalPrice: 120000, quantity: 3, calculationSnapshot: { selectedOptions: {
      factory: 'jangwon', materialId: 'casting', qualityId: 'glossy-color', thickness: '5T', sizes, selectedColor: 'AC-A001', colorType: '', processing: 'raw-only', adhesion: 'none',
      additionalOptions: { packing: 2 }, qty: 7, bevelLengthM: 0, polishedEdgeLengthM: 2.5, laserHoles: 0, isComplex: false,
      edgeFinishing: false, bulgwang: false, tapung: false, mugwangPainting: false,
    } } };
  const original = structuredClone(item);
  const restored = restorePanelCalculation(item);
  assert.deepEqual(restored.issues, []); assert.deepEqual(restored.confirmation, []);
  assert.equal(restored.inputs.qty, 7); assert.equal(restored.inputs.selectedSizes[0].quantity, 2);
  assert.equal(restored.inputs.selectedSizes[1].colorMixingCost, 0);
  assert.equal(restored.inputs.selectedAdditionalOptions.packing, 2);
  assert.deepEqual(calculateQuoteTotals([item]), { subtotal: 360000, tax: 36000, total: 396000 });
  assert.equal(hasQuotePriceChanges([item], [{ ...item, itemTitle: 'title only' }]), false);
  assert.equal(hasQuoteSpecChanges([item], [{ ...item, selectedColor: 'NEW' }]), true);
  assert.equal(hasQuotePriceChanges([item], [{ ...item, quantity: 4 }]), true);
  assert.equal(hasQuotePriceChanges([item], [structuredClone(item)]), false);
  assert.deepEqual(quoteSpecNames({ ...item, specDisplay: { qualityName: '고객 재질', colorName: '고객 컬러' } }), { quality: '고객 재질', color: '고객 컬러' });
  assert.equal(restorePanelCalculation({ ...item, calculationSnapshot: undefined }).inputs, null);
  const missing = structuredClone(item); delete missing.calculationSnapshot.selectedOptions.additionalOptions;
  assert.equal(restorePanelCalculation(missing).inputs, null);
  const malformed = structuredClone(item); malformed.calculationSnapshot.selectedOptions.sizes = [null];
  assert.equal(restorePanelCalculation(malformed).inputs, null);
  const mismatch = { ...item, size: '임의 변경 표시' };
  assert.ok(restorePanelCalculation(mismatch).confirmation.length);
  const unknownAdhesion = structuredClone(item); delete unknownAdhesion.calculationSnapshot.selectedOptions.adhesion;
  assert.ok(restorePanelCalculation(unknownAdhesion).confirmation.length);
  assert.throws(() => calculateQuoteTotals([{ ...item, totalPrice: NaN }]));
  assert.deepEqual(item, original, 'restoration must not mutate the original quote');
  assert.equal(hasPanelCalculationChanges(item, { ...item, totalPrice: 999999, itemTitle: 'title' }), false);
  const changedCondition = structuredClone(item); changedCondition.calculationSnapshot.selectedOptions.qty = 8;
  assert.equal(hasPanelCalculationChanges(item, changedCondition), true);
  console.log('Issued quote calculation restoration / totals / display / no-op repricing checks passed');

  const pglite = process.env.ACBANK_TEST_PGLITE;
  if (!pglite) { console.log('DB tests skipped: set ACBANK_TEST_PGLITE to a temporary PGlite module path.'); process.exitCode = 1; }
  else {
    const { PGlite } = await import(pathToFileURL(pglite));
    const db = new PGlite();
    const owner = '00000000-0000-4000-8000-000000000001';
    const other = '00000000-0000-4000-8000-000000000002';
    const quoteId = '00000000-0000-4000-8000-000000000003';
    try {
      await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
        CREATE TABLE profiles(id uuid PRIMARY KEY, full_name text);
        CREATE TABLE panel_masters(id uuid PRIMARY KEY, quality text);
        CREATE TABLE panel_pricing_versions(id uuid PRIMARY KEY, is_active boolean);
        CREATE TABLE color_options(id uuid PRIMARY KEY, panel_master_id uuid, color_name text, is_active boolean, is_producible boolean);
        CREATE TABLE saved_quotes(id uuid PRIMARY KEY, user_id uuid, quote_number text, updated_at timestamptz DEFAULT clock_timestamp(),
          project_name text, quote_date_display timestamptz, valid_until text, delivery_period text, payment_condition text,
          recipient_name text, recipient_company text, recipient_phone text, recipient_email text, recipient_address text, recipient_memo text,
          quote_notes text, desired_delivery_date timestamptz, issuer_id uuid, issuer_name text, issuer_email text, issuer_phone text,
          attachments jsonb, items jsonb, calculation_snapshot jsonb, subtotal numeric, tax numeric, total numeric);
        CREATE TABLE quote_versions(id uuid DEFAULT gen_random_uuid(), quote_id uuid, version_number integer, snapshot jsonb, change_summary text, changed_by uuid, changed_by_name text);
        CREATE TABLE quote_activity_history(id uuid DEFAULT gen_random_uuid(), quote_id uuid, action_type text, actor_id uuid, actor_name text, memo text, metadata jsonb);
        GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
        GRANT SELECT,UPDATE,INSERT ON ALL TABLES IN SCHEMA public TO authenticated;
        ALTER TABLE saved_quotes ENABLE ROW LEVEL SECURITY;
        CREATE POLICY owner_read ON saved_quotes FOR SELECT TO authenticated USING(user_id=auth.uid());
        CREATE POLICY owner_update ON saved_quotes FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
        ALTER TABLE quote_versions ENABLE ROW LEVEL SECURITY;
        CREATE POLICY history_read ON quote_versions FOR SELECT TO authenticated USING(changed_by=auth.uid());
        CREATE POLICY history_write ON quote_versions FOR INSERT TO authenticated WITH CHECK(changed_by=auth.uid());
        ALTER TABLE quote_activity_history ENABLE ROW LEVEL SECURITY;
        CREATE POLICY activity_read ON quote_activity_history FOR SELECT TO authenticated USING(actor_id=auth.uid());
        CREATE POLICY activity_write ON quote_activity_history FOR INSERT TO authenticated WITH CHECK(actor_id=auth.uid());
        INSERT INTO profiles VALUES ('${owner}','Test owner');
        INSERT INTO panel_masters VALUES ('${owner}', 'glossy-color');
        INSERT INTO panel_pricing_versions VALUES ('${owner}', true);
        INSERT INTO color_options VALUES ('${owner}', '${owner}', 'AC-NEW 신규 컬러', true, true);`);
      await db.exec(await readFile('supabase/migrations/20260923090000_issued_quote_revision.sql', 'utf8'));
      const untouchedItem = { ...structuredClone(item), id: 'untouched', material: '제품 제작', totalPrice: 25000, quantity: 2 };
      await db.query('INSERT INTO saved_quotes(id,user_id,quote_number,items,subtotal,tax,total) VALUES($1,$2,$3,$4,360000,36000,396000)', [quoteId, owner, 'TEST-ONLY', JSON.stringify([item, untouchedItem])]);
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [owner]);
      await db.exec('SET ROLE authenticated');
      const current = async () => (await db.query('SELECT updated_at::text AS stamp, * FROM saved_quotes WHERE id=$1', [quoteId])).rows[0];
      const revision = (stamp, patch) => db.query('SELECT save_issued_quote_revision($1,$2,$3) AS result', [quoteId, stamp, JSON.stringify(patch)]);
      const before = await current();
      await revision(before.stamp, { project_name: 'title changed' });
      const after = await current();
      assert.equal(after.total, before.total); assert.deepEqual(after.items, before.items);
      assert.notEqual(after.stamp, before.stamp);
      assert.deepEqual((await db.query('SELECT snapshot FROM quote_versions')).rows[0].snapshot.items, before.items);
      assert.equal((await db.query('SELECT * FROM quote_activity_history')).rows.length, 1);
      await assert.rejects(revision(before.stamp, { project_name: 'stale' }), /다른 사용자/);
      await assert.rejects(revision(after.stamp, { user_id: other }), /허용되지/);
      await assert.rejects(revision(after.stamp, { items: [{ ...item, quantity: -1 }] }), /수량/);
      await assert.rejects(revision(after.stamp, { items: [item, item] }), /중복/);
      await assert.rejects(revision(after.stamp, { items: [{ ...item, quality: 'fake' }] }), /등록 계산/);
      assert.equal((await current()).stamp, after.stamp);
      const repriced = structuredClone(item);
      repriced.selectedColor = 'AC-NEW'; repriced.totalPrice = 150000;
      repriced.breakdown = [{ label: '원판', price: 150000 }];
      repriced.specDisplay = { qualityName: '고객 재질', colorName: '고객 색상' };
      Object.assign(repriced.calculationSnapshot, { totalPrice: 150000, breakdown: repriced.breakdown, calculationStatus: 'calculable', pricingVersion: { id: owner } });
      Object.assign(repriced.calculationSnapshot.selectedOptions, { colorId: owner, selectedColor: 'AC-NEW', qualityName: item.quality });
      const repricingPatch = { items: [repriced, untouchedItem], subtotal: 500000, tax: 50000, total: 550000, calculation_snapshot: { manualTotalAdjustment: null } };
      await assert.rejects(revision(after.stamp, { ...repricingPatch, subtotal: 440000, total: 490000 }), /품목 합계/);
      await assert.rejects(revision(after.stamp, { ...repricingPatch, calculation_snapshot: { manualTotalAdjustment: { adjustedTotal: 495000 } } }), /수동 총액/);
      await revision(after.stamp, repricingPatch);
      const repricedState = await current();
      assert.equal(repricedState.total, '550000');
      assert.deepEqual(repricedState.items[1], untouchedItem, 'unchanged items retain every saved field');
      assert.equal(repricedState.items[0].id, item.id);
      assert.equal(repricedState.items[0].quantity, 3);
      assert.equal((await db.query('SELECT * FROM quote_versions')).rows.length, 2);
      await db.exec('RESET ROLE; REVOKE INSERT ON quote_activity_history FROM authenticated; SET ROLE authenticated');
      await assert.rejects(revision(repricedState.stamp, { project_name: 'must rollback' }), /permission denied/);
      assert.equal((await current()).project_name, 'title changed');
      assert.equal((await db.query('SELECT * FROM quote_versions')).rows.length, 2);
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [other]);
      await assert.rejects(revision(after.stamp, { project_name: 'forbidden' }), /권한/);
      await db.exec('RESET ROLE; SET ROLE anon');
      await assert.rejects(revision(after.stamp, { project_name: 'anonymous' }), /permission denied/);
      console.log('Isolated PostgreSQL: atomic history, RLS, conflicts, input validation passed');
    } finally { await db.close(); }
  }
} finally { await rm(temp, { recursive: true, force: true }); }
