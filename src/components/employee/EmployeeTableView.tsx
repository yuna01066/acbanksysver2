import React, { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter } from 'lucide-react';
import AvatarUpload from './AvatarUpload';
import type { EmployeeProfile } from './EmployeeListSidebar';

interface EmployeeTableViewProps {
  employees: EmployeeProfile[];
  search: string;
  onSearchChange: (v: string) => void;
  departmentFilter: string;
  onDepartmentFilterChange: (v: string) => void;
  departments: string[];
  onSelect: (e: EmployeeProfile) => void;
}

const calcTenure = (joinDate: string | null): string => {
  if (!joinDate) return '-';
  const join = new Date(joinDate);
  const now = new Date();
  const diffMs = now.getTime() - join.getTime();
  const totalMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years > 0 && months > 0) return `${years}년 ${months}개월`;
  if (years > 0) return `${years}년`;
  if (months > 0) return `${months}개월`;
  return '1개월 미만';
};

const formatDate = (d: string | null): string => {
  if (!d) return '-';
  const date = new Date(d);
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}`;
};

const EmployeeTableView: React.FC<EmployeeTableViewProps> = ({
  employees, search, onSearchChange, departmentFilter, onDepartmentFilterChange, departments, onSelect,
}) => {
  const statusTabs = ['전체', '재직', '퇴사'] as const;
  const [statusFilter, setStatusFilter] = React.useState<string>('전체');

  const filtered = useMemo(() => {
    return employees.filter(e => {
      if (statusFilter === '재직') return e.is_approved;
      if (statusFilter === '퇴사') return !e.is_approved;
      return true;
    });
  }, [employees, statusFilter]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 space-y-4 shrink-0">
        {/* Status tabs */}
        <div className="flex items-center gap-4 border-b">
          {statusTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                statusFilter === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
              {tab === '전체' && (
                <span className="ml-1.5 text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
                  {employees.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="이름, 이메일, 전화번호 검색"
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              className="pl-9 w-64 h-9 text-sm"
            />
          </div>
          <Select value={departmentFilter || '_all'} onValueChange={v => onDepartmentFilterChange(v === '_all' ? '' : v)}>
            <SelectTrigger className="w-40 h-9 text-sm">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="부서 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">부서 전체</SelectItem>
              {departments.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length}명</span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[200px] text-xs">이름</TableHead>
              <TableHead className="text-xs">재직 상태</TableHead>
              <TableHead className="text-xs">사번</TableHead>
              <TableHead className="text-xs">입사일</TableHead>
              <TableHead className="text-xs">근속 기간</TableHead>
              <TableHead className="text-xs">이메일</TableHead>
              <TableHead className="text-xs">휴대전화번호</TableHead>
              <TableHead className="text-xs">부서</TableHead>
              <TableHead className="text-xs">직위 · 직책</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                  검색 결과가 없습니다
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(emp => (
                <TableRow
                  key={emp.id}
                  className="cursor-pointer"
                  onClick={() => onSelect(emp)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2.5">
                      <AvatarUpload
                        userId={emp.id}
                        avatarUrl={emp.avatar_url || null}
                        name={emp.full_name}
                        size="sm"
                      />
                      <div>
                        <div className="text-sm font-medium">{emp.full_name}</div>
                        {emp.position && (
                          <div className="text-xs text-muted-foreground">{emp.position}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={emp.is_approved ? 'default' : 'secondary'} className="text-xs font-normal">
                      {emp.is_approved ? '재직' : '미승인'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {emp.employee_number || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(emp.join_date)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {calcTenure(emp.join_date)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[180px]">
                    {emp.email || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {emp.phone || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {emp.department || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[emp.rank_title, emp.job_title].filter(Boolean).join(' · ') || '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default EmployeeTableView;
