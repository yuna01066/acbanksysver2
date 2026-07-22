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
  actorId: string;
  actorName: string;
}

const QUOTE_LOSS_SCHEMA_COLUMNS = [
  'lost_by',
  'lost_reason_category',
  'lost_reason_detail',
  'lost_competitor_name',
  'lost_price_gap',
  'lost_follow_up_at',
  'lost_recorded_by',
  'lost_recorded_at',
];

const isQuoteLossSchemaCacheError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as { code?: string; message?: string; details?: string; hint?: string };
  const combined = [candidate.message, candidate.details, candidate.hint].filter(Boolean).join(' ');

  return (
    candidate.code === 'PGRST204'
    && combined.includes('saved_quotes')
    && QUOTE_LOSS_SCHEMA_COLUMNS.some((column) => combined.includes(column))
  );
};

const getQuoteLossErrorMessage = (error: unknown) => {
  if (isQuoteLossSchemaCacheError(error)) {
    const candidate = error as { message?: string; code?: string };
    return [
      '수주 실패 저장용 DB 컬럼이 아직 운영 DB에 적용되지 않았습니다.',
      'Supabase SQL migration `20260722073000_ensure_quote_loss_columns.sql`을 적용한 뒤 다시 시도해주세요.',
      candidate.message ? `원문: ${candidate.message}` : null,
      candidate.code ? `code: ${candidate.code}` : null,
    ]
      .filter(Boolean)
      .join(' / ');
  }

  if (error instanceof Error) return error.message;

  if (error && typeof error === 'object') {
    const candidate = error as { message?: string; details?: string; hint?: string; code?: string };
    return [candidate.message, candidate.details, candidate.hint, candidate.code ? `code: ${candidate.code}` : null]
      .filter(Boolean)
      .join(' / ') || '수주 실패 사유 저장 중 알 수 없는 오류가 발생했습니다.';
  }

  return String(error || '수주 실패 사유 저장 중 알 수 없는 오류가 발생했습니다.');
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
    lost_competitor_name: null,
    lost_price_gap: null,
    lost_follow_up_at: null,
    lost_recorded_by: input.actorId,
    lost_recorded_at: nowIso,
  };

  const { error } = await (supabase as any)
    .from('saved_quotes')
    .update(updatePayload)
    .eq('id', input.quoteId);

  if (error) {
    console.error('[quote-loss] saved_quotes update failed', {
      quoteId: input.quoteId,
      quoteNumber: input.quoteNumber,
      projectStage: input.projectStage,
      quoteStatus: input.quoteStatus,
      updateColumns: Object.keys(updatePayload),
      error,
    });
    throw new Error(getQuoteLossErrorMessage(error));
  }

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
    },
  });

  return {
    ...updatePayload,
    project_stage: 'cancelled' as const,
    quote_status: 'cancelled' as const,
  };
}
