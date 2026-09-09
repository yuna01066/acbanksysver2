const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
const nextDate = new Date(); nextDate.setDate(nextDate.getDate() + 14);
const future = nextDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
const stamp = new Date().toISOString();
window.__hubQueries = [];
window.__hubWrites = [];
const profiles = [
  { id: 'admin-1', full_name: '테스트 관리자', department: '운영', position: '관리자', join_date: '2025-10-01', is_approved: true },
  { id: 'staff-1', full_name: '테스트 직원', department: '제작', position: '직원', join_date: '2025-10-01', is_approved: true },
  { id: 'staff-empty', full_name: '기록 없는 직원', department: '제작', position: '직원', join_date: '2026-06-01', is_approved: true },
];
const tables = {
  profiles, profile_directory: profiles,
  leave_policy_settings: [{ id: 'policy-1', policy_name: '기본 연차 정책', grant_method: 'monthly_accrual', grant_basis: 'join_date', auto_expire_enabled: false, auto_expire_type: 'none', allow_advance_use: false, leave_unit: 'day', smart_promotion: 'none', approver_required: true, approver_level: 'moderator_up', is_default: true, created_at: stamp }],
  leave_adjustments: [{ id: 'adj-1', user_id: 'staff-1', user_name: '테스트 직원', adjustment_type: 'grant', days: 1, leave_category: 'annual', effective_date: today, expires_at: null, granted_by_name: '테스트 관리자', reason: '테스트 추가 부여', created_at: stamp }],
  attendance_records: [{ id: 'attendance-1', user_id: 'staff-1', user_name: '테스트 직원', date: today, check_in: today + 'T09:00:00+09:00', check_out: null, status: 'checked_in', work_hours: null, memo: null, updated_at: stamp }],
  leave_requests: [
    { id: 'leave-1', user_id: 'staff-1', user_name: '테스트 직원', leave_type: 'annual', start_date: future, end_date: future, days: 1, reason: '테스트 예정 휴가', status: 'approved', approved_by_name: '테스트 관리자', created_at: stamp },
    { id: 'leave-2', user_id: 'staff-1', user_name: '테스트 직원', leave_type: 'half_am', start_date: today, end_date: today, days: 0.5, reason: '테스트 신청', status: 'pending', created_at: stamp },
    { id: 'leave-3', user_id: 'staff-1', user_name: '테스트 직원', leave_type: 'annual', start_date: today, end_date: today, days: 1, reason: '테스트 취소 기록', status: 'cancelled', created_at: stamp },
  ],
  leave_cancellation_requests: [{ id: 'cancel-1', leave_request_id: 'leave-1', requested_by: 'staff-1', reason: '테스트 취소 신청', status: 'pending', created_at: stamp }],
  attendance_correction_requests: [{ id: 'correction-1', user_id: 'staff-1', user_name: '테스트 직원', attendance_record_id: 'attendance-1', date: today, request_type: 'check_in', requested_check_in: today + 'T08:50:00+09:00', requested_check_out: null, reason: '테스트 출근 시각 정정', status: 'pending', updated_at: stamp, created_at: stamp }],
};
class Query {
  constructor(table) { this.table = table; this.filters = []; this.one = false; }
  select() { return this; }
  order() { return this; }
  eq(key, value) { this.filters.push([key, 'eq', value]); return this; }
  gte(key, value) { this.filters.push([key, 'gte', value]); return this; }
  lte(key, value) { this.filters.push([key, 'lte', value]); return this; }
  gt(key, value) { this.filters.push([key, 'gt', value]); return this; }
  in(key, value) { this.filters.push([key, 'in', value]); return this; }
  is(key, value) { return this.eq(key, value); }
  limit(value) { this.end = value; return this; }
  range(start, end) { this.start = start; this.end = end + 1; return this; }
  single() { this.one = true; return this; }
  maybeSingle() { this.one = true; return this; }
  insert(data) { this.write = ['insert', data]; return this; }
  update(data) { this.write = ['update', data]; return this; }
  delete() { this.write = ['delete']; return this; }
  then(resolve, reject) {
    const run = async () => {
      await new Promise(done => setTimeout(done, 60));
      window.__hubQueries.push({ table: this.table, filters: this.filters });
      if (new URLSearchParams(location.search).get('fail') === this.table) return { data: null, error: { message: '격리 테스트 조회 실패' } };
      let rows = (tables[this.table] || []).filter(row => this.filters.every(([key, op, value]) => {
        const v = key === 'leave_requests.user_id' ? tables.leave_requests.find(r => r.id === row.leave_request_id)?.user_id : row[key];
        return op === 'eq' ? v === value : op === 'gte' ? v >= value : op === 'lte' ? v <= value : op === 'gt' ? v > value : value.includes(v);
      }));
      if (this.write) {
        window.__hubWrites.push({ table: this.table, operation: this.write[0] });
        if (this.write[0] === 'insert') { const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...this.write[1] }; (tables[this.table] ||= []).push(row); rows = [row]; }
        if (this.write[0] === 'update') rows.forEach(row => Object.assign(row, this.write[1]));
        if (this.write[0] === 'delete') tables[this.table] = tables[this.table].filter(row => !rows.includes(row));
      }
      rows = rows.slice(this.start || 0, this.end);
      return { data: this.one ? rows[0] || null : structuredClone(rows), error: null };
    };
    return run().then(resolve, reject);
  }
}
export const supabase = {
  from: table => new Query(table),
  rpc: async (name, args) => {
    window.__hubWrites.push({ rpc: name, args });
    await new Promise(resolve => setTimeout(resolve, 100));
    if (window.__hubFailRpc === name) return { data: null, error: { message: '격리 테스트 처리 실패' } };
    if (name === 'review_leave_request') tables.leave_requests.find(r => r.id === args._request_id).status = args._decision;
    if (name === 'review_leave_cancellation') {
      const cancellation = tables.leave_cancellation_requests.find(c => c.id === args._cancellation_id);
      cancellation.status = args._decision;
      if (args._decision === 'approved') tables.leave_requests.find(r => r.id === cancellation.leave_request_id).status = 'cancelled';
    }
    if (name === 'review_attendance_correction') {
      const correction = tables.attendance_correction_requests.find(r => r.id === args._request_id);
      correction.status = args._decision; correction.handled_memo = args._note;
    }
    return { data: null, error: null };
  },
  functions: { invoke: async () => ({ data: null, error: null }) },
  storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
};
