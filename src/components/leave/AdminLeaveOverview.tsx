import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Users, Search, Plus, Minus, Trash2, Gift } from 'lucide-react';
import { calculateMonthlyLeaveDays, calculateAnnualOnlyDays, calculatePolicyBasedLeaveDays, LeaveRequest } from '@/hooks/useLeaveRequests';
import { useLeaveAdjustments } from '@/hooks/useLeaveAdjustments';
import LeaveAdjustmentDialog from './LeaveAdjustmentDialog';
import { differenceInMonths, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface EmployeeProfile {
  id: string;
  full_name: string;
  join_date: string | null;
  department: string | null;
  position?: string | null;
  avatar_url?: string | null;
}

interface AdminLeaveOverviewProps {
  employees: EmployeeProfile[];
  allRequests: LeaveRequest[];
  grantMethod: string;
  grantBasis: string;
}

const AdminLeaveOverview: React.FC<AdminLeaveOverviewProps> = ({
  employees, allRequests, grantMethod, grantBasis,
}) => {
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);

  const { adjustments, refresh: refreshAdjustments, getNetAdjustment, deleteAdjustment } = useLeaveAdjustments();

  const departments = useMemo(() => {
    const depts = new Set<string>();
    employees.forEach(e => { if (e.department) depts.add(e.department); });
    return Array.from(depts).sort();
  }, [employees]);

  const employeeStats = useMemo(() => {
    return employees.map(emp => {
      const joinDate = emp.join_date || '';
      const totalMonths = joinDate ? differenceInMonths(new Date(), new Date(joinDate)) : 0;
      const isUnderOneYear = totalMonths < 12;

      const monthlyDays = calculateMonthlyLeaveDays(joinDate);
      const annualDays = calculateAnnualOnlyDays(joinDate);
      const baseTotalDays = calculatePolicyBasedLeaveDays(joinDate, grantMethod, grantBasis);

      // Add manual adjustments
      const netAdjustment = getNetAdjustment(emp.id);
      const totalDays = baseTotalDays + netAdjustment;

      const empRequests = allRequests.filter(r => r.user_id === emp.id && r.status === 'approved');

      const usedMonthly = empRequests
        .filter(r => r.leave_type === 'monthly')
        .reduce((s, r) => s + r.days, 0);

      const usedAnnual = empRequests
        .filter(r => r.leave_type === 'annual' || r.leave_type === 'half_am' || r.leave_type === 'half_pm')
        .reduce((s, r) => s + r.days, 0);

      const usedTotal = usedMonthly + usedAnnual;
      const pendingCount = allRequests.filter(r => r.user_id === emp.id && r.status === 'pending').length;

      return {
        ...emp,
        joinDate,
        isUnderOneYear,
        monthlyDays,
        annualDays,
        baseTotalDays,
        netAdjustment,
        totalDays,
        usedMonthly,
        usedAnnual,
        usedTotal,
        remainingMonthly: monthlyDays - usedMonthly,
        remainingAnnual: annualDays - usedAnnual,
        remainingTotal: totalDays - usedTotal,
        pendingCount,
      };
    });
  }, [employees, allRequests, grantMethod, grantBasis, adjustments]);

  const filtered = useMemo(() => {
    let list = employeeStats;
    if (departmentFilter) {
      list = list.filter(e => e.department === departmentFilter);
    }
    if (search) {
      list = list.filter(e =>
        e.full_name.includes(search) || (e.department || '').includes(search)
      );
    }
    return list;
  }, [employeeStats, search, departmentFilter]);

  const selectedEmp = selectedId ? filtered.find(e => e.id === selectedId) : null;

  // Adjustments for the selected employee
  const selectedAdjustments = useMemo(() => {
    if (!selectedId) return [];
    return adjustments.filter(a => a.user_id === selectedId);
  }, [adjustments, selectedId]);

  const handleDeleteAdjustment = async (id: string) => {
    const err = await deleteAdjustment(id);
    if (err) toast.error('삭제 실패');
    else toast.success('삭제되었습니다.');
  };

  return (
    <div className="flex gap-4 h-full">
      {/* Left: Employee list sidebar */}
      <div className="w-full lg:w-80 xl:w-96 border rounded-lg bg-card flex flex-col shrink-0 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              구성원
            </h2>
            <Badge variant="secondary" className="text-xs">
              {filtered.length}명
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="이름 또는 부서 검색"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
          {/* Department filter chips */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setDepartmentFilter('')}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                !departmentFilter
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              전체
            </button>
            {departments.map(dept => (
              <button
                key={dept}
                onClick={() => setDepartmentFilter(dept === departmentFilter ? '' : dept)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                  dept === departmentFilter
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        {/* Employee List */}
        <ScrollArea className="flex-1">
          <div className="divide-y">
            {filtered.map(emp => (
              <button
                key={emp.id}
                onClick={() => setSelectedId(emp.id)}
                className={cn(
                  "w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors",
                  selectedId === emp.id && "bg-accent border-l-2 border-l-primary"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-bold text-primary shrink-0 overflow-hidden">
                    {emp.avatar_url ? (
                      <img src={emp.avatar_url} alt={emp.full_name} className="w-full h-full object-cover" />
                    ) : (
                      emp.full_name?.charAt(0) || '?'
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{emp.full_name}</span>
                      {emp.pendingCount > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 border-amber-200">
                          대기 {emp.pendingCount}
                        </Badge>
                      )}
                      {emp.netAdjustment !== 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {emp.netAdjustment > 0 ? '+' : ''}{emp.netAdjustment}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {emp.department && (
                        <span className="text-xs text-muted-foreground">{emp.department}</span>
                      )}
                      {emp.department && emp.position && (
                        <span className="text-xs text-muted-foreground">·</span>
                      )}
                      {emp.position && (
                        <span className="text-xs text-muted-foreground">{emp.position}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={cn(
                      "text-sm font-semibold",
                      emp.remainingTotal <= 0 ? "text-destructive" : "text-foreground"
                    )}>
                      {emp.remainingTotal}일
                    </span>
                    <p className="text-[10px] text-muted-foreground">잔여</p>
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                검색 결과가 없습니다
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right: Detail panel */}
      <div className="flex-1 hidden lg:block">
        {selectedEmp ? (
          <Card className="h-full overflow-auto">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-lg font-bold text-primary overflow-hidden">
                    {selectedEmp.avatar_url ? (
                      <img src={selectedEmp.avatar_url} alt={selectedEmp.full_name} className="w-full h-full object-cover" />
                    ) : (
                      selectedEmp.full_name?.charAt(0) || '?'
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{selectedEmp.full_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {selectedEmp.department || '-'}{selectedEmp.position ? ` · ${selectedEmp.position}` : ''}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setAdjustDialogOpen(true)}
                  className="gap-1"
                >
                  <Gift className="h-4 w-4" />
                  연차 부여/차감
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">총 부여</p>
                  <p className="text-xl font-bold">{selectedEmp.totalDays}일</p>
                  {selectedEmp.netAdjustment !== 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      법정 {selectedEmp.baseTotalDays} {selectedEmp.netAdjustment > 0 ? '+' : ''}{selectedEmp.netAdjustment} 추가
                    </p>
                  )}
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">사용</p>
                  <p className="text-xl font-bold">{selectedEmp.usedTotal}일</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">잔여</p>
                  <p className={cn("text-xl font-bold", selectedEmp.remainingTotal <= 0 ? "text-destructive" : "text-emerald-600")}>
                    {selectedEmp.remainingTotal}일
                  </p>
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">상세 내역</h3>
                {selectedEmp.isUnderOneYear && (
                  <div className="flex items-center justify-between py-2 border-b">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">월차</Badge>
                      <span className="text-sm">1년 미만 월차</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">부여 {selectedEmp.monthlyDays}</span>
                      <span className="text-muted-foreground">사용 {selectedEmp.usedMonthly}</span>
                      <span className={cn("font-medium", selectedEmp.remainingMonthly <= 0 ? "text-destructive" : "")}>
                        잔여 {selectedEmp.remainingMonthly}
                      </span>
                    </div>
                  </div>
                )}
                {!selectedEmp.isUnderOneYear && (
                  <div className="flex items-center justify-between py-2 border-b">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">연차</Badge>
                      <span className="text-sm">연차 휴가</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">부여 {selectedEmp.annualDays}</span>
                      <span className="text-muted-foreground">사용 {selectedEmp.usedAnnual}</span>
                      <span className={cn("font-medium", selectedEmp.remainingAnnual <= 0 ? "text-destructive" : "")}>
                        잔여 {selectedEmp.remainingAnnual}
                      </span>
                    </div>
                  </div>
                )}
                {!selectedEmp.joinDate && (
                  <p className="text-sm text-muted-foreground text-center py-4">입사일이 등록되지 않았습니다.</p>
                )}
                {selectedEmp.pendingCount > 0 && (
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200">대기</Badge>
                      <span className="text-sm">승인 대기 중인 요청</span>
                    </div>
                    <span className="text-sm font-medium">{selectedEmp.pendingCount}건</span>
                  </div>
                )}
              </div>

              {/* Manual Adjustments History */}
              {selectedAdjustments.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Gift className="h-4 w-4 text-primary" />
                    추가 부여/차감 내역
                  </h3>
                  <div className="space-y-2">
                    {selectedAdjustments.map(adj => (
                      <div key={adj.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          {adj.adjustment_type === 'grant' ? (
                            <Plus className="h-4 w-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Minus className="h-4 w-4 text-destructive shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {adj.leave_category === 'annual' ? '연차' :
                                 adj.leave_category === 'monthly' ? '월차' :
                                 adj.leave_category === 'special' ? '특별휴가' :
                                 adj.leave_category === 'reward' ? '포상' : '기타'}
                              </Badge>
                              <span className="font-medium">
                                {adj.adjustment_type === 'grant' ? '+' : '-'}{Number(adj.days)}일
                              </span>
                            </div>
                            {adj.reason && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{adj.reason}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {format(new Date(adj.created_at), 'yyyy.MM.dd')} · {adj.granted_by_name}
                              {adj.expires_at && ` · 만료 ${format(new Date(adj.expires_at), 'yyyy.MM.dd')}`}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteAdjustment(adj.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="h-full flex items-center justify-center border rounded-lg">
            <div className="text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">직원을 선택하면 연차 상세 내역을 확인할 수 있습니다</p>
            </div>
          </div>
        )}
      </div>

      {/* Adjustment Dialog */}
      <LeaveAdjustmentDialog
        open={adjustDialogOpen}
        onOpenChange={setAdjustDialogOpen}
        employee={selectedEmp ? { id: selectedEmp.id, full_name: selectedEmp.full_name } : null}
        onSuccess={refreshAdjustments}
      />
    </div>
  );
};

export default AdminLeaveOverview;
