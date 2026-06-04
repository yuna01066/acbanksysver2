import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileUp,
  Image as ImageIcon,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UploadCloud,
  UserRound,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import HomeLogoButton from '@/components/HomeLogoButton';
import { CONSULTATION_UNKNOWN_OPTION, useAcrylicOptionCatalog } from '@/hooks/useAcrylicOptionCatalog';
import { cn } from '@/lib/utils';

type ConsultationType = '' | 'sheet_purchase' | 'fabrication' | 'design';

type FormState = {
  source: string;
  consultationType: ConsultationType;
  productPurpose: string;
  customerCompany: string;
  customerName: string;
  customerPosition: string;
  customerPhone: string;
  customerEmail: string;
  projectName: string;
  productType: string;
  acrylicType: string;
  materialQualityId: string;
  materialName: string;
  colorOptionId: string;
  colorName: string;
  colorCode: string;
  thickness: string;
  sheetSize: string;
  quantity: string;
  dimensions: string;
  processing: string[];
  inquiryBody: string;
  desiredDeliveryDate: string;
  deliveryAddress: string;
  privacyConsent: boolean;
  marketingConsent: boolean;
  website: string;
};

type ConsultationItem = {
  id: string;
  itemName: string;
  width: string;
  height: string;
  thickness: string;
  materialQualityId: string;
  materialName: string;
  colorOptionId: string;
  quantity: string;
  unit: string;
  colorName: string;
  colorCode: string;
  sheetSize: string;
  processingOptions: string[];
  memo: string;
};

type UploadedFile = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  uploadedAt: string;
  previewUrl?: string;
};

type SavedDraft = {
  form: FormState;
  items: ConsultationItem[];
  files: UploadedFile[];
  step: number;
  submissionToken: string;
  savedAt: string;
};

const steps = [
  { id: 'contact', title: '프로젝트·고객', description: '프로젝트와 회신 정보를 먼저 입력합니다.' },
  { id: 'production', title: '문의 유형', description: '상담 유형에 맞는 제작 정보를 정리합니다.' },
  { id: 'delivery', title: '자료·내용', description: '도면과 요청 내용을 첨부합니다.' },
  { id: 'review', title: '확인·동의', description: '입력 내용을 확인하고 접수합니다.' },
];

const itemUnits = ['개', '세트', '장', 'm', '식'];
const MAX_FILES = 6;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const DRAFT_STORAGE_PREFIX = 'acbank_client_consultation_widget_draft_v2';

const productPurposeOptions = [
  { value: 'display', label: '진열대', description: '제품 거치, 쇼케이스, POP 진열' },
  { value: 'sign', label: '사인·명판', description: '간판, 안내판, QR/가격표' },
  { value: 'cover_box', label: '커버·박스', description: '보호 커버, 케이스, 수납 박스' },
  { value: 'pop', label: 'POP·판촉', description: '행사 집기, 프로모션 소품' },
  { value: 'space_furniture', label: '공간·가구', description: '파티션, 테이블, 매장 집기' },
  { value: 'other', label: '기타', description: '도면 기준 특수 제작' },
];

const consultationTypeOptions: Array<{
  value: Exclude<ConsultationType, ''>;
  label: string;
  description: string;
  helper: string;
}> = [
  {
    value: 'sheet_purchase',
    label: '원장 구매 문의',
    description: '아크릴 원장 재고, 컬러, 두께, 규격 구매',
    helper: '원장 사이즈와 수량을 중심으로 입력합니다.',
  },
  {
    value: 'fabrication',
    label: '제작·가공 문의',
    description: '도면 기준 재단, 접착, 집기, 사인물 제작',
    helper: '품목별 규격과 수량을 중심으로 입력합니다.',
  },
  {
    value: 'design',
    label: '디자인 문의',
    description: '구조 제안, 레퍼런스 기반 시안, 제작 방향 상담',
    helper: '사용 목적과 참고 자료를 중심으로 입력합니다.',
  },
];

const consultationTypeLabels: Record<Exclude<ConsultationType, ''>, string> = {
  sheet_purchase: '원장 구매 문의',
  fabrication: '제작·가공 문의',
  design: '디자인 문의',
};

const internalQuickLinks = [
  { title: '홈', description: '대시보드로 이동', path: '/', shortcut: 'Home' },
  { title: '상담 리드함', description: '아임웹 폼과 채널톡 문의 확인', path: '/channel-talk-leads?source=imweb', shortcut: 'Leads' },
  { title: '견적 초안함', description: '상담 내용을 견적 초안으로 전환', path: '/quote-drafts', shortcut: 'Drafts' },
  { title: '견적 계산기', description: '판재 견적 계산', path: '/calculator?type=quote', shortcut: 'Quote' },
  { title: '고객사 관리', description: '거래처와 담당자 정보', path: '/recipients', shortcut: 'Client' },
];

const initialForm = (source: string): FormState => ({
  source,
  consultationType: '',
  productPurpose: '',
  customerCompany: '',
  customerName: '',
  customerPosition: '',
  customerPhone: '',
  customerEmail: '',
  projectName: '',
  productType: '',
  acrylicType: '',
  materialQualityId: '',
  materialName: '',
  colorOptionId: '',
  colorName: '',
  colorCode: '',
  thickness: '',
  sheetSize: '',
  quantity: '',
  dimensions: '',
  processing: [],
  inquiryBody: '',
  desiredDeliveryDate: '',
  deliveryAddress: '',
  privacyConsent: false,
  marketingConsent: false,
  website: '',
});

