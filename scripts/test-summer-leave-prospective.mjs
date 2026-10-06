// Local calculation only: no Supabase client, credentials, or production writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const modules = new Map();
function load(path) {
  if (modules.has(path)) return modules.get(path);
  const module = { exports: {} };
  modules.set(path, module.exports);
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const resolve = id => id.startsWith('@/') ? load(root + 'src/' + id.slice(2) + '.ts') : require(id);
  new Function('require', 'module', 'exports', source)(resolve, module, module.exports);
  return module.exports;
}

const api = load(root + 'src/lib/leaveBalance.ts');
const policy = { grant_method: 'monthly_accrual', grant_basis: 'join_date', auto_expire_enabled: false, auto_expire_type: 'none' };
const record = (type, status, days, deductible, start = '2026-08-12') => ({
  leave_type: type, status, days, deducts_annual_leave: deductible,
  start_date: start, end_date: start, created_at: '2026-10-01T00:00:00Z',
});
const legacy = [record('monthly', 'approved', 1, null), record('summer', 'approved', 3, null)];
const snapshot = JSON.stringify(legacy);
const balance = rows => api.calculateLeaveBalance('2024-04-01', policy, rows, 2);
const original = balance(legacy);
assert.equal(original.usedDays, 1, 'legacy summer must remain non-deducting');
assert.equal(balance(legacy.map(row => ({ ...row, deducts_annual_leave: undefined }))).remainingDays, original.remainingDays);
const fresh = record('summer', 'approved', 3, true);
assert.equal(balance([...legacy, fresh]).usedDays, 4, 'new approved summer must deduct');
assert.equal(balance([...legacy, fresh]).remainingDays, original.remainingDays - 3);
assert.equal(balance([...legacy, { ...fresh, status: 'pending' }]).pendingDays, 3);
for (const status of ['pending', 'rejected', 'cancelled']) {
  assert.equal(balance([...legacy, { ...fresh, status }]).remainingDays, original.remainingDays);
}
assert.equal(balance([...legacy, { ...legacy[1], status: 'pending' }]).pendingDays, 0, 'old pending summer keeps its basis');
assert.equal(balance([...legacy, { ...legacy[1], start_date: '2099-07-01' }]).scheduledDays, 0, 'future use date must not migrate an old request');
assert.equal(balance([{ ...fresh, start_date: '2099-07-01' }]).scheduledDays, 3);
assert.equal(balance([...legacy, record('half_am', 'approved', 0.5, true)]).usedDays, 1.5);
assert.equal(balance([...legacy, record('unpaid', 'approved', 3, false)]).usedDays, 1);
assert.equal(api.isAnnualBalanceRequest(fresh), true);
assert.equal(api.isAnnualBalanceRequest(legacy[1]), false);
for (const basis of ['join_date', 'fiscal_year']) for (const type of ['annual_only', 'annual_monthly']) {
  const expiringPolicy = { ...policy, grant_basis: basis, auto_expire_enabled: true, auto_expire_type: type };
  const previous = api.calculateLeaveBalance('2020-04-01', expiringPolicy, legacy, 2);
  const current = api.calculateLeaveBalance('2020-04-01', expiringPolicy, [...legacy, fresh], 2);
  assert.equal(current.expiration.expiredDays, previous.expiration.expiredDays, 'new summer must not rewrite historical expiration');
  assert.equal(current.remainingDays, previous.remainingDays - 3, 'expiration must not silently offset the new deduction');
}
assert.equal(JSON.stringify(legacy), snapshot, 'calculation must not rewrite historical records');
console.log('prospective summer leave: legacy preservation, approval, pending, cancellation, future dates and half-day checks passed');

