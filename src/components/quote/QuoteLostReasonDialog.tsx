import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  QUOTE_LOST_BY_OPTIONS,
  QUOTE_LOST_REASON_CATEGORIES,
  type QuoteLostBy,
  type QuoteLostReasonCategory,
} from '@/utils/quoteLossReason';
import { formatPrice } from '@/utils/priceCalculations';

export interface QuoteLostReasonFormValue {
  lostBy: QuoteLostBy;
  reasonCategory: QuoteLostReasonCategory;
  detail: string;
  competitorName?: string | null;
  priceGap?: number | null;
  followUpAt?: string | null;
}

interface QuoteLostReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote?: {
    quoteNumber?: string | null;
    title?: string | null;
    recipient?: string | null;
    total?: number | null;
  } | null;
  submitting?: boolean;
  onSubmit: (value: QuoteLostReasonFormValue) => Promise<void> | void;
}

const QuoteLostReasonDialog = ({
  open,
  onOpenChange,
  quote,
  submitting = false,
  onSubmit,
}: QuoteLostReasonDialogProps) => {
  const [lostBy, setLostBy] = useState<QuoteLostBy>('client');
  const [reasonCategory, setReasonCategory] = useState<QuoteLostReasonCategory>('price_too_high');
  const [detail, setDetail] = useState('');
  const [competitorName, setCompetitorName] = useState('');
  const [priceGap, setPriceGap] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');

  useEffect(() => {
    if (!open) return;
    setLostBy('client');
    setReasonCategory('price_too_high');
    setDetail('');
    setCompetitorName('');
    setPriceGap('');
    setFollowUpAt('');
  }, [open, quote?.quoteNumber]);

  const trimmedDetail = detail.trim();
  const parsedPriceGap = useMemo(() => {
    const normalized = priceGap.replace(/,/g, '').trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }, [priceGap]);
  const detailTooShort = trimmedDetail.length > 0 && trimmedDetail.length < 5;
  const canSubmit = trimmedDetail.length >= 5 && (!priceGap.trim() || parsedPriceGap !== null);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({
      lostBy,
      reasonCategory,
      detail: trimmedDetail,
      competitorName: competitorName.trim() || null,
      priceGap: parsedPriceGap,
      followUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <XCircle className="h-5 w-5" />
            수주 실패/취소 원인 기록
          </DialogTitle>
          <DialogDescription>
            견적은 취소 상태로 변경되고, 담당자별/거래처별 실패 원인 통계에 반영됩니다.
          </DialogDescription>
        </DialogHeader>

        {quote && (
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">
                  {quote.title || `견적 ${quote.quoteNumber || ''}`}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {quote.recipient || '거래처 미지정'}
                  {quote.quoteNumber ? ` · No. ${quote.quoteNumber}` : ''}
                </p>
              </div>
              {typeof quote.total === 'number' && (
                <div className="text-right text-sm font-semibold tabular-nums">
                  {formatPrice(quote.total)}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>취소 주체</Label>
            <Select value={lostBy} onValueChange={(value: QuoteLostBy) => setLostBy(value)}>
              <SelectTrigger className="h-10 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUOTE_LOST_BY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>사유 카테고리</Label>
            <Select
              value={reasonCategory}
              onValueChange={(value: QuoteLostReasonCategory) => setReasonCategory(value)}
            >
              <SelectTrigger className="h-10 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUOTE_LOST_REASON_CATEGORIES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>상세 사유</Label>
          <Textarea
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            placeholder="예: 타사 견적이 약 15% 낮아 거래처에서 타사 진행을 결정함"
            className="min-h-[120px] resize-y rounded-lg"
          />
          <p className={`text-xs ${detailTooShort ? 'text-destructive' : 'text-muted-foreground'}`}>
            5자 이상 입력해야 저장할 수 있습니다. 내부 통계와 활동 이력에 함께 남습니다.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>타사/경쟁사</Label>
            <Input
              value={competitorName}
              onChange={(event) => setCompetitorName(event.target.value)}
              placeholder="선택 입력"
              className="h-10 rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label>가격 차이</Label>
            <Input
              inputMode="numeric"
              value={priceGap}
              onChange={(event) => setPriceGap(event.target.value)}
              placeholder="예: 150000"
              className="h-10 rounded-lg"
            />
            {priceGap.trim() && parsedPriceGap === null && (
              <p className="text-xs text-destructive">숫자로 입력해주세요.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>재연락 예정일</Label>
            <Input
              type="date"
              value={followUpAt}
              onChange={(event) => setFollowUpAt(event.target.value)}
              className="h-10 rounded-lg"
            />
          </div>
        </div>

        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            저장 후 이 견적은 후속관리와 납기 운영 목록에서 제외됩니다. 수주 이후 프로젝트 취소는 프로젝트 화면의 별도 취소 흐름에서 처리하세요.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            닫기
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit || submitting} className="gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            수주 실패 처리
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuoteLostReasonDialog;