function createSubmissionToken() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createConsultationItem(overrides: Partial<ConsultationItem> = {}): ConsultationItem {
  return {
    id: createSubmissionToken(),
    itemName: '',
    width: '',
    height: '',
    thickness: '',
    materialQualityId: '',
    materialName: '',
    colorOptionId: '',
    quantity: '',
    unit: '개',
    colorName: '',
    colorCode: '',
    sheetSize: '',
    processingOptions: [],
    memo: '',
    ...overrides,
  };
}

function draftStorageKey(source: string) {
  return `${DRAFT_STORAGE_PREFIX}:${source || 'imweb-acbankform'}`;
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}MB`;
  if (size >= 1024) return `${Math.round(size / 1024)}KB`;
  return `${size}B`;
}

function fieldFilled(value?: string | null) {
  return (value || '').trim().length > 0;
}

function itemHasContent(item: ConsultationItem) {
  return [
    item.itemName,
    item.materialName,
    item.width,
    item.height,
    item.thickness,
    item.quantity,
    item.colorName,
    item.sheetSize,
    item.memo,
  ].some(fieldFilled);
}

function itemLabel(item: ConsultationItem, index: number) {
  const size = [item.width, item.height, item.thickness].filter(fieldFilled).join(' x ');
  return [
    `${index + 1}. ${item.itemName || '품목'}`,
    item.materialName,
    size,
    item.quantity ? `${item.quantity}${item.unit || ''}` : '',
    item.colorName,
    item.sheetSize,
  ].filter(Boolean).join(' · ');
}

const ClientConsultationWidgetPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const source = searchParams.get('source') || 'imweb-acbankform';
  const isEmbedded = searchParams.get('embed') === '1';
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(() => initialForm(source));
  const [items, setItems] = useState<ConsultationItem[]>(() => [createConsultationItem()]);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [submissionToken, setSubmissionToken] = useState(() => createSubmissionToken());
  const [draftReady, setDraftReady] = useState(false);
  const [restoreDraft, setRestoreDraft] = useState<SavedDraft | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successLeadId, setSuccessLeadId] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);

  const progress = ((step + 1) / steps.length) * 100;
  const hasProductionInfo = useMemo(
    () => (
      fieldFilled(form.productType)
      || fieldFilled(form.productPurpose)
      || fieldFilled(form.materialName)
      || fieldFilled(form.thickness)
      || fieldFilled(form.quantity)
      || items.some(itemHasContent)
    ),
    [form.materialName, form.productPurpose, form.productType, form.quantity, form.thickness, items],
  );
  const hasMaterialSelection = fieldFilled(form.materialQualityId)
    || items.some((item) => fieldFilled(item.materialQualityId));

  const currentValidation = useMemo(() => {
    const missing: string[] = [];
    if (step === 0) {
      if (!fieldFilled(form.customerName)) missing.push('담당자명');
      if (!fieldFilled(form.customerPhone)) missing.push('연락처');
    }
    if (step === 1) {
      if (!form.consultationType) missing.push('문의 유형');
      if (form.consultationType === 'sheet_purchase') {
        if (!hasMaterialSelection) missing.push('소재');
        if (!fieldFilled(form.quantity) && !items.some((item) => fieldFilled(item.quantity))) missing.push('수량');
      } else if (form.consultationType === 'fabrication' && !hasProductionInfo) {
        missing.push('제작 품목 또는 품목 행');
      } else if (form.consultationType === 'design' && !fieldFilled(form.productPurpose) && !fieldFilled(form.productType)) {
        missing.push('디자인 목적');
      }
    }
    if (step === 2 && !fieldFilled(form.inquiryBody)) missing.push('문의 내용');
    if (step === 3 && !form.privacyConsent) missing.push('개인정보 수집·이용 동의');
    return missing;
  }, [form, hasMaterialSelection, hasProductionInfo, items, step]);

  const canGoNext = currentValidation.length === 0;

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateConsultationType = (value: Exclude<ConsultationType, ''>) => {
    setForm((current) => ({
      ...current,
      consultationType: value,
      productType: !current.productType || Object.values(consultationTypeLabels).includes(current.productType)
        ? consultationTypeLabels[value]
        : current.productType,
      sheetSize: value === 'sheet_purchase' ? current.sheetSize : '',
      processing: [],
    }));
  };

  const updateItem = (id: string, patch: Partial<ConsultationItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    setItems((current) => [...current, createConsultationItem()]);
  };

  const duplicateItem = (item: ConsultationItem) => {
    setItems((current) => [...current, createConsultationItem({ ...item, id: createSubmissionToken() })]);
  };

  const removeItem = (id: string) => {
    setItems((current) => {
      const next = current.filter((item) => item.id !== id);
      return next.length > 0 ? next : [createConsultationItem()];
    });
  };

  const moveItem = (id: string, direction: -1 | 1) => {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftStorageKey(source));
      if (raw) {
        const parsed = JSON.parse(raw) as SavedDraft;
        if (parsed?.form && parsed?.submissionToken) {
          setRestoreDraft(parsed);
        }
      }
    } catch {
      window.localStorage.removeItem(draftStorageKey(source));
    } finally {
      setDraftReady(true);
    }
  }, [source]);

  useEffect(() => {
    if (!draftReady || restoreDraft || successLeadId) return;
    const hasDraftContent = [
      form.customerCompany,
      form.customerName,
      form.customerPhone,
      form.projectName,
      form.consultationType,
      form.productType,
      form.materialName,
      form.desiredDeliveryDate,
      form.deliveryAddress,
      form.inquiryBody,
    ].some(fieldFilled) || items.some(itemHasContent) || files.length > 0 || step > 0;
    if (!hasDraftContent) return;

    const timer = window.setTimeout(() => {
      const draft: SavedDraft = {
        form,
        items,
        files: files.map(({ previewUrl, ...file }) => file),
        step,
        submissionToken,
        savedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(draftStorageKey(source), JSON.stringify(draft));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [draftReady, files, form, items, restoreDraft, source, step, submissionToken, successLeadId]);

  const restoreSavedDraft = () => {
    if (!restoreDraft) return;
    setForm({ ...initialForm(source), ...restoreDraft.form, source });
    setItems(restoreDraft.items?.length ? restoreDraft.items.map((item) => createConsultationItem(item)) : [createConsultationItem()]);
    setFiles((restoreDraft.files || []).map((file) => ({ ...file, previewUrl: undefined })));
    setSubmissionToken(restoreDraft.submissionToken || createSubmissionToken());
    setStep(Math.max(0, Math.min(steps.length - 1, Number(restoreDraft.step) || 0)));
    setRestoreDraft(null);
  };

  const discardSavedDraft = () => {
    window.localStorage.removeItem(draftStorageKey(source));
    setRestoreDraft(null);
  };

  const handleSelectedFiles = useCallback(async (selected: File[]) => {
    if (selected.length === 0) return;
    setErrorMessage('');

    if (files.length + selected.length > MAX_FILES) {
      setErrorMessage(`첨부파일은 최대 ${MAX_FILES}개까지 가능합니다.`);
      return;
    }

    const oversized = selected.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) {
      setErrorMessage(`${oversized.name} 파일이 20MB를 초과합니다.`);
      return;
    }

    setUploading(true);
    try {
      const uploaded: UploadedFile[] = [];
      for (const file of selected) {
        const { data, error } = await supabase.functions.invoke('client-consultation-intake', {
          body: {
            action: 'create-upload-url',
            payload: {
              source: form.source,
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              fileSize: file.size,
            },
          },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        const { error: uploadError } = await supabase.storage
          .from(data.bucket)
          .uploadToSignedUrl(data.path, data.token, file, {
            contentType: file.type || 'application/octet-stream',
          });
        if (uploadError) throw uploadError;

        uploaded.push({
          id: `${data.path}-${file.name}`,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
          storagePath: data.path,
          uploadedAt: new Date().toISOString(),
          previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        });
      }
      setFiles((current) => [...current, ...uploaded]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  }, [files.length, form.source]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    await handleSelectedFiles(selected);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    await handleSelectedFiles(Array.from(event.dataTransfer.files || []));
  };

  const submit = async () => {
    setErrorMessage('');
    if (!form.privacyConsent) {
      setErrorMessage('개인정보 수집·이용 동의가 필요합니다.');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-consultation-intake', {
        body: {
          action: 'submit',
          payload: {
            ...form,
            submissionToken,
            items: items
              .filter(itemHasContent)
              .map((item, index) => ({
                ...item,
                materialQualityId: item.materialQualityId || form.materialQualityId,
                materialName: item.materialName || form.materialName,
                colorOptionId: item.colorOptionId || form.colorOptionId,
                colorName: item.colorName || form.colorName,
                colorCode: item.colorCode || form.colorCode,
                thickness: item.thickness || form.thickness,
                sheetSize: item.sheetSize || form.sheetSize,
                processingOptions: [],
                sortOrder: index,
              })),
            files,
          },
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setSuccessLeadId(data.leadId || 'submitted');
      window.localStorage.removeItem(draftStorageKey(source));
      window.parent?.postMessage?.({ type: 'acbank-consultation-submitted', leadId: data.leadId }, '*');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '상담 접수 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setForm(initialForm(source));
    setItems([createConsultationItem()]);
    setFiles([]);
    setSubmissionToken(createSubmissionToken());
    setStep(0);
    setSuccessLeadId(null);
    setErrorMessage('');
    window.localStorage.removeItem(draftStorageKey(source));
  };

  if (successLeadId) {
    return (
      <>
        {!isEmbedded && <InternalWidgetHeader open={quickOpen} onOpenChange={setQuickOpen} onNavigate={navigate} />}
        <main className="min-h-screen bg-white px-4 py-6 text-neutral-950">
          <div className="mx-auto flex min-h-[640px] max-w-3xl flex-col items-center justify-center text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold">상담 문의가 접수되었습니다.</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-neutral-600">
              담당자가 입력 내용과 첨부 자료를 검토한 뒤 연락드리겠습니다. 추가 자료가 필요하면 회신 연락처로 안내드립니다.
            </p>
            <div className="mt-6 rounded-full border border-neutral-200 px-4 py-2 text-xs text-neutral-500">
              접수번호 {successLeadId.slice(0, 8).toUpperCase()}
            </div>
            <div className="mt-4 grid w-full max-w-lg gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-left text-sm sm:grid-cols-2">
              <Summary label="고객" value={[form.customerCompany, form.customerName].filter(Boolean).join(' · ') || '-'} />
              <Summary label="문의 유형" value={form.consultationType ? consultationTypeLabels[form.consultationType] : '-'} />
              <Summary label="품목 행" value={`${items.filter(itemHasContent).length}개`} />
              <Summary label="첨부파일" value={`${files.length}개`} />
              <Summary label="응답 안내" value="영업일 기준 순차 확인" />
            </div>
            <Button type="button" variant="outline" className="mt-8 h-11 rounded-full px-6" onClick={reset}>
              새 문의 작성
            </Button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {!isEmbedded && <InternalWidgetHeader open={quickOpen} onOpenChange={setQuickOpen} onNavigate={navigate} />}
      <main className="min-h-screen bg-white px-3 py-4 text-neutral-950 sm:px-5 sm:py-6">
        <div className="mx-auto max-w-5xl">
        <header className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">ACBANK Consultation</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">아크릴 제작 상담 문의</h1>
              <p className="mt-2 text-sm text-neutral-600">
                제작 정보와 자료를 단계별로 남겨주시면 내부 상담 리드함으로 바로 접수됩니다.
              </p>
            </div>
            <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-xs">
              예상 입력 3-5분
            </Badge>
          </div>
          <div className="mt-5">
            <Progress value={progress} className="h-1.5 bg-neutral-100" />
            <div className="mt-3 grid grid-cols-4 gap-1 text-xs">
              {steps.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStep(index)}
                  className={cn(
                    'rounded-full px-2 py-1.5 text-center transition-colors',
                    index === step ? 'bg-neutral-950 text-white' : index < step ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500',
                  )}
                >
                  {index + 1}. {item.title}
                </button>
              ))}
            </div>
          </div>
        </header>

        {restoreDraft && (
          <Alert className="mt-4 border-neutral-200 bg-neutral-50 text-neutral-900">
            <RotateCcw className="h-4 w-4" />
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                이전 작성 내용이 있습니다.
                <span className="ml-1 text-neutral-500">
                  {new Date(restoreDraft.savedAt).toLocaleString('ko-KR')} 저장
                </span>
              </span>
              <span className="flex gap-2">
                <Button type="button" size="sm" variant="outline" className="h-8 rounded-full" onClick={discardSavedDraft}>
                  새로 작성
                </Button>
                <Button type="button" size="sm" className="h-8 rounded-full bg-neutral-950 text-white hover:bg-neutral-800" onClick={restoreSavedDraft}>
                  복구하기
                </Button>
              </span>
            </AlertDescription>
          </Alert>
        )}

        {errorMessage && (
          <Alert className="mt-4 border-red-200 bg-red-50 text-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <Card className="mt-4 rounded-lg border-neutral-200 shadow-none">
          <CardHeader className="border-b border-neutral-100 p-4 sm:p-5">
            <CardTitle className="text-lg">{steps[step].title}</CardTitle>
            <p className="text-sm text-neutral-500">{steps[step].description}</p>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {step === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field icon={<ClipboardList className="h-4 w-4" />} label="프로젝트명" className="sm:col-span-2">
                  <Input value={form.projectName} onChange={(event) => updateField('projectName', event.target.value)} placeholder="예: 더현대 팝업 진열대 제작" />
                </Field>
                <Field icon={<Building2 className="h-4 w-4" />} label="회사명">
                  <Input value={form.customerCompany} onChange={(event) => updateField('customerCompany', event.target.value)} placeholder="회사명 또는 상호" />
                </Field>
                <Field icon={<UserRound className="h-4 w-4" />} label="담당자명" required>
                  <Input value={form.customerName} onChange={(event) => updateField('customerName', event.target.value)} placeholder="성함" />
                </Field>
                <Field label="직함/부서">
                  <Input value={form.customerPosition} onChange={(event) => updateField('customerPosition', event.target.value)} placeholder="예: 구매팀 / 대표" />
                </Field>
                <Field icon={<Phone className="h-4 w-4" />} label="연락처" required>
                  <Input value={form.customerPhone} onChange={(event) => updateField('customerPhone', event.target.value)} placeholder="010-0000-0000" inputMode="tel" />
                </Field>
                <Field icon={<Mail className="h-4 w-4" />} label="이메일">
                  <Input value={form.customerEmail} onChange={(event) => updateField('customerEmail', event.target.value)} placeholder="quote@example.com" inputMode="email" />
                </Field>
                <Field icon={<CalendarDays className="h-4 w-4" />} label="희망 납기일">
                  <Input type="date" value={form.desiredDeliveryDate} onChange={(event) => updateField('desiredDeliveryDate', event.target.value)} />
                </Field>
                <Field icon={<MapPin className="h-4 w-4" />} label="납기 주소" className="sm:col-span-2">
                  <Input value={form.deliveryAddress} onChange={(event) => updateField('deliveryAddress', event.target.value)} placeholder="배송 또는 설치 주소" />
                </Field>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <Label className="text-sm font-semibold">문의 유형</Label>
                  <div className="mt-2 grid gap-2 lg:grid-cols-3">
                    {consultationTypeOptions.map((option) => {
                      const selected = form.consultationType === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            updateConsultationType(option.value);
                          }}
                          className={cn(
                            'rounded-lg border p-3 text-left transition-colors',
                            selected ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white hover:border-neutral-400',
                          )}
                        >
                          <span className="text-sm font-semibold">{option.label}</span>
                          <span className={cn('mt-1 block text-xs', selected ? 'text-neutral-200' : 'text-neutral-500')}>
                            {option.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {form.consultationType && (
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
                    {consultationTypeOptions.find((option) => option.value === form.consultationType)?.helper}
                  </div>
                )}

                {form.consultationType === 'sheet_purchase' && (
                  <div className="space-y-4">
                    <MaterialOptionFields
                      materialQualityId={form.materialQualityId}
                      thickness={form.thickness}
                      colorOptionId={form.colorOptionId}
                      sheetSize={form.sheetSize}
                      showSheetSize
                      onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="원장 구매 수량" required>
                        <Input value={form.quantity} onChange={(event) => updateField('quantity', event.target.value)} placeholder="예: 3장 / 10장" />
                      </Field>
                      <Field label="구매 용도">
                        <Input value={form.productType} onChange={(event) => updateField('productType', event.target.value)} placeholder="예: 매장 진열대 샘플 제작용" />
                      </Field>
                    </div>
                  </div>
                )}

                {form.consultationType === 'fabrication' && (
                  <div className="space-y-5">
                    <div>
                      <Label className="text-sm font-semibold">제작 목적</Label>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {productPurposeOptions.map((option) => {
                          const selected = form.productPurpose === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                updateField('productPurpose', option.value);
                                if (!fieldFilled(form.productType)) updateField('productType', option.label);
                              }}
                              className={cn(
                                'rounded-lg border p-3 text-left transition-colors',
                                selected ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white hover:border-neutral-400',
                              )}
                            >
                              <span className="text-sm font-semibold">{option.label}</span>
                              <span className={cn('mt-1 block text-xs', selected ? 'text-neutral-200' : 'text-neutral-500')}>
                                {option.description}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <MaterialOptionFields
                      materialQualityId={form.materialQualityId}
                      thickness={form.thickness}
                      colorOptionId={form.colorOptionId}
                      sheetSize=""
                      showSheetSize={false}
                      onChange={(patch) => setForm((current) => ({ ...current, ...patch, sheetSize: '' }))}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field icon={<Package className="h-4 w-4" />} label="제작 품목">
                        <Input value={form.productType} onChange={(event) => updateField('productType', event.target.value)} placeholder="예: 진열대, 명판, 박스, POP" />
                      </Field>
                      <Field label="대표 규격">
                        <Input value={form.dimensions} onChange={(event) => updateField('dimensions', event.target.value)} placeholder="예: 300x200x5T, 상세 규격 여러 개" />
                      </Field>
                      <Field label="대표 수량">
                        <Input value={form.quantity} onChange={(event) => updateField('quantity', event.target.value)} placeholder="예: 50개 / 2세트" />
                      </Field>
                    </div>
                    <ItemRowsSection
                      items={items}
                      onAdd={addItem}
                      onChange={updateItem}
                      onRemove={removeItem}
                      onDuplicate={duplicateItem}
                      onMove={moveItem}
                      showSheetSize={false}
                    />
                  </div>
                )}

                {form.consultationType === 'design' && (
                  <div className="space-y-5">
                    <div>
                      <Label className="text-sm font-semibold">디자인 목적</Label>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {productPurposeOptions.map((option) => {
                          const selected = form.productPurpose === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                updateField('productPurpose', option.value);
                                if (!fieldFilled(form.productType)) updateField('productType', option.label);
                              }}
                              className={cn(
                                'rounded-lg border p-3 text-left transition-colors',
                                selected ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white hover:border-neutral-400',
                              )}
                            >
                              <span className="text-sm font-semibold">{option.label}</span>
                              <span className={cn('mt-1 block text-xs', selected ? 'text-neutral-200' : 'text-neutral-500')}>
                                {option.description}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field icon={<Package className="h-4 w-4" />} label="디자인 요청 대상">
                        <Input value={form.productType} onChange={(event) => updateField('productType', event.target.value)} placeholder="예: 팝업 진열대 구조 제안" />
                      </Field>
                      <Field label="사용 위치/상황">
                        <Input value={form.dimensions} onChange={(event) => updateField('dimensions', event.target.value)} placeholder="예: 백화점 팝업, 벽면 사인, 테이블 위 진열" />
                      </Field>
                    </div>
                    <MaterialOptionFields
                      materialQualityId={form.materialQualityId}
                      thickness={form.thickness}
                      colorOptionId={form.colorOptionId}
                      sheetSize=""
                      showSheetSize={false}
                      optional
                      onChange={(patch) => setForm((current) => ({ ...current, ...patch, sheetSize: '' }))}
                    />
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <Label className="text-sm font-semibold">도면·이미지 첨부</Label>
                  <div
                    className="mt-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 transition-colors hover:border-neutral-500"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleDrop}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="rounded-full border border-neutral-200 bg-white p-2">
                          <UploadCloud className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">파일을 끌어놓거나 선택하세요.</p>
                          <p className="text-xs text-neutral-500">이미지, PDF, 엑셀, ZIP 파일 · 최대 {MAX_FILES}개, 파일당 20MB</p>
                        </div>
                      </div>
                      <Button type="button" variant="outline" className="relative h-10 rounded-full" disabled={uploading || files.length >= MAX_FILES}>
                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                        파일 선택
                        <input
                          type="file"
                          multiple
                          className="absolute inset-0 cursor-pointer opacity-0"
                          onChange={handleFileUpload}
                          disabled={uploading || files.length >= MAX_FILES}
                        />
                      </Button>
                    </div>
                    {files.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {files.map((file) => (
                          <div key={file.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
                            <div className="flex min-w-0 items-center gap-3">
                              {file.previewUrl ? (
                                <img src={file.previewUrl} alt="" className="h-10 w-10 shrink-0 rounded-md border border-neutral-200 object-cover" />
                              ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50">
                                  {file.mimeType.includes('pdf') ? <FileUp className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                                </div>
                              )}
                              <div className="min-w-0">
                              <p className="truncate font-medium">{file.fileName}</p>
                              <p className="text-xs text-neutral-500">{formatFileSize(file.fileSize)}</p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={() => {
                                if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
                                setFiles((current) => current.filter((item) => item.id !== file.id));
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <Field label="문의 내용" required>
                  <Textarea
                    value={form.inquiryBody}
                    onChange={(event) => updateField('inquiryBody', event.target.value)}
                    className="min-h-36"
                    placeholder="제작 목적, 사용 위치, 원하는 마감, 참고 이미지 설명, 중요 납기 등을 적어주세요."
                  />
                </Field>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Summary label="고객" value={[form.customerCompany, form.customerName, form.customerPhone].filter(Boolean).join(' · ')} />
                  <Summary label="문의 유형" value={form.consultationType ? consultationTypeLabels[form.consultationType] : '미입력'} />
                  <Summary label="소재" value={[form.materialName, form.thickness, form.colorName].filter(Boolean).join(' · ') || '미입력'} />
                  <Summary label="품목" value={[form.productType, form.acrylicType].filter(Boolean).join(' · ') || '미입력'} />
                  <Summary label="규격/수량" value={[form.dimensions, form.quantity].filter(Boolean).join(' · ') || '미입력'} />
                  <Summary label="품목 행" value={`${items.filter(itemHasContent).length}개 입력`} />
                  <Summary label="납기" value={[form.desiredDeliveryDate, form.deliveryAddress].filter(Boolean).join(' · ') || '미입력'} />
                </div>
                {items.some(itemHasContent) && (
                  <div className="rounded-lg border border-neutral-200 bg-white p-4">
                    <p className="text-sm font-semibold">품목별 입력</p>
                    <div className="mt-2 space-y-1 text-sm text-neutral-700">
                      {items.filter(itemHasContent).map((item, index) => (
                        <p key={item.id}>{itemLabel(item, index)}</p>
                      ))}
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-sm font-semibold">문의 내용</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{form.inquiryBody || '미입력'}</p>
                  <p className="mt-3 text-xs text-neutral-500">첨부파일 {files.length}개</p>
                </div>
                <label className="flex items-start gap-3 rounded-lg border border-neutral-200 p-4">
                  <Checkbox checked={form.privacyConsent} onCheckedChange={(checked) => updateField('privacyConsent', checked === true)} />
                  <span className="text-sm leading-6">
                    <span className="font-semibold">개인정보 수집·이용에 동의합니다.</span>
                    <span className="block text-neutral-500">
                      수집 항목: 회사명, 담당자명, 연락처, 이메일, 문의 내용, 첨부 자료. 목적: 상담 응대와 견적 검토. 보유기간: 상담 종료 후 내부 보존 정책에 따름.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-neutral-200 p-4">
                  <Checkbox checked={form.marketingConsent} onCheckedChange={(checked) => updateField('marketingConsent', checked === true)} />
                  <span className="text-sm leading-6">
                    <span className="font-semibold">후속 안내 수신에 동의합니다. 선택</span>
                    <span className="block text-neutral-500">견적 보완, 제작 가능 여부, 샘플 안내처럼 상담에 필요한 후속 연락에 사용합니다.</span>
                  </span>
                </label>
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  className="hidden"
                  value={form.website}
                  onChange={(event) => updateField('website', event.target.value)}
                  aria-hidden="true"
                />
              </div>
            )}

            {currentValidation.length > 0 && (
              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                다음 항목을 입력해야 진행할 수 있습니다: {currentValidation.join(', ')}
              </div>
            )}
          </CardContent>
        </Card>

        <footer className="sticky bottom-0 mt-4 border-t border-neutral-200 bg-white/95 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <Button type="button" variant="outline" className="h-11 rounded-full px-5" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || submitting}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              이전
            </Button>
            {step < steps.length - 1 ? (
              <Button type="button" className="h-11 rounded-full bg-neutral-950 px-6 text-white hover:bg-neutral-800" onClick={() => setStep((current) => current + 1)} disabled={!canGoNext}>
                다음
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" className="h-11 rounded-full bg-neutral-950 px-6 text-white hover:bg-neutral-800" onClick={submit} disabled={!canGoNext || submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                상담 접수
              </Button>
            )}
          </div>
        </footer>
        </div>
      </main>
    </>
  );
};

const InternalWidgetHeader = ({
  open,
  onOpenChange,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (path: string) => void;
}) => {
  const goTo = (path: string) => {
    onOpenChange(false);
    onNavigate(path);
  };

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center justify-between">
          <HomeLogoButton size="default" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(true)}
            className="h-10 gap-2 rounded-full border-neutral-200 bg-white px-3 text-xs shadow-sm"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">빠른 이동</span>
            <kbd className="hidden rounded border bg-neutral-50 px-1.5 py-0.5 text-[10px] text-neutral-500 md:inline-block">
              Ctrl K
            </kbd>
          </Button>
        </div>
      </div>

      <CommandDialog open={open} onOpenChange={onOpenChange}>
        <div className="border-b px-4 py-3">
          <div className="text-sm font-semibold">빠른 이동</div>
          <div className="text-xs text-neutral-500">상담폼에서 자주 쓰는 내부 화면으로 이동합니다.</div>
        </div>
        <CommandInput placeholder="예: 리드함, 견적, 고객사..." />
        <CommandList className="max-h-[360px]">
          <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
          <CommandGroup heading="상담 업무">
            {internalQuickLinks.map((item) => (
              <CommandItem
                key={item.path}
                value={`${item.title} ${item.description}`}
                onSelect={() => goTo(item.path)}
                className="gap-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-100">
                  <ClipboardList className="h-4 w-4 text-neutral-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{item.title}</div>
                  <div className="truncate text-xs text-neutral-500">{item.description}</div>
                </div>
                <CommandShortcut>{item.shortcut}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};

const Field = ({
  label,
  required,
  icon,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) => (
  <div className={cn('space-y-2', className)}>
    <Label className="flex items-center gap-1.5 text-sm font-semibold">
      {icon}
      {label}
      {required && <span className="text-red-500">*</span>}
    </Label>
    {children}
  </div>
);

const SelectBox = ({
  value,
  onChange,
  children,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) => (
  <select
    value={value}
    onChange={(event) => onChange(event.target.value)}
    disabled={disabled}
    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
  >
    {children}
  </select>
);

type MaterialPatch = Partial<Pick<FormState,
  'materialQualityId' | 'materialName' | 'colorOptionId' | 'colorName' | 'colorCode' | 'thickness' | 'sheetSize'
>>;

const MaterialOptionFields = ({
  materialQualityId,
  thickness,
  colorOptionId,
  sheetSize,
  showSheetSize,
  optional,
  compact,
  className,
  onChange,
}: {
  materialQualityId: string;
  thickness: string;
  colorOptionId: string;
  sheetSize: string;
  showSheetSize: boolean;
  optional?: boolean;
  compact?: boolean;
  className?: string;
  onChange: (patch: MaterialPatch) => void;
}) => {
  const { qualities, colorOptions, thicknessOptions, panelSizeOptions, isLoadingColors, isLoadingPanelSizes } =
    useAcrylicOptionCatalog(materialQualityId, thickness);
  const selectedQuality = qualities.find((quality) => quality.id === materialQualityId);

  const handleMaterialChange = (value: string) => {
    const quality = qualities.find((item) => item.id === value);
    onChange({
      materialQualityId: value,
      materialName: value === CONSULTATION_UNKNOWN_OPTION ? '상담 후 결정' : quality?.name || '',
      colorOptionId: '',
      colorName: '',
      colorCode: '',
      thickness: '',
      sheetSize: '',
    });
  };

  const handleColorChange = (value: string) => {
    const color = colorOptions.find((item) => item.id === value);
    onChange({
      colorOptionId: value,
      colorName: value === CONSULTATION_UNKNOWN_OPTION ? '상담 후 결정' : color?.color_name || '',
      colorCode: value === CONSULTATION_UNKNOWN_OPTION ? '' : color?.color_code || '',
    });
  };

  const gridClass = compact ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-4' : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={cn('rounded-lg border border-neutral-200 bg-white p-4', compact && 'p-3', className)}>
      {!compact && (
        <div className="mb-3">
          <Label className="text-sm font-semibold">소재·컬러·두께</Label>
          <p className="mt-1 text-xs text-neutral-500">
            견적 계산기 기준 옵션을 사용합니다. 정확하지 않으면 상담 후 결정으로 남길 수 있습니다.
          </p>
        </div>
      )}
      <div className={gridClass}>
        <Field label={optional ? '소재 선택' : '소재 선택'}>
          <SelectBox value={materialQualityId} onChange={handleMaterialChange}>
            <option value="">소재 선택</option>
            <option value={CONSULTATION_UNKNOWN_OPTION}>상담 후 결정</option>
            {qualities.map((quality) => (
              <option key={quality.id} value={quality.id}>{quality.name}</option>
            ))}
          </SelectBox>
        </Field>
        <Field label="두께">
          <SelectBox
            value={thickness}
            onChange={(value) => onChange({ thickness: value, sheetSize: '' })}
            disabled={!materialQualityId}
          >
            <option value="">두께 선택</option>
            <option value={CONSULTATION_UNKNOWN_OPTION}>상담 후 결정</option>
            {thicknessOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </SelectBox>
        </Field>
        <Field label="컬러">
          <SelectBox
            value={colorOptionId}
            onChange={handleColorChange}
            disabled={!materialQualityId || isLoadingColors}
          >
            <option value="">{isLoadingColors ? '컬러 불러오는 중' : '컬러 선택'}</option>
            <option value={CONSULTATION_UNKNOWN_OPTION}>상담 후 결정</option>
            {colorOptions.map((color) => (
              <option key={color.id} value={color.id}>
                {[color.color_name, color.pantone || color.color_code].filter(Boolean).join(' · ')}
              </option>
            ))}
          </SelectBox>
        </Field>
        {showSheetSize && (
          <Field label="원장 사이즈">
            <SelectBox
              value={sheetSize}
              onChange={(value) => onChange({ sheetSize: value })}
              disabled={!selectedQuality || !thickness || isLoadingPanelSizes}
            >
              <option value="">{isLoadingPanelSizes ? '사이즈 불러오는 중' : '원장 사이즈 선택'}</option>
              <option value={CONSULTATION_UNKNOWN_OPTION}>상담 후 결정</option>
              {panelSizeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </SelectBox>
          </Field>
        )}
      </div>
    </div>
  );
};

const ItemRowsSection = ({
  items,
  onAdd,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
  showSheetSize,
}: {
  items: ConsultationItem[];
  onAdd: () => void;
  onChange: (id: string, patch: Partial<ConsultationItem>) => void;
  onRemove: (id: string) => void;
  onDuplicate: (item: ConsultationItem) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  showSheetSize: boolean;
}) => (
  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Label className="text-sm font-semibold">품목별 제작 정보</Label>
        <p className="mt-1 text-xs text-neutral-500">
          규격과 수량이 여러 개인 경우 행을 추가해 입력하면 내부 견적 초안으로 더 정확히 전환됩니다.
        </p>
      </div>
      <Button type="button" variant="outline" className="h-9 rounded-full bg-white" onClick={onAdd}>
        <Plus className="mr-2 h-4 w-4" />
        품목 추가
      </Button>
    </div>
    <div className="mt-4 space-y-3">
      {items.map((item, index) => (
        <ConsultationItemEditor
          key={item.id}
          item={item}
          index={index}
          total={items.length}
          showSheetSize={showSheetSize}
          onChange={(patch) => onChange(item.id, patch)}
          onRemove={() => onRemove(item.id)}
          onDuplicate={() => onDuplicate(item)}
          onMove={(direction) => onMove(item.id, direction)}
        />
      ))}
    </div>
  </div>
);

const ConsultationItemEditor = ({
  item,
  index,
  total,
  showSheetSize,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
}: {
  item: ConsultationItem;
  index: number;
  total: number;
  showSheetSize: boolean;
  onChange: (patch: Partial<ConsultationItem>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (direction: -1 | 1) => void;
}) => (
  <div className="rounded-lg border border-neutral-200 bg-white p-3">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
      <div className="flex items-center justify-between gap-3 lg:w-28 lg:flex-col lg:items-start">
        <Badge variant="outline" className="rounded-full">
          품목 {index + 1}
        </Badge>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onMove(-1)} disabled={index === 0}>
            <ArrowLeft className="h-3.5 w-3.5 rotate-90" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onMove(1)} disabled={index === total - 1}>
            <ArrowRight className="h-3.5 w-3.5 rotate-90" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onDuplicate}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-red-600" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="품목명">
          <Input value={item.itemName} onChange={(event) => onChange({ itemName: event.target.value })} placeholder="예: 진열대 상판" />
        </Field>
        <MaterialOptionFields
          materialQualityId={item.materialQualityId}
          thickness={item.thickness}
          colorOptionId={item.colorOptionId}
          sheetSize={item.sheetSize}
          showSheetSize={showSheetSize}
          compact
          className="sm:col-span-2 xl:col-span-4"
          onChange={(patch) => onChange(patch as Partial<ConsultationItem>)}
        />
        <Field label="가로">
          <Input value={item.width} onChange={(event) => onChange({ width: event.target.value })} placeholder="예: 300mm" />
        </Field>
        <Field label="세로">
          <Input value={item.height} onChange={(event) => onChange({ height: event.target.value })} placeholder="예: 200mm" />
        </Field>
        <Field label="수량">
          <Input value={item.quantity} onChange={(event) => onChange({ quantity: event.target.value })} placeholder="예: 20" />
        </Field>
        <Field label="단위">
          <select
            value={item.unit}
            onChange={(event) => onChange({ unit: event.target.value })}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
          >
            {itemUnits.map((unit) => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        </Field>
        <Field label="비고">
          <Input value={item.memo} onChange={(event) => onChange({ memo: event.target.value })} placeholder="예: 모서리 라운드" />
        </Field>
      </div>
    </div>
  </div>
);

const Summary = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
    <p className="text-xs text-neutral-500">{label}</p>
    <p className="mt-1 text-sm font-semibold text-neutral-950">{value}</p>
  </div>
);

export default ClientConsultationWidgetPage;