if (process.argv.includes('--db')) {
  const modulePath = process.env.ACBANK_TEST_PGLITE;
  if (!modulePath) throw new Error('Set ACBANK_TEST_PGLITE to the temporary @electric-sql/pglite/dist/index.js path.');
  const { PGlite } = await import(pathToFileURL(modulePath).href);
  const db = new PGlite(); // In-memory only; never accepts a connection URL.
  const employee = '00000000-0000-4000-8000-000000000001';
  const admin = '00000000-0000-4000-8000-000000000002';
  const owner = () => db.exec('RESET ROLE');
  const as = async user => {
    await owner();
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user]);
    await db.exec('SET ROLE authenticated');
  };
  const requests = async () => (await db.query('SELECT * FROM leave_requests ORDER BY id')).rows;
  const request = async id => (await db.query('SELECT * FROM leave_requests WHERE id=$1', [id])).rows[0];
  const submit = async (type, start, end) => (await db.query(
    'SELECT submit_leave_request($1,$2::date,$3::date,$4) AS id', [type, start, end, 'Isolated fixture'],
  )).rows[0].id;
  try {
    await db.exec(`
      CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
      CREATE SCHEMA auth;
      CREATE TYPE app_role AS ENUM ('employee','admin','moderator');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
      CREATE TABLE profiles(id uuid PRIMARY KEY,full_name text);
      CREATE TABLE user_roles(user_id uuid,role app_role);
      CREATE FUNCTION has_role(_user uuid,_role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=_user AND role=_role) $$;
      CREATE FUNCTION get_profile_display_name(_user uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT full_name FROM profiles WHERE id=_user $$;
      CREATE FUNCTION update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=clock_timestamp(); RETURN NEW; END $$;
      CREATE TABLE page_role_access(page_key text PRIMARY KEY,min_role text);
      CREATE TABLE company_holidays(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),start_date date,end_date date);
      CREATE TABLE notifications(user_id uuid,type text,title text,description text,data jsonb,dedupe_key text,is_read boolean DEFAULT false,UNIQUE(user_id,type,dedupe_key));
      CREATE TABLE leave_requests(
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,user_name text NOT NULL,
        leave_type text NOT NULL DEFAULT 'annual',start_date date NOT NULL,end_date date NOT NULL,days numeric NOT NULL,
        reason text,status text NOT NULL DEFAULT 'pending',approved_by uuid,approved_by_name text,approved_at timestamptz,reject_reason text,
        created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
      GRANT SELECT,INSERT,UPDATE,DELETE ON leave_requests TO authenticated;
      CREATE POLICY read_leaves ON leave_requests FOR SELECT TO authenticated USING(user_id=auth.uid() OR has_role(auth.uid(),'admin'));
      CREATE TABLE leave_adjustments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,adjustment_type text,days numeric,reason text);
      INSERT INTO profiles VALUES('${employee}','Fixture employee'),('${admin}','Fixture admin');
      INSERT INTO user_roles VALUES('${employee}','employee'),('${admin}','admin');
      INSERT INTO leave_adjustments(user_id,adjustment_type,days,reason) VALUES('${employee}','grant',2,'Historical adjustment');
    `);
    await db.exec(readFileSync(root + 'supabase/migrations/20260907090000_leave_cancellation_and_integrity.sql', 'utf8'));
    const dates = (await db.query("SELECT to_char(date_trunc('week',current_date+interval '21 days'),'YYYY-MM-DD') AS start,to_char(date_trunc('week',current_date+interval '21 days')+interval '2 days','YYYY-MM-DD') AS finish")).rows[0];
    await as(employee);
    const oldPending = await submit('summer', dates.start, dates.finish);
    await as(admin);
    for (const type of ['summer', 'monthly']) await db.query('SELECT admin_create_leave_request($1,$2,$3::date,$4::date,$5)', [employee, type, '2026-08-12', '2026-08-12', 'Before cutover']);
    await owner();
    const beforeRows = (await db.query('SELECT row_to_json(r) AS value FROM leave_requests r ORDER BY id')).rows;
    const beforeAdjustment = (await db.query('SELECT row_to_json(r) AS value FROM leave_adjustments r ORDER BY id')).rows;
    const beforeBalance = balance(await requests());
    await db.exec(readFileSync(root + 'supabase/migrations/20261001090000_summer_leave_prospective_deduction.sql', 'utf8'));
    assert.deepEqual((await db.query("SELECT to_jsonb(r)-'deducts_annual_leave' AS value FROM leave_requests r ORDER BY id")).rows, beforeRows);
    assert.deepEqual((await db.query('SELECT row_to_json(r) AS value FROM leave_adjustments r ORDER BY id')).rows, beforeAdjustment);
    assert.ok((await requests()).every(row => row.deducts_annual_leave === null));
    assert.deepEqual(balance(await requests()), beforeBalance, 'migration must not change existing balance');
    await as(admin);
    await db.query("SELECT review_leave_request($1,'approved',NULL)", [oldPending]);
    assert.equal((await request(oldPending)).deducts_annual_leave, null);
    assert.equal(balance(await requests()).remainingDays, beforeBalance.remainingDays, 'approving an old future request must not adopt the new basis');
    await as(employee);
    const freshId = await submit('summer', dates.start, dates.finish);
    assert.equal((await request(freshId)).deducts_annual_leave, true);
    assert.equal(balance(await requests()).pendingDays, 3);
    assert.equal(balance(await requests()).remainingDays, beforeBalance.remainingDays);
    await assert.rejects(() => db.query('UPDATE leave_requests SET deducts_annual_leave=false WHERE id=$1', [freshId]), /permission denied/);
    await as(admin);
    await db.query("SELECT review_leave_request($1,'approved',NULL)", [freshId]);
    assert.equal(balance(await requests()).remainingDays, beforeBalance.remainingDays - 3);
    await assert.rejects(() => db.query("SELECT review_leave_request($1,'approved',NULL)", [freshId]), /대기 중인/);
    await as(employee);
    const cancellationId = (await db.query('SELECT request_leave_cancellation($1,$2) AS id', [freshId, 'Fixture cancellation'])).rows[0].id;
    assert.equal(balance(await requests()).remainingDays, beforeBalance.remainingDays - 3, 'cancellation waiting must still deduct');
    await as(admin);
    await db.query("SELECT review_leave_cancellation($1,'approved',NULL)", [cancellationId]);
    assert.equal((await request(freshId)).deducts_annual_leave, true);
    assert.equal(balance(await requests()).remainingDays, beforeBalance.remainingDays, 'cancellation approval must restore the deducted days');
    const manualId = (await db.query('SELECT admin_create_leave_request($1,$2,$3::date,$4::date,$5) AS id', [employee, 'summer', '2026-08-12', '2026-08-14', 'New registration for past dates'])).rows[0].id;
    assert.equal((await request(manualId)).deducts_annual_leave, true);
    assert.equal(balance(await requests()).remainingDays, beforeBalance.remainingDays - 3);
    await owner();
    await assert.rejects(() => db.query('UPDATE leave_requests SET deducts_annual_leave=true WHERE id=$1', [oldPending]), /변경할 수 없습니다/);
    await assert.rejects(() => db.query("UPDATE leave_requests SET leave_type='annual' WHERE id=$1", [oldPending]), /변경할 수 없습니다/);
    const forged = (await db.query("INSERT INTO leave_requests(user_id,user_name,leave_type,start_date,end_date,days,status,created_at,deducts_annual_leave) VALUES($1,'Fixture','summer','2020-08-12','2020-08-14',3,'pending','2000-01-01',false) RETURNING deducts_annual_leave", [employee])).rows[0];
    assert.equal(forged.deducts_annual_leave, true, 'caller flags and backdated created_at cannot bypass the insert basis');
    await as(employee);
    const halfId = await submit('half_am', dates.start, dates.start);
    const unpaidId = await submit('unpaid', dates.start, dates.finish);
    assert.equal(Number((await request(halfId)).days), 0.5);
    assert.equal((await request(halfId)).deducts_annual_leave, true);
    assert.equal((await request(unpaidId)).deducts_annual_leave, false);
    await owner();
    assert.deepEqual((await db.query('SELECT row_to_json(r) AS value FROM leave_adjustments r ORDER BY id')).rows, beforeAdjustment);
    await db.exec('SET ROLE anon');
    await assert.rejects(() => submit('summer', dates.start, dates.finish), /permission denied/);
    console.log('prospective summer isolated PostgreSQL: migration preservation, actual submit/admin/review/cancel RPCs, immutable basis, forged flags, backdated registration and RLS checks passed');
  } finally { await db.close(); }
}
