// Synthetic data only. Does not read environment credentials or contact Supabase.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
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
  await esbuild.build({ entryPoints: [path.join(src, 'utils/quoteAmounts.ts')], outfile: path.join(temp, 'amounts.mjs'), bundle: true, format: 'esm', platform: 'node' });
  const { calculateAutomaticQuoteTotals, calculateManualQuoteTotals } = await import(pathToFileURL(path.join(temp, 'amounts.mjs')));
  for (const [amount, expected] of [
    [682800, { subtotal: 682800, tax: 68280, total: 751100 }],
    [682849, { subtotal: 682800, tax: 68280, total: 751100 }],
    [682850, { subtotal: 682900, tax: 68290, total: 751200 }],
    [100000, { subtotal: 100000, tax: 10000, total: 110000 }],
  ]) {
    assert.deepEqual(calculateQuoteTotals([{ totalPrice: amount, quantity: 1 }]), expected);
    assert.deepEqual(calculateAutomaticQuoteTotals([{ totalPrice: amount, quantity: 1 }]), expected);
  }
  assert.deepEqual(calculateManualQuoteTotals(751100), { subtotal: 682818, tax: 68282, total: 751100 });
  for (const amount of [NaN, Infinity, -1]) assert.throws(() => calculateQuoteTotals([{ totalPrice: amount, quantity: 1 }]));
  assert.throws(() => calculateQuoteTotals([{ totalPrice: Number.MAX_VALUE, quantity: 2 }]));
  for (const amount of [NaN, Infinity, -1, 0]) assert.throws(() => calculateManualQuoteTotals(amount));
  // Guard the real entry points against reintroducing independent sum-only formulas.
  for (const file of ['contexts/QuoteContext.tsx', 'pages/InternalQuotePage.tsx', 'pages/SavedQuoteDetailPage.tsx']) {
    assert.match(await readFile(path.join(src, file), 'utf8'), /calculateAutomaticQuoteTotals/);
  }
  const calculator = await readFile(path.join(src, 'components/PanelCalculator.tsx'), 'utf8');
  assert.equal((calculator.match(/calculateQuoteTotals\(items as Quote\[\]\)/g) || []).length, 3, 'calculator revision and both item-add paths share totals');
  assert.match(await readFile(path.join(src, 'components/quote-detail/QuoteTotalSection.tsx'), 'utf8'), /calculateManualQuoteTotals\(total\)/);
  // Exercise the actual issuance persistence payload with an isolated transport stub.
  await esbuild.build({ entryPoints: [path.join(src, 'services/issuedQuoteSaver.ts')], outfile: path.join(temp, 'saver.mjs'), bundle: true, format: 'esm', platform: 'node', alias: { '@': src }, plugins: [{
    name: 'synthetic-persistence',
    setup(build) {
      build.onResolve({ filter: /^@\/(integrations\/supabase\/client|services\/documentFiles|services\/recipientUpsert)$/ }, args => ({ path: args.path, namespace: 'synthetic' }));
      build.onLoad({ filter: /.*/, namespace: 'synthetic' }, args => ({ contents: args.path.endsWith('/client')
        ? `export const supabase = { from(table) { if (table !== 'saved_quotes') throw Error('unexpected table'); return { insert(rows) { globalThis.__syntheticIssuedRows = rows; return { select() { return { single: async () => ({ data: { id: 'synthetic-issued' }, error: null }) }; } }; } }; } };`
        : args.path.endsWith('/documentFiles') ? `export const createDocumentFileRecord = () => { throw Error('unexpected attachment'); };`
        : `export const upsertRecipientFromQuoteRecipient = async () => ({ recipientId: null, status: 'skipped' });`, loader: 'js' }));
    },
  }] });
  const { saveIssuedQuote } = await import(pathToFileURL(path.join(temp, 'saver.mjs')));
  const issuedItems = [{ id: 'synthetic-issued-item', material: '제품 제작', totalPrice: 682800, quantity: 1 }];
  await saveIssuedQuote({ userId: 'synthetic-owner', quotes: issuedItems, recipient: null, quoteNumber: 'SYNTHETIC-ONLY', quoteStyle: 'panel', ...calculateAutomaticQuoteTotals(issuedItems) });
  const issuedRow = globalThis.__syntheticIssuedRows[0];
  for (const values of [issuedRow, issuedRow.calculation_snapshot]) {
    assert.deepEqual([values.subtotal, values.tax, values.total], [682800, 68280, 751100]);
  }
  delete globalThis.__syntheticIssuedRows;
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
      const migrationDir = process.env.ACBANK_TEST_MIGRATION_DIR || 'supabase/migrations';
      const migrations = (await readdir(migrationDir)).filter(name => /issued_quote_(revision|rounding)/.test(name) && name.endsWith('.sql')).sort();
      assert.ok(migrations.length);
      for (const name of migrations) await db.exec(await readFile(path.join(migrationDir, name), 'utf8'));
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
      await db.exec('RESET ROLE; GRANT INSERT ON quote_activity_history TO authenticated');
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [owner]);
      const syntheticItem = { id: 'synthetic', material: '제품 제작', totalPrice: 682800, quantity: 1 };
      for (const total of [751100, 751080, 751099, 751081]) {
        await db.query('UPDATE saved_quotes SET items=$1,subtotal=682800,tax=68280,total=$2,calculation_snapshot=NULL WHERE id=$3', [JSON.stringify([syntheticItem]), total, quoteId]);
        await db.exec('SET ROLE authenticated');
        const saved = await current();
        const action = revision(saved.stamp, { project_name: 'synthetic title', recipient_memo: 'synthetic memo', items: [{ ...syntheticItem, itemTitle: 'title only' }] });
        if ([751100, 751080].includes(total)) {
          await action;
          const result = await current();
          assert.deepEqual([result.subtotal, result.tax, result.total], ['682800', '68280', String(total)]);
        } else await assert.rejects(action, /견적 금액/);
        await db.exec('RESET ROLE');
      }
      const seed = async (amounts = { subtotal: 682800, tax: 68280, total: 751100 }, snapshot = null) => {
        await db.exec('RESET ROLE');
        await db.query('UPDATE saved_quotes SET items=$1,subtotal=$2,tax=$3,total=$4,calculation_snapshot=$5 WHERE id=$6', [JSON.stringify([syntheticItem]), amounts.subtotal, amounts.tax, amounts.total, JSON.stringify(snapshot), quoteId]);
        await db.exec('SET ROLE authenticated');
        return current();
      };
      for (const amount of [682849, 682850, 100000]) {
        const saved = await seed();
        const items = [{ ...syntheticItem, totalPrice: amount }];
        const totals = calculateQuoteTotals(items);
        await revision(saved.stamp, { items, ...totals });
        const result = await current();
        assert.deepEqual([result.subtotal, result.tax, result.total], Object.values(totals).map(String));
        await revision(result.stamp, { recipient_memo: 'unchanged financial values' });
        assert.equal((await current()).total, result.total);
      }
      // Changed quantity, unit price and added/deleted items must recalculate, even without a panel spec edit.
      for (const items of [
        [{ ...syntheticItem, quantity: 2 }],
        [{ ...syntheticItem, totalPrice: 682850 }],
        [syntheticItem, { ...syntheticItem, id: 'added', totalPrice: 100000 }],
      ]) {
        const saved = await seed();
        await assert.rejects(revision(saved.stamp, { items }), /품목 합계/);
        await revision(saved.stamp, { items, ...calculateQuoteTotals(items) });
        if (items.length === 2) {
          const added = await current();
          await assert.rejects(revision(added.stamp, { items: [syntheticItem] }), /품목 합계/);
          await revision(added.stamp, { items: [syntheticItem], ...calculateQuoteTotals([syntheticItem]) });
        }
      }
      const manual = calculateManualQuoteTotals(751100);
      const manualSnapshot = { manualTotalAdjustment: { mode: 'vat_included_total_override', adjustedSubtotal: manual.subtotal, adjustedTax: manual.tax, adjustedTotal: manual.total } };
      let saved = await seed();
      await revision(saved.stamp, { ...manual, calculation_snapshot: manualSnapshot });
      saved = await current();
      await revision(saved.stamp, { recipient_memo: 'manual preserved' });
      const preservedManual = await current();
      assert.deepEqual([preservedManual.subtotal, preservedManual.tax, preservedManual.total], ['682818', '68282', '751100']);
      for (const total of [751099, 751081, 751080]) {
        saved = await seed();
        await assert.rejects(revision(saved.stamp, { total }), /견적 금액|품목 합계/);
      }
      for (const field of ['subtotal', 'tax', 'total']) {
        for (const value of [null, -1, 'NaN', 'Infinity', '-Infinity', ...(field === 'total' ? [0] : [])]) {
          saved = await seed();
          await assert.rejects(revision(saved.stamp, { [field]: value }), /견적 금액/);
          assert.equal((await current()).stamp, saved.stamp);
        }
      }
      console.log('Isolated PostgreSQL: atomic history, RLS, conflicts, input validation passed');
    } finally { await db.close(); }
  }
} finally { await rm(temp, { recursive: true, force: true }); }
