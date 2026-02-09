import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Users, Search, Clock, CalendarDays, Briefcase, FileText, Mail, Phone, Hash, Building2, Calendar, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInMonths, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import EmployeeAttendancePanel from '@/components/employee/EmployeeAttendancePanel';
import EmployeeLeavePanel from '@/components/employee/EmployeeLeavePanel';
import AvatarUpload from '@/components/employee/AvatarUpload';
import PerformanceReviewPanel from '@/components/employee/PerformanceReviewPanel';
import ReviewCycleManager from '@/components/employee/ReviewCycleManager';

interface WorkEmployee {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  join_date: string;
  employee_number: string;
  avatar_url: string;
  work_type: string;
  work_hours_per_week: number;
  rank_title: string;
  is_approved: boolean;
}

const EmployeeWorkManagementPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin, userRole, loading: authLoading } = useAuth();
  const [employees, setEmployees] = useState<WorkEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<WorkEmployee | null>(null);

  const isModerator = userRole === 'moderator';
  const hasAccess = isAdmin || isModerator;

  useEffect(() => {
    if (!authLoading && (!user || !hasAccess)) {
      toast.error('관리자 또는 중간관리자만 접근할 수 있습니다.');
      navigate('/');
    }
  }, [user, hasAccess, authLoading, navigate]);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, department, position, join_date, employee_number, avatar_url, work_type, work_hours_per_week, rank_title, is_approved')
      .order('full_name', { ascending: true });
    if (!error && data) {
      setEmployees(data.map((d: any) => ({
        id: d.id, full_name: d.full_name || '', email: d.email || '', phone: d.phone || '',
        department: d.department || '', position: d.position || '', join_date: d.join_date || '',
        employee_number: d.employee_number || '', avatar_url: d.avatar_url || '',
        work_type: d.work_type || '', work_hours_per_week: d.work_hours_per_week ?? 40,
        rank_title: d.rank_title || '', is_approved: d.is_approved ?? false,
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user && hasAccess) fetchEmployees();
  }, [user, hasAccess]);

  const departments = useMemo(() => {
    const depts = new Set(employees.map(e => e.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees
      .filter(e => {
        if (departmentFilter && e.department !== departmentFilter) return false;
        if (!search.trim()) return true;
        const s = search.toLowerCase();
        return e.full_name.toLowerCase().includes(s) || e.email.toLowerCase().includes(s) ||
          e.department.toLowerCase().includes(s) || e.phone.includes(s);
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'ko'));
  }, [employees, search, departmentFilter]);

  const getTenureBadge = (joinDate: string) => {
    if (!joinDate) return null;
    const jd = new Date(joinDate);
    const now = new Date();
    const months = differenceInMonths(now, jd);
    const days = differenceInDays(now, jd) - months * 30;
    if (months > 0) return `${months}개월 ${days > 0 ? days + '일' : ''} 재직`;
    return `${differenceInDays(now, jd)}일 재직`;
  };

  if (authLoading || !hasAccess) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <div className="border-b px-4 py-2 flex items-center gap-3 bg-card shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin-settings')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          직원 근무 관리
        </h1>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            {/* Sidebar */}
            <div className="w-full lg:w-80 xl:w-96 border-r bg-card flex flex-col h-full">
              <div className="p-4 border-b space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    구성원
                  </h2>
                  <Badge variant="secondary" className="text-xs">{filteredEmployees.length}명</Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="이름, 이메일, 부서 검색" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setDepartmentFilter('')} className={cn("px-2.5 py-1 rounded-full text-xs font-medium transition-colors", !departmentFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                    전체
                  </button>
                  {departments.map(dept => (
                    <button key={dept} onClick={() => setDepartmentFilter(dept === departmentFilter ? '' : dept)} className={cn("px-2.5 py-1 rounded-full text-xs font-medium transition-colors", dept === departmentFilter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                      {dept}
                    </button>
                  ))}
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="divide-y">
                  {filteredEmployees.map(emp => (
                    <button key={emp.id} onClick={() => setSelectedEmployee(emp)} className={cn("w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors", selectedEmployee?.id === emp.id && "bg-accent border-l-2 border-l-primary")}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-bold text-primary shrink-0 overflow-hidden">
                          {emp.avatar_url ? <img src={emp.avatar_url} alt={emp.full_name} className="w-full h-full object-cover" /> : emp.full_name?.charAt(0) || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium truncate block">{emp.full_name}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            {emp.department && <span className="text-xs text-muted-foreground">{emp.department}</span>}
                            {emp.department && emp.position && <span className="text-xs text-muted-foreground">·</span>}
                            {emp.position && <span className="text-xs text-muted-foreground">{emp.position}</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">검색 결과가 없습니다</div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Detail */}
            {selectedEmployee ? (
              <div className="flex-1 flex flex-col h-full min-w-0">
                {/* Profile Header - simplified */}
                <div className="p-6 border-b bg-card">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-lg font-bold text-primary shrink-0 overflow-hidden">
                      {selectedEmployee.avatar_url ? <img src={selectedEmployee.avatar_url} alt={selectedEmployee.full_name} className="w-full h-full object-cover" /> : selectedEmployee.full_name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-xl font-bold truncate">{selectedEmployee.full_name}</h1>
                        {selectedEmployee.join_date && getTenureBadge(selectedEmployee.join_date) && (
                          <Badge variant="secondary" className="text-xs">{getTenureBadge(selectedEmployee.join_date)}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {selectedEmployee.department || '부서 미설정'}
                        {selectedEmployee.position && ` · ${selectedEmployee.position}`}
                        {selectedEmployee.rank_title && ` · ${selectedEmployee.rank_title}`}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{selectedEmployee.email}</span>
                        {selectedEmployee.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{selectedEmployee.phone}</span>}
                        {selectedEmployee.employee_number && <span className="flex items-center gap-1"><Hash className="h-3 w-3" />사번 {selectedEmployee.employee_number}</span>}
                        {selectedEmployee.join_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />입사일 {format(new Date(selectedEmployee.join_date), 'yyyy.MM.dd')}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="attendance" className="flex-1 flex flex-col min-h-0">
                  <div className="border-b px-6">
                    <TabsList className="bg-transparent h-10 p-0 gap-0">
                      <TabsTrigger value="attendance" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 text-sm">
                        <Clock className="h-3.5 w-3.5 mr-1.5" />근태기록
                      </TabsTrigger>
                      <TabsTrigger value="leave" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 text-sm">
                        <CalendarDays className="h-3.5 w-3.5 mr-1.5" />연차·휴가
                      </TabsTrigger>
                      <TabsTrigger value="review" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 text-sm">
                        <Star className="h-3.5 w-3.5 mr-1.5" />업무평가
                      </TabsTrigger>
                      <TabsTrigger value="work-info" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 text-sm">
                        <Briefcase className="h-3.5 w-3.5 mr-1.5" />근무 정보
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="px-6 pb-6">
                      <TabsContent value="attendance" className="mt-0 py-4">
                        <EmployeeAttendancePanel userId={selectedEmployee.id} userName={selectedEmployee.full_name} />
                      </TabsContent>
                      <TabsContent value="leave" className="mt-0 py-4">
                        <EmployeeLeavePanel userId={selectedEmployee.id} />
                      </TabsContent>
                      <TabsContent value="review" className="mt-0 py-4">
                        <PerformanceReviewPanel userId={selectedEmployee.id} userName={selectedEmployee.full_name} summaryOnly />
                        <div className="mt-3 flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={() => navigate(`/review-settings?tab=history&employeeId=${selectedEmployee.id}`)}
                          >
                            <Star className="h-3.5 w-3.5" /> 평가 더보기
                          </Button>
                        </div>
                      </TabsContent>
                      <TabsContent value="work-info" className="mt-0 py-4">
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-lg border bg-card">
                              <p className="text-xs text-muted-foreground mb-1">근무 유형</p>
                              <p className="text-sm font-medium">{selectedEmployee.work_type || '미설정'}</p>
                            </div>
                            <div className="p-4 rounded-lg border bg-card">
                              <p className="text-xs text-muted-foreground mb-1">주당 근무시간</p>
                              <p className="text-sm font-medium">주 {selectedEmployee.work_hours_per_week}시간</p>
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                    </div>
                  </ScrollArea>
                </Tabs>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">좌측에서 구성원을 선택하세요</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default EmployeeWorkManagementPage;
