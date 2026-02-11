import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Users, FileText, BarChart3, FileSignature, Shield, TableProperties } from 'lucide-react';
import EmployeeListSidebar, { type EmployeeProfile, type AppRoleType } from '@/components/employee/EmployeeListSidebar';
import EmployeeTableView from '@/components/employee/EmployeeTableView';
import EmployeeProfileDetail from '@/components/employee/EmployeeProfileDetail';
import DocumentBoxSettings from '@/components/employee/DocumentBoxSettings';
import DocumentSubmissionDashboard from '@/components/employee/DocumentSubmissionDashboard';
import ContractManagement from '@/components/contract/ContractManagement';
import UserAccountManagement from '@/components/employee/UserAccountManagement';

const mapProfileData = (d: any): EmployeeProfile => ({
  id: d.id, full_name: d.full_name || '', email: d.email || '', phone: d.phone || '',
  department: d.department || '', position: d.position || '', is_approved: d.is_approved ?? false,
  created_at: d.created_at || '', employee_number: d.employee_number || '',
  birthday: d.birthday || '', address: d.address || '', detail_address: d.detail_address || '',
  zipcode: d.zipcode || '', nationality: d.nationality || '', bank_name: d.bank_name || '',
  bank_account: d.bank_account || '', join_date: d.join_date || '', job_title: d.job_title || '',
  job_group: d.job_group || '', rank_title: d.rank_title || '', rank_level: d.rank_level || '',
  nickname: d.nickname || '', personal_email: d.personal_email || '', work_type: d.work_type || '',
  work_hours_per_week: d.work_hours_per_week ?? 40, overtime_policy: d.overtime_policy || '',
  salary_info: d.salary_info || '', wage_contract: d.wage_contract || '',
  leave_policy: d.leave_policy || '', holidays: d.holidays || '', leave_history: d.leave_history || '',
  awards: d.awards || '', disciplinary: d.disciplinary || '', career_history: d.career_history || '',
  education: d.education || '', special_notes: d.special_notes || '', family_info: d.family_info || '',
  avatar_url: d.avatar_url || '',
  resident_registration_number: d.resident_registration_number || '',
  group_join_date: d.group_join_date || '',
  join_type: d.join_type || '',
  family_basic_deduction: d.family_basic_deduction ?? 1,
  family_child_tax_credit: d.family_child_tax_credit ?? 0,
  family_health_dependents: d.family_health_dependents ?? 0,
});

const EmployeeProfileManagementPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin, userRole, loading: authLoading } = useAuth();
  const isModerator = userRole === 'moderator';
  const hasAccess = isAdmin || isModerator;
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeProfile | null>(null);
  const [activeTab, setActiveTab] = useState<string>('employees');
  const [employeeRoles, setEmployeeRoles] = useState<Record<string, AppRoleType>>({});
  const [sortMode, setSortMode] = useState<'name' | 'role'>('role');

  useEffect(() => {
    if (!authLoading && (!user || !hasAccess)) {
      toast.error('관리자 또는 중간관리자만 접근할 수 있습니다.');
      navigate('/');
    }
  }, [user, hasAccess, authLoading, navigate]);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });
    if (!error && data) {
      setEmployees(data.map(mapProfileData));
    }
    setLoading(false);
  };

  const fetchRoles = async () => {
    const { data } = await supabase.from('user_roles').select('user_id, role');
    if (data) {
      const roleMap: Record<string, AppRoleType> = {};
      // Priority: admin > moderator > manager > employee
      const priority: AppRoleType[] = ['employee', 'manager', 'moderator', 'admin'];
      for (const r of data) {
        const current = roleMap[r.user_id];
        const newIdx = priority.indexOf(r.role as AppRoleType);
        const curIdx = current ? priority.indexOf(current) : -1;
        if (newIdx > curIdx) roleMap[r.user_id] = r.role as AppRoleType;
      }
      setEmployeeRoles(roleMap);
    }
  };

  useEffect(() => {
    if (user && hasAccess) {
      fetchEmployees();
      fetchRoles();
    }
  }, [user, hasAccess]);

  const departments = useMemo(() => {
    const depts = new Set(employees.map(e => e.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [employees]);

  const ROLE_PRIORITY: Record<string, number> = { admin: 0, moderator: 1, manager: 2, employee: 3 };

  const filteredEmployees = useMemo(() => {
    return employees
      .filter(e => {
        if (departmentFilter && e.department !== departmentFilter) return false;
        if (!search.trim()) return true;
        const s = search.toLowerCase();
        return e.full_name.toLowerCase().includes(s) || e.email.toLowerCase().includes(s) ||
          e.department.toLowerCase().includes(s) || e.phone.includes(s);
      })
      .sort((a, b) => {
        if (sortMode === 'role') {
          const ra = ROLE_PRIORITY[employeeRoles[a.id] || 'employee'] ?? 3;
          const rb = ROLE_PRIORITY[employeeRoles[b.id] || 'employee'] ?? 3;
          if (ra !== rb) return ra - rb;
        }
        return a.full_name.localeCompare(b.full_name, 'ko');
      });
  }, [employees, search, departmentFilter, sortMode, employeeRoles]);

  const handleEmployeeUpdated = (updated: EmployeeProfile) => {
    setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
    setSelectedEmployee(updated);
  };

  const handleRoleChanged = useCallback((userId: string, newRole: AppRoleType) => {
    setEmployeeRoles(prev => ({ ...prev, [userId]: newRole }));
  }, []);

  if (authLoading || !hasAccess) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      {/* Top Bar */}
      <div className="border-b px-4 py-2 flex items-center justify-between bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin-settings')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-base font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            구성원 관리
          </h1>
        </div>
        <TabsList className="bg-muted h-8">
          <TabsTrigger value="employees" className="text-xs h-7 gap-1">
            <Users className="h-3.5 w-3.5" /> 구성원
          </TabsTrigger>
          <TabsTrigger value="employee-table" className="text-xs h-7 gap-1">
            <TableProperties className="h-3.5 w-3.5" /> 구성원 목록
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="document-settings" className="text-xs h-7 gap-1">
                <FileText className="h-3.5 w-3.5" /> 문서함 설정
              </TabsTrigger>
              <TabsTrigger value="document-status" className="text-xs h-7 gap-1">
                <BarChart3 className="h-3.5 w-3.5" /> 제출 현황
              </TabsTrigger>
              <TabsTrigger value="contracts" className="text-xs h-7 gap-1">
                <FileSignature className="h-3.5 w-3.5" /> 전자계약
              </TabsTrigger>
              <TabsTrigger value="accounts" className="text-xs h-7 gap-1">
                <Shield className="h-3.5 w-3.5" /> 계정/권한
              </TabsTrigger>
            </>
          )}
        </TabsList>
      </div>

      {/* Content area - rendered outside TabsContent to avoid Radix display issues */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeTab === 'employees' && (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                <EmployeeListSidebar
                  employees={filteredEmployees}
                  selectedId={selectedEmployee?.id || null}
                  search={search}
                  onSearchChange={setSearch}
                  departmentFilter={departmentFilter}
                  onDepartmentFilterChange={setDepartmentFilter}
                  onSelect={setSelectedEmployee}
                  departments={departments}
                  employeeRoles={employeeRoles}
                  sortMode={sortMode}
                  onSortModeChange={setSortMode}
                />
                {selectedEmployee ? (
                  <EmployeeProfileDetail
                    key={selectedEmployee.id}
                    employee={selectedEmployee}
                    onUpdated={handleEmployeeUpdated}
                    currentRole={employeeRoles[selectedEmployee.id]}
                    onRoleChanged={handleRoleChanged}
                  />
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
        )}

        {activeTab === 'employee-table' && (
          <div className="flex flex-1 min-h-0">
            <EmployeeTableView
              employees={filteredEmployees}
              search={search}
              onSearchChange={setSearch}
              departmentFilter={departmentFilter}
              onDepartmentFilterChange={setDepartmentFilter}
              departments={departments}
              onSelect={(emp) => {
                setSelectedEmployee(emp);
                setActiveTab('employees');
              }}
            />
          </div>
        )}

        {activeTab === 'document-settings' && (
          <div className="flex-1 overflow-y-auto">
            <div className="container max-w-3xl mx-auto px-6 py-8">
              <DocumentBoxSettings />
            </div>
          </div>
        )}

        {activeTab === 'document-status' && (
          <div className="flex-1 overflow-y-auto">
            <div className="container max-w-5xl mx-auto px-6 py-8">
              <h2 className="text-lg font-bold mb-4">서류 제출 현황</h2>
              <DocumentSubmissionDashboard />
            </div>
          </div>
        )}

        {activeTab === 'contracts' && (
          <div className="flex-1 overflow-y-auto">
            <div className="container max-w-6xl mx-auto px-6 py-6">
              <ContractManagement />
            </div>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="flex-1 overflow-y-auto">
            <div className="container max-w-5xl mx-auto px-6 py-8">
              <UserAccountManagement />
            </div>
          </div>
        )}
      </div>
    </Tabs>
  );
};

export default EmployeeProfileManagementPage;
