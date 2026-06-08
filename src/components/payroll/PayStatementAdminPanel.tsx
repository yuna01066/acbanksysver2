import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FilePlus2, Loader2, Pencil, RotateCcw, Search, Wallet, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdminPayStatements, usePayrollProfiles, usePayrollRateVersions, type PayStatement, type PayStatementSaveInput } from '@/hooks/useHrSelfService';
import PayStatementEditor from '@/components/payroll/PayStatementEditor';
import PayStatementPreview, { formatPayrollAmount } from '@/components/payroll/PayStatementPreview';
import { calculatePayrollDraft, createDefaultPayrollRateVersion, type PayrollAttendanceRecord, type PayrollRateVersion } from '@/services/payrollCalculation';

type PayrollEmployee = {
  id: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
  position: string | null;
  employee_number: string | null;
};

const statusMeta = {
  draft: { label: '임시저장', className: 'border-slate-200 bg-slate-50 text-slate-700' },
  published: { label: '발행', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  voided: { label: '회수', className: 'border-red-200 bg-red-50 text-red-700' },
} as const;

const toMonthInput = (value?: string | null) => (value || new Date().toISOString()).slice(0, 7);
const formatMonth = (value: string) => format(new Date(value), 'yyyy년 M월', { locale: ko });
const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : '알 수 없는 오류';
const monthStart = (month: string) => `${month}-01`;
const monthEnd = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber, 0).toISOString().slice(0, 10);
};

