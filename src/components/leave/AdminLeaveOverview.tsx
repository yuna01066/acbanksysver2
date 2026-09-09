import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useLeavePolicy } from '@/hooks/useLeavePolicy';
import { useLeaveAdjustments } from '@/hooks/useLeaveAdjustments';
import { calculateLeaveBalance } from '@/lib/leaveBalance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import LeaveSummaryCards from './LeaveSummaryCards';
import LeaveAdjustmentDialog from './LeaveAdjustmentDialog';
import EmployeeAttendancePanel from '@/components/employee/EmployeeAttendancePanel';
import EmployeeLeavePanel from '@/components/employee/EmployeeLeavePanel';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function AdminLeaveOverview() {
  const { user, isAdmin, isModerator } = useAuth();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [includePrevious, setIncludePrevious] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const selectedId = params.get('employee');
  const memberTab = params.get('memberTab') === 'attendance' ? 'attendance' : 'leave';
  const leave = useLeaveRequests('all');
  const policy = useLeavePolicy();
  const adjustment = useLeaveAdjustments();
  const profiles = useQuery({
    queryKey: ['attendance-members', user?.id],
    enabled: !!user && (isAdmin || isModerator),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles')
        .select('id, full_name, department, position, join_date, is_approved').order('full_name');
      if (error) throw error;
      return data;
    },
  });
  const choose = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('employee', id); else next.delete('employee');
    setParams(next);
  };
  const retry = () => { void profiles.refetch(); void leave.refresh(); void policy.refresh(); void adjustment.refresh(); };
  if (!isAdmin && !isModerator) return <p role="alert">구성원 관리 권한이 필요합니다.</p>;
  if (profiles.error || leave.loadError || policy.error || adjustment.error) return <div role="alert">구성원 정보를 불러오지 못했습니다. <Button variant="outline" onClick={retry}>다시 시도</Button></div>;
  if (profiles.isLoading || leave.loading || policy.loading || adjustment.loading) return <p role="status">구성원 정보를 불러오는 중…</p>;
  const employees = (profiles.data || []).map(employee => ({
    ...employee,
    balance: calculateLeaveBalance(employee.join_date || '', policy.policy, leave.requests.filter(r => r.user_id === employee.id), adjustment.getNetAdjustment(employee.id)),
  }));
  const filtered = employees.filter(e => (includePrevious || e.is_approved || e.id === selectedId)
    && (!department || e.department === department) && (!search || (e.full_name + ' ' + (e.department || '')).includes(search)));
  const selected = employees.find(e => e.id === selectedId);
  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className={cn('rounded-lg border bg-card', selectedId && 'hidden lg:block')} aria-label="구성원 목록">
        <div className="space-y-3 border-b p-4">
          <h2 className="font-semibold">구성원 <span className="text-muted-foreground tabular-nums">{filtered.length}명</span></h2>
          <Input aria-label="이름 또는 부서 검색" placeholder="이름 또는 부서 검색" value={search} onChange={e => setSearch(e.target.value)} />
          <select aria-label="부서 필터" value={department} onChange={e => setDepartment(e.target.value)} className="h-11 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">전체 부서</option>{departments.map(d => <option key={d} value={d!}>{d}</option>)}
          </select>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={includePrevious} onChange={e => setIncludePrevious(e.target.checked)} />이전·미승인 구성원 포함</label>
        </div>
        <ul className="max-h-[65vh] divide-y overflow-y-auto [scrollbar-gutter:stable]">
          {filtered.map(employee => <li key={employee.id}><button onClick={() => choose(employee.id)} aria-current={selectedId === employee.id ? 'true' : undefined}
            className={cn('flex min-h-16 w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary', selectedId === employee.id && 'bg-primary/5')}>
            <span><span className="font-medium">{employee.full_name}</span><span className="block text-xs text-muted-foreground">{employee.department || '부서 미지정'}{!employee.is_approved && ' · 이전/미승인'}</span></span>
            <span className="text-right text-sm tabular-nums">{employee.balance.remainingDays}일<span className="block text-xs text-muted-foreground">현재 잔여</span></span>
          </button></li>)}
          {!filtered.length && <li className="p-4 text-sm text-muted-foreground">검색 조건에 맞는 구성원이 없습니다.</li>}
        </ul>
      </aside>
      <section className={cn('min-w-0 space-y-5', !selectedId && 'hidden lg:block')} aria-label="구성원 상세">
        <Button variant="outline" className="lg:hidden" onClick={() => choose(null)}>구성원 목록으로</Button>
        {!selected ? <p className="rounded-lg border p-8 text-sm text-muted-foreground">{selectedId ? '구성원을 찾을 수 없습니다. 목록에서 다시 선택해 주세요.' : '구성원을 선택하면 근태와 연차·휴가 기록을 함께 확인할 수 있습니다.'}</p> : <div key={selected.id} className="space-y-5">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div><h2 className="text-xl font-semibold">{selected.full_name}</h2><p className="text-sm text-muted-foreground">{selected.department || '부서 미지정'} · {selected.position || '직책 미지정'}</p></div>
            <Button variant="outline" onClick={() => setAdjustOpen(true)}>연차 부여·차감</Button>
          </header>
          <LeaveSummaryCards {...selected.balance} compact expiredDays={selected.balance.expiration.expiredDays} />
          <p className="text-sm text-muted-foreground">현재 잔여량 기준입니다. 승인된 예정 휴가 {selected.balance.scheduledDays}일이 사용 반영에 포함되며, 기록의 월·연도 필터는 현재 잔액에 영향을 주지 않습니다.</p>
          <Tabs value={memberTab} onValueChange={value => { const next = new URLSearchParams(params); next.set('memberTab', value); setParams(next); }}>
            <TabsList><TabsTrigger value="leave">연차·휴가 기록</TabsTrigger><TabsTrigger value="attendance">근태 기록</TabsTrigger></TabsList>
            <TabsContent value="leave"><EmployeeLeavePanel userId={selected.id} /></TabsContent>
            <TabsContent value="attendance"><EmployeeAttendancePanel userId={selected.id} userName={selected.full_name} /></TabsContent>
          </Tabs>
          <details className="rounded-lg border p-4"><summary className="cursor-pointer text-sm font-medium">추가 부여·차감 이력</summary>
            <ul className="mt-3 divide-y">{adjustment.adjustments.filter(a => a.user_id === selected.id).map(a => <li key={a.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div><p className="tabular-nums">{a.adjustment_type === 'grant' ? '+' : '-'}{a.days}일 · {a.effective_date} 적용</p><p className="text-muted-foreground">{a.reason || '사유 없음'} · {a.granted_by_name}{a.expires_at && ' · 만료 ' + a.expires_at}</p></div>
              <Button variant="ghost" aria-label="부여·차감 내역 삭제" onClick={async () => {
                if (!confirm('이 부여·차감 내역을 삭제하면 현재 잔여량이 달라질 수 있습니다. 삭제하시겠습니까?')) return;
                const error = await adjustment.deleteAdjustment(a.id);
                if (error) toast.error(error.message); else toast.success('내역이 삭제되었습니다.');
              }}>삭제</Button>
            </li>)}</ul>
            {!adjustment.adjustments.some(a => a.user_id === selected.id) && <p className="mt-3 text-sm text-muted-foreground">추가 부여·차감 내역이 없습니다.</p>}
          </details>
          <LeaveAdjustmentDialog open={adjustOpen} onOpenChange={setAdjustOpen} employee={selected} onSuccess={() => void adjustment.refresh()} />
        </div>}
      </section>
    </div>
  );
}
