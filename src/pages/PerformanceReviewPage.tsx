import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Star, Search, Loader2, User, Shield, AlertTriangle, CalendarDays } from 'lucide-react';
import PerformanceReviewPanel from '@/components/employee/PerformanceReviewPanel';
import AdminReviewDashboard from '@/components/performance/AdminReviewDashboard';
import IncidentReportPanel from '@/components/performance/IncidentReportPanel';

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
    <div className="min-h-screen bg-background">
      <div className="border-b px-4 py-3 flex items-center gap-3 bg-card">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" />
          업무 평가
        </h1>
      </div>

      <div className="container max-w-5xl mx-auto px-4 py-6">
        {canAccessAdmin ? (
          <Tabs defaultValue="review">
            <TabsList className="mb-4">
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
            <TabsList className="mb-4">
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
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

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
        setSelectedCycleId(active ? active.id : data[0].id);
      }
      setLoading(false);
    };
    fetchCycles();
  }, []);

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
        const { data: profiles } = await supabase
          .from('profiles')
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

  const filteredEmployees = employees.filter(e => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return e.full_name.toLowerCase().includes(s) ||
      (e.department && e.department.toLowerCase().includes(s)) ||
      (e.position && e.position.toLowerCase().includes(s));
  });

  const selectedCycle = cycles.find(c => c.id === selectedCycleId);

  if (selectedEmployee) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setSelectedEmployee(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> 직원 목록
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              {selectedEmployee.avatar_url ? (
                <img src={selectedEmployee.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <User className="h-4 w-4 text-primary" />
              )}
            </div>
            <div>
              <span className="font-semibold text-sm">{selectedEmployee.full_name}</span>
              {selectedEmployee.department && (
                <span className="text-xs text-muted-foreground ml-2">{selectedEmployee.department}</span>
              )}
            </div>
          </div>
          {selectedCycle && (
            <Badge variant="outline" className="text-xs ml-auto">
              <CalendarDays className="h-3 w-3 mr-1" />{selectedCycle.title}
            </Badge>
          )}
        </div>
        <PerformanceReviewPanel userId={selectedEmployee.id} userName={selectedEmployee.full_name} />
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Cycle selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedCycleId} onValueChange={v => { setSelectedCycleId(v); setSearch(''); }}>
          <SelectTrigger className="w-60 h-9 text-sm">
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
        {employees.length > 0 && (
          <span className="text-xs text-muted-foreground">대상자 {employees.length}명</span>
        )}
      </div>

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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="이름, 부서, 직급으로 검색..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          {filteredEmployees.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">검색 결과가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredEmployees.map(emp => (
                <Card key={emp.id} className="cursor-pointer hover:border-primary/40 transition-all" onClick={() => setSelectedEmployee(emp)}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      {emp.avatar_url ? (
                        <img src={emp.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{emp.full_name}</p>
                      <div className="flex items-center gap-1.5">
                        {emp.department && <Badge variant="secondary" className="text-xs">{emp.department}</Badge>}
                        {emp.position && <span className="text-xs text-muted-foreground">{emp.position}</span>}
                      </div>
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
