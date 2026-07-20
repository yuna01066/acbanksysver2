import {
  normalizeProjectStage,
  type ProjectStageValue,
} from '@/utils/quoteWorkflow';

export const QUOTE_LOST_BY_OPTIONS = [
  { value: 'client', label: '거래처 취소' },
  { value: 'internal', label: '내부 조건 불가' },
  { value: 'expired', label: '무응답/기한 만료' },
  { value: 'system', label: '시스템 처리' },
] as const;

export const QUOTE_LOST_REASON_CATEGORIES = [
  { value: 'price_too_high', label: '가격' },
  { value: 'lead_time', label: '납기' },
  { value: 'spec_mismatch', label: '스펙/제작 불가' },
  { value: 'competitor_selected', label: '타사 선정' },
  { value: 'client_budget_cancelled', label: '예산/프로젝트 취소' },
  { value: 'no_response', label: '무응답/기한 만료' },
  { value: 'internal_rejected', label: '내부 조건 불가' },
  { value: 'duplicate_or_test', label: '중복/테스트' },
  { value: 'other', label: '기타' },
] as const;

export type QuoteLostBy = typeof QUOTE_LOST_BY_OPTIONS[number]['value'];
export type QuoteLostReasonCategory = typeof QUOTE_LOST_REASON_CATEGORIES[number]['value'];

const LOSS_ALLOWED_STAGES = new Set<ProjectStageValue>([
  'reviewing',
  'quote_issued',
  'revision_requested',
  'on_hold',
]);

export function getQuoteLostByLabel(value?: string | null) {
  return QUOTE_LOST_BY_OPTIONS.find((option) => option.value === value)?.label || '미기록';
}

export function getQuoteLostReasonLabel(value?: string | null) {
  return QUOTE_LOST_REASON_CATEGORIES.find((option) => option.value === value)?.label || '원인 미입력';
}

export function canRecordQuoteLostReason(
  stage?: string | null,
  quoteStatus?: string | null,
  projectId?: string | null,
) {
  if (projectId) return false;
  return LOSS_ALLOWED_STAGES.has(normalizeProjectStage(stage, quoteStatus));
}
