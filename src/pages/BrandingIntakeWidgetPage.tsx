import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FileUp,
  Loader2,
  Mail,
  Palette,
  Phone,
  Sparkles,
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
import { Textarea } from '@/components/ui/textarea';
import {
  BRANDING_ADDON_GROUPS,
  BRANDING_LEAD_TIMES,
  BRANDING_OPTIMIZATION_TIERS,
  BRANDING_PACKAGES,
  type BrandingAddonId,
  type BrandingLeadTimeId,
  type BrandingOptimizationId,
  type BrandingPackageId,
  calculateBrandingPricing,
} from '@/lib/brandingPricing';
import { cn } from '@/lib/utils';

type UploadedFile = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  uploadedAt: string;
};

type FormState = {
  customerCompany: string;
  customerName: string;
  customerPosition: string;
  customerPhone: string;
  customerEmail: string;
  projectName: string;
  industry: string;
  homepageUrl: string;
  referenceNote: string;
  inquiryBody: string;
  packageId: BrandingPackageId;
  leadTimeId: BrandingLeadTimeId;
  optimizationTierId: BrandingOptimizationId;
  selectedAddons: BrandingAddonId[];
  privacyConsent: boolean;
  marketingConsent: boolean;
  website: string;
};

const MAX_FILES = 8;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const initialForm: FormState = {
  customerCompany: '',
  customerName: '',
  customerPosition: '',
  customerPhone: '',
  customerEmail: '',
  projectName: '',
  industry: '',
  homepageUrl: '',
  referenceNote: '',
  inquiryBody: '',
  packageId: 'standard',
  leadTimeId: 'normal',
  optimizationTierId: 'basic',
  selectedAddons: ['story'],
  privacyConsent: false,
  marketingConsent: false,
  website: '',
};

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(size / 1024))}KB`;
}

const BrandingIntakeWidgetPage = () => {
  const [form, setForm] = useState<FormState>(initialForm);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ estimate: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submissionToken] = useState(() => crypto.randomUUID());

  const pricing = useMemo(
    () => calculateBrandingPricing({
      packageId: form.packageId,
      leadTimeId: form.leadTimeId,
      optimizationTierId: form.optimizationTierId,
      selectedAddons: form.selectedAddons,
    }),
    [form.packageId, form.leadTimeId, form.optimizationTierId, form.selectedAddons],
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleAddon = (addonId: BrandingAddonId) => {
    setForm((prev) => ({
      ...prev,
      selectedAddons: prev.selectedAddons.includes(addonId)
        ? prev.selectedAddons.filter((id) => id !== addonId)
        : [...prev.selectedAddons, addonId],
    }));
  };

  const uploadFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (selected.length === 0) return;

    setError(null);
    const remaining = Math.max(0, MAX_FILES - files.length);
    const nextFiles = selected.slice(0, remaining);
    if (nextFiles.length < selected.length) {
      setError(`첨부파일은 최대 ${MAX_FILES}개까지 가능합니다.`);
    }

    setUploading(true);
    try {
      const uploaded: UploadedFile[] = [];
      for (const file of nextFiles) {
        if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name} 파일은 20MB 이하만 가능합니다.`);

        const { data, error: functionError } = await supabase.functions.invoke('branding-intake', {
          body: {
            action: 'create-upload-url',
            payload: {
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              fileSize: file.size,
            },
          },
        });
        if (functionError) throw functionError;
        if (data?.error) throw new Error(data.error);

        const { error: uploadError } = await supabase.storage
          .from(data.bucket)
          .uploadToSignedUrl(data.path, data.token, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          });
        if (uploadError) throw uploadError;

        uploaded.push({
          id: crypto.randomUUID(),
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileSize: file.size,
          storagePath: data.path,
          uploadedAt: new Date().toISOString(),
        });
      }
      setFiles((prev) => [...prev, ...uploaded]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '첨부파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const validate = () => {
    const missing: string[] = [];
    if (!form.customerName.trim()) missing.push('담당자명');
    if (!form.customerPhone.trim()) missing.push('연락처');
    if (!form.projectName.trim()) missing.push('프로젝트명');
    if (!form.inquiryBody.trim()) missing.push('문의 내용');
    if (!form.privacyConsent) missing.push('개인정보 동의');
    return missing;
  };

  const submit = async () => {
    const missing = validate();
    if (missing.length > 0) {
      setError(`필수 항목을 확인해주세요: ${missing.join(', ')}`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { data, error: functionError } = await supabase.functions.invoke('branding-intake', {
        body: {
          action: 'submit',
          payload: {
            source: 'branding-intake',
            submissionToken,
            ...form,
            files,
          },
        },
      });
      if (functionError) throw functionError;
      if (data?.error) throw new Error(data.error);

      setSubmitResult({
        estimate: data.customerEstimateText || pricing.customerEstimateText,
        message: data.customerMessage || pricing.customerMessage,
      });
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '브랜딩 접수 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#f6f7f9] px-4 py-10 text-slate-950">
        <section className="mx-auto max-w-3xl rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">브랜딩 접수가 완료되었습니다.</h1>
          <p className="mt-3 text-base text-slate-600">
            자료 확인 후 담당자가 예상 범위와 검토 항목을 기준으로 연락드리겠습니다.
          </p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-500">예상 범위</div>
            <div className="mt-1 text-3xl font-black">{submitResult?.estimate}</div>
            <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700">{submitResult?.message}</pre>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 py-8 text-slate-950">
      <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <header className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              <Sparkles className="h-3.5 w-3.5" />
              ACBANK Branding Intake
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">브랜딩 접수·예상금액</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              브랜드 방향, 적용 범위, 납기와 옵션을 기준으로 상담용 예상 범위를 확인하고 접수합니다.
              제작비·인쇄비·시공비·제품 제작비는 실제 사양 확인 후 별도 안내됩니다.
            </p>
          </header>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card className="rounded-[24px] border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="h-5 w-5" />
                고객 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>회사명</Label>
                <Input value={form.customerCompany} onChange={(event) => update('customerCompany', event.target.value)} placeholder="회사명 또는 브랜드명" />
              </div>
              <div className="space-y-2">
                <Label>담당자명 *</Label>
                <Input value={form.customerName} onChange={(event) => update('customerName', event.target.value)} placeholder="성함" />
              </div>
              <div className="space-y-2">
                <Label>직책</Label>
                <Input value={form.customerPosition} onChange={(event) => update('customerPosition', event.target.value)} placeholder="직책/부서" />
              </div>
              <div className="space-y-2">
                <Label>연락처 *</Label>
                <Input value={form.customerPhone} onChange={(event) => update('customerPhone', event.target.value)} placeholder="010-0000-0000" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>이메일</Label>
                <Input value={form.customerEmail} onChange={(event) => update('customerEmail', event.target.value)} placeholder="name@example.com" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                프로젝트 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>프로젝트명 *</Label>
                <Input value={form.projectName} onChange={(event) => update('projectName', event.target.value)} placeholder="예: 신규 매장 브랜딩" />
              </div>
              <div className="space-y-2">
                <Label>업종/분야</Label>
                <Input value={form.industry} onChange={(event) => update('industry', event.target.value)} placeholder="F&B, 리테일, 전시..." />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>홈페이지/레퍼런스 URL</Label>
                <Input value={form.homepageUrl} onChange={(event) => update('homepageUrl', event.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>레퍼런스/자료 메모</Label>
                <Textarea value={form.referenceNote} onChange={(event) => update('referenceNote', event.target.value)} placeholder="참고 브랜드, 원하는 분위기, 피하고 싶은 방향 등" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>브랜딩 패키지</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {BRANDING_PACKAGES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => update('packageId', item.id)}
                  className={cn(
                    'rounded-2xl border p-4 text-left transition hover:border-slate-950',
                    form.packageId === item.id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white',
                  )}
                >
                  <div className="text-lg font-black">{item.name}</div>
                  <div className={cn('mt-1 text-sm', form.packageId === item.id ? 'text-slate-200' : 'text-slate-500')}>{item.description}</div>
                  <div className="mt-4 text-xl font-black">{item.displayPrice}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="rounded-[24px] border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>납기</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {BRANDING_LEAD_TIMES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => update('leadTimeId', item.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm',
                      form.leadTimeId === item.id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white',
                    )}
                  >
                    <span className="font-bold">{item.name}</span>
                    <span>{item.description}</span>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>SEO/AEO/GEO 최적화</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {BRANDING_OPTIMIZATION_TIERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => update('optimizationTierId', item.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm',
                      form.optimizationTierId === item.id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white',
                    )}
                  >
                    <span className="font-bold">{item.name}</span>
                    <span>{item.displayPrice}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-[24px] border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>추가 옵션</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {BRANDING_ADDON_GROUPS.map((group) => (
                <div key={group.id}>
                  <div className="mb-2 text-sm font-black">{group.name}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.addons.map((addon) => (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => toggleAddon(addon.id)}
                        className={cn(
                          'rounded-xl border px-4 py-3 text-left text-sm transition',
                          form.selectedAddons.includes(addon.id) ? 'border-slate-950 bg-slate-50' : 'border-slate-200 bg-white',
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-bold">{addon.name}</span>
                          <Badge variant="outline">{addon.displayPrice}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{addon.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileUp className="h-5 w-5" />
                자료·문의 내용
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>문의 내용 *</Label>
                <Textarea
                  value={form.inquiryBody}
                  onChange={(event) => update('inquiryBody', event.target.value)}
                  className="min-h-32"
                  placeholder="현재 상황, 필요한 결과물, 적용 공간/매체, 일정, 예산 범위 등을 적어주세요."
                />
              </div>

              <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center hover:bg-slate-100">
                <input type="file" className="hidden" multiple onChange={uploadFiles} disabled={uploading || files.length >= MAX_FILES} />
                <span className="flex flex-col items-center gap-2 text-sm text-slate-600">
                  {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <UploadCloud className="h-6 w-6" />}
                  PDF, 이미지, ZIP, 문서 파일을 첨부할 수 있습니다. 최대 {MAX_FILES}개, 파일당 20MB
                </span>
              </label>

              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div key={file.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">{file.fileName}</span>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{formatFileSize(file.fileSize)}</span>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeFile(file.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="hidden">
                <Label>Website</Label>
                <Input value={form.website} onChange={(event) => update('website', event.target.value)} tabIndex={-1} autoComplete="off" />
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="rounded-[24px] border-slate-200 bg-slate-950 text-white shadow-sm">
            <CardHeader>
              <CardTitle>예상 범위</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black">{pricing.customerEstimateText}</div>
              <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-300">{pricing.customerMessage}</p>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-5 text-slate-300">
                최종 견적은 자료 확인 후 확정됩니다. 고객용 화면에는 내부 산정 breakdown이 표시되지 않습니다.
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-slate-200 shadow-sm">
            <CardContent className="space-y-3 p-5">
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={form.privacyConsent} onCheckedChange={(checked) => update('privacyConsent', checked === true)} />
                <span>개인정보 수집·이용에 동의합니다. *</span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={form.marketingConsent} onCheckedChange={(checked) => update('marketingConsent', checked === true)} />
                <span>브랜딩 관련 안내를 받아보겠습니다.</span>
              </label>

              <Button type="button" className="h-12 w-full rounded-xl bg-slate-950 text-white hover:bg-slate-800" onClick={submit} disabled={submitting || uploading}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                브랜딩 접수하기
              </Button>

              <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-slate-500">
                <div className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> 회신 연락처 필요</div>
                <div className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> 이메일 선택</div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
};

export default BrandingIntakeWidgetPage;
