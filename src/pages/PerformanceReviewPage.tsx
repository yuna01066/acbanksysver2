import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, Search, Loader2, User, Shield, AlertTriangle, CalendarDays, ArrowLeft, ChevronRight, Users } from 'lucide-react';
import PerformanceReviewPanel from '@/components/employee/PerformanceReviewPanel';
import AdminReviewDashboard from '@/components/performance/AdminReviewDashboard';
import IncidentReportPanel from '@/components/performance/IncidentReportPanel';
import ProfileAvatarImage from '@/components/employee/ProfileAvatarImage';

interface Employee {
  id: string;
  full_name: string;
  department: string | null;
  position: string | null;
  avatar_url: string | null;
}

interface ReviewCycle {
  id: string;
  title: string;
  year: number;
  quarter: number;
  status: string;
}

const PerformanceReviewPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, isModerator } = useAuth();
  const canAccessAdmin = isAdmin || isModerator;

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="border-b bg-card/90">
        <div className="container max-w-6xl mx-auto px-4 py-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Star className="h-6 w-6 text-primary" />
              업무 평가
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              분기별 평가를 작성하고 관리자 검토 결과를 정리합니다.
            </p>
          </div>
          <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-xs">
            6각형 역량 기준
          </Badge>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 py-6">
        {canAccessAdmin ? (
          <Tabs defaultValue="review">
            <TabsList className="mb-5 h-auto rounded-2xl border bg-background/80 p-1 shadow-sm">
              <TabsTrigger value="review" className="gap-1.5">
                <Star className="h-3.5 w-3.5" /> 평가하기
              </TabsTrigger>
              <TabsTrigger value="incidents" className="gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> 사고 경위서
              </TabsTrigger>
              <TabsTrigger value="admin" className="gap-1.5">
                <Shield className="h-3.5 w-3.5" /> 관리자 대시보드
              </TabsTrigger>
            </TabsList>

            <TabsContent value="review">
              <ReviewEmployeeList />
            </TabsContent>

            <TabsContent value="incidents">
              <IncidentReportPanel isAdminView={true} />
            </TabsContent>

            <TabsContent value="admin">
              <AdminReviewDashboard />
            </TabsContent>
          </Tabs>
        ) : (
          <Tabs defaultValue="review">
            <TabsList className="mb-5 h-auto rounded-2xl border bg-background/80 p-1 shadow-sm">
              <TabsTrigger value="review" className="gap-1.5">
                <Star className="h-3.5 w-3.5" /> 평가하기
              </TabsTrigger>
              <TabsTrigger value="my-incidents" className="gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> 내 경위서
              </TabsTrigger>
            </TabsList>

            <TabsContent value="review">
              <ReviewEmployeeList />
            </TabsContent>

            <TabsContent value="my-incidents">
              <IncidentReportPanel isAdminView={false} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

const ReviewEmployeeList: React.FC = () => {
  const [searchParams] = useSearchParams();
  const resumeCycleId = searchParams.get('cycleId') || '';
  const resumeRevieweeId = searchParams.get('revieweeId') || '';
  const shouldResumeDraft = searchParams.get('resume') === '1';
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [resumeSelectionConsumed, setResumeSelectionConsumed] = useState(false);

  // Load cycles on mount
  useEffect(() => {
    const fetchCycles = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('performance_review_cycles')
        .select('id, title, year, quarter, status')
        .order('year', { ascending: false })
        .order('quarter', { ascending: false });
      if (data && data.length > 0) {
        setCycles(data as ReviewCycle[]);
        // Default to first active cycle, or first cycle
        const active = data.find(c => c.status === 'active');
        const requestedCycle = resumeCycleId ? data.find(c => c.id === resumeCycleId) : null;
        setSelectedCycleId(requestedCycle ? requestedCycle.id : active ? active.id : data[0].id);
      }
      setLoading(false);
    };
    fetchCycles();
  }, [resumeCycleId]);

  // Load target employees when cycle changes
  useEffect(() => {
    if (!selectedCycleId) {
      setEmployees([]);
      return;
    }
    const fetchTargets = async () => {
      setEmployeesLoading(true);
      // Get target user IDs for this cycle
      const { data: targets } = await supabase
        .from('review_cycle_targets')
        .select('user_id, user_name')
        .eq('cycle_id', selectedCycleId);

      if (targets && targets.length > 0) {
        const userIds = targets.map(t => t.user_id);
        const { data: profiles } = await (supabase.from('profile_directory' as any) as any)
          .select('id, full_name, department, position, avatar_url')
          .in('id', userIds)
          .order('full_name');
        setEmployees(profiles || []);
      } else {
        setEmployees([]);
      }
      setEmployeesLoading(false);
    };
    fetchTargets();
  }, [selectedCycleId]);

  useEffect(() => {
    if (resumeSelectionConsumed || !resumeRevieweeId || employees.length === 0) return;

    const target = employees.find(emp => emp.id === resumeRevieweeId);
    if (!target) return;

    setSelectedEmployee(target);
    setResumeSelectionConsumed(true);
  }, [employees, resumeRevieweeId, resumeSelectionConsumed]);

  const filteredEmployees = employees.filter(e => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return e.full_name.toLowerCase().includes(s) ||
      (e.department && e.department.toLowerCase().includes(s)) ||
      (e.position && e.position.toLowerCase().includes(s));
  });

  const selectedCycle = cycles.find(c => c.id === selectedCycleId);
  const selectedCycleStatusLabel = selectedCycle?.status === 'active' ? '진행중' : selectedCycle?.status === 'closed' ? '종료' : '대기';

  if (selectedEmployee) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="outline" size="sm" onClick={() => setSelectedEmployee(null)} className="shrink-0 rounded-xl">
            <ArrowLeft className="h-4 w-4 mr-1" /> 직원 목록
          </Button>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              {selectedEmployee.avatar_url ? (
                <ProfileAvatarImage src={selectedEmployee.avatar_url} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <User className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-base truncate">{selectedEmployee.full_name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {[selectedEmployee.department, selectedEmployee.position].filter(Boolean).join(' · ') || '부서 정보 없음'}
              </div>
            </div>
          </div>
          {selectedCycle && (
            <Badge variant="outline" className="w-fit rounded-full text-xs">
              <CalendarDays className="h-3 w-3 mr-1" />
              {selectedCycle.title}
            </Badge>
          )}
        </div>
        <PerformanceReviewPanel
          userId={selectedEmployee.id}
          userName={selectedEmployee.full_name}
          initialCycleId={selectedCycleId}
          autoOpenDraft={shouldResumeDraft && selectedEmployee.id === resumeRevieweeId}
        />
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card className="border bg-card/95 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold">평가 대상 선택</p>
              <p className="mt-1 text-xs text-muted-foreground">
                평가 주기를 선택한 뒤 대상자를 눌러 평가를 작성합니다.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedCycleId} onValueChange={v => { setSelectedCycleId(v); setSearch(''); }}>
                <SelectTrigger className="h-10 w-full rounded-xl text-sm sm:w-64">
                  <SelectValue placeholder="평가 주기 선택" />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        {c.title}
                        {c.status === 'active' && <Badge className="text-[10px] px-1.5 py-0">진행중</Badge>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCycle && (
                <Badge variant="secondary" className="h-9 rounded-full px-3 text-xs">
                  {selectedCycleStatusLabel}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="이름, 부서, 직급으로 검색..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-11 rounded-xl pl-9 text-sm"
              />
            </div>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border bg-background px-3 py-2">
                대상 {employees.length}명
              </span>
              <span className="rounded-full border bg-background px-3 py-2">
                표시 {filteredEmployees.length}명
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedCycleId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            평가 주기를 선택해주세요.
          </CardContent>
        </Card>
      ) : employeesLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : employees.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            이 주기에 지정된 평가 대상자가 없습니다.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            평가 대상자
          </div>
          {filteredEmployees.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">검색 결과가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filteredEmployees.map(emp => (
                <Card
                  key={emp.id}
                  className="group cursor-pointer border bg-card transition-all hover:border-primary/40 hover:shadow-sm"
                  onClick={() => setSelectedEmployee(emp)}
                >
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        {emp.avatar_url ? (
                          <ProfileAvatarImage src={emp.avatar_url} className="w-11 h-11 rounded-full object-cover" />
                        ) : (
                          <User className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{emp.full_name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {emp.department && <Badge variant="secondary" className="rounded-full text-xs">{emp.department}</Badge>}
                          {emp.position && <span className="text-xs text-muted-foreground">{emp.position}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground group-hover:text-primary">
                      평가 작성
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PerformanceReviewPage;
