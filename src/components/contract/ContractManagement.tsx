import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  AlertTriangle, Bell, CheckCircle2, Clock, DollarSign, Download,
  Eye, FilePenLine, FileText, Filter, History, Loader2, RotateCw, Save, Search,
  Send, Settings2, ShieldCheck, Sparkles, Stamp, Users, X, XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useContractTemplates, useEmploymentContracts, type EmploymentContract } from '@/hooks/useContracts';
import ContractTemplateSettings from './ContractTemplateSettings';
import ContractPreviewDialog, { type ContractData } from './ContractPreviewDialog';
import { PREBUILT_TEMPLATES } from './template-editor/prebuiltTemplates';
import { contractDocumentCss, injectCompanySealIntoRenderedHtml, renderContractHtml } from '@/utils/contractRenderer';
import { evaluateContractTemplateQuality } from '@/utils/contractTemplateQuality';
import { sanitizeHtml } from '@/utils/sanitizeHtml';
import { getDownloadUrl } from '@/services/documentFiles';

interface EmployeeForContract {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  detail_address: string;
  department: string;
  position: string;
  birthday: string;
  join_date: string;
  job_title: string;
  rank_title: string;
  salary_info: string;
  avatar_url: string;
}

interface ContractEvent {
  id: string;
  contract_id: string;
  actor_id: string | null;
  actor_role: string | null;
  event_type: 'requested' | 'opened' | 'signed' | 'rejected' | 'downloaded';
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface CompanyInfoForContracts extends Record<string, unknown> {
  company_seal_storage_path?: string | null;
}

type ValidationSeverity = 'error' | 'warning';

interface ContractValidationIssue {
  key: string;
  severity: ValidationSeverity;
  message: string;
  employeeId?: string;
  employeeName?: string;
  field?: string;
}

interface BulkApplyDraft {
  contract_date: string;
  contract_start_date: string;
  contract_end_date: string;
  contract_type: string;
  probation_period: string;
  pay_basis: PayBasis | 'skip';
  pay_amount: string;
  pay_day: string;
}

const CONTRACT_TYPES: Record<string, string> = {
  regular: '정규직',
  fixed_term: '기간제',
  part_time: '파트타임',
};

const TEMPLATE_TYPE_INFO: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  labor: { label: '근로계약서', icon: <FileText className="h-5 w-5" />, className: 'bg-[#f5f5f5] text-[#111111]' },
  salary: { label: '연봉계약서', icon: <DollarSign className="h-5 w-5" />, className: 'bg-[#f5f5f5] text-[#111111]' },
  oath: { label: '서약서', icon: <ShieldCheck className="h-5 w-5" />, className: 'bg-[#f5f5f5] text-[#111111]' },
  privacy: { label: '개인정보 동의서', icon: <FileText className="h-5 w-5" />, className: 'bg-[#f5f5f5] text-[#111111]' },
  custom: { label: '자유양식', icon: <FilePenLine className="h-5 w-5" />, className: 'bg-[#f5f5f5] text-[#111111]' },
};

const STATUS_LABELS: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  draft: { label: '임시저장', className: 'bg-[#f5f5f5] text-[#707072]', icon: <Clock className="h-3 w-3" /> },
  requested: { label: '발송됨', className: 'bg-blue-50 text-blue-700', icon: <Send className="h-3 w-3" /> },
  opened: { label: '열람됨', className: 'bg-amber-50 text-amber-700', icon: <Eye className="h-3 w-3" /> },
  signed: { label: '서명 완료', className: 'bg-emerald-50 text-emerald-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { label: '거절', className: 'bg-red-50 text-red-700', icon: <XCircle className="h-3 w-3" /> },
};

const EVENT_LABELS: Record<string, string> = {
  requested: '계약 요청',
  opened: '계약 열람',
  signed: '서명 완료',
  rejected: '거절',
  downloaded: 'PDF 다운로드',
};

const PROBATION_OPTIONS = ['수습 없음', '1개월', '2개월', '3개월', '6개월'];
const MINIMUM_HOURLY_WAGE_2026 = 10320;
const MINIMUM_MONTHLY_WAGE_2026 = 2156880;
const MONTHLY_STANDARD_HOURS_2026 = 209;

type PayBasis = 'monthly' | 'hourly' | 'annual';

const PAY_BASIS_LABELS: Record<PayBasis, string> = {
  monthly: '월급',
  hourly: '시급',
  annual: '연봉',
};

const PAY_BASIS_OPTIONS: Array<{ value: PayBasis; label: string; helper: string }> = [
  { value: 'monthly', label: '월급', helper: '월 지급액' },
  { value: 'hourly', label: '시급', helper: '209시간 환산' },
  { value: 'annual', label: '연봉', helper: '12개월 환산' },
];

const DEFAULT_BULK_APPLY_DRAFT: BulkApplyDraft = {
  contract_date: '',
  contract_start_date: '',
  contract_end_date: '',
  contract_type: 'skip',
  probation_period: 'skip',
  pay_basis: 'skip',
  pay_amount: '',
  pay_day: '',
};

const formatNumber = (n: number | null | undefined) => {
  if (!n) return '';
  return n.toLocaleString('ko-KR');
};

const getPayBasis = (draft?: Partial<EmploymentContract> | null): PayBasis => {
  const rawBasis = String(draft?.wage_basis || '').toLowerCase();
  if (rawBasis.includes('시급') || rawBasis.includes('hour')) return 'hourly';
  if (rawBasis.includes('연봉') || rawBasis.includes('annual')) return 'annual';
  if (rawBasis.includes('월급') || rawBasis.includes('monthly')) return 'monthly';
  if (draft?.monthly_salary && !draft?.annual_salary) return 'monthly';
  if (draft?.annual_salary && !draft?.monthly_salary) return 'annual';
  return 'monthly';
};

const getMonthlyEquivalent = (draft?: Partial<EmploymentContract> | null) => {
  if (!draft) return null;
  if (draft.monthly_salary && draft.monthly_salary > 0) return Math.round(draft.monthly_salary);
  if (draft.annual_salary && draft.annual_salary > 0) return Math.round(draft.annual_salary / 12);
  return null;
};

const getHourlyEquivalent = (draft?: Partial<EmploymentContract> | null) => {
  if (!draft) return null;
  const monthlyEquivalent = getMonthlyEquivalent(draft);
  if (!monthlyEquivalent) return null;
  return Math.round(monthlyEquivalent / MONTHLY_STANDARD_HOURS_2026);
};

const getPayInputAmount = (draft?: Partial<EmploymentContract> | null) => {
  const basis = getPayBasis(draft);
  if (basis === 'hourly') return getHourlyEquivalent(draft);
  if (basis === 'annual') {
    if (draft?.annual_salary && draft.annual_salary > 0) return Math.round(draft.annual_salary);
    const monthlyEquivalent = getMonthlyEquivalent(draft);
    return monthlyEquivalent ? monthlyEquivalent * 12 : null;
  }
  return getMonthlyEquivalent(draft);
};

const getPayInputPlaceholder = (basis: PayBasis) => {
  if (basis === 'hourly') return '예: 10320';
  if (basis === 'annual') return '예: 30000000';
  return '예: 2156880';
};

const buildPayFields = (
  draft: Partial<EmploymentContract>,
  basis: PayBasis,
  amount: number | null,
): Partial<EmploymentContract> => {
  if (!amount || amount <= 0) {
    return {
      wage_basis: PAY_BASIS_LABELS[basis],
      annual_salary: null,
      monthly_salary: null,
      base_pay: null,
    };
  }

  const monthlySalary = basis === 'hourly'
    ? Math.round(amount * MONTHLY_STANDARD_HOURS_2026)
    : basis === 'annual'
      ? Math.round(amount / 12)
      : Math.round(amount);
  const annualSalary = basis === 'annual' ? Math.round(amount) : Math.round(monthlySalary * 12);
  const fixedOvertimePay = Number(draft.fixed_overtime_pay || 0);

  return {
    wage_basis: PAY_BASIS_LABELS[basis],
    annual_salary: annualSalary,
    monthly_salary: monthlySalary,
    base_pay: Math.max(monthlySalary - fixedOvertimePay, 0) || monthlySalary,
  };
};

const normalizePayDraft = (draft: Partial<EmploymentContract>) => (
  {
    ...draft,
    ...buildPayFields(draft, getPayBasis(draft), getPayInputAmount(draft)),
  }
);

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return format(new Date(value), 'yyyy.MM.dd HH:mm', { locale: ko });
};

const getDisplayStatus = (contract: EmploymentContract) => {
  if (contract.status === 'requested' && contract.opened_at) return 'opened';
  return contract.status || 'draft';
};

const getContractTitle = (contract: EmploymentContract) => (
  contract.template_snapshot?.name || `${CONTRACT_TYPES[contract.contract_type] || contract.contract_type} 계약서`
);

const contractEventsTable = 'contract_events' as never;

