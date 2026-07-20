import { supabase } from '@/integrations/supabase/client';
import { logQuoteActivity } from '@/services/quoteActivity';
import { projectStageToLegacyQuoteStatus } from '@/utils/quoteWorkflow';
import {
  canRecordQuoteLostReason,
  getQuoteLostByLabel,
  getQuoteLostReasonLabel,
  type QuoteLostBy,
  type QuoteLostReasonCategory,
} from '@/utils/quoteLossReason';

export interface RecordQuoteLostReasonInput {
  quoteId: string;
  quoteNumber?: string | null;
  projectStage?: string | null;
  quoteStatus?: string | null;
  projectId?: string | null;
  lostBy: QuoteLostBy;
  reasonCategory: QuoteLostReasonCategory;
  detail: string;
  competitorName?: string | null;
  priceGap?: number | null;
  followUpAt?: string | null;
  actorId: string;
  actorName: string;
}

const trimOrNull = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export async function recordQuoteLostReason(input: RecordQuoteLostReasonInput) {
  if (!canRecordQuoteLostReason(input.projectStage, input.quoteStatus, input.projectId)) {
    throw new Error('수주 이후 단계 또는 프로젝트 연결 견적은 이 화면에서 수주 실패 처리할 수 없습니다.');
  }

  const detail = input.detail.trim();
  if (detail.length < 5) {
    throw new Error('수주 실패 상세 사유를 5자 이상 입력해주세요.');
  }

  const nowIso = new Date().toISOString();
  const previousStage = input.projectStage || 'quote_issued';
  const updatePayload = {
    project_stage: 'cancelled',
    quote_status: projectStageToLegacyQuoteStatus('cancelled'),
    status_updated_at: nowIso,
    lost_by: input.lostBy,
    lost_reason_category: input.reasonCategory,
    lost_reason_detail: detail,
    lost_competitor_name: trimOrNull(input.competitorName),
    lost_price_gap: typeof input.priceGap === 'number' && Number.isFinite(input.priceGap) ? input.priceGap : null,
    lost_follow_up_at: input.followUpAt || null,
    lost_recorded_by: input.actorId,
    lost_recorded_at: nowIso,
  };

  const { error } = await (supabase as any)
    .from('saved_quotes')
    .update(updatePayload)
    .eq('id', input.quoteId);

  if (error) throw error;

  await logQuoteActivity({
    quoteId: input.quoteId,
    actionType: 'quote_lost',
    actorId: input.actorId,
    actorName: input.actorName,
    oldValue: previousStage,
    newValue: 'cancelled',
    memo: detail,
    metadata: {
      quoteNumber: input.quoteNumber,
      lostBy: input.lostBy,
      lostByLabel: getQuoteLostByLabel(input.lostBy),
      reasonCategory: input.reasonCategory,
      reasonLabel: getQuoteLostReasonLabel(input.reasonCategory),
      competitorName: trimOrNull(input.competitorName),
      priceGap: updatePayload.lost_price_gap,
      followUpAt: input.followUpAt || null,
    },
  });

  return {
    ...updatePayload,
    project_stage: 'cancelled' as const,
    quote_status: 'cancelled' as const,
  };
}
