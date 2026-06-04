import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  FileUp,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  Search,
  Trash2,
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
import { cn } from '@/lib/utils';

type FormState = {
  source: string;
  customerCompany: string;
  customerName: string;
  customerPosition: string;
  customerPhone: string;
  customerEmail: string;
  projectName: string;
  productType: string;
  acrylicType: string;
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

type UploadedFile = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  uploadedAt: string;
};

const steps = [
  { id: 'contact', title: '연락처', description: '회신 받을 정보를 입력합니다.' },
  { id: 'production', title: '제작 정보', description: '소재와 규격을 정리합니다.' },
  { id: 'delivery', title: '자료·납기', description: '도면과 납기 정보를 첨부합니다.' },
  { id: 'review', title: '확인·동의', description: '입력 내용을 확인하고 접수합니다.' },
];

const processingOptions = ['재단', '타공', '절곡', 'UV인쇄', '실크인쇄', '레이저각인', '접착', '조립', '현장설치'];
const MAX_FILES = 6;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const internalQuickLinks = [
  { title: '홈', description: '대시보드로 이동', path: '/', shortcut: 'Home' },
  { title: '상담 리드함', description: '아임웹 폼과 채널톡 문의 확인', path: '/channel-talk-leads?source=imweb', shortcut: 'Leads' },
  { title: '견적 초안함', description: '상담 내용을 견적 초안으로 전환', path: '/quote-drafts', shortcut: 'Drafts' },
  { title: '견적 계산기', description: '판재 견적 계산', path: '/calculator?type=quote', shortcut: 'Quote' },
  { title: '고객사 관리', description: '거래처와 담당자 정보', path: '/recipients', shortcut: 'Client' },
];

