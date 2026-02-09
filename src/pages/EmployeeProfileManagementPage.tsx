import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import EmployeeListSidebar, { type EmployeeProfile } from '@/components/employee/EmployeeListSidebar';
import EmployeeProfileDetail from '@/components/employee/EmployeeProfileDetail';

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
});

const EmployeeProfileManagementPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeProfile | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      toast.error('관리자만 접근할 수 있습니다.');
      navigate('/');
    }
  }, [user, isAdmin, authLoading, navigate]);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');
    if (!error && data) {
      setEmployees(data.map(mapProfileData));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user && isAdmin) fetchEmployees();
  }, [user, isAdmin]);

  const departments = useMemo(() => {
    const depts = new Set(employees.map(e => e.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      if (departmentFilter && e.department !== departmentFilter) return false;
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return e.full_name.toLowerCase().includes(s) || e.email.toLowerCase().includes(s) ||
        e.department.toLowerCase().includes(s) || e.phone.includes(s);
    });
  }, [employees, search, departmentFilter]);

  const handleEmployeeUpdated = (updated: EmployeeProfile) => {
    setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
    setSelectedEmployee(updated);
  };

  if (authLoading || !isAdmin) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="h-screen flex flex-col bg-background">
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
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
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
            />
            {selectedEmployee ? (
              <EmployeeProfileDetail
                key={selectedEmployee.id}
                employee={selectedEmployee}
                onUpdated={handleEmployeeUpdated}
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
    </div>
  );
};

export default EmployeeProfileManagementPage;