const getErrorMessage = (error: unknown) => {
  if (!error) return '알 수 없는 오류';
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;

  if (typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const parts = [
      record.message,
      record.error_description,
      record.details,
      record.hint,
      record.code ? `code: ${record.code}` : null,
      record.status ? `status: ${record.status}` : null,
      record.statusText,
    ]
      .filter(Boolean)
      .map((value) => String(value));

    if (parts.length > 0) return parts.join(' / ');

    try {
      return JSON.stringify(record);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }

  return String(error);
};

const ContractManagement: React.FC = () => {
  const { user, session, isAdmin, isModerator } = useAuth();
  const { templates, loading: templatesLoading } = useContractTemplates();
  const { contracts, loading: contractsLoading, bulkCreate } = useEmploymentContracts();
  const [activeTab, setActiveTab] = useState('compose');
  const [showContractEditor, setShowContractEditor] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeForContract[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [companyInfo, setCompanyInfo] = useState<CompanyInfoForContracts | null>(null);
  const [companySealUrl, setCompanySealUrl] = useState<string | null>(null);
  const [includeCompanySeal, setIncludeCompanySeal] = useState(true);
  const [previewContract, setPreviewContract] = useState<Partial<EmploymentContract> | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [draftContracts, setDraftContracts] = useState<Map<string, Partial<EmploymentContract>>>(new Map());
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finalReviewEmployeeId, setFinalReviewEmployeeId] = useState<string | null>(null);
  const [reviewedContractKeys, setReviewedContractKeys] = useState<Set<string>>(new Set());
  const [historySearch, setHistorySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [contractEvents, setContractEvents] = useState<ContractEvent[]>([]);
  const [auditContract, setAuditContract] = useState<EmploymentContract | null>(null);
  const [detailContract, setDetailContract] = useState<EmploymentContract | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [bulkApplyDraft, setBulkApplyDraft] = useState<BulkApplyDraft>(DEFAULT_BULK_APPLY_DRAFT);
  const [activeIssueKey, setActiveIssueKey] = useState<string | null>(null);
  const draftRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, email, phone, address, detail_address, department, position, birthday, join_date, job_title, rank_title, salary_info, avatar_url')
      .eq('is_approved', true)
      .order('full_name')
      .then(({ data }) => {
        if (data) setEmployees(data as EmployeeForContract[]);
      });
  }, []);

  useEffect(() => {
    supabase
      .from('company_info')
      .select('*')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setCompanyInfo(data || null));
  }, []);

  useEffect(() => {
    let mounted = true;
    const path = companyInfo?.company_seal_storage_path;
    if (!path) {
      setCompanySealUrl(null);
      return;
    }
    getDownloadUrl({
      storageProvider: 'supabase_storage',
      storageBucket: 'employee-contracts',
      storagePath: path,
    })
      .then((url) => { if (mounted) setCompanySealUrl(url); })
      .catch(() => { if (mounted) setCompanySealUrl(null); });
    return () => { mounted = false; };
  }, [companyInfo]);

  useEffect(() => {
    if (contracts.length === 0) {
      setContractEvents([]);
      return;
    }

    let mounted = true;
    setEventsLoading(true);
    Promise.resolve(
      supabase
        .from(contractEventsTable)
        .select('*')
        .in('contract_id', contracts.map((contract) => contract.id))
        .order('created_at', { ascending: false })
    )
      .then(({ data }) => {
        if (mounted) setContractEvents((data || []) as ContractEvent[]);
      })
      .finally(() => {
        if (mounted) setEventsLoading(false);
      });

    return () => { mounted = false; };
  }, [contracts]);

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
  const selectedTemplateContent = useMemo(() => {
    if (selectedTemplate?.content) return selectedTemplate.content;
    return PREBUILT_TEMPLATES.find((template) => template.type === selectedTemplate?.template_type)?.content
      || PREBUILT_TEMPLATES[0]?.content
      || null;
  }, [selectedTemplate]);

  const selectedTemplateQuality = useMemo(
    () => evaluateContractTemplateQuality(selectedTemplateContent, { templateType: selectedTemplate?.template_type }),
    [selectedTemplate?.template_type, selectedTemplateContent],
  );

  const filteredEmployees = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter((employee) => [
      employee.full_name,
      employee.email,
      employee.phone,
      employee.department,
      employee.position,
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [employees, employeeSearch]);

  const visibleAllSelected = filteredEmployees.length > 0
    && filteredEmployees.every((employee) => selectedEmployees.has(employee.id));

  const createDefaultDraft = (employee: EmployeeForContract): Partial<EmploymentContract> => ({
    template_id: selectedTemplateId,
    user_id: employee.id,
    user_name: employee.full_name,
    contract_type: 'regular',
    contract_date: new Date().toISOString().split('T')[0],
    birth_date: employee.birthday || null,
    contract_start_date: employee.join_date || new Date().toISOString().split('T')[0],
    contract_end_date: null,
    position: employee.position || '',
    department: employee.department || '',
    probation_period: '수습 없음',
    probation_start_date: null,
    probation_end_date: null,
    probation_salary_rate: 100,
    work_type: '고정 근무제',
    work_days: '월,화,수,목,금요일',
    pay_day: selectedTemplate?.pay_day || 25,
    wage_basis: PAY_BASIS_LABELS.monthly,
    other_allowances: [],
  });

  const toggleEmployee = (id: string) => {
    const employee = employees.find((item) => item.id === id);
    if (!employee) return;

    setSelectedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setDraftContracts((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, createDefaultDraft(employee));
      return next;
    });
  };

  const toggleVisibleEmployees = () => {
    setSelectedEmployees((prev) => {
      const next = new Set(prev);
      if (visibleAllSelected) {
        filteredEmployees.forEach((employee) => next.delete(employee.id));
      } else {
        filteredEmployees.forEach((employee) => next.add(employee.id));
      }
      return next;
    });

    setDraftContracts((prev) => {
      const next = new Map(prev);
      if (visibleAllSelected) {
        filteredEmployees.forEach((employee) => next.delete(employee.id));
      } else {
        filteredEmployees.forEach((employee) => {
          if (!next.has(employee.id)) next.set(employee.id, createDefaultDraft(employee));
        });
      }
      return next;
    });
  };

  const updateDraft = (userId: string, field: string, value: string | number | null) => {
    setDraftContracts((prev) => {
      const next = new Map(prev);
      const existing = next.get(userId) || {};
      next.set(userId, { ...existing, [field]: value });
      return next;
    });
  };

  const updateDraftPayBasis = (userId: string, basis: PayBasis) => {
    setDraftContracts((prev) => {
      const next = new Map(prev);
      const existing = next.get(userId) || {};
      const existingAmount = getPayInputAmount(existing);
      next.set(userId, { ...existing, ...buildPayFields(existing, basis, existingAmount) });
      return next;
    });
  };

  const updateDraftPayAmount = (userId: string, amount: number | null) => {
    setDraftContracts((prev) => {
      const next = new Map(prev);
      const existing = next.get(userId) || {};
      next.set(userId, { ...existing, ...buildPayFields(existing, getPayBasis(existing), amount) });
      return next;
    });
  };

  const validationItems = useMemo(() => {
    const issues: ContractValidationIssue[] = [];
    const addIssue = (
      message: string,
      options: Partial<Omit<ContractValidationIssue, 'key' | 'message'>> = {},
    ) => {
      issues.push({
        key: `${options.employeeId || 'global'}-${options.field || 'general'}-${issues.length}`,
        severity: options.severity || 'error',
        message,
        ...options,
      });
    };

    if (!selectedTemplate) addIssue('계약 양식을 선택하세요.', { field: 'template' });
    if (selectedTemplate && !selectedTemplateQuality.ok) {
      addIssue(`양식 필수필드 부족: ${selectedTemplateQuality.missing.join(', ')}`, { field: 'template' });
    }
    if (selectedEmployees.size === 0) addIssue('발송할 구성원을 선택하세요.', { field: 'employees' });
    if (includeCompanySeal && !companyInfo?.company_seal_storage_path) {
      addIssue('회사 직인 포함을 선택했습니다. 회사 설정에서 직인 파일을 먼저 등록하세요.', { field: 'company_seal' });
    }

    for (const employeeId of selectedEmployees) {
      const draft = draftContracts.get(employeeId);
      const employeeName = employees.find((employee) => employee.id === employeeId)?.full_name || '선택 구성원';
      if (!draft) {
        addIssue(`${employeeName}: 입력값을 다시 확인하세요.`, { employeeId, employeeName, field: 'draft' });
        continue;
      }
      if (!draft.contract_date) addIssue(`${employeeName}: 계약일이 필요합니다.`, { employeeId, employeeName, field: 'contract_date' });
      if (!draft.birth_date) addIssue(`${employeeName}: 생년월일이 필요합니다.`, { employeeId, employeeName, field: 'birth_date' });
      if (['labor', 'salary'].includes(selectedTemplate?.template_type || '') && !draft.contract_start_date) {
        addIssue(`${employeeName}: 계약 시작일이 필요합니다.`, { employeeId, employeeName, field: 'contract_start_date' });
      }
      if (['labor', 'salary'].includes(selectedTemplate?.template_type || '')) {
        const payBasis = getPayBasis(draft);
        const payInputAmount = getPayInputAmount(draft);
        const monthlyEquivalent = getMonthlyEquivalent(draft);
        const hourlyEquivalent = getHourlyEquivalent(draft);
        if (!payInputAmount) {
          addIssue(`${employeeName}: 급여 형태와 금액이 필요합니다.`, { employeeId, employeeName, field: 'pay' });
        } else if (payBasis === 'hourly' && (!hourlyEquivalent || hourlyEquivalent < MINIMUM_HOURLY_WAGE_2026)) {
          addIssue(`${employeeName}: 시급이 2026년 최저임금 시급 ${formatNumber(MINIMUM_HOURLY_WAGE_2026)}원보다 낮습니다.`, { employeeId, employeeName, field: 'pay' });
        } else if (draft.contract_type !== 'part_time') {
          if (!monthlyEquivalent) {
            addIssue(`${employeeName}: 월 환산 급여가 필요합니다.`, { employeeId, employeeName, field: 'pay' });
          } else if (monthlyEquivalent < MINIMUM_MONTHLY_WAGE_2026) {
            addIssue(`${employeeName}: 월 환산액이 2026년 최저임금 월환산액 ${formatNumber(MINIMUM_MONTHLY_WAGE_2026)}원보다 낮습니다.`, { employeeId, employeeName, field: 'pay' });
          }
        }
      }
      if (draft.pay_day && (draft.pay_day < 1 || draft.pay_day > 31)) {
        addIssue(`${employeeName}: 급여일은 1일부터 31일 사이여야 합니다.`, { employeeId, employeeName, field: 'pay_day' });
      }
      if (draft.contract_start_date && draft.contract_end_date && draft.contract_end_date < draft.contract_start_date) {
        addIssue(`${employeeName}: 계약 종료일이 시작일보다 빠릅니다.`, { employeeId, employeeName, field: 'contract_end_date' });
      }
    }

    selectedTemplateQuality.warnings.forEach((warning, index) => {
      addIssue(warning, { severity: 'warning', field: `template-warning-${index}` });
    });
    return issues;
  }, [companyInfo, draftContracts, employees, includeCompanySeal, selectedEmployees, selectedTemplate, selectedTemplateQuality]);

  const validationIssues = useMemo(
    () => validationItems.filter((issue) => issue.severity === 'error').map((issue) => issue.message),
    [validationItems],
  );

  const validationWarnings = useMemo(
    () => validationItems.filter((issue) => issue.severity === 'warning'),
    [validationItems],
  );

  const selectedDrafts = useMemo(() => (
    Array.from(selectedEmployees)
      .map((id) => draftContracts.get(id))
      .filter(Boolean) as Partial<EmploymentContract>[]
  ), [draftContracts, selectedEmployees]);

  const selectedContractPeriodSummary = useMemo(() => {
    if (selectedDrafts.length === 0) return '-';
    const periods = new Set(selectedDrafts.map((draft) => `${draft.contract_start_date || '-'} ~ ${draft.contract_end_date || '무기한'}`));
    if (periods.size === 1) return Array.from(periods)[0];
    return `서로 다른 계약기간 ${periods.size}개`;
  }, [selectedDrafts]);

  const selectedPaySummary = useMemo(() => {
    if (selectedDrafts.length === 0) return '-';
    const counts = new Map<string, number>();
    selectedDrafts.forEach((draft) => {
      const label = PAY_BASIS_LABELS[getPayBasis(draft)];
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([label, count]) => `${label} ${count}명`).join(' / ');
  }, [selectedDrafts]);

  const selectedEditorEmployees = useMemo(
    () => employees.filter((employee) => selectedEmployees.has(employee.id)),
    [employees, selectedEmployees],
  );

  const validIssueCount = validationItems.filter((issue) => issue.severity === 'error').length;

  const reviewKeysByEmployee = useMemo(() => {
    const next = new Map<string, string>();
    for (const draft of selectedDrafts) {
      if (!draft.user_id) continue;
      next.set(draft.user_id, JSON.stringify({
        user_id: draft.user_id,
        template_id: selectedTemplateId,
        template_updated_at: selectedTemplate?.updated_at || selectedTemplate?.created_at || null,
        include_company_seal: includeCompanySeal,
        company_seal_storage_path: includeCompanySeal ? (companyInfo?.company_seal_storage_path || null) : null,
        contract_type: draft.contract_type || null,
        contract_date: draft.contract_date || null,
        birth_date: draft.birth_date || null,
        contract_start_date: draft.contract_start_date || null,
        contract_end_date: draft.contract_end_date || null,
        probation_period: draft.probation_period || null,
        department: draft.department || null,
        position: draft.position || null,
        work_type: draft.work_type || null,
        work_days: draft.work_days || null,
        wage_basis: draft.wage_basis || null,
        annual_salary: draft.annual_salary || null,
        monthly_salary: draft.monthly_salary || null,
        base_pay: draft.base_pay || null,
        fixed_overtime_pay: draft.fixed_overtime_pay || null,
        fixed_overtime_hours: draft.fixed_overtime_hours || null,
        pay_day: draft.pay_day || null,
      }));
    }
    return next;
  }, [companyInfo?.company_seal_storage_path, includeCompanySeal, selectedDrafts, selectedTemplate?.created_at, selectedTemplate?.updated_at, selectedTemplateId]);

  const reviewedEmployeeIds = useMemo(() => (
    selectedEditorEmployees
      .filter((employee) => {
        const reviewKey = reviewKeysByEmployee.get(employee.id);
        return Boolean(reviewKey && reviewedContractKeys.has(reviewKey));
      })
      .map((employee) => employee.id)
  ), [reviewKeysByEmployee, reviewedContractKeys, selectedEditorEmployees]);

  const reviewedCount = reviewedEmployeeIds.length;
  const allContractsReviewed = selectedEditorEmployees.length > 0 && reviewedCount === selectedEditorEmployees.length;
  const selectedFinalReviewEmployee = selectedEditorEmployees.find((employee) => employee.id === finalReviewEmployeeId) || selectedEditorEmployees[0] || null;
  const selectedFinalReviewDraft = selectedFinalReviewEmployee ? draftContracts.get(selectedFinalReviewEmployee.id) : null;
  const selectedFinalReviewKey = selectedFinalReviewEmployee ? reviewKeysByEmployee.get(selectedFinalReviewEmployee.id) : null;
  const selectedFinalReviewCompleted = Boolean(selectedFinalReviewKey && reviewedContractKeys.has(selectedFinalReviewKey));

  const scrollToValidationIssue = (issue: ContractValidationIssue) => {
    setActiveIssueKey(issue.key);
    if (issue.employeeId) {
      draftRowRefs.current[issue.employeeId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleBulkApply = () => {
    if (selectedEmployees.size === 0) {
      toast.error('일괄 적용할 구성원을 선택하세요.');
      return;
    }

    setDraftContracts((prev) => {
      const next = new Map(prev);
      for (const employeeId of selectedEmployees) {
        const existing = next.get(employeeId);
        if (!existing) continue;
        let updated: Partial<EmploymentContract> = { ...existing };
        if (bulkApplyDraft.contract_date) updated.contract_date = bulkApplyDraft.contract_date;
        if (bulkApplyDraft.contract_start_date) updated.contract_start_date = bulkApplyDraft.contract_start_date;
        if (bulkApplyDraft.contract_end_date) updated.contract_end_date = bulkApplyDraft.contract_end_date;
        if (bulkApplyDraft.contract_type !== 'skip') updated.contract_type = bulkApplyDraft.contract_type;
        if (bulkApplyDraft.probation_period !== 'skip') updated.probation_period = bulkApplyDraft.probation_period;
        if (bulkApplyDraft.pay_day) updated.pay_day = Number(bulkApplyDraft.pay_day) || updated.pay_day;
        if (bulkApplyDraft.pay_basis !== 'skip' || bulkApplyDraft.pay_amount) {
          const basis = bulkApplyDraft.pay_basis === 'skip' ? getPayBasis(updated) : bulkApplyDraft.pay_basis;
          const amount = bulkApplyDraft.pay_amount ? Number(bulkApplyDraft.pay_amount) || null : getPayInputAmount(updated);
          updated = { ...updated, ...buildPayFields(updated, basis, amount) };
        }
        next.set(employeeId, updated);
      }
      return next;
    });
    toast.success(`${selectedEmployees.size}명에게 공통값을 적용했습니다.`);
  };

  const buildContractPayload = (draft: Partial<EmploymentContract>, status: 'draft' | 'requested') => {
    const employee = employees.find((item) => item.id === draft.user_id);
    const normalizedDraft = ['labor', 'salary'].includes(selectedTemplate?.template_type || '')
      ? normalizePayDraft(draft)
      : draft;
    const rendered_html = renderContractHtml({
      templateContent: selectedTemplateContent,
      contract: normalizedDraft,
      companyInfo,
      employee,
      companySealUrl: null,
      includeCompanySeal,
    });

    return {
      ...normalizedDraft,
      status,
      template_id: selectedTemplateId,
      template_snapshot: selectedTemplate ? {
        id: selectedTemplate.id,
        name: selectedTemplate.name,
        template_type: selectedTemplate.template_type,
        description: selectedTemplate.description,
        pay_day: selectedTemplate.pay_day,
        content: selectedTemplateContent,
      } : null,
      rendered_html,
      company_seal_included: includeCompanySeal,
      company_seal_storage_path: includeCompanySeal ? (companyInfo?.company_seal_storage_path || null) : null,
    };
  };

  const selectedFinalReviewContract = selectedFinalReviewDraft
    ? (buildContractPayload(selectedFinalReviewDraft, 'requested') as Partial<EmploymentContract>)
    : null;
  const selectedFinalReviewHtml = selectedFinalReviewContract?.rendered_html
    ? sanitizeHtml(injectCompanySealIntoRenderedHtml(selectedFinalReviewContract.rendered_html, companySealUrl))
    : null;

  const openDraftPreview = (employeeId: string) => {
    const draft = draftContracts.get(employeeId);
    if (!draft) return;
    setPreviewContract(buildContractPayload(draft, 'draft') as Partial<EmploymentContract>);
  };

  const handleSaveDraft = async () => {
    if (!selectedTemplate) { toast.error('계약 양식을 선택하세요.'); return; }
    if (selectedDrafts.length === 0) { toast.error('대상을 선택해주세요.'); return; }
    setSaving(true);
    try {
      await bulkCreate(selectedDrafts.map((draft) => buildContractPayload(draft, 'draft')));
      toast.success('임시저장되었습니다.');
      setShowContractEditor(false);
      setSelectedEmployees(new Set());
      setDraftContracts(new Map());
    } catch (error: unknown) {
      toast.error('저장 실패: ' + getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSendConfirm = () => {
    if (validationIssues.length > 0) {
      toast.error(validationIssues[0]);
      return;
    }
    const firstUnreviewed = selectedEditorEmployees.find((employee) => {
      const reviewKey = reviewKeysByEmployee.get(employee.id);
      return !reviewKey || !reviewedContractKeys.has(reviewKey);
    });
    setFinalReviewEmployeeId((current) => (
      current && selectedEmployees.has(current)
        ? current
        : (firstUnreviewed || selectedEditorEmployees[0])?.id || null
    ));
    setSendConfirmOpen(true);
  };

  const setSelectedFinalReviewCompleted = (checked: boolean) => {
    if (!selectedFinalReviewKey) return;
    setReviewedContractKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(selectedFinalReviewKey);
      else next.delete(selectedFinalReviewKey);
      return next;
    });
  };

  const markFinalReviewComplete = () => {
    if (!selectedFinalReviewKey) return;
    const reviewedKeysAfterClick = new Set(reviewedContractKeys);
    reviewedKeysAfterClick.add(selectedFinalReviewKey);
    setReviewedContractKeys(reviewedKeysAfterClick);

    const currentIndex = selectedEditorEmployees.findIndex((employee) => employee.id === selectedFinalReviewEmployee?.id);
    const orderedEmployees = [
      ...selectedEditorEmployees.slice(currentIndex + 1),
      ...selectedEditorEmployees.slice(0, Math.max(currentIndex, 0)),
    ];
    const nextUnreviewed = orderedEmployees.find((employee) => {
      const reviewKey = reviewKeysByEmployee.get(employee.id);
      return !reviewKey || !reviewedKeysAfterClick.has(reviewKey);
    });
    if (nextUnreviewed) setFinalReviewEmployeeId(nextUnreviewed.id);
  };

  const handleRequest = async () => {
    if (!user || validationIssues.length > 0 || !allContractsReviewed) return;
    setSaving(true);
    let requestStage = '계약 저장';
    let contractsToSave: Partial<EmploymentContract>[] = [];
    let createdContracts: EmploymentContract[] = [];
    try {
      contractsToSave = selectedDrafts.map((draft) => ({
        ...buildContractPayload(draft, 'requested'),
        requested_by: user.id,
        requested_at: new Date().toISOString(),
      }));
      createdContracts = await bulkCreate(contractsToSave);

      requestStage = '알림 생성';
      const notifications = createdContracts.map((contract) => ({
        user_id: contract.user_id!,
        type: 'contract_request',
        title: '새 계약서가 도착했습니다',
        description: `${contract.user_name}님 앞으로 전자계약서가 발송되었습니다. 마이페이지에서 검토 후 서명해주세요.`,
        data: { contract_id: contract.id, contract_user_name: contract.user_name },
      }));
      if (notifications.length > 0) {
        const { error } = await supabase.from('notifications').insert(notifications as never);
        if (error) throw error;
      }

      requestStage = '감사 기록';
      const events = createdContracts.map((contract) => ({
        contract_id: contract.id,
        actor_id: user.id,
        actor_role: isAdmin ? 'admin' : isModerator ? 'moderator' : 'admin',
        event_type: 'requested',
        metadata: {
          template_id: contract.template_id,
          template_name: selectedTemplate?.name,
          selected_count: createdContracts.length,
          company_seal_included: includeCompanySeal,
        },
      }));
      if (events.length > 0) {
        const { error } = await supabase.from(contractEventsTable).insert(events as never);
        if (error) throw error;
      }

      toast.success(`${createdContracts.length}명에게 계약을 요청했습니다.`);
      setSendConfirmOpen(false);
      setShowContractEditor(false);
      setSelectedEmployees(new Set());
      setDraftContracts(new Map());
      setReviewedContractKeys(new Set());
    } catch (error: unknown) {
      console.error('[ContractManagement] contract request failed', {
        stage: requestStage,
        error,
        selectedCount: selectedDrafts.length,
        createdCount: createdContracts.length,
        contractIds: createdContracts.map((contract) => contract.id),
        payloadSummary: contractsToSave.map((contract) => ({
          user_id: contract.user_id,
          user_name: contract.user_name,
          template_id: contract.template_id,
          status: contract.status,
          company_seal_included: contract.company_seal_included,
        })),
      });
      const partialWarning = requestStage !== '계약 저장' && createdContracts.length > 0
        ? ' 계약은 생성됐을 수 있으니 발송 내역을 확인한 뒤 재시도하세요.'
        : '';
      toast.error(`${requestStage} 실패: ${getErrorMessage(error)}${partialWarning}`);
    } finally {
      setSaving(false);
    }
  };

  const invokeContractAction = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('contract-actions', {
      body,
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
    if (error || data?.error) throw new Error(error?.message || data?.error || '계약 처리에 실패했습니다.');
    return data;
  };

  const handleAdminDownload = async (contract: EmploymentContract) => {
    if (!contract.signed_pdf_storage_path) return;
    try {
      const url = await getDownloadUrl({
        storageProvider: 'supabase_storage',
        storageBucket: 'employee-contracts',
        storagePath: contract.signed_pdf_storage_path,
      });
      window.open(url, '_blank', 'noopener,noreferrer');
      await invokeContractAction({ action: 'downloaded', contractId: contract.id });
    } catch (error: unknown) {
      toast.error('PDF 열기 실패: ' + getErrorMessage(error));
    }
  };

  const handleReminder = async (contract: EmploymentContract) => {
    if (!user || !['requested', 'opened'].includes(contract.status)) return;
    try {
      await supabase.from('notifications').insert({
        user_id: contract.user_id,
        type: 'contract_request',
        title: '전자계약 서명 재알림',
        description: `${getContractTitle(contract)} 검토 및 서명이 필요합니다.`,
        data: { contract_id: contract.id, reminder: true },
      } as never);
      await supabase.from(contractEventsTable).insert({
        contract_id: contract.id,
        actor_id: user.id,
        actor_role: isAdmin ? 'admin' : isModerator ? 'moderator' : 'admin',
        event_type: 'requested',
        metadata: { reminder: true },
      } as never);
      toast.success('앱 내부 알림을 다시 발송했습니다.');
    } catch (error: unknown) {
      toast.error('재알림 실패: ' + getErrorMessage(error));
    }
  };

  const handlePrepareResend = (contract: EmploymentContract) => {
    if (!contract.template_id || !templates.some((template) => template.id === contract.template_id)) {
      toast.error('원본 양식이 비활성화 또는 삭제되어 템플릿 관리에서 새 양식을 선택해주세요.');
      return;
    }
    setSelectedTemplateId(contract.template_id);
    setIncludeCompanySeal(Boolean(contract.company_seal_included));
    setSelectedEmployees(new Set([contract.user_id]));
    setDraftContracts(new Map([[contract.user_id, {
      ...contract,
      id: undefined,
      status: 'draft',
      requested_at: null,
      signed_at: null,
      rejected_at: null,
      rejected_reason: null,
      opened_at: null,
      signed_by_name: null,
      signature_storage_path: null,
      signed_pdf_storage_path: null,
      signed_pdf_document_file_id: null,
      content_sha256: null,
    } as Partial<EmploymentContract>]]));
    setActiveTab('compose');
    setShowContractEditor(true);
  };

  const handleAICalculate = async () => {
    setCalculating(true);
    let calculated = 0;
    for (const [userId, draft] of draftContracts) {
      if (getPayBasis(draft) !== 'annual') continue;
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
          calculated += 1;
        }
      } catch (error) {
        console.error('Salary calc error for', userId, error);
      }
    }
    setCalculating(false);
    if (calculated > 0) toast.success(`${calculated}명의 급여가 자동 계산되었습니다.`);
    else toast.info('연봉 단위로 입력된 구성원이 없습니다.');
    setSalaryModalOpen(false);
  };

  const filteredContracts = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return contracts.filter((contract) => {
      const status = getDisplayStatus(contract);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      const date = (contract.requested_at || contract.created_at || '').slice(0, 10);
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      if (!query) return true;
      return [
        contract.user_name,
        contract.department,
        contract.position,
        contract.template_snapshot?.name,
        contract.contract_type,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [contracts, fromDate, historySearch, statusFilter, toDate]);

  const eventsByContract = useMemo(() => {
    const grouped = new Map<string, ContractEvent[]>();
    for (const event of contractEvents) {
      const items = grouped.get(event.contract_id) || [];
      items.push(event);
      grouped.set(event.contract_id, items);
    }
    return grouped;
  }, [contractEvents]);

  const auditEvents = useMemo(() => {
    if (!auditContract) return contractEvents;
    return contractEvents.filter((event) => event.contract_id === auditContract.id);
  }, [auditContract, contractEvents]);

  const unreadCount = contracts.filter((contract) => contract.status === 'requested' && !contract.opened_at).length;
  const pendingCount = contracts.filter((contract) => ['requested', 'opened'].includes(contract.status)).length;
  const signedCount = contracts.filter((contract) => contract.status === 'signed').length;

  if (templatesLoading || contractsLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (showContractEditor && selectedTemplate) {
    const typeInfo = TEMPLATE_TYPE_INFO[selectedTemplate.template_type] || TEMPLATE_TYPE_INFO.custom;

    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-white text-[#111111]">
        <div className="shrink-0 border-b border-[#e5e5e5] bg-white px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setShowContractEditor(false)} className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${typeInfo.className}`}>
                {typeInfo.icon}
              </div>
              <div>
                <h2 className="text-base font-semibold">{selectedTemplate.name}</h2>
                <p className="text-xs text-[#707072]">템플릿 선택 → 직원 선택 → 필수값 입력 → 미리보기 → 발송 확인</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-[#cacacb] px-3 py-1.5">
                <Stamp className="h-3.5 w-3.5 text-[#707072]" />
                <Label htmlFor="include-company-seal-editor" className="text-xs">회사 직인</Label>
                <Switch id="include-company-seal-editor" checked={includeCompanySeal} onCheckedChange={setIncludeCompanySeal} />
              </div>
              <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={saving} className="gap-1 rounded-full">
                <Save className="h-3.5 w-3.5" /> 임시저장
              </Button>
              <Button size="sm" onClick={handleOpenSendConfirm} disabled={saving || selectedEmployees.size === 0 || validationIssues.length > 0} className="gap-1 rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a]">
                <Send className="h-3.5 w-3.5" /> 발송 검토
              </Button>
            </div>
          </div>
        </div>

        <div className="grid shrink-0 gap-3 border-b border-[#e5e5e5] bg-[#fafafa] px-4 py-3 xl:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className="rounded-full">선택 {selectedEmployees.size}명</Badge>
              <Badge variant="outline" className="rounded-full">{typeInfo.label}</Badge>
              <Badge
                variant="outline"
                className={`rounded-full ${validIssueCount === 0 ? 'border-emerald-200 text-emerald-700' : 'border-amber-200 text-amber-700'}`}
              >
                {validIssueCount === 0 ? '발송 가능' : `검증 ${validIssueCount}건`}
              </Badge>
              {validationWarnings.length > 0 && (
                <Badge variant="outline" className="rounded-full border-amber-200 text-amber-700">경고 {validationWarnings.length}건</Badge>
              )}
              {includeCompanySeal && !companySealUrl && (
                <Badge variant="outline" className="rounded-full border-amber-200 text-amber-700">직인 파일 필요</Badge>
              )}
            </div>

            <div className="rounded-lg border border-[#e5e5e5] bg-white p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">공통값 일괄 적용</p>
                  <p className="text-xs text-[#707072]">입력한 값만 선택 직원 전체에 적용됩니다.</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full"
                  onClick={handleBulkApply}
                  disabled={selectedEmployees.size === 0}
                >
                  선택 {selectedEmployees.size}명 적용
                </Button>
              </div>
              <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
                <Input
                  type="date"
                  value={bulkApplyDraft.contract_date}
                  onChange={(event) => setBulkApplyDraft((prev) => ({ ...prev, contract_date: event.target.value }))}
                  className="h-8 text-xs"
                  aria-label="공통 계약일"
                />
                <Input
                  type="date"
                  value={bulkApplyDraft.contract_start_date}
                  onChange={(event) => setBulkApplyDraft((prev) => ({ ...prev, contract_start_date: event.target.value }))}
                  className="h-8 text-xs"
                  aria-label="공통 시작일"
                />
                <Input
                  type="date"
                  value={bulkApplyDraft.contract_end_date}
                  onChange={(event) => setBulkApplyDraft((prev) => ({ ...prev, contract_end_date: event.target.value }))}
                  className="h-8 text-xs"
                  aria-label="공통 종료일"
                />
                <Select value={bulkApplyDraft.contract_type} onValueChange={(value) => setBulkApplyDraft((prev) => ({ ...prev, contract_type: value }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">계약유형 유지</SelectItem>
                    {Object.entries(CONTRACT_TYPES).map(([key, value]) => <SelectItem key={key} value={key}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={bulkApplyDraft.probation_period} onValueChange={(value) => setBulkApplyDraft((prev) => ({ ...prev, probation_period: value }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">수습 유지</SelectItem>
                    {PROBATION_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select
                  value={bulkApplyDraft.pay_basis}
                  onValueChange={(value) => setBulkApplyDraft((prev) => ({ ...prev, pay_basis: value as BulkApplyDraft['pay_basis'] }))}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">급여형태 유지</SelectItem>
                    {PAY_BASIS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={bulkApplyDraft.pay_amount}
                  onChange={(event) => setBulkApplyDraft((prev) => ({ ...prev, pay_amount: event.target.value }))}
                  placeholder="급여액"
                  className="h-8 text-xs"
                />
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={bulkApplyDraft.pay_day}
                  onChange={(event) => setBulkApplyDraft((prev) => ({ ...prev, pay_day: event.target.value }))}
                  placeholder="급여일"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#707072]" />
            <Input
              value={employeeSearch}
              onChange={(event) => setEmployeeSearch(event.target.value)}
              placeholder="직원명, 부서, 이메일 검색"
              className="h-9 rounded-full border-[#cacacb] pl-9"
            />
          </div>
        </div>

        <div className="grid min-h-0 flex-1 overflow-hidden xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="min-h-0 border-r border-[#e5e5e5] bg-white">
            <div className="flex items-center justify-between border-b border-[#e5e5e5] px-3 py-2">
              <div>
                <p className="text-sm font-semibold">직원 선택</p>
                <p className="text-xs text-[#707072]">표시 {filteredEmployees.length}명</p>
              </div>
              <Button variant="outline" size="sm" className="h-8 rounded-full" onClick={toggleVisibleEmployees}>
                {visibleAllSelected ? '표시 해제' : '표시 선택'}
              </Button>
            </div>
            <ScrollArea className="h-full max-h-[calc(100vh-264px)]">
              <div className="space-y-1 p-2">
                {filteredEmployees.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#cacacb] px-3 py-8 text-center text-xs text-[#707072]">
                    검색 결과가 없습니다.
                  </div>
                ) : filteredEmployees.map((employee) => {
                  const isSelected = selectedEmployees.has(employee.id);
                  return (
                    <button
                      key={employee.id}
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors ${isSelected ? 'border-[#111111] bg-[#fafafa]' : 'border-transparent hover:border-[#e5e5e5] hover:bg-[#fafafa]'}`}
                      onClick={() => toggleEmployee(employee.id)}
                    >
                      <Checkbox checked={isSelected} className="pointer-events-none" />
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#111111] text-xs font-semibold text-white">
                        {employee.full_name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{employee.full_name}</p>
                        <p className="truncate text-xs text-[#707072]">{employee.department || '-'} · {employee.position || '-'}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </aside>

          <main className="min-h-0 overflow-auto bg-white">
            {selectedEditorEmployees.length === 0 ? (
              <div className="flex h-full min-h-[420px] items-center justify-center p-6">
                <div className="rounded-lg border border-dashed border-[#cacacb] bg-[#fafafa] px-8 py-10 text-center">
                  <Users className="mx-auto mb-3 h-8 w-8 text-[#9e9ea0]" />
                  <p className="text-sm font-medium">입력할 직원을 선택하세요.</p>
                  <p className="mt-1 text-xs text-[#707072]">왼쪽 목록에서 직원을 선택하면 이 표에 편집 row가 표시됩니다.</p>
                </div>
              </div>
            ) : (
              <table className="w-full min-w-[1540px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-[#cacacb]">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#707072]">구성원</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#707072]">미리보기</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#707072]">계약일</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#707072]">생년월일</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#707072]">계약유형</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#707072]">시작일</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#707072]">종료일</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#707072]">수습</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#707072]">부서</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#707072]">직위</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#707072]">급여 형태</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#707072]">급여액</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#707072]">월 환산</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-[#707072]">급여일</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-[#707072]">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEditorEmployees.map((employee) => {
                    const draft = draftContracts.get(employee.id);
                    const payBasis = getPayBasis(draft);
                    const payInputAmount = getPayInputAmount(draft);
                    const monthlyEquivalent = getMonthlyEquivalent(draft);
                    const hasActiveIssue = validationItems.some((issue) => issue.key === activeIssueKey && issue.employeeId === employee.id);
                    return (
                      <tr
                        key={employee.id}
                        ref={(node) => { draftRowRefs.current[employee.id] = node; }}
                        className={`border-b border-[#e5e5e5] bg-white hover:bg-[#fafafa] ${hasActiveIssue ? 'bg-amber-50 outline outline-1 outline-amber-300' : ''}`}
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111111] text-xs font-semibold text-white">
                              {employee.full_name[0]}
                            </div>
                            <div>
                              <p className="font-medium">{employee.full_name}</p>
                              <p className="text-xs text-[#707072]">{employee.department || '-'} · {employee.position || '-'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Button variant="link" size="sm" className="h-auto p-0 text-xs text-[#111111]" onClick={() => openDraftPreview(employee.id)}>
                            미리보기
                          </Button>
                        </td>
                        <td className="px-3 py-2">
                          <Input type="date" value={draft?.contract_date || ''} onChange={(event) => updateDraft(employee.id, 'contract_date', event.target.value)} className="h-8 w-[130px] text-xs" />
                        </td>
                        <td className="px-3 py-2">
                          <Input type="date" value={draft?.birth_date || ''} onChange={(event) => updateDraft(employee.id, 'birth_date', event.target.value)} className={`h-8 w-[130px] text-xs ${!draft?.birth_date ? 'border-red-300' : ''}`} />
                        </td>
                        <td className="px-3 py-2">
                          <Select value={draft?.contract_type || 'regular'} onValueChange={(value) => updateDraft(employee.id, 'contract_type', value)}>
                            <SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{Object.entries(CONTRACT_TYPES).map(([key, value]) => <SelectItem key={key} value={key}>{value}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          <Input type="date" value={draft?.contract_start_date || ''} onChange={(event) => updateDraft(employee.id, 'contract_start_date', event.target.value)} className="h-8 w-[130px] text-xs" />
                        </td>
                        <td className="px-3 py-2">
                          <Input type="date" value={draft?.contract_end_date || ''} onChange={(event) => updateDraft(employee.id, 'contract_end_date', event.target.value || null)} className="h-8 w-[130px] text-xs" />
                        </td>
                        <td className="px-3 py-2">
                          <Select value={draft?.probation_period || '수습 없음'} onValueChange={(value) => updateDraft(employee.id, 'probation_period', value)}>
                            <SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{PROBATION_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          <Input value={draft?.department || ''} onChange={(event) => updateDraft(employee.id, 'department', event.target.value)} className="h-8 w-[120px] text-xs" />
                        </td>
                        <td className="px-3 py-2">
                          <Input value={draft?.position || ''} onChange={(event) => updateDraft(employee.id, 'position', event.target.value)} className="h-8 w-[110px] text-xs" />
                        </td>
                        <td className="px-3 py-2">
                          <Select value={payBasis} onValueChange={(value) => updateDraftPayBasis(employee.id, value as PayBasis)}>
                            <SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PAY_BASIS_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  <div>
                                    <div>{option.label}</div>
                                    <div className="text-[11px] text-[#707072]">{option.helper}</div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            value={payInputAmount || ''}
                            onChange={(event) => updateDraftPayAmount(employee.id, Number(event.target.value) || null)}
                            className="h-8 w-[130px] text-xs"
                            placeholder={getPayInputPlaceholder(payBasis)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="min-w-[118px] text-xs">
                            <p className="font-medium tabular-nums">{monthlyEquivalent ? `${formatNumber(monthlyEquivalent)}원` : '-'}</p>
                            {payBasis === 'hourly' && (
                              <p className="text-[11px] text-[#707072]">월 {MONTHLY_STANDARD_HOURS_2026}시간 기준</p>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" value={draft?.pay_day || 25} onChange={(event) => updateDraft(employee.id, 'pay_day', Number(event.target.value) || 25)} className="h-8 w-[80px] text-xs" />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button variant="ghost" size="sm" className="h-8 rounded-full text-xs" onClick={() => toggleEmployee(employee.id)}>
                            제외
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </main>

          <aside className="min-h-0 border-l border-[#e5e5e5] bg-[#fafafa]">
            <div className="border-b border-[#e5e5e5] bg-white px-3 py-2">
              <p className="text-sm font-semibold">검증 패널</p>
              <p className="text-xs text-[#707072]">항목을 클릭하면 해당 입력 row로 이동합니다.</p>
            </div>
            <ScrollArea className="h-full max-h-[calc(100vh-264px)]">
              <div className="space-y-3 p-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-red-100 bg-white p-2 text-center">
                    <p className="text-lg font-semibold tabular-nums text-red-700">{validIssueCount}</p>
                    <p className="text-[11px] text-[#707072]">누락</p>
                  </div>
                  <div className="rounded-lg border border-amber-100 bg-white p-2 text-center">
                    <p className="text-lg font-semibold tabular-nums text-amber-700">{validationWarnings.length}</p>
                    <p className="text-[11px] text-[#707072]">경고</p>
                  </div>
                  <div className="rounded-lg border border-emerald-100 bg-white p-2 text-center">
                    <p className="text-lg font-semibold tabular-nums text-emerald-700">{validIssueCount === 0 ? 1 : 0}</p>
                    <p className="text-[11px] text-[#707072]">발송</p>
                  </div>
                </div>

                {validationItems.length === 0 ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    필수값과 경고 항목이 없습니다. 발송 검토를 진행할 수 있습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {validationItems.map((issue) => (
                      <button
                        key={issue.key}
                        type="button"
                        className={`w-full rounded-lg border bg-white p-3 text-left text-xs transition-colors hover:bg-[#fafafa] ${issue.severity === 'error' ? 'border-red-200' : 'border-amber-200'} ${activeIssueKey === issue.key ? 'ring-1 ring-[#111111]' : ''}`}
                        onClick={() => scrollToValidationIssue(issue)}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <Badge variant="outline" className={`rounded-full text-[11px] ${issue.severity === 'error' ? 'border-red-200 text-red-700' : 'border-amber-200 text-amber-700'}`}>
                            {issue.severity === 'error' ? '누락' : '경고'}
                          </Badge>
                          {issue.employeeName && <span className="truncate text-[11px] text-[#707072]">{issue.employeeName}</span>}
                        </div>
                        <p className="leading-relaxed text-[#111111]">{issue.message}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </aside>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#e5e5e5] bg-white px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-3 text-[#707072]">
            <span>선택 {selectedEmployees.size} / 표시 {filteredEmployees.length} / 전체 {employees.length}명</span>
            <Button variant="outline" size="sm" className="h-8 rounded-full gap-1" onClick={() => setSalaryModalOpen(true)} disabled={selectedEmployees.size === 0}>
              <Sparkles className="h-3.5 w-3.5" /> 급여 자동계산
            </Button>
          </div>
          <Button
            size="sm"
            onClick={handleOpenSendConfirm}
            disabled={saving || selectedEmployees.size === 0 || validationIssues.length > 0}
            className="rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a]"
          >
            {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-2 h-3.5 w-3.5" />}
            발송 검토
          </Button>
        </div>

        <Dialog open={salaryModalOpen} onOpenChange={setSalaryModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> 급여 자동 계산</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-[#707072]">
                연봉 단위로 입력한 구성원만 월급, 기본급, 고정초과근무수당을 자동 계산합니다. 월급/시급 계약은 작성 표에서 직접 입력하면 월 환산액이 자동 반영됩니다.
              </p>
              <p className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-xs text-[#707072]">
                2026년 최저임금 기준: 시급 {formatNumber(MINIMUM_HOURLY_WAGE_2026)}원, 월 환산액 {formatNumber(MINIMUM_MONTHLY_WAGE_2026)}원(주 40시간, 월 209시간 기준)
              </p>
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {employees.filter((employee) => selectedEmployees.has(employee.id)).map((employee) => {
                    const draft = draftContracts.get(employee.id);
                    const payBasis = getPayBasis(draft);
                    return (
                      <div key={employee.id} className="flex items-center gap-2 border-b py-2 last:border-0">
                        <span className="min-w-[90px] text-sm font-medium">{employee.full_name}</span>
                        <Badge variant="outline" className="rounded-full text-[11px]">{PAY_BASIS_LABELS[payBasis]}</Badge>
                        <Input
                          type="number"
                          placeholder={payBasis === 'annual' ? '연봉 입력' : '표에서 직접 입력'}
                          value={payBasis === 'annual' ? (draft?.annual_salary || '') : ''}
                          onChange={(event) => updateDraftPayAmount(employee.id, Number(event.target.value) || null)}
                          disabled={payBasis !== 'annual'}
                          className="h-8 flex-1 text-sm"
                        />
                        <span className="text-xs text-[#707072]">원</span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <Button onClick={handleAICalculate} disabled={calculating} className="w-full rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a]">
                {calculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                계산 적용
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
          <DialogContent className="flex max-h-[92vh] max-w-[1120px] flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="border-b border-[#e5e5e5] px-5 py-4">
              <DialogTitle>전자계약 최종 검토</DialogTitle>
              <p className="text-sm text-[#707072]">
                선택된 직원 계약서를 모두 검토 완료해야 발송할 수 있습니다.
              </p>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
              <aside className="min-h-0 border-r border-[#e5e5e5] bg-[#fafafa]">
                <div className="border-b border-[#e5e5e5] bg-white px-4 py-3">
                  <p className="text-sm font-semibold">검토 대상</p>
                  <p className="text-xs text-[#707072]">{reviewedCount}/{selectedEditorEmployees.length}명 검토 완료</p>
                </div>
                <ScrollArea className="h-[58vh]">
                  <div className="space-y-1 p-2">
                    {selectedEditorEmployees.map((employee) => {
                      const reviewKey = reviewKeysByEmployee.get(employee.id);
                      const reviewed = Boolean(reviewKey && reviewedContractKeys.has(reviewKey));
                      const active = selectedFinalReviewEmployee?.id === employee.id;
                      return (
                        <button
                          key={employee.id}
                          type="button"
                          className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${active ? 'border-[#111111] bg-white' : 'border-transparent hover:border-[#e5e5e5] hover:bg-white'}`}
                          onClick={() => setFinalReviewEmployeeId(employee.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium">{employee.full_name}</span>
                            <Badge variant="outline" className={`shrink-0 rounded-full text-[11px] ${reviewed ? 'border-emerald-200 text-emerald-700' : 'border-amber-200 text-amber-700'}`}>
                              {reviewed ? '검토 완료' : '미검토'}
                            </Badge>
                          </div>
                          <p className="mt-1 truncate text-xs text-[#707072]">{employee.department || '-'} · {employee.position || '-'}</p>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </aside>

              <main className="min-h-0 overflow-hidden bg-[#f5f5f5]">
                <ScrollArea className="h-[66vh]">
                  <style>{contractDocumentCss()}</style>
                  <div className="px-4 py-5">
                    {selectedFinalReviewHtml ? (
                      <div dangerouslySetInnerHTML={{ __html: selectedFinalReviewHtml }} />
                    ) : (
                      <div className="rounded-lg border border-dashed border-[#cacacb] bg-white px-6 py-16 text-center text-sm text-[#707072]">
                        검토할 계약서를 선택하세요.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </main>

              <aside className="min-h-0 border-l border-[#e5e5e5] bg-white">
                <ScrollArea className="h-[66vh]">
                  <div className="space-y-4 p-4">
                    <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3 text-sm">
                      <p className="font-semibold">{selectedFinalReviewEmployee?.full_name || '선택 직원'}</p>
                      <div className="mt-2 space-y-1 text-xs text-[#707072]">
                        <p><span className="text-[#111111]">양식</span> {selectedTemplate.name}</p>
                        <p><span className="text-[#111111]">계약기간</span> {selectedFinalReviewDraft?.contract_start_date || '-'} ~ {selectedFinalReviewDraft?.contract_end_date || '무기한'}</p>
                        <p><span className="text-[#111111]">급여 단위</span> {selectedFinalReviewDraft ? PAY_BASIS_LABELS[getPayBasis(selectedFinalReviewDraft)] : '-'}</p>
                        <p><span className="text-[#111111]">월 환산</span> {formatNumber(getMonthlyEquivalent(selectedFinalReviewDraft)) || '-'}원</p>
                        <p><span className="text-[#111111]">직인</span> {includeCompanySeal ? '포함' : '미포함'}</p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#e5e5e5] p-3">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="final-review-confirm"
                          checked={selectedFinalReviewCompleted}
                          disabled={!selectedFinalReviewKey}
                          onCheckedChange={(checked) => setSelectedFinalReviewCompleted(Boolean(checked))}
                        />
                        <Label htmlFor="final-review-confirm" className="text-sm leading-relaxed">
                          이 계약서의 입력값, 급여, 계약기간, 직인 포함 여부를 최종 검토했습니다.
                        </Label>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full rounded-full"
                        onClick={markFinalReviewComplete}
                        disabled={!selectedFinalReviewKey}
                      >
                        검토 완료 후 다음으로
                      </Button>
                    </div>

                    <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3 text-sm">
                      <p className="font-semibold">발송 요약</p>
                      <div className="mt-2 space-y-1 text-xs text-[#707072]">
                        <p>선택 직원 {selectedEmployees.size}명</p>
                        <p>검토 완료 {reviewedCount}명</p>
                        <p>직인 {includeCompanySeal ? '포함' : '미포함'}</p>
                        <p>급여 단위 {selectedPaySummary}</p>
                        <p>계약기간 {selectedContractPeriodSummary}</p>
                      </div>
                    </div>

                    {(validationIssues.length > 0 || validationWarnings.length > 0) && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                        {validationIssues.length > 0
                          ? `누락 ${validationIssues.length}건: ${validationIssues.slice(0, 3).join(' / ')}`
                          : `경고 ${validationWarnings.length}건: ${validationWarnings.map((issue) => issue.message).slice(0, 3).join(' / ')}`}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </aside>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e5e5] bg-white px-5 py-3">
              <p className="text-sm text-[#707072]">
                {allContractsReviewed ? '모든 계약서 검토가 완료되었습니다.' : `미검토 ${selectedEditorEmployees.length - reviewedCount}건이 남았습니다.`}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setSendConfirmOpen(false)} disabled={saving}>
                  취소
                </Button>
                <Button
                  onClick={handleRequest}
                  disabled={saving || validationIssues.length > 0 || !allContractsReviewed}
                  className="rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a]"
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  발송하기
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <ContractPreviewDialog open={!!previewContract} onOpenChange={(open) => !open && setPreviewContract(null)} contract={previewContract as ContractData} />
      </div>
    );
  }

  return (
    <div className="space-y-5 text-[#111111]">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
          <p className="text-xs font-medium text-[#707072]">미열람 계약</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{unreadCount}</p>
        </div>
        <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
          <p className="text-xs font-medium text-[#707072]">서명 대기</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{pendingCount}</p>
        </div>
        <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
          <p className="text-xs font-medium text-[#707072]">서명 완료</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{signedCount}</p>
        </div>
        <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
          <p className="text-xs font-medium text-[#707072]">활성 양식</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{templates.length}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="rounded-full bg-[#f5f5f5] p-1">
          <TabsTrigger value="compose" className="rounded-full gap-1.5"><Send className="h-3.5 w-3.5" /> 계약 작성</TabsTrigger>
          <TabsTrigger value="history" className="rounded-full gap-1.5"><History className="h-3.5 w-3.5" /> 발송 내역</TabsTrigger>
          <TabsTrigger value="templates" className="rounded-full gap-1.5"><Settings2 className="h-3.5 w-3.5" /> 템플릿 관리</TabsTrigger>
          <TabsTrigger value="audit" className="rounded-full gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> 감사 기록</TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-5">
          <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">계약 양식 선택</h3>
                <p className="text-sm text-[#707072]">필수필드가 충족된 양식만 안전하게 발송할 수 있습니다.</p>
              </div>
              <Button variant="outline" size="sm" className="rounded-full gap-1" onClick={() => setActiveTab('templates')}>
                <Settings2 className="h-3.5 w-3.5" /> 양식 관리
              </Button>
            </div>
            {templates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#cacacb] bg-[#fafafa] py-12 text-center text-sm text-[#707072]">
                등록된 활성 계약 양식이 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {templates.map((template) => {
                  const typeInfo = TEMPLATE_TYPE_INFO[template.template_type] || TEMPLATE_TYPE_INFO.custom;
                  const templateContent = template.content
                    || PREBUILT_TEMPLATES.find((item) => item.type === template.template_type)?.content
                    || null;
                  const quality = evaluateContractTemplateQuality(templateContent, { templateType: template.template_type });
                  return (
                    <button
                      key={template.id}
                      type="button"
                      className={`rounded-lg border p-4 text-left transition-all ${selectedTemplateId === template.id ? 'border-[#111111] bg-[#fafafa] ring-1 ring-[#111111]' : 'border-[#cacacb] bg-white hover:bg-[#fafafa]'}`}
                      onClick={() => {
                        setSelectedTemplateId(template.id);
                        setSelectedEmployees(new Set());
                        setDraftContracts(new Map());
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${typeInfo.className}`}>{typeInfo.icon}</div>
                          <div>
                            <p className="text-sm font-semibold">{template.name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className="rounded-full text-[11px]">{typeInfo.label}</Badge>
                              <Badge variant="outline" className={`rounded-full text-[11px] ${quality.ok ? 'border-emerald-200 text-emerald-700' : 'border-red-200 text-red-700'}`}>{quality.ok ? '필수필드 충족' : '필수필드 부족'}</Badge>
                              {quality.warnings.length > 0 && <Badge variant="outline" className="rounded-full border-amber-200 text-[11px] text-amber-700">검토 필요</Badge>}
                            </div>
                          </div>
                        </div>
                        <Checkbox checked={selectedTemplateId === template.id} />
                      </div>
                      {template.description && <p className="mt-2 text-xs text-[#707072]">{template.description}</p>}
                      {!quality.ok && <p className="mt-2 text-xs text-red-700">누락: {quality.missing.join(', ')}</p>}
                      {quality.warnings.length > 0 && <p className="mt-2 text-xs text-amber-700">확인: {quality.warnings.join(' / ')}</p>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedTemplate && (
            <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <div className="flex items-center gap-2 rounded-full border border-[#cacacb] px-3 py-1.5">
                    <Stamp className="h-4 w-4 text-[#707072]" />
                    <span>회사 직인 포함</span>
                    <Switch checked={includeCompanySeal} onCheckedChange={setIncludeCompanySeal} />
                  </div>
                  {includeCompanySeal && !companySealUrl && <span className="text-xs text-amber-700">회사 설정에 직인 파일을 등록해야 발송할 수 있습니다.</span>}
                </div>
                <Button onClick={() => setShowContractEditor(true)} className="rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a] gap-1">
                  <Users className="h-4 w-4" /> 직원 선택 및 작성
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="grid gap-2 rounded-lg border border-[#e5e5e5] bg-white p-3 lg:grid-cols-[1fr_150px_150px_150px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#707072]" />
              <Input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="직원, 부서, 템플릿 검색" className="h-9 rounded-full pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 rounded-full"><Filter className="mr-2 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                {Object.entries(STATUS_LABELS).map(([key, value]) => <SelectItem key={key} value={key}>{value.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="h-9 rounded-full" />
            <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="h-9 rounded-full" />
            <Button variant="outline" size="sm" className="h-9 rounded-full" onClick={() => { setHistorySearch(''); setStatusFilter('all'); setFromDate(''); setToDate(''); }}>
              초기화
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#cacacb] bg-white">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-[#fafafa]">
                <tr className="border-b border-[#cacacb]">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#707072]">계약</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#707072]">직원</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#707072]">기간</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-[#707072]">상태</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#707072]">마지막 다운로드</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#707072]">작업</th>
                </tr>
              </thead>
              <tbody>
                {filteredContracts.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[#707072]">계약 내역이 없습니다.</td></tr>
                ) : filteredContracts.map((contract) => {
                  const statusKey = getDisplayStatus(contract);
                  const statusInfo = STATUS_LABELS[statusKey] || STATUS_LABELS.draft;
                  const lastDownload = eventsByContract.get(contract.id)?.find((event) => event.event_type === 'downloaded');
                  return (
                    <tr
                      key={contract.id}
                      className="cursor-pointer border-b border-[#e5e5e5] last:border-0 hover:bg-[#fafafa]"
                      onClick={() => setDetailContract(contract)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{getContractTitle(contract)}</p>
                        <p className="text-xs text-[#707072]">발송 {formatDateTime(contract.requested_at || contract.created_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{contract.user_name}</p>
                        <p className="text-xs text-[#707072]">{contract.department || '-'} · {contract.position || '-'}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#707072]">{contract.contract_start_date || '-'} ~ {contract.contract_end_date || '무기한'}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={`border-0 gap-1 ${statusInfo.className}`}>{statusInfo.icon}{statusInfo.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#707072]">{lastDownload ? formatDateTime(lastDownload.created_at) : '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="ghost" size="sm" className="h-8 rounded-full" onClick={(event) => { event.stopPropagation(); setPreviewContract(contract); }}>보기</Button>
                          <Button variant="outline" size="sm" className="h-8 rounded-full" onClick={(event) => { event.stopPropagation(); setAuditContract(contract); setActiveTab('audit'); }}>감사</Button>
                          {contract.signed_pdf_storage_path && (
                            <Button variant="outline" size="sm" className="h-8 rounded-full gap-1" onClick={(event) => { event.stopPropagation(); handleAdminDownload(contract); }}>
                              <Download className="h-3.5 w-3.5" /> PDF
                            </Button>
                          )}
                          {['requested', 'opened'].includes(contract.status) && (
                            <Button variant="outline" size="sm" className="h-8 rounded-full gap-1" onClick={(event) => { event.stopPropagation(); handleReminder(contract); }}>
                              <Bell className="h-3.5 w-3.5" /> 재알림
                            </Button>
                          )}
                          {contract.status === 'rejected' && (
                            <Button variant="outline" size="sm" className="h-8 rounded-full gap-1" onClick={(event) => { event.stopPropagation(); handlePrepareResend(contract); }}>
                              <RotateCw className="h-3.5 w-3.5" /> 재발송
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <ContractTemplateSettings />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e5e5e5] bg-white p-3">
            <div>
              <h3 className="font-semibold">감사 기록</h3>
              <p className="text-sm text-[#707072]">{auditContract ? `${auditContract.user_name} · ${getContractTitle(auditContract)}` : '전체 계약 이벤트'}</p>
            </div>
            {auditContract && <Button variant="outline" size="sm" className="rounded-full" onClick={() => setAuditContract(null)}>전체 보기</Button>}
          </div>
          <div className="rounded-lg border border-[#cacacb] bg-white">
            {eventsLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : auditEvents.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#707072]">감사 기록이 없습니다.</div>
            ) : (
              <div className="divide-y divide-[#e5e5e5]">
                {auditEvents.map((event) => {
                  const contract = contracts.find((item) => item.id === event.contract_id);
                  return (
                    <div key={event.id} className="grid gap-2 p-4 md:grid-cols-[180px_1fr_180px]">
                      <div className="text-xs text-[#707072]">{formatDateTime(event.created_at)}</div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="rounded-full">{EVENT_LABELS[event.event_type] || event.event_type}</Badge>
                          <span className="text-sm font-medium">{contract ? `${contract.user_name} · ${getContractTitle(contract)}` : event.contract_id}</span>
                        </div>
                        <p className="mt-1 text-xs text-[#707072]">
                          actor: {event.actor_role || '-'} · IP: {event.ip_address || '-'} · UA: {event.user_agent || '-'}
                        </p>
                      </div>
                      <div className="text-xs text-[#707072]">
                        {Object.keys(event.metadata || {}).length > 0 ? JSON.stringify(event.metadata) : '-'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Sheet open={!!detailContract} onOpenChange={(open) => { if (!open) setDetailContract(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>계약 상세</SheetTitle>
          </SheetHeader>
          {detailContract && (() => {
            const statusKey = getDisplayStatus(detailContract);
            const statusInfo = STATUS_LABELS[statusKey] || STATUS_LABELS.draft;
            const detailEvents = eventsByContract.get(detailContract.id) || [];
            const lastDownload = detailEvents.find((event) => event.event_type === 'downloaded');
            return (
              <div className="mt-5 space-y-4">
                <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold">{getContractTitle(detailContract)}</p>
                      <p className="mt-1 text-sm text-[#707072]">{detailContract.user_name} · {detailContract.department || '-'} · {detailContract.position || '-'}</p>
                    </div>
                    <Badge className={`border-0 gap-1 ${statusInfo.className}`}>{statusInfo.icon}{statusInfo.label}</Badge>
                  </div>
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <p><span className="text-[#707072]">계약기간</span><br />{detailContract.contract_start_date || '-'} ~ {detailContract.contract_end_date || '무기한'}</p>
                    <p><span className="text-[#707072]">발송일</span><br />{formatDateTime(detailContract.requested_at || detailContract.created_at)}</p>
                    <p><span className="text-[#707072]">열람일</span><br />{formatDateTime(detailContract.opened_at)}</p>
                    <p><span className="text-[#707072]">서명일</span><br />{formatDateTime(detailContract.signed_at)}</p>
                    <p><span className="text-[#707072]">마지막 다운로드</span><br />{lastDownload ? formatDateTime(lastDownload.created_at) : '-'}</p>
                    <p><span className="text-[#707072]">회사 직인</span><br />{detailContract.company_seal_included ? '포함' : '미포함'}</p>
                  </div>
                  {detailContract.rejected_reason && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      거절 사유: {detailContract.rejected_reason}
                    </div>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="outline" className="rounded-full" onClick={() => setPreviewContract(detailContract)}>
                    <Eye className="mr-2 h-4 w-4" /> 계약 미리보기
                  </Button>
                  {detailContract.signed_pdf_storage_path && (
                    <Button variant="outline" className="rounded-full" onClick={() => handleAdminDownload(detailContract)}>
                      <Download className="mr-2 h-4 w-4" /> PDF 다운로드
                    </Button>
                  )}
                  {['requested', 'opened'].includes(detailContract.status) && (
                    <Button variant="outline" className="rounded-full" onClick={() => handleReminder(detailContract)}>
                      <Bell className="mr-2 h-4 w-4" /> 재알림 보내기
                    </Button>
                  )}
                  {detailContract.status === 'rejected' && (
                    <Button variant="outline" className="rounded-full" onClick={() => handlePrepareResend(detailContract)}>
                      <RotateCw className="mr-2 h-4 w-4" /> 수정 후 재발송
                    </Button>
                  )}
                </div>

                <div className="rounded-lg border border-[#e5e5e5] bg-white">
                  <div className="border-b border-[#e5e5e5] px-4 py-3">
                    <p className="text-sm font-semibold">감사 이벤트 타임라인</p>
                  </div>
                  {detailEvents.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-[#707072]">이벤트 기록이 없습니다.</div>
                  ) : (
                    <div className="divide-y divide-[#e5e5e5]">
                      {detailEvents.map((event) => (
                        <div key={event.id} className="p-4">
                          <div className="flex items-center justify-between gap-3">
                            <Badge variant="outline" className="rounded-full">{EVENT_LABELS[event.event_type] || event.event_type}</Badge>
                            <span className="text-xs text-[#707072]">{formatDateTime(event.created_at)}</span>
                          </div>
                          <p className="mt-2 text-xs text-[#707072]">
                            actor: {event.actor_role || '-'} · IP: {event.ip_address || '-'}
                          </p>
                          {Object.keys(event.metadata || {}).length > 0 && (
                            <p className="mt-1 break-all rounded-md bg-[#fafafa] p-2 text-[11px] text-[#707072]">
                              {JSON.stringify(event.metadata)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      <ContractPreviewDialog open={!!previewContract} onOpenChange={(open) => !open && setPreviewContract(null)} contract={previewContract as ContractData} />
    </div>
  );
};

export default ContractManagement;
