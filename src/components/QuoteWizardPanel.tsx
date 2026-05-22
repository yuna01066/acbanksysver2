import { useId, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, FileSearch, FileUp, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  analyzeQuoteWizardJob,
  classifyQuoteWizardFile,
  convertQuoteWizardToDraft,
  createQuoteWizardJob,
  uploadQuoteWizardFiles,
} from '@/services/quoteWizard';
import type {
  QuoteWizardFileKind,
  QuoteWizardPart,
  QuoteWizardPayload,
  QuoteWizardReviewStatus,
} from '@/types/quoteWizard';
import { cn } from '@/lib/utils';

type WizardStep = 'upload' | 'uploading' | 'analyzing' | 'completed' | 'failed';

interface QuoteWizardPanelProps {
  embedded?: boolean;
  compact?: boolean;
  onOpenFullPage?: () => void;
  className?: string;
}

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

const inferredText = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

const stepIndex = (step: WizardStep) => {
  if (step === 'failed') return 2;
  return Math.max(0, STEP_META.findIndex(item => item.key === step));
};

const QuoteWizardPanel = ({ embedded = false, compact = false, onOpenFullPage, className }: QuoteWizardPanelProps) => {
  const navigate = useNavigate();
  const noteId = useId();
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
  const inferred = analysis?.inferred || {};
  const engineStatus = inferredText(inferred.engine_status);
  const extractionMode = inferredText(inferred.extraction_mode);
  const workerStatus = inferredText(inferred.worker_status);
  const engineNote = inferredText(inferred.note);
  const hasFormulaAmount = Boolean((formula?.line_items?.length || 0) > 0 && Number(formula?.total) > 0);
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
  const cardClassName = compact ? 'rounded-[20px] border-[#dedede] shadow-none' : undefined;
  const cardHeaderClassName = compact ? 'space-y-1 px-3 py-3' : 'space-y-2';
  const cardContentClassName = compact ? 'space-y-3 px-3 pb-3' : 'space-y-4';
  const titleClassName = compact ? 'text-base' : 'text-lg';

  const setFiles = (files: File[]) => {
    setSelectedFiles(files.slice(0, 8));
    setPayload(null);
    setErrorMessage(null);
    setStep('upload');
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(event.target.files || []));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    setFiles(Array.from(event.dataTransfer.files || []));
  };

  const handleUploadKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    fileInputRef.current?.click();
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
    <div className={cn(compact ? 'space-y-3' : 'space-y-4', className)}>
      {embedded && onOpenFullPage && (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onOpenFullPage} className="h-7 px-2 text-[11px] text-[#707072]">
            관리자 화면 열기
          </Button>
        </div>
      )}

      <section className={cn('grid gap-4', !compact && 'lg:grid-cols-[minmax(0,1fr)_360px]', compact && 'gap-3')}>
        <Card className={cardClassName}>
          <CardHeader className={cardHeaderClassName}>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className={titleClassName}>도면/사진 업로드</CardTitle>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className={compact ? 'h-5 px-1.5 text-[10px]' : undefined}>{selectedFiles.length} FILES</Badge>
                <Button type="button" variant="ghost" size="icon" onClick={resetWizard} disabled={isBusy} className={cn('rounded-full', compact ? 'h-7 w-7' : 'h-8 w-8')}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span className="sr-only">초기화</span>
                </Button>
              </div>
            </div>
            <p className={cn('text-muted-foreground', compact ? 'text-xs leading-5' : 'text-sm')}>
              PDF, 이미지, DXF, DWG 원본을 첨부할 수 있습니다. 원본 CAD만 있는 경우에는 미리보기 요청 상태로 표시됩니다.
            </p>
          </CardHeader>
          <CardContent className={cardContentClassName}>
            <div
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed text-center transition-colors',
                compact ? 'min-h-[142px] p-4' : 'min-h-[220px] p-6',
                dragging || selectedFiles.length ? 'border-foreground bg-muted/50' : 'border-border bg-muted/20'
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onKeyDown={handleUploadKeyDown}
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
              <FileUp className={cn('mb-3 text-muted-foreground', compact ? 'h-8 w-8' : 'h-10 w-10')} />
              <div className={cn('font-semibold', compact ? 'text-sm' : 'text-base')}>
                {selectedFiles.length ? '파일이 준비되었습니다' : '파일을 드롭하거나 선택하세요'}
              </div>
              <div className={cn('mt-1 text-muted-foreground', compact ? 'text-xs leading-5' : 'text-sm')}>
                파일 업로드가 첫 단계이며, 파일 없이는 견적 마법사를 시작할 수 없습니다.
              </div>
            </div>

            {selectedFileSummary.length > 0 && (
              <div className="grid gap-2">
                {selectedFileSummary.map((file) => (
                  <div key={`${file.name}-${file.size}`} className={cn('flex items-center justify-between gap-3 rounded-lg border', compact ? 'p-2.5' : 'p-3')}>
                    <div className="min-w-0">
                      <div className={cn('truncate font-semibold', compact ? 'text-xs' : 'text-sm')}>{file.name}</div>
                      <div className="text-xs text-muted-foreground">{file.size}</div>
                    </div>
                    <Badge variant="outline" className={compact ? 'h-5 px-1.5 text-[10px]' : undefined}>{KIND_LABEL[file.kind]}</Badge>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <label className={cn('font-semibold', compact ? 'text-xs' : 'text-sm')} htmlFor={noteId}>상담 메모</label>
              <Textarea
                id={noteId}
                value={customerNote}
                onChange={(event) => setCustomerNote(event.target.value)}
                placeholder="예: 투명 아크릴 5T, 매장 진열 커버, 로고 인쇄 포함. 도면 치수와 수량을 우선 확인해주세요."
                rows={compact ? 3 : 4}
                className={compact ? 'text-xs' : undefined}
              />
            </div>

            <Button className="w-full" size={compact ? 'sm' : 'lg'} onClick={handleStart} disabled={!selectedFiles.length || isBusy}>
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
              견적 마법사 시작
            </Button>
          </CardContent>
        </Card>

        <Card className={cardClassName}>
          <CardHeader className={cardHeaderClassName}>
            <CardTitle className={titleClassName}>진행 상태</CardTitle>
          </CardHeader>
          <CardContent className={cardContentClassName}>
            <Progress value={progressValue} />
            <div className={cn('grid', compact ? 'grid-cols-2 gap-2' : 'gap-2')}>
              {STEP_META.map((item, index) => {
                const done = index < currentStepIndex || step === 'completed';
                const active = index === currentStepIndex && step !== 'completed';
                return (
                  <div key={item.key} className={cn('flex items-center gap-2 rounded-lg border text-sm', compact ? 'px-2 py-2 text-xs' : 'p-3', active && 'border-foreground')}>
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : active && isBusy ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <span className="h-4 w-4 shrink-0 rounded-full border" />
                    )}
                    <span className={cn('min-w-0 truncate', done && 'font-semibold')}>{item.label}</span>
                  </div>
                );
              })}
            </div>
            <div className={cn('rounded-lg border bg-muted/30 text-muted-foreground', compact ? 'p-2.5 text-[11px] leading-5' : 'p-3 text-xs leading-5')}>
              견적 마법사는 기존 견적 계산기와 별도로 산출되는 임시 분석 결과입니다. 전환 버튼을 누르기 전까지 기존 초안에 저장되지 않습니다.
            </div>
            {errorMessage && (
              <div className={cn('flex gap-2 rounded-lg border border-red-200 bg-red-50 text-red-700', compact ? 'p-2.5 text-xs' : 'p-3 text-sm')}>
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {result && (
        <>
        <EngineStatusNotice
          status={engineStatus}
          mode={extractionMode}
          workerStatus={workerStatus}
          note={engineNote}
          compact={compact}
        />

        <section className={cn('grid gap-4', !compact && 'lg:grid-cols-[minmax(0,1fr)_380px]', compact && 'gap-3')}>
          <div className="space-y-3">
            <Card className={cardClassName}>
              <CardHeader className={cn('flex-row items-center justify-between gap-3 space-y-0', compact ? 'px-3 py-3' : undefined)}>
                <CardTitle className={titleClassName}>제작물 판별</CardTitle>
                <Badge className={cn(reviewMeta.className, compact && 'h-5 px-1.5 text-[10px]')} variant="outline">{reviewMeta.label}</Badge>
              </CardHeader>
              <CardContent className={cn('grid gap-3', compact ? 'px-3 pb-3' : 'sm:grid-cols-2')}>
                <ResultField label="제작물" value={analysis?.item_name} compact={compact} />
                <ResultField label="치수" value={analysis?.dimensions} compact={compact} />
                <ResultField label="수량" value={analysis?.quantity ? `${analysis.quantity}개` : null} compact={compact} />
                <ResultField label="소재/두께" value={[analysis?.material, analysis?.thickness, analysis?.color, analysis?.finish].filter(Boolean).join(' / ')} compact={compact} />
                <ResultField label="가공" value={analysis?.processing?.join(', ')} className={compact ? undefined : 'sm:col-span-2'} compact={compact} />
                <ResultField label="추천 회신" value={analysis?.recommended_reply} className={compact ? undefined : 'sm:col-span-2'} compact={compact} />
              </CardContent>
            </Card>

            <Card className={cardClassName}>
              <CardHeader className={cardHeaderClassName}>
                <CardTitle className={titleClassName}>파트/조각 분해</CardTitle>
              </CardHeader>
              <CardContent className={compact ? 'px-3 pb-3' : undefined}>
                <PartsBreakdown parts={analysis?.parts || []} compact={compact} />
              </CardContent>
            </Card>

            <Card className={cardClassName}>
              <CardHeader className={cardHeaderClassName}>
                <CardTitle className={titleClassName}>보완/위험 체크</CardTitle>
              </CardHeader>
              <CardContent className={cn('grid gap-3', compact ? 'px-3 pb-3' : 'md:grid-cols-2')}>
                <Checklist title="부족한 내용" items={analysis?.missing_fields || []} compact={compact} />
                <Checklist title="위험/검수 항목" items={analysis?.production_risks || []} tone="warning" compact={compact} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <Card className={cardClassName}>
              <CardHeader className={cardHeaderClassName}>
                <CardTitle className={titleClassName}>원장/수율 참고값</CardTitle>
              </CardHeader>
              <CardContent className={cn('space-y-3', compact ? 'px-3 pb-3' : undefined)}>
                <ResultField label="상태" value={yieldSnapshot?.status} compact={compact} />
                <ResultField label="원장 후보" value={yieldSnapshot?.stock_sheet?.name || undefined} compact={compact} />
                <ResultField
                  label="원장 치수"
                  value={yieldSnapshot?.stock_sheet?.width_mm && yieldSnapshot?.stock_sheet?.height_mm
                    ? `${yieldSnapshot.stock_sheet.width_mm} x ${yieldSnapshot.stock_sheet.height_mm}mm`
                    : null}
                  compact={compact}
                />
                <ResultField label="총 조각 면적" value={formatArea(yieldSnapshot?.total_part_area_mm2)} compact={compact} />
                <ResultField label="필요 원장" value={yieldSnapshot?.estimated_sheet_count ? `${yieldSnapshot.estimated_sheet_count}장` : null} compact={compact} />
                <ResultField label="예상 수율" value={yieldSnapshot?.yield_percent ? `${yieldSnapshot.yield_percent}%` : null} compact={compact} />
                <Checklist title="수율 메모" items={yieldSnapshot?.notes || []} compact={compact} />
              </CardContent>
            </Card>

            <Card className={cardClassName}>
              <CardHeader className={cardHeaderClassName}>
                <CardTitle className={titleClassName}>임시 견적 초안</CardTitle>
              </CardHeader>
              <CardContent className={cn('space-y-4', compact ? 'px-3 pb-3' : undefined)}>
                <div className={cn('rounded-xl border bg-muted/30', compact ? 'p-3' : 'p-4')}>
                  <div className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>VAT 포함 예상</div>
                  <div className={cn('mt-1 font-bold tabular-nums', compact ? 'text-2xl' : 'text-3xl')}>
                    {hasFormulaAmount ? formatMoney(formula?.total) : '산출 보류'}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {hasFormulaAmount
                      ? `공급가 ${formatMoney(formula?.subtotal)} · VAT ${formatMoney(formula?.tax)}`
                      : '샘플 금액 없이 상담원 검수 후 산출합니다.'}
                  </div>
                </div>
                <div className="grid gap-2">
                  {(formula?.line_items || []).map((item) => (
                    <div key={`${item.label}-${item.amount}`} className={cn('flex items-start justify-between gap-3 rounded-lg border text-sm', compact ? 'p-2.5 text-xs' : 'p-3')}>
                      <div>
                        <div className="font-medium">{item.label}</div>
                        {item.reason && <div className="text-xs text-muted-foreground">{item.reason}</div>}
                      </div>
                      <div className="font-semibold tabular-nums">{formatMoney(item.amount)}</div>
                    </div>
                  ))}
                  {!formula?.line_items?.length && (
                    <div className={cn('rounded-lg border text-muted-foreground', compact ? 'p-2.5 text-xs' : 'p-3 text-sm')}>
                      산출 가능한 금액 항목이 없습니다.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className={cardClassName}>
              <CardHeader className={cardHeaderClassName}>
                <CardTitle className={titleClassName}>상담원 검수</CardTitle>
              </CardHeader>
              <CardContent className={cn('space-y-3', compact ? 'px-3 pb-3' : undefined)}>
                <ResultField label="job" value={payload?.job.id} compact={compact} />
                <ResultField label="공식 버전" value={formula?.version} compact={compact} />
                <ResultField label="만료" value={payload?.job.expires_at ? new Date(payload.job.expires_at).toLocaleString('ko-KR') : null} compact={compact} />
                <Button
                  className="w-full"
                  size={compact ? 'sm' : 'default'}
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
        </>
      )}
    </div>
  );
};

const EngineStatusNotice = ({
  status,
  mode,
  workerStatus,
  note,
  compact,
}: {
  status: string | null;
  mode: string | null;
  workerStatus: string | null;
  note: string | null;
  compact: boolean;
}) => {
  const unavailable = status === 'unavailable' || status === 'needs_review';
  const limited = status === 'limited' || mode?.includes('builtin') || mode?.includes('text');
  const toneClass = unavailable
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : limited
      ? 'border-blue-200 bg-blue-50 text-blue-900'
      : 'border-emerald-200 bg-emerald-50 text-emerald-900';
  const title = unavailable
    ? '분석 엔진 연결 확인 필요'
    : limited
      ? '제한 분석 결과'
      : '분석 엔진 결과';
  const description = note || (limited
    ? '파일에서 관찰 가능한 값만 추출했습니다. 없는 치수/수량/금액은 만들지 않습니다.'
    : '연결된 분석 엔진이 반환한 결과입니다.');

  return (
    <div className={cn('flex gap-2 rounded-lg border', toneClass, compact ? 'p-2.5 text-xs leading-5' : 'p-3 text-sm leading-6')}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <div className="font-semibold">{title}</div>
        <div className="break-words">{description}</div>
        {(mode || workerStatus) && (
          <div className="mt-1 text-[11px] opacity-80">
            {mode && `mode: ${mode}`}
            {mode && workerStatus && ' · '}
            {workerStatus && `worker: ${workerStatus}`}
          </div>
        )}
      </div>
    </div>
  );
};

const ResultField = ({
  label,
  value,
  className,
  compact = false,
}: {
  label: string;
  value?: string | number | null;
  className?: string;
  compact?: boolean;
}) => (
  <div className={cn('rounded-lg border', compact ? 'p-2.5' : 'p-3', className)}>
    <div className={cn('font-semibold text-muted-foreground', compact ? 'text-[11px]' : 'text-xs')}>{label}</div>
    <div className={cn('mt-1 break-words font-medium', compact ? 'text-xs leading-5' : 'text-sm')}>{value || '-'}</div>
  </div>
);

const PartsBreakdown = ({ parts, compact }: { parts: QuoteWizardPart[]; compact: boolean }) => {
  if (compact) {
    return (
      <div className="grid gap-2">
        {parts.length ? parts.map((part) => (
          <div key={part.id} className="rounded-lg border p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold">{part.name}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {part.width_mm && part.height_mm ? `${part.width_mm} x ${part.height_mm}mm` : '-'} · {part.quantity ?? '-'}개
                </div>
              </div>
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{part.confidence}</Badge>
            </div>
            <div className="mt-2 text-[11px] leading-5 text-muted-foreground">
              {part.basis}
              {part.risk_notes.length > 0 && ` / ${part.risk_notes.join(', ')}`}
            </div>
          </div>
        )) : (
          <div className="rounded-lg border p-3 text-center text-xs text-muted-foreground">
            파트 추출에 필요한 치수/미리보기 정보가 부족합니다.
          </div>
        )}
      </div>
    );
  }

  return (
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
        {parts.map((part) => (
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
        {!parts.length && (
          <TableRow>
            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
              파트 추출에 필요한 치수/미리보기 정보가 부족합니다.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};

const Checklist = ({
  title,
  items,
  tone = 'default',
  compact = false,
}: {
  title: string;
  items: string[];
  tone?: 'default' | 'warning';
  compact?: boolean;
}) => (
  <div className="space-y-2">
    <div className={cn('font-semibold', compact ? 'text-xs' : 'text-sm')}>{title}</div>
    <div className="grid gap-2">
      {items.length ? items.map((item) => (
        <div
          key={item}
          className={cn(
            'flex gap-2 rounded-lg border',
            compact ? 'p-2.5 text-xs leading-5' : 'p-3 text-sm',
            tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'bg-muted/20'
          )}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{item}</span>
        </div>
      )) : (
        <div className={cn('rounded-lg border text-muted-foreground', compact ? 'p-2.5 text-xs' : 'p-3 text-sm')}>표시할 항목이 없습니다.</div>
      )}
    </div>
  </div>
);

export default QuoteWizardPanel;
