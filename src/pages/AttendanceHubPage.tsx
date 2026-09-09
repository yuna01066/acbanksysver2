import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { resolveAttendanceHub } from '@/lib/attendanceHubRoute';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AttendancePage from './AttendancePage';
import LeaveManagementPage from './LeaveManagementPage';
import AttendanceCorrections from '@/components/attendance/AttendanceCorrections';
import AdminLeaveOverview from '@/components/leave/AdminLeaveOverview';
import LeavePolicySettings from '@/components/leave/LeavePolicySettings';
import CompanyHolidayManager from '@/components/company/CompanyHolidayManager';
import OvertimeDetectionPanel from '@/components/attendance/OvertimeDetectionPanel';
import MonthlyAttendanceReport from '@/components/attendance/MonthlyAttendanceReport';
import DepartmentWorkPatternAnalysis from '@/components/attendance/DepartmentWorkPatternAnalysis';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import LeaveRequestList from '@/components/leave/LeaveRequestList';
import { Link } from 'react-router-dom';

const labels: Record<string, string> = {
  attendance: '근태', leave: '연차·휴가', overview: '운영 현황',
  approvals: '승인함', members: '구성원', reports: '리포트', settings: '설정',
};

function ApprovalInbox({ request, kind }: { request?: string; kind: string | null }) {
  const { user } = useAuth();
  const leave = useLeaveRequests('all');
  const [filter, setFilter] = useState(kind === 'attendance' ? 'attendance' : 'all');
  const pendingCancelIds = new Set(leave.cancellations.filter(c => c.status === 'pending').map(c => c.leave_request_id));
  const requests = leave.requests.filter(r => {
    if (r.id === request) return true;
    if (filter === 'cancel') return pendingCancelIds.has(r.id);
    if (filter === 'leave') return r.status === 'pending';
    return r.status === 'pending' || pendingCancelIds.has(r.id);
  });
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">처리할 요청</h2>
      <select aria-label="승인 요청 유형" value={filter} onChange={e => setFilter(e.target.value)} className="h-11 rounded-md border bg-background px-3 text-sm">
        <option value="all">전체</option><option value="leave">휴가 신청</option><option value="cancel">휴가 취소</option><option value="attendance">근태 정정</option>
      </select>
    </div>
    {filter !== 'attendance' && <section aria-label="휴가 승인 요청" className="space-y-3">
      <h3 className="font-medium">휴가 신청·취소</h3>
      {leave.loadError ? <div role="alert">휴가 요청 조회 실패 <Button variant="outline" onClick={() => void leave.refresh()}>다시 시도</Button></div>
        : leave.loading ? <p role="status">요청을 불러오는 중…</p>
        : <LeaveRequestList requests={requests} cancellations={leave.cancellations} isAdmin currentUserId={user?.id || ''}
          onApprove={leave.approveRequest} onReject={leave.rejectRequest} onCancel={leave.cancelRequest}
          onReviewCancellation={leave.reviewCancellation} onAdminCancel={leave.adminCancelRequest} focusedRequestId={request} />}
    </section>}
    {(filter === 'all' || filter === 'attendance') && <AttendanceCorrections admin focusedRequestId={kind === 'attendance' ? request : undefined} />}
  </div>;
}

export function LeaveManagementRedirect() {
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  const tab = next.get('tab');
  if (tab === 'admin' || tab === 'settings') {
    next.set('scope', 'all');
    next.set('tab', tab === 'settings' ? 'settings' : params.has('request') ? 'approvals' : 'members');
  } else next.set('tab', 'leave');
  return <Navigate replace to={'/attendance?' + next.toString()} />;
}

export default function AttendanceHubPage() {
  const { user, isAdmin, isModerator, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  const canManage = isAdmin || isModerator;
  const state = resolveAttendanceHub(params, canManage, isAdmin);
  const setTab = (tab: string) => {
    const next = new URLSearchParams(params);
    next.set('scope', state.scope); next.set('tab', tab);
    next.delete('request'); next.delete('kind');
    setParams(next);
  };
  const setScope = (scope: 'my' | 'all') => {
    // Deliberately discard employee/action context when switching modes.
    const next = new URLSearchParams();
    if (params.has('month')) next.set('month', params.get('month')!);
    next.set('scope', scope); next.set('tab', scope === 'all' ? 'overview' : 'attendance');
    setParams(next);
  };
  if (loading) return <p role="status" className="p-6">권한을 확인하는 중…</p>;
  if (!user) return <Navigate to="/auth" replace />;
  const tabs = state.scope === 'my' ? ['attendance', 'leave'] : ['overview', 'approvals', 'members', 'reports', ...(isAdmin ? ['settings'] : [])];
  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6" id="attendance-hub">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div><h1 className="text-2xl font-semibold">근태·연차·휴가</h1>
          <p className="mt-1 text-sm text-muted-foreground">{state.scope === 'all' ? '관리자 모드 · 전체 구성원 운영' : '내 관리 · 내 출퇴근과 휴가'}</p></div>
        {canManage && <div className="flex rounded-lg bg-muted p-1" role="group" aria-label="관리 모드 전환">
          <Button variant={state.scope === 'my' ? 'secondary' : 'ghost'} aria-pressed={state.scope === 'my'} onClick={() => setScope('my')}>내 관리</Button>
          <Button variant={state.scope === 'all' ? 'secondary' : 'ghost'} aria-pressed={state.scope === 'all'} onClick={() => setScope('all')}>관리자 모드</Button>
        </div>}
      </header>
      <Tabs value={state.tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto bg-muted/40 p-1">
          {tabs.map(tab => <TabsTrigger className="min-h-11 shrink-0 px-4" key={tab} value={tab}>{labels[tab]}</TabsTrigger>)}
        </TabsList>
      <TabsContent value={state.tab} key={state.scope + ':' + state.tab} id="attendance-hub-content" className="min-w-0 space-y-6" aria-label={labels[state.tab]}>
        {state.scope === 'my' && state.tab === 'attendance' && <><AttendancePage scope="my" /><AttendanceCorrections focusedRequestId={state.request} /></>}
        {state.scope === 'my' && state.tab === 'leave' && <LeaveManagementPage embedded focusedRequestId={state.request} />}
        {state.scope === 'all' && state.tab === 'overview' && <AttendancePage scope="all" />}
        {state.scope === 'all' && state.tab === 'approvals' && <ApprovalInbox key={params.get('kind') || 'all'} request={state.request} kind={params.get('kind')} />}
        {state.scope === 'all' && state.tab === 'members' && <AdminLeaveOverview />}
        {state.scope === 'all' && state.tab === 'reports' && <>
          <select className="h-11 rounded-md border bg-background px-3" aria-label="리포트 종류" value={state.report}
            onChange={e => { const next = new URLSearchParams(params); next.set('tab', 'reports'); next.set('report', e.target.value); setParams(next); }}>
            <option value="monthly-report">월별 근태 리포트</option><option value="overtime">초과근무</option><option value="dept-analysis">부서 분석</option>
          </select>
          {state.report === 'overtime' ? <OvertimeDetectionPanel /> : state.report === 'dept-analysis' ? <DepartmentWorkPatternAnalysis /> : <MonthlyAttendanceReport />}
        </>}
        {state.scope === 'all' && isAdmin && state.tab === 'settings' && <>
          <LeavePolicySettings />
          <CompanyHolidayManager />
          <p className="text-sm text-muted-foreground">근무지 위치는 회사정보 보호 설정에서 관리합니다. <Link className="text-primary underline" to="/company-settings">회사 설정 열기</Link></p>
        </>}
      </TabsContent>
      </Tabs>
    </main>
  );
}
