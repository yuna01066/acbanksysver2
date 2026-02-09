import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  X, Sparkles, Settings2, Save, Send, Loader2, CheckCircle2,
  FileText, DollarSign, Eye, ChevronDown
} from 'lucide-react';
import { useContractTemplates, useEmploymentContracts, type EmploymentContract } from '@/hooks/useContracts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EmployeeForContract {
  id: string;
  full_name: string;
  department: string;
  position: string;
  birthday: string;
  join_date: string;
  salary_info: string;
  avatar_url: string;
}

const CONTRACT_TYPES: Record<string, string> = {
  regular: '정규직',
  fixed_term: '기간제',
  part_time: '파트타임',
};

const PROBATION_OPTIONS = ['수습 없음', '1개월', '2개월', '3개월', '6개월'];

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: '임시저장', className: 'bg-muted text-muted-foreground' },
  requested: { label: '계약 요청됨', className: 'bg-primary/10 text-primary' },
  signed: { label: '서명 완료', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  rejected: { label: '거절', className: 'bg-destructive/10 text-destructive' },
};

const ContractManagement: React.FC = () => {
  const { user, profile } = useAuth();
  const { templates, loading: templatesLoading } = useContractTemplates();
  const { contracts, loading: contractsLoading, bulkCreate, updateContract } = useEmploymentContracts();
  const [showContractEditor, setShowContractEditor] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeForContract[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [draftContracts, setDraftContracts] = useState<Map<string, Partial<EmploymentContract>>>(new Map());
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('request');

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, department, position, birthday, join_date, salary_info, avatar_url')
      .eq('is_approved', true)
      .order('full_name')
      .then(({ data }) => {
        if (data) setEmployees(data as EmployeeForContract[]);
      });
  }, []);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const toggleEmployee = (id: string) => {
    setSelectedEmployees(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setDraftContracts(prev => { const n = new Map(prev); n.delete(id); return n; });
      } else {
        next.add(id);
        const emp = employees.find(e => e.id === id);
        if (emp) {
          setDraftContracts(prev => new Map(prev).set(id, {
            template_id: selectedTemplateId,
            user_id: id,
            user_name: emp.full_name,
            contract_type: 'regular',
            contract_date: new Date().toISOString().split('T')[0],
            birth_date: emp.birthday || null,
            contract_start_date: emp.join_date || new Date().toISOString().split('T')[0],
            position: emp.position || '',
            department: emp.department || '',
            probation_period: '수습 없음',
            work_type: '고정 근무제',
            work_days: '월,화,수,목,금요일',
            pay_day: selectedTemplate?.pay_day || 25,
          }));
        }
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedEmployees.size === employees.length) {
      setSelectedEmployees(new Set());
      setDraftContracts(new Map());
    } else {
      const allIds = new Set(employees.map(e => e.id));
      setSelectedEmployees(allIds);
      const drafts = new Map<string, Partial<EmploymentContract>>();
      employees.forEach(emp => {
        drafts.set(emp.id, {
          template_id: selectedTemplateId,
          user_id: emp.id,
          user_name: emp.full_name,
          contract_type: 'regular',
          contract_date: new Date().toISOString().split('T')[0],
          birth_date: emp.birthday || null,
          contract_start_date: emp.join_date || new Date().toISOString().split('T')[0],
          position: emp.position || '',
          department: emp.department || '',
          probation_period: '수습 없음',
          work_type: '고정 근무제',
          work_days: '월,화,수,목,금요일',
          pay_day: selectedTemplate?.pay_day || 25,
        });
      });
      setDraftContracts(drafts);
    }
  };

  const updateDraft = (userId: string, field: string, value: any) => {
    setDraftContracts(prev => {
      const n = new Map(prev);
      const existing = n.get(userId) || {};
      n.set(userId, { ...existing, [field]: value });
      return n;
    });
  };

  const handleAICalculate = async () => {
    setCalculating(true);
    let calculated = 0;
    for (const [userId, draft] of draftContracts) {
      if (!draft.annual_salary || draft.annual_salary <= 0) continue;
      try {
        const { data, error } = await supabase.functions.invoke('calculate-salary', {
          body: { annual_salary: draft.annual_salary },
        });
        if (error) throw error;
        if (data) {
          updateDraft(userId, 'monthly_salary', data.monthly_salary);
          updateDraft(userId, 'base_pay', data.base_pay);
          updateDraft(userId, 'fixed_overtime_pay', data.fixed_overtime_pay);
          updateDraft(userId, 'fixed_overtime_hours', data.fixed_overtime_hours);
          calculated++;
        }
      } catch (e: any) {
        console.error('Salary calc error for', userId, e);
      }
    }
    setCalculating(false);
    if (calculated > 0) {
      toast.success(`${calculated}명의 급여가 자동 계산되었습니다.`);
    } else {
      toast.info('연봉이 입력된 구성원이 없습니다.');
    }
    setSalaryModalOpen(false);
  };

  const handleSaveDraft = async () => {
    if (draftContracts.size === 0) { toast.error('대상을 선택해주세요.'); return; }
    setSaving(true);
    try {
      const contractsToSave = Array.from(draftContracts.values()).map(d => ({ ...d, status: 'draft' }));
      await bulkCreate(contractsToSave);
      toast.success('임시저장되었습니다.');
      setShowContractEditor(false);
      setSelectedEmployees(new Set());
      setDraftContracts(new Map());
    } catch (e: any) {
      toast.error('저장 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRequest = async () => {
    if (draftContracts.size === 0) { toast.error('대상을 선택해주세요.'); return; }

    // Validate required fields
    for (const [, draft] of draftContracts) {
      if (!draft.contract_start_date) {
        toast.error('근로계약 시작일을 입력해주세요.');
        return;
      }
      if (!draft.birth_date) {
        toast.error('생년월일을 입력해주세요.');
        return;
      }
    }

    setSaving(true);
    try {
      const contractsToSave = Array.from(draftContracts.values()).map(d => ({
        ...d,
        status: 'requested',
        requested_by: user?.id,
        requested_at: new Date().toISOString(),
      }));
      await bulkCreate(contractsToSave);

      // Send notifications to each employee
      const notifications = contractsToSave.map(c => ({
        user_id: c.user_id!,
        type: 'system',
        title: '새 계약서가 도착했습니다',
        description: `근로계약서가 발송되었습니다. 마이페이지에서 검토 후 서명해주세요.`,
        data: { contract_user_name: c.user_name },
      }));
      await supabase.from('notifications').insert(notifications);

      toast.success(`${contractsToSave.length}명에게 계약을 요청했습니다.`);
      setShowContractEditor(false);
      setSelectedEmployees(new Set());
      setDraftContracts(new Map());
    } catch (e: any) {
      toast.error('요청 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const formatNumber = (n: number | null | undefined) => {
    if (!n) return '';
    return n.toLocaleString();
  };

  if (templatesLoading || contractsLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  // Contract Editor (full-screen overlay)
  if (showContractEditor && selectedTemplate) {
    const selectedList = employees.filter(e => selectedEmployees.has(e.id));

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b px-4 py-2.5 flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setShowContractEditor(false)}>
              <X className="h-4 w-4" />
            </Button>
            <h2 className="text-base font-semibold">자동 근로계약서</h2>
            <Badge variant="outline" className="text-xs gap-1 text-primary border-primary">
              <Sparkles className="h-3 w-3" /> AI 금액 자동 계산
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm"><Settings2 className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={saving} className="gap-1">
              <Save className="h-3.5 w-3.5" /> 임시저장
            </Button>
            <Button
              size="sm"
              onClick={handleRequest}
              disabled={saving || selectedEmployees.size === 0}
              className="gap-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              계약 요청하기
            </Button>
          </div>
        </div>

        {/* Tab header */}
        <div className="border-b px-4 py-1.5 flex items-center gap-6 bg-card text-sm shrink-0">
          <span className="text-muted-foreground">필수 입력 정보</span>
          <span className="font-medium border-b-2 border-primary pb-1.5">필수 입력 정보</span>
        </div>

        {/* Spreadsheet-like table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse min-w-[1800px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-muted/50">
                <th className="w-10 px-3 py-2.5 text-center">
                  <Checkbox
                    checked={selectedEmployees.size === employees.length && employees.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[100px]">이름</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[80px]">상태</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[80px]">미리보기</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[100px]">구성원 이름</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[130px]">계약일</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[130px]">생년월일</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[120px]">계약유형</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[130px]">근로계약 시작일</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[130px]">근로계약 종료일</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[110px]">수습기간 여부</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[130px]">수습기간 시작일</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[130px]">수습기간 종료일</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[130px]">수습기간 급여지급률</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[80px]">직무</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[200px]">근무유형 외</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[120px]">급여일</th>
              </tr>
              {/* Filter row */}
              <tr className="border-b bg-card">
                <th className="px-3 py-1.5 text-center text-xs text-muted-foreground">구분</th>
                {Array(16).fill(null).map((_, i) => (
                  <th key={i} className="px-3 py-1.5">
                    <span className="text-xs text-muted-foreground">검색</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const isSelected = selectedEmployees.has(emp.id);
                const draft = draftContracts.get(emp.id);

                return (
                  <tr
                    key={emp.id}
                    className={`border-b hover:bg-muted/30 ${isSelected ? 'bg-muted/10' : ''}`}
                  >
                    <td className="px-3 py-2 text-center">
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleEmployee(emp.id)} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                          {emp.full_name[0]}
                        </div>
                        <span className="font-medium">{emp.full_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {isSelected ? (
                        <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">미발송</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isSelected && (
                        <Button variant="link" size="sm" className="text-xs text-primary p-0 h-auto">미리보기</Button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{emp.full_name}</td>
                    <td className="px-3 py-2">
                      {isSelected ? (
                        <Input
                          type="date"
                          value={draft?.contract_date || ''}
                          onChange={e => updateDraft(emp.id, 'contract_date', e.target.value)}
                          className="h-8 text-xs w-[130px]"
                        />
                      ) : <span className="text-muted-foreground text-xs">-</span>}
                    </td>
                    <td className="px-3 py-2">
                      {isSelected ? (
                        draft?.birth_date ? (
                          <Input
                            type="date"
                            value={draft.birth_date}
                            onChange={e => updateDraft(emp.id, 'birth_date', e.target.value)}
                            className="h-8 text-xs w-[130px]"
                          />
                        ) : (
                          <Input
                            type="date"
                            placeholder="날짜 입력"
                            onChange={e => updateDraft(emp.id, 'birth_date', e.target.value)}
                            className="h-8 text-xs w-[130px] text-red-500 placeholder:text-red-400"
                          />
                        )
                      ) : <span className="text-muted-foreground text-xs">-</span>}
                    </td>
                    <td className="px-3 py-2">
                      {isSelected ? (
                        <Select
                          value={draft?.contract_type || 'regular'}
                          onValueChange={v => updateDraft(emp.id, 'contract_type', v)}
                        >
                          <SelectTrigger className="h-8 text-xs w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CONTRACT_TYPES).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : <span className="text-muted-foreground text-xs">-</span>}
                    </td>
                    <td className="px-3 py-2">
                      {isSelected ? (
                        draft?.contract_start_date ? (
                          <Input
                            type="date"
                            value={draft.contract_start_date}
                            onChange={e => updateDraft(emp.id, 'contract_start_date', e.target.value)}
                            className="h-8 text-xs w-[130px]"
                          />
                        ) : (
                          <Input
                            type="date"
                            onChange={e => updateDraft(emp.id, 'contract_start_date', e.target.value)}
                            className="h-8 text-xs w-[130px] text-red-500"
                          />
                        )
                      ) : <span className="text-muted-foreground text-xs">-</span>}
                    </td>
                    <td className="px-3 py-2">
                      {isSelected ? (
                        <Input
                          type="date"
                          value={draft?.contract_end_date || ''}
                          onChange={e => updateDraft(emp.id, 'contract_end_date', e.target.value)}
                          className="h-8 text-xs w-[130px]"
                        />
                      ) : <span className="text-muted-foreground text-xs">-</span>}
                    </td>
                    <td className="px-3 py-2">
                      {isSelected ? (
                        <Select
                          value={draft?.probation_period || '수습 없음'}
                          onValueChange={v => updateDraft(emp.id, 'probation_period', v)}
                        >
                          <SelectTrigger className="h-8 text-xs w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PROBATION_OPTIONS.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : <span className="text-muted-foreground text-xs">-</span>}
                    </td>
                    <td className="px-3 py-2">
                      {isSelected && draft?.probation_period !== '수습 없음' ? (
                        <Input
                          type="date"
                          value={draft?.probation_start_date || ''}
                          onChange={e => updateDraft(emp.id, 'probation_start_date', e.target.value)}
                          className="h-8 text-xs w-[130px]"
                        />
                      ) : <span className="text-muted-foreground text-xs">날짜 없음</span>}
                    </td>
                    <td className="px-3 py-2">
                      {isSelected && draft?.probation_period !== '수습 없음' ? (
                        <Input
                          type="date"
                          value={draft?.probation_end_date || ''}
                          onChange={e => updateDraft(emp.id, 'probation_end_date', e.target.value)}
                          className="h-8 text-xs w-[130px]"
                        />
                      ) : <span className="text-muted-foreground text-xs">날짜 없음</span>}
                    </td>
                    <td className="px-3 py-2">
                      {isSelected && draft?.probation_period !== '수습 없음' ? (
                        <span className="text-xs">{draft?.probation_salary_rate || 100}%</span>
                      ) : <span className="text-muted-foreground text-xs">-</span>}
                    </td>
                    <td className="px-3 py-2">
                      {isSelected ? (
                        <Input
                          value={draft?.position || ''}
                          onChange={e => updateDraft(emp.id, 'position', e.target.value)}
                          className="h-8 text-xs w-[80px]"
                          placeholder="입력"
                        />
                      ) : <span className="text-muted-foreground text-xs">-</span>}
                    </td>
                    <td className="px-3 py-2">
                      {isSelected ? (
                        <span className="text-xs text-muted-foreground">
                          {draft?.work_type}, {draft?.work_days}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">-</span>}
                    </td>
                    <td className="px-3 py-2">
                      {isSelected ? (
                        <span className="text-xs">매월 {draft?.pay_day || 25}일</span>
                      ) : <span className="text-muted-foreground text-xs">-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom bar */}
        <div className="border-t px-4 py-2.5 flex items-center justify-between bg-card text-sm shrink-0">
          <div className="flex items-center gap-4">
            <span>선택 {selectedEmployees.size} / {employees.length}명</span>
            <Button variant="link" size="sm" className="text-xs p-0 h-auto">선택한 대상만 보기</Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setSalaryModalOpen(true)}
            disabled={selectedEmployees.size === 0}
          >
            <Sparkles className="h-3.5 w-3.5" /> 선택한 대상 자동계산하기
          </Button>
        </div>

        {/* Salary Modal */}
        <Dialog open={salaryModalOpen} onOpenChange={setSalaryModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                AI 급여 자동 계산
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                선택한 구성원의 연봉을 입력하면 통상시급, 기본급, 고정초과근무수당을 자동으로 계산합니다.
              </p>

              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {employees.filter(e => selectedEmployees.has(e.id)).map(emp => {
                    const draft = draftContracts.get(emp.id);
                    return (
                      <div key={emp.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                            {emp.full_name[0]}
                          </div>
                          <span className="text-sm font-medium">{emp.full_name}</span>
                        </div>
                        <Input
                          type="number"
                          placeholder="연봉 입력"
                          value={draft?.annual_salary || ''}
                          onChange={e => updateDraft(emp.id, 'annual_salary', Number(e.target.value))}
                          className="h-8 text-sm flex-1"
                        />
                        <span className="text-xs text-muted-foreground shrink-0">원</span>
                        <span className="text-xs text-muted-foreground shrink-0">입력</span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="text-center space-y-2">
                <p className="text-sm font-medium">
                  입력한 금액을 이용하여 통상시급, 기본급<br />
                  고정초과근무수당을 자동으로 입력해요.
                </p>
                <p className="text-xs text-muted-foreground">
                  *자동 입력을 원하지 않는다면, 우측 삼단의<br />
                  설정에서 '금액 자동 입력'을 꺼주세요.
                </p>
              </div>

              <Button
                onClick={handleAICalculate}
                disabled={calculating}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {calculating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                확인했어요
              </Button>
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setSalaryModalOpen(false)}>
                다시 보지 않기
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Main view: Template selection + contract list
  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted">
          <TabsTrigger value="request">계약 요청</TabsTrigger>
          <TabsTrigger value="history">계약 내역</TabsTrigger>
          <TabsTrigger value="employee">구성원 계약</TabsTrigger>
        </TabsList>

        <TabsContent value="request" className="mt-4 space-y-6">
          {/* 전자계약서 선택 */}
          <div>
            <h3 className="font-semibold mb-3">전자계약서 선택</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {templates.map(t => (
                <div
                  key={t.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedTemplateId === t.id
                      ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                      : 'hover:border-muted-foreground/30'
                  }`}
                  onClick={() => setSelectedTemplateId(t.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        t.template_type === 'labor'
                          ? 'bg-blue-100 dark:bg-blue-900/30'
                          : 'bg-green-100 dark:bg-green-900/30'
                      }`}>
                        <FileText className={`h-5 w-5 ${
                          t.template_type === 'labor'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-green-600 dark:text-green-400'
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{t.name}</p>
                        <Badge variant="outline" className="text-xs mt-1">급여일 {t.pay_day}일</Badge>
                      </div>
                    </div>
                    <Checkbox checked={selectedTemplateId === t.id} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{t.description}</p>
                </div>
              ))}
            </div>
          </div>

          {selectedTemplateId && (
            <div className="flex justify-end">
              <Button
                onClick={() => setShowContractEditor(true)}
                className="gap-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <Send className="h-4 w-4" /> 1건 계약 생성
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {contracts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">계약 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">이름</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">부서</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">계약유형</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">계약일</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">계약기간</th>
                    <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">상태</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">연봉</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map(c => {
                    const statusInfo = STATUS_LABELS[c.status] || STATUS_LABELS.draft;
                    return (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-medium">{c.user_name}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{c.department || '-'}</td>
                        <td className="px-4 py-2.5">{CONTRACT_TYPES[c.contract_type] || c.contract_type}</td>
                        <td className="px-4 py-2.5">{c.contract_date}</td>
                        <td className="px-4 py-2.5">
                          {c.contract_start_date || '-'} ~ {c.contract_end_date || '무기한'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge className={`text-xs ${statusInfo.className} border-0`}>
                            {statusInfo.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {c.annual_salary ? `${formatNumber(c.annual_salary)}원` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="employee" className="mt-4">
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">구성원별 계약 현황을 확인할 수 있습니다.</p>
            <p className="text-xs mt-1">계약을 요청하면 여기에 표시됩니다.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ContractManagement;
