import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import {
  analyzeQuoteWizardJob,
  classifyQuoteWizardFile,
  convertQuoteWizardToDraft,
  createQuoteWizardJob,
  uploadQuoteWizardFiles,
} from '@/services/quoteWizard';
import type { QuoteWizardFileKind, QuoteWizardPayload, QuoteWizardReviewStatus } from '@/types/quoteWizard';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, FileSearch, FileUp, Loader2, RefreshCw, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';

type WizardStep = 'upload' | 'uploading' | 'analyzing' | 'completed' | 'failed';

const STEP_META: Array<{ key: WizardStep; label: string }> = [
  { key: 'upload', label: '파일 업로드' },
  { key: 'uploading', label: '임시 저장' },
  { key: 'analyzing', label: '하이브리드 분석' },
  { key: 'completed', label: '상담원 검수' },
];

const REVIEW_META: Record<QuoteWizardReviewStatus, { label: string; className: string }> = {
  calculable: { label: '산출 가능', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  needs_review: { label: '검수 필요', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  blocked: { label: '보류', className: 'border-red-200 bg-red-50 text-red-700' },
  converted: { label: '전환 완료', className: 'border-blue-200 bg-blue-50 text-blue-700' },
};

const KIND_LABEL: Record<QuoteWizardFileKind, string> = {
  pdf: 'PDF',
  image: '이미지',
  dxf: 'DXF',
  dwg: 'DWG',
  source: '원본',
  unknown: '기타',
};

const formatMoney = (value?: number | null) => `₩${Math.round(Number(value) || 0).toLocaleString('ko-KR')}`;

const formatArea = (value?: number | null) => {
  if (!value) return '-';
  return `${(value / 1_000_000).toFixed(2)}m²`;
};

const formatSize = (value: number) => {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024)).toLocaleString('ko-KR')} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
};

const stepIndex = (step: WizardStep) => {
  if (step === 'failed') return 2;
  return Math.max(0, STEP_META.findIndex(item => item.key === step));
};

const QuoteWizardPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [customerNote, setCustomerNote] = useState('');
  const [payload, setPayload] = useState<QuoteWizardPayload | null>(null);
  const [step, setStep] = useState<WizardStep>('upload');
  const [dragging, setDragging] = useState(false);
  const [converting, setConverting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const result = payload?.result;
  const analysis = result?.analysis;
  const yieldSnapshot = result?.yield;
  const formula = result?.formula;
  const isBusy = step === 'uploading' || step === 'analyzing';
  const currentStepIndex = stepIndex(step);
  const progressValue = step === 'failed' ? 68 : Math.round((currentStepIndex / (STEP_META.length - 1)) * 100);

  const selectedFileSummary = useMemo(() => (
    selectedFiles.map((file) => ({
      name: file.name,
      size: formatSize(file.size),
      kind: classifyQuoteWizardFile(file),
    }))
  ), [selectedFiles]);

  const reviewStatus = (payload?.job.review_status || formula?.status || 'needs_review') as QuoteWizardReviewStatus;
  const reviewMeta = REVIEW_META[reviewStatus] || REVIEW_META.needs_review;

  const setFiles = (files: File[]) => {
    setSelectedFiles(files.slice(0, 8));
    setPayload(null);
    setErrorMessage(null);
    setStep('upload');
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(event.target.files || []));
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    setFiles(Array.from(event.dataTransfer.files || []));
  };

  const handleStart = async () => {
    if (!selectedFiles.length || isBusy) return;
    setErrorMessage(null);
    setPayload(null);

    try {
      setStep('uploading');
      const created = await createQuoteWizardJob(customerNote);
      setPayload(created);
      await uploadQuoteWizardFiles(created.job, selectedFiles);

      setStep('analyzing');
      const analyzed = await analyzeQuoteWizardJob(created.job.id);
      setPayload(analyzed);
      setStep('completed');
      toast.success('견적 마법사 분석이 완료되었습니다.');
    } catch (error) {
      console.error('Quote wizard failed:', error);
      setStep('failed');
      setErrorMessage(error instanceof Error ? error.message : '견적 마법사 처리 중 오류가 발생했습니다.');
      toast.error('견적 마법사 분석에 실패했습니다.');
    }
  };

  const handleConvertDraft = async () => {
    if (!payload?.job.id || !result || converting) return;
    setConverting(true);
    try {
      const converted = await convertQuoteWizardToDraft(payload.job.id);
      setPayload((current) => current ? {
        ...current,
        job: {
          ...current.job,
          review_status: 'converted',
          converted_draft_id: converted.draftId,
        },
      } : current);
      toast.success('견적 초안으로 전환했습니다.');
      navigate('/quote-drafts');
    } catch (error) {
      console.error('Quote wizard convert failed:', error);
      toast.error(error instanceof Error ? error.message : '견적 초안 전환에 실패했습니다.');
    } finally {
      setConverting(false);
    }
  };

  const resetWizard = () => {
    setSelectedFiles([]);
    setPayload(null);
    setCustomerNote('');
    setErrorMessage(null);
    setStep('upload');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <PageShell maxWidth="7xl">
      <PageHeader
        eyebrow="Quote Wizard"
        title="견적 마법사"
        description="업로드한 도면과 사진을 별도 임시 job으로 분석하고, 상담원 검수 후에만 기존 견적 초안으로 전환합니다."
        icon={<WandSparkles className="h-5 w-5" />}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={resetWizard} disabled={isBusy}>
              <RefreshCw className="h-4 w-4" />
              초기화
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/calculator?type=quote')}>
              기존 견적 계산기
            </Button>
          </>
        )}
        meta={(
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
            24시간 임시 저장
          </Badge>
        )}
      />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg">도면/사진 업로드</CardTitle>
              <Badge variant="outline">{selectedFiles.length} FILES</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              PDF, 이미지, DXF, DWG 원본을 첨부할 수 있습니다. 원본 CAD만 있는 경우에는 미리보기 요청 상태로 표시됩니다.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={cn(
                'flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-colors',
                dragging || selectedFiles.length ? 'border-foreground bg-muted/50' : 'border-border bg-muted/20'
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
            >
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                multiple
                accept=".pdf,image/*,.dxf,.dwg,.ai,.eps,.skp,.step,.stp,.iges,.igs,.obj"
                onChange={handleFileChange}
              />
              <FileUp className="mb-3 h-10 w-10 text-muted-foreground" />
              <div className="text-base font-semibold">
                {selectedFiles.length ? '파일이 준비되었습니다' : '파일을 드롭하거나 선택하세요'}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                파일 업로드가 첫 단계이며, 파일 없이는 견적 마법사를 시작할 수 없습니다.
              </div>
            </div>

            {selectedFileSummary.length > 0 && (
              <div className="grid gap-2">
                {selectedFileSummary.map((file) => (
                  <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{file.name}</div>
                      <div className="text-xs text-muted-foreground">{file.size}</div>
                    </div>
                    <Badge variant="outline">{KIND_LABEL[file.kind]}</Badge>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold" htmlFor="quote-wizard-note">상담 메모</label>
              <Textarea
                id="quote-wizard-note"
                value={customerNote}
                onChange={(event) => setCustomerNote(event.target.value)}
                placeholder="예: 투명 아크릴 5T, 매장 진열 커버, 로고 인쇄 포함. 도면 치수와 수량을 우선 확인해주세요."
                rows={4}
              />
            </div>

            <Button className="w-full" size="lg" onClick={handleStart} disabled={!selectedFiles.length || isBusy}>
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
              견적 마법사 시작
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">진행 상태</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progressValue} />
            <div className="grid gap-2">
              {STEP_META.map((item, index) => {
                const done = index < currentStepIndex || step === 'completed';
                const active = index === currentStepIndex && step !== 'completed';
                return (
                  <div key={item.key} className={cn('flex items-center gap-2 rounded-lg border p-3 text-sm', active && 'border-foreground')}>
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : active && isBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="h-4 w-4 rounded-full border" />
                    )}
                    <span className={cn(done && 'font-semibold')}>{item.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
              견적 마법사는 기존 견적 계산기와 별도로 산출되는 임시 분석 결과입니다. 전환 버튼을 누르기 전까지 기존 초안에 저장되지 않습니다.
            </div>
            {errorMessage && (
              <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {result && (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle className="text-lg">제작물 판별</CardTitle>
                <Badge className={reviewMeta.className} variant="outline">{reviewMeta.label}</Badge>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <ResultField label="제작물" value={analysis?.item_name} />
                <ResultField label="치수" value={analysis?.dimensions} />
                <ResultField label="수량" value={analysis?.quantity ? `${analysis.quantity}개` : null} />
                <ResultField label="소재/두께" value={[analysis?.material, analysis?.thickness, analysis?.color, analysis?.finish].filter(Boolean).join(' / ')} />
                <ResultField label="가공" value={analysis?.processing?.join(', ')} className="sm:col-span-2" />
                <ResultField label="추천 회신" value={analysis?.recommended_reply} className="sm:col-span-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">파트/조각 분해</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>파트</TableHead>
                      <TableHead>사이즈</TableHead>
                      <TableHead>수량</TableHead>
                      <TableHead>근거/주의</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(analysis?.parts || []).map((part) => (
                      <TableRow key={part.id}>
                        <TableCell className="font-medium">{part.name}</TableCell>
                        <TableCell>{part.width_mm && part.height_mm ? `${part.width_mm} x ${part.height_mm}mm` : '-'}</TableCell>
                        <TableCell>{part.quantity ?? '-'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {part.basis}
                          {part.risk_notes.length > 0 && ` / ${part.risk_notes.join(', ')}`}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!analysis?.parts?.length && (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          파트 추출에 필요한 치수/미리보기 정보가 부족합니다.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">보완/위험 체크</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <Checklist title="부족한 내용" items={analysis?.missing_fields || []} />
                <Checklist title="위험/검수 항목" items={analysis?.production_risks || []} tone="warning" />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">원장/수율 참고값</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ResultField label="상태" value={yieldSnapshot?.status} />
                <ResultField label="원장 후보" value={yieldSnapshot?.stock_sheet?.name || undefined} />
                <ResultField
                  label="원장 치수"
                  value={yieldSnapshot?.stock_sheet?.width_mm && yieldSnapshot?.stock_sheet?.height_mm
                    ? `${yieldSnapshot.stock_sheet.width_mm} x ${yieldSnapshot.stock_sheet.height_mm}mm`
                    : null}
                />
                <ResultField label="총 조각 면적" value={formatArea(yieldSnapshot?.total_part_area_mm2)} />
                <ResultField label="필요 원장" value={yieldSnapshot?.estimated_sheet_count ? `${yieldSnapshot.estimated_sheet_count}장` : null} />
                <ResultField label="예상 수율" value={yieldSnapshot?.yield_percent ? `${yieldSnapshot.yield_percent}%` : null} />
                <Checklist title="수율 메모" items={yieldSnapshot?.notes || []} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">임시 견적 초안</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="text-sm text-muted-foreground">VAT 포함 예상</div>
                  <div className="mt-1 text-3xl font-bold tabular-nums">{formatMoney(formula?.total)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    공급가 {formatMoney(formula?.subtotal)} · VAT {formatMoney(formula?.tax)}
                  </div>
                </div>
                <div className="grid gap-2">
                  {(formula?.line_items || []).map((item) => (
                    <div key={`${item.label}-${item.amount}`} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                      <div>
                        <div className="font-medium">{item.label}</div>
                        {item.reason && <div className="text-xs text-muted-foreground">{item.reason}</div>}
                      </div>
                      <div className="font-semibold tabular-nums">{formatMoney(item.amount)}</div>
                    </div>
                  ))}
                  {!formula?.line_items?.length && (
                    <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                      산출 가능한 금액 항목이 없습니다.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">상담원 검수</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ResultField label="job" value={payload?.job.id} />
                <ResultField label="공식 버전" value={formula?.version} />
                <ResultField label="만료" value={payload?.job.expires_at ? new Date(payload.job.expires_at).toLocaleString('ko-KR') : null} />
                <Button
                  className="w-full"
                  onClick={handleConvertDraft}
                  disabled={converting || !result || reviewStatus === 'converted' || reviewStatus === 'blocked'}
                >
                  {converting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {reviewStatus === 'converted' ? '전환 완료' : '견적 초안으로 전환'}
                </Button>
                {reviewStatus === 'blocked' && (
                  <p className="text-xs text-muted-foreground">
                    보류 상태는 누락 파일이나 필수 치수 확인 후 전환할 수 있습니다.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </PageShell>
  );
};

const ResultField = ({ label, value, className }: { label: string; value?: string | number | null; className?: string }) => (
  <div className={cn('rounded-lg border p-3', className)}>
    <div className="text-xs font-semibold text-muted-foreground">{label}</div>
    <div className="mt-1 break-words text-sm font-medium">{value || '-'}</div>
  </div>
);

const Checklist = ({ title, items, tone = 'default' }: { title: string; items: string[]; tone?: 'default' | 'warning' }) => (
  <div className="space-y-2">
    <div className="text-sm font-semibold">{title}</div>
    <div className="grid gap-2">
      {items.length ? items.map((item) => (
        <div
          key={item}
          className={cn(
            'flex gap-2 rounded-lg border p-3 text-sm',
            tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'bg-muted/20'
          )}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{item}</span>
        </div>
      )) : (
        <div className="rounded-lg border p-3 text-sm text-muted-foreground">표시할 항목이 없습니다.</div>
      )}
    </div>
  </div>
);

export default QuoteWizardPage;
