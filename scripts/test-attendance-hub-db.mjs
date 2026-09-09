// Runs only an in-memory PostgreSQL instance; never accepts a DB URL or credentials.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const modulePath = process.env.ACBANK_TEST_PGLITE;
if (!modulePath) throw new Error('Set ACBANK_TEST_PGLITE to the temporary @electric-sql/pglite/dist/index.js path.');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const employee = '00000000-0000-4000-8000-000000000001';
const admin = '00000000-0000-4000-8000-000000000002';
const moderator = '00000000-0000-4000-8000-000000000003';
const other = '00000000-0000-4000-8000-000000000004';
const pending = '00000000-0000-4000-8000-000000000005';
let checks = 0;
try {
  await db.exec(`
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth;
    CREATE TYPE public.app_role AS ENUM ('employee', 'admin', 'moderator');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    GRANT USAGE ON SCHEMA auth, public TO authenticated, anon;
    CREATE TABLE profiles(id uuid PRIMARY KEY, full_name text, is_approved boolean);
    CREATE TABLE user_roles(user_id uuid, role app_role);
    CREATE FUNCTION has_role(_user uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = _user AND role = _role)
    $$;
    CREATE FUNCTION update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN NEW.updated_at = clock_timestamp(); RETURN NEW; END
    $$;
    CREATE TABLE attendance_records(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, user_name text NOT NULL,
      date date NOT NULL, check_in timestamptz, check_out timestamptz, status text NOT NULL DEFAULT 'checked_in', memo text,
      work_hours numeric GENERATED ALWAYS AS (CASE WHEN check_in IS NOT NULL AND check_out IS NOT NULL THEN extract(epoch from check_out - check_in) / 3600 END) STORED,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(user_id, date)
    );
    CREATE TRIGGER attendance_updated BEFORE UPDATE ON attendance_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, type text, title text, description text, data jsonb);
    CREATE TABLE leave_policy_settings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text);
    CREATE TABLE leave_general_settings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text);
    CREATE TABLE company_holidays(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text);
    ALTER TABLE company_holidays ENABLE ROW LEVEL SECURITY;
    GRANT ALL ON company_holidays TO authenticated;
    CREATE POLICY "Admins can manage company holidays" ON company_holidays FOR ALL USING (has_role(auth.uid(), 'admin'));
    CREATE POLICY "Moderators can manage company holidays" ON company_holidays FOR ALL USING (has_role(auth.uid(), 'moderator'));
    ALTER TABLE leave_policy_settings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE leave_general_settings ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON leave_policy_settings, leave_general_settings TO authenticated;
    CREATE POLICY "Approved users can read leave policies" ON leave_policy_settings FOR SELECT TO authenticated USING (true);
    CREATE POLICY "Admins can manage leave policies" ON leave_policy_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
    CREATE POLICY "Moderators can manage leave policies" ON leave_policy_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'moderator'));
    CREATE POLICY "Admins can manage leave general settings" ON leave_general_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
    CREATE POLICY "Moderators can manage leave general settings" ON leave_general_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'moderator'));
    INSERT INTO profiles VALUES ('${employee}', 'Test employee', true), ('${admin}', 'Test admin', true), ('${moderator}', 'Test moderator', true), ('${other}', 'Test other', true), ('${pending}', 'Test pending', false);
    INSERT INTO user_roles VALUES ('${employee}', 'employee'), ('${admin}', 'admin'), ('${moderator}', 'moderator'), ('${other}', 'employee');
  `);
  await db.exec(read('supabase/migrations/20260601090000_attendance_correction_requests.sql'));
  // Include a pre-existing record/request to verify the migration preserves values.
  await db.exec(`
    INSERT INTO attendance_records(user_id, user_name, date, check_in, status)
    VALUES ('${employee}', 'Test employee', '2026-08-03', '2026-08-03 09:00+09', 'checked_in');
    INSERT INTO attendance_correction_requests(user_id, user_name, date, request_type, reason, status)
    VALUES ('${employee}', 'Test employee', '2026-07-01', 'memo', 'Historical request', 'cancelled');
  `);
  const before = await db.query('SELECT row_to_json(r) AS value FROM attendance_records r ORDER BY id');
  const beforeRequests = await db.query('SELECT id, user_id, date, status, reason FROM attendance_correction_requests ORDER BY id');
  await db.exec(read('supabase/migrations/20260909160000_attendance_leave_hub.sql'));
  assert.deepEqual((await db.query('SELECT row_to_json(r) AS value FROM attendance_records r ORDER BY id')).rows, before.rows);
  assert.deepEqual((await db.query('SELECT id, user_id, date, status, reason FROM attendance_correction_requests ORDER BY id')).rows, beforeRequests.rows);
  checks += 2;
  const owner = () => db.exec('RESET ROLE');
  const as = async id => { await owner(); await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id || '']); await db.exec('SET ROLE authenticated'); };
  const submit = async (date, type = 'both', checkIn = date + ' 09:00+09', checkOut = date + ' 18:00+09') =>
    (await db.query('SELECT submit_attendance_correction($1::date,$2,$3::timestamptz,$4::timestamptz,$5) AS id', [date, type, checkIn, checkOut, 'Test correction reason'])).rows[0].id;
  const readReview = async id => {
    await owner();
    const request = (await db.query('SELECT * FROM attendance_correction_requests WHERE id=$1', [id])).rows[0];
    const record = (await db.query('SELECT * FROM attendance_records WHERE user_id=$1 AND date=$2', [request.user_id, request.date])).rows[0];
    return { request, record };
  };
  const review = (snapshot, decision = 'handled') => db.query(
    'SELECT review_attendance_correction($1,$2,$3,$4::timestamptz,$5::uuid,$6::timestamptz)',
    [snapshot.request.id, decision, 'Test review note', snapshot.request.updated_at, snapshot.record?.id || null, snapshot.record?.updated_at || null],
  );
  const rejects = async (fn, pattern) => { await assert.rejects(fn, pattern); checks++; };
  await as(employee);
  const id = await submit('2026-08-03', 'check_out', null, '2026-08-03 18:00+09');
  await rejects(() => submit('2026-08-03'), /대기/);
  await rejects(() => db.query("UPDATE attendance_correction_requests SET status='handled' WHERE id=$1", [id]), /permission denied/);
  await rejects(() => submit('2026-08-04', 'both', '2026-08-04 18:00+09', '2026-08-04 09:00+09'), /순서/);
  const snapshot = await readReview(id);
  await as(other);
  assert.equal((await db.query('SELECT * FROM attendance_correction_requests WHERE id=$1', [id])).rows.length, 0); checks++;
  await rejects(() => db.query('SELECT cancel_attendance_correction($1)', [id]), /철회/);
  await rejects(() => review(snapshot), /권한/);
  await as(pending);
  await rejects(() => submit('2026-08-05'), /승인된/);
  await as(null);
  await rejects(() => submit('2026-08-05'), /승인된/);
  await as(moderator);
  await review(snapshot);
  await owner();
  const after = await readReview(id);
  assert.equal(after.request.status, 'handled');
  assert.ok(after.request.attendance_before && after.request.attendance_after);
  assert.equal(Number(after.record.work_hours), 9);
  assert.equal(after.record.id, snapshot.record.id);
  checks += 4;
  await as(admin);
  await rejects(() => review(snapshot), /이미 처리/);
  await as(employee);
  await rejects(() => db.query('SELECT cancel_attendance_correction($1)', [id]), /이미 처리/);
  const staleId = await submit('2026-08-06');
  const stale = await readReview(staleId);
  await db.exec(`INSERT INTO attendance_records(user_id,user_name,date,check_in,status) VALUES ('${employee}','Test employee','2026-08-06','2026-08-06 08:00+09','checked_in')`);
  await as(admin);
  await rejects(() => review(stale), /변경/);
  const fresh = await readReview(staleId);
  await as(admin); await review(fresh);
  const originalStale = await readReview(staleId);
  assert.equal(originalStale.request.status, 'handled'); checks++;
  await as(employee);
  const rejectId = await submit('2026-08-07');
  const rejectSnapshot = await readReview(rejectId);
  await as(moderator); await review(rejectSnapshot, 'rejected');
  await owner();
  assert.equal((await db.query("SELECT count(*)::int AS n FROM attendance_records WHERE date='2026-08-07'")).rows[0].n, 0); checks++;
  await as(employee);
  const cancelId = await submit('2026-08-10');
  await db.query('SELECT cancel_attendance_correction($1)', [cancelId]);
  assert.equal((await db.query('SELECT status FROM attendance_correction_requests WHERE id=$1', [cancelId])).rows[0].status, 'cancelled'); checks++;
  await as(moderator);
  await rejects(() => db.exec("INSERT INTO leave_policy_settings(name) VALUES ('forbidden')"), /row-level security/);
  await rejects(() => db.exec("INSERT INTO leave_general_settings(name) VALUES ('forbidden')"), /row-level security/);
  await rejects(() => db.exec("INSERT INTO company_holidays(name) VALUES ('forbidden')"), /row-level security/);
  await as(admin);
  await db.exec("INSERT INTO leave_policy_settings(name) VALUES ('allowed')");
  checks++;
  await as(employee);
  const rollbackId = await submit('2026-08-11');
  const rollbackSnapshot = await readReview(rollbackId);
  await db.exec("ALTER TABLE notifications ADD CONSTRAINT fixture_failure CHECK (title IS NULL) NOT VALID");
  await as(admin);
  await rejects(() => review(rollbackSnapshot), /fixture_failure/);
  const rolledBack = await readReview(rollbackId);
  assert.equal(rolledBack.request.status, 'pending'); assert.equal(rolledBack.record, undefined); checks += 2;
  await db.exec("ALTER TABLE notifications DROP CONSTRAINT fixture_failure");
  // A reviewer must not overwrite an existing row edited after opening their dialog.
  await as(employee); const changedId = await submit('2026-08-03');
  const changedSnapshot = await readReview(changedId);
  await db.exec("UPDATE attendance_records SET memo='Newer admin edit' WHERE date='2026-08-03'");
  await as(admin); await rejects(() => review(changedSnapshot), /변경/);
  await as(employee);
  await rejects(() => db.query("DELETE FROM attendance_correction_requests WHERE id=$1", [changedId]), /permission denied/);
  await rejects(() => db.exec("INSERT INTO attendance_correction_requests DEFAULT VALUES"), /permission denied/);
  await owner(); await db.exec('SET ROLE anon');
  await rejects(() => db.query('SELECT cancel_attendance_correction($1)', [id]), /permission denied/);
  console.log(`attendance hub isolated PostgreSQL: ${checks} checks passed; no production connection`);
} finally { await db.close(); }