const initialForm = (source: string): FormState => ({
  source,
  customerCompany: '',
  customerName: '',
  customerPosition: '',
  customerPhone: '',
  customerEmail: '',
  projectName: '',
  productType: '',
  acrylicType: '',
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

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}MB`;
  if (size >= 1024) return `${Math.round(size / 1024)}KB`;
  return `${size}B`;
}

function fieldFilled(value: string) {
  return value.trim().length > 0;
}

const ClientConsultationWidgetPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const source = searchParams.get('source') || 'imweb-acbankform';
  const isEmbedded = searchParams.get('embed') === '1';
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(() => initialForm(source));
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successLeadId, setSuccessLeadId] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);

  const progress = ((step + 1) / steps.length) * 100;

  const currentValidation = useMemo(() => {
    const missing: string[] = [];
    if (step === 0) {
      if (!fieldFilled(form.customerName)) missing.push('담당자명');
      if (!fieldFilled(form.customerPhone)) missing.push('연락처');
    }
    if (step === 2 && !fieldFilled(form.inquiryBody)) missing.push('문의 내용');
    if (step === 3 && !form.privacyConsent) missing.push('개인정보 수집·이용 동의');
    return missing;
  }, [form, step]);

  const canGoNext = currentValidation.length === 0;

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleProcessing = (value: string) => {
    setForm((current) => ({
      ...current,
      processing: current.processing.includes(value)
        ? current.processing.filter((item) => item !== value)
        : [...current.processing, value],
    }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
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
        });
      }
      setFiles((current) => [...current, ...uploaded]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
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
            files,
          },
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setSuccessLeadId(data.leadId || 'submitted');
      window.parent?.postMessage?.({ type: 'acbank-consultation-submitted', leadId: data.leadId }, '*');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '상담 접수 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setForm(initialForm(source));
    setFiles([]);
    setStep(0);
    setSuccessLeadId(null);
    setErrorMessage('');
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
                <Field label="프로젝트명">
                  <Input value={form.projectName} onChange={(event) => updateField('projectName', event.target.value)} placeholder="예: 매장 사인물 제작" />
                </Field>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field icon={<Package className="h-4 w-4" />} label="제작 품목">
                    <Input value={form.productType} onChange={(event) => updateField('productType', event.target.value)} placeholder="예: 진열대, 명판, 박스, POP" />
                  </Field>
                  <Field label="아크릴 종류">
                    <Input value={form.acrylicType} onChange={(event) => updateField('acrylicType', event.target.value)} placeholder="예: 투명, 백색, 흑색, 미러, 확산판" />
                  </Field>
                  <Field label="컬러/팬톤">
                    <Input value={form.colorName} onChange={(event) => updateField('colorName', event.target.value)} placeholder="예: 팬톤 485C 또는 레퍼런스 컬러" />
                  </Field>
                  <Field label="컬러 코드">
                    <Input value={form.colorCode} onChange={(event) => updateField('colorCode', event.target.value)} placeholder="예: #FFFFFF / Pantone" />
                  </Field>
                  <Field label="두께">
                    <Input value={form.thickness} onChange={(event) => updateField('thickness', event.target.value)} placeholder="예: 3T, 5T, 10T" />
                  </Field>
                  <Field label="원장 사이즈">
                    <Input value={form.sheetSize} onChange={(event) => updateField('sheetSize', event.target.value)} placeholder="예: 1220x2440, 1000x2000" />
                  </Field>
                  <Field label="수량">
                    <Input value={form.quantity} onChange={(event) => updateField('quantity', event.target.value)} placeholder="예: 50개 / 2세트" />
                  </Field>
                  <Field label="규격">
                    <Input value={form.dimensions} onChange={(event) => updateField('dimensions', event.target.value)} placeholder="예: 300x200x5T, 상세 규격 여러 개" />
                  </Field>
                </div>
                <div>
                  <Label className="text-sm font-semibold">가공 옵션</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {processingOptions.map((option) => {
                      const checked = form.processing.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => toggleProcessing(option)}
                          className={cn(
                            'rounded-full border px-3 py-2 text-sm transition-colors',
                            checked ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400',
                          )}
                        >
                          {checked && <Check className="mr-1 inline h-3.5 w-3.5" />}
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <Label className="text-sm font-semibold">도면·이미지 첨부</Label>
                  <div className="mt-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="rounded-full border border-neutral-200 bg-white p-2">
                          <FileUp className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">이미지, PDF, 엑셀, ZIP 파일</p>
                          <p className="text-xs text-neutral-500">최대 {MAX_FILES}개, 파일당 20MB까지 업로드할 수 있습니다.</p>
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
                            <div className="min-w-0">
                              <p className="truncate font-medium">{file.fileName}</p>
                              <p className="text-xs text-neutral-500">{formatFileSize(file.fileSize)}</p>
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))}>
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field icon={<CalendarDays className="h-4 w-4" />} label="희망 납기일">
                    <Input type="date" value={form.desiredDeliveryDate} onChange={(event) => updateField('desiredDeliveryDate', event.target.value)} />
                  </Field>
                  <Field icon={<MapPin className="h-4 w-4" />} label="납기 주소">
                    <Input value={form.deliveryAddress} onChange={(event) => updateField('deliveryAddress', event.target.value)} placeholder="배송 또는 설치 주소" />
                  </Field>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Summary label="고객" value={[form.customerCompany, form.customerName, form.customerPhone].filter(Boolean).join(' · ')} />
                  <Summary label="품목" value={[form.productType, form.acrylicType, form.thickness].filter(Boolean).join(' · ') || '미입력'} />
                  <Summary label="규격/수량" value={[form.dimensions, form.quantity].filter(Boolean).join(' · ') || '미입력'} />
                  <Summary label="납기" value={[form.desiredDeliveryDate, form.deliveryAddress].filter(Boolean).join(' · ') || '미입력'} />
                </div>
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

const Field = ({ label, required, icon, children }: { label: string; required?: boolean; icon?: React.ReactNode; children: React.ReactNode }) => (
  <div className="space-y-2">
    <Label className="flex items-center gap-1.5 text-sm font-semibold">
      {icon}
      {label}
      {required && <span className="text-red-500">*</span>}
    </Label>
    {children}
  </div>
);

const Summary = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
    <p className="text-xs text-neutral-500">{label}</p>
    <p className="mt-1 text-sm font-semibold text-neutral-950">{value}</p>
  </div>
);

export default ClientConsultationWidgetPage;
