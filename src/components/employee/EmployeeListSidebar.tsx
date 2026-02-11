import React from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Users, Phone, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type AppRoleType = 'admin' | 'moderator' | 'manager' | 'employee';

export const ROLE_BADGE_MAP: Record<AppRoleType, { label: string; className: string } | null> = {
  admin: { label: '관리자', className: 'text-red-500' },
  moderator: { label: '중간관리자', className: 'text-blue-500' },
  manager: null,
  employee: null,
};

export const RoleStar: React.FC<{ role: AppRoleType | undefined }> = ({ role }) => {
  if (!role) return null;
  const info = ROLE_BADGE_MAP[role];
  if (!info) return null;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Star className={cn("h-3.5 w-3.5 shrink-0 fill-current", info.className)} />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {info.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export interface EmployeeProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  is_approved: boolean;
  created_at: string;
  employee_number: string;
  birthday: string;
  address: string;
  detail_address: string;
  zipcode: string;
  nationality: string;
  bank_name: string;
  bank_account: string;
  join_date: string;
  job_title: string;
  job_group: string;
  rank_title: string;
  rank_level: string;
  nickname: string;
  personal_email: string;
  work_type: string;
  work_hours_per_week: number;
  overtime_policy: string;
  salary_info: string;
  wage_contract: string;
  leave_policy: string;
  holidays: string;
  leave_history: string;
  awards: string;
  disciplinary: string;
  career_history: string;
  education: string;
  special_notes: string;
  family_info: string;
  avatar_url: string;
  resident_registration_number: string;
  group_join_date: string;
  join_type: string;
  family_basic_deduction: number;
  family_child_tax_credit: number;
  family_health_dependents: number;
}

interface EmployeeListSidebarProps {
  employees: EmployeeProfile[];
  selectedId: string | null;
  search: string;
  onSearchChange: (val: string) => void;
  departmentFilter: string;
  onDepartmentFilterChange: (val: string) => void;
  onSelect: (emp: EmployeeProfile) => void;
  departments: string[];
  employeeRoles?: Record<string, AppRoleType>;
}

const EmployeeListSidebar: React.FC<EmployeeListSidebarProps> = ({
  employees, selectedId, search, onSearchChange,
  departmentFilter, onDepartmentFilterChange,
  onSelect, departments, employeeRoles = {},
}) => {
  return (
    <div className="w-full lg:w-80 xl:w-96 border-r bg-card flex flex-col shrink-0 self-stretch overflow-hidden" style={{ minHeight: 0 }}>
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            구성원
          </h2>
          <Badge variant="secondary" className="text-xs">
            {employees.length}명
          </Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="이름, 이메일, 부서 검색"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        {/* Department filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onDepartmentFilterChange('')}
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
              onClick={() => onDepartmentFilterChange(dept === departmentFilter ? '' : dept)}
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
          {employees.map(emp => (
            <button
              key={emp.id}
              onClick={() => onSelect(emp)}
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
                    <RoleStar role={employeeRoles[emp.id]} />
                    {!emp.is_approved && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-300 text-amber-600">
                        미승인
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
              </div>
            </button>
          ))}
          {employees.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              검색 결과가 없습니다
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default EmployeeListSidebar;