const PayStatementAdminPanel: React.FC = () => {
  const [monthFilter, setMonthFilter] = useState(toMonthInput());
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'voided'>('all');
  const [search, setSearch] = useState('');
  const [editingStatement, setEditingStatement] = useState<PayStatement | null>(null);
  const [previewStatement, setPreviewStatement] = useState<PayStatement | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const { data: statements = [], isLoading, saveStatement, voidStatement } = useAdminPayStatements(true);
  const { data: payrollProfiles = [], saveProfile } = usePayrollProfiles(true);
  const { data: rateVersions = [], saveRateVersion } = usePayrollRateVersions(true);
  const activeRate = rateVersions.find((rate) => rate.is_active) || rateVersions[0] || createDefaultPayrollRateVersion();
  const [rateDraft, setRateDraft] = useState<PayrollRateVersion>(activeRate);

  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['payroll-employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, department, position, employee_number')
        .eq('is_approved', true)
        .order('full_name', { ascending: true });
      if (error) throw error;
      return (data || []) as PayrollEmployee[];
    },
  });

  const filteredStatements = useMemo(() => {
    const query = search.trim().toLowerCase();
    return statements.filter((statement) => {
      const monthMatches = !monthFilter || toMonthInput(statement.pay_month) === monthFilter;
      const statusMatches = statusFilter === 'all' || statement.status === statusFilter;
      const text = `${statement.profile?.full_name || ''} ${statement.profile?.email || ''} ${statement.profile?.department || ''} ${statement.profile?.employee_number || ''}`.toLowerCase();
      const searchMatches = query.length === 0 || text.includes(query);
      return monthMatches && statusMatches && searchMatches;
    });
  }, [monthFilter, search, statements, statusFilter]);

  const handleSave = async (input: PayStatementSaveInput) => {
    try {
      await saveStatement.mutateAsync(input);
      toast.success(input.status === 'published' ? '급여명세를 발행했습니다.' : '급여명세를 임시저장했습니다.');
      setEditorOpen(false);
      setEditingStatement(null);
    } catch (error: unknown) {
      toast.error(`저장 실패: ${getErrorMessage(error)}`);
      throw error;
    }
  };

  React.useEffect(() => {
    setRateDraft(activeRate);
  }, [activeRate?.id]);

  const updateRateDraft = (patch: Partial<PayrollRateVersion>) => {
    setRateDraft((current) => ({ ...current, ...patch }));
  };

  const saveActiveRate = async () => {
    try {
      await saveRateVersion.mutateAsync({ ...rateDraft, is_active: true });
      toast.success('급여 요율을 저장했습니다.');
    } catch (error: unknown) {
      toast.error(`요율 저장 실패: ${getErrorMessage(error)}`);
    }
  };

  const generateMonthlyDrafts = async () => {
    const start = monthStart(monthFilter);
    const end = monthEnd(monthFilter);
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('user_id,date,check_in,check_out,work_hours,status')
        .gte('date', start)
        .lte('date', end);
      if (error) throw error;
      const attendanceRows = (data || []) as (PayrollAttendanceRecord & { user_id: string })[];
      let created = 0;
      let skipped = 0;
      let updated = 0;

      for (const employee of employees) {
        const profile = payrollProfiles.find((item) => item.user_id === employee.id && item.status !== 'inactive');
        if (!profile) {
          skipped += 1;
          continue;
        }
        const existingStatement = statements.find((statement) => statement.user_id === employee.id && toMonthInput(statement.pay_month) === monthFilter);
        if (existingStatement?.status === 'published') {
          skipped += 1;
          continue;
        }
        const attendanceRecords = attendanceRows.filter((record) => record.user_id === employee.id);
        const result = calculatePayrollDraft({
          profile,
          rateVersion: activeRate,
          attendanceRecords,
          payMonth: start,
        });
        await saveStatement.mutateAsync({
          id: existingStatement?.id,
          user_id: employee.id,
          pay_month: start,
          pay_period_start: start,
          pay_period_end: end,
          payment_date: new Date().toISOString().slice(0, 10),
          earnings: result.earnings,
          deductions: result.deductions,
          memo: result.warnings.length ? `자동계산 검토 필요: ${result.warnings.join(' / ')}` : null,
          internal_note: '월별 일괄 자동계산 초안',
          status: 'draft',
          rate_version_id: activeRate.id || null,
          calculation_basis: result.calculationBasis,
          has_manual_override: false,
          calculation_input_snapshot: { profile, rateVersion: activeRate, attendanceRecords },
          calculation_result_snapshot: result as unknown as Record<string, unknown>,
          calculation_warnings: result.warnings,
        });
        if (existingStatement) {
          updated += 1;
        } else {
          created += 1;
        }
      }

      toast.success(`자동 초안 ${created}건 생성, ${updated}건 갱신 완료${skipped ? `, ${skipped}명 제외` : ''}`);
    } catch (error: unknown) {
      toast.error(`일괄 생성 실패: ${getErrorMessage(error)}`);
    }
  };

  const handleVoid = async (statement: PayStatement) => {
    const reason = window.prompt('회수 사유를 입력해주세요.', '관리자 회수');
    if (reason === null) return;
    try {
      await voidStatement.mutateAsync({ statementId: statement.id, reason });
      toast.success('급여명세를 회수했습니다.');
    } catch (error: unknown) {
      toast.error(`회수 실패: ${getErrorMessage(error)}`);
    }
  };

  const openEditor = (statement?: PayStatement) => {
    setEditingStatement(statement || null);
    setEditorOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Wallet className="h-5 w-5 text-primary" />
            급여명세 발행
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">직원별 월 급여명세를 작성, 검증, 발행, 회수합니다.</p>
        </div>
        <Button className="gap-1.5" onClick={() => openEditor()} disabled={employeesLoading}>
          <FilePlus2 className="h-4 w-4" />
          새 명세서
        </Button>
        <Button variant="outline" className="gap-1.5" onClick={generateMonthlyDrafts} disabled={employeesLoading || saveStatement.isPending}>
          <Wand2 className="h-4 w-4" />
          이번 달 자동 초안
        </Button>
      </div>

      <Card className="border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">조회 조건</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[180px_180px_1fr]">
          <Input type="month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} />
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="draft">임시저장</SelectItem>
              <SelectItem value="published">발행</SelectItem>
              <SelectItem value="voided">회수</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="직원명, 이메일, 부서, 사번 검색" />
          </div>
        </CardContent>
      </Card>

      <Card className="border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">자동계산 요율 설정</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label>요율명</Label>
            <Input value={rateDraft.name} onChange={(event) => updateRateDraft({ name: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>적용 시작일</Label>
            <Input type="date" value={rateDraft.effective_from} onChange={(event) => updateRateDraft({ effective_from: event.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>국민연금</Label>
            <Input type="number" step="0.0001" value={rateDraft.national_pension_rate} onChange={(event) => updateRateDraft({ national_pension_rate: Number(event.target.value) || 0 })} placeholder="0.045" />
          </div>
          <div className="space-y-1.5">
            <Label>건강보험</Label>
            <Input type="number" step="0.0001" value={rateDraft.health_insurance_rate} onChange={(event) => updateRateDraft({ health_insurance_rate: Number(event.target.value) || 0 })} placeholder="0.03545" />
          </div>
          <div className="space-y-1.5">
            <Label>장기요양</Label>
            <Input type="number" step="0.0001" value={rateDraft.long_term_care_rate} onChange={(event) => updateRateDraft({ long_term_care_rate: Number(event.target.value) || 0 })} placeholder="0.1295" />
          </div>
          <div className="space-y-1.5">
            <Label>고용보험</Label>
            <Input type="number" step="0.0001" value={rateDraft.employment_insurance_rate} onChange={(event) => updateRateDraft({ employment_insurance_rate: Number(event.target.value) || 0 })} placeholder="0.009" />
          </div>
          <div className="space-y-1.5">
            <Label>소득세 수동 세율</Label>
            <Input
              type="number"
              step="0.0001"
              value={rateDraft.income_tax_config?.manualRate || 0}
              onChange={(event) => updateRateDraft({ income_tax_mode: 'manual_rate', income_tax_config: { ...rateDraft.income_tax_config, manualRate: Number(event.target.value) || 0 } })}
              placeholder="0.03"
            />
          </div>
          <div className="flex items-end">
            <Button type="button" className="w-full" onClick={saveActiveRate} disabled={saveRateVersion.isPending}>
              요율 저장
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border shadow-none">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredStatements.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">조회된 급여명세가 없습니다.</div>
          ) : (
            <div className="divide-y">
              {filteredStatements.map((statement) => {
                const meta = statusMeta[statement.status || 'published'];
                return (
                  <div key={statement.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(180px,1fr)_120px_120px_120px_auto] lg:items-center">
                    <div className="min-w-0">
                      <p className="font-semibold">{statement.profile?.full_name || '직원 미지정'}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[statement.profile?.department, statement.profile?.position, statement.profile?.employee_number].filter(Boolean).join(' · ') || statement.profile?.email || '-'}
                      </p>
                    </div>
                    <p className="text-sm font-medium">{formatMonth(statement.pay_month)}</p>
                    <p className="text-sm tabular-nums">{formatPayrollAmount(statement.net_pay)}</p>
                    <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPreviewStatement(statement)}>미리보기</Button>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEditor(statement)}>
                        <Pencil className="h-3.5 w-3.5" />
                        수정
                      </Button>
                      {statement.status !== 'voided' && (
                        <Button variant="outline" size="sm" className="gap-1.5 text-red-600" onClick={() => handleVoid(statement)}>
                          <RotateCcw className="h-3.5 w-3.5" />
                          회수
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[92vh] max-w-7xl overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>{editingStatement ? '급여명세 수정' : '새 급여명세 작성'}</DialogTitle>
          </DialogHeader>
          <PayStatementEditor
            employees={employees}
            statement={editingStatement}
            onSave={handleSave}
            payrollProfiles={payrollProfiles}
            rateVersions={rateVersions}
            onSavePayrollProfile={(profile) => saveProfile.mutateAsync(profile)}
            isSaving={saveStatement.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewStatement)} onOpenChange={(open) => !open && setPreviewStatement(null)}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto bg-white p-5">
          {previewStatement && <PayStatementPreview statement={previewStatement} showInternalNote />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PayStatementAdminPanel;
