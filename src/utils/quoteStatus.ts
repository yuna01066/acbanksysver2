import { projectStageToLegacyQuoteStatus } from '@/utils/quoteWorkflow';

export const QUOTE_STATUSES = [
  {
    value: 'draft',
    label: '초안',
    description: '발행 전 검토가 필요한 견적',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  {
    value: 'reviewing',
    label: '검토중',
    description: '내부 검토 또는 금액 확인 중',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    value: 'sent',
    label: '발송완료',
    description: '고객에게 전달된 견적',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    value: 'revision_requested',
    label: '수정요청',
    description: '고객 또는 내부 수정 요청 있음',
    color: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  {
    value: 'won',
    label: '수주',
    description: '프로젝트 전환 또는 수주 확정',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    value: 'on_hold',
    label: '보류',
    description: '일정 또는 의사결정 대기',
    color: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  },
  {
    value: 'cancelled',
    label: '취소',
    description: '취소 또는 유효기간 만료',
    color: 'bg-red-50 text-red-700 border-red-200',
  },
] as const;

export type QuoteStatusValue = typeof QUOTE_STATUSES[number]['value'];

export const DEFAULT_QUOTE_STATUS: QuoteStatusValue = 'sent';

export function isQuoteStatus(value: unknown): value is QuoteStatusValue {
  return typeof value === 'string' && QUOTE_STATUSES.some((status) => status.value === value);
}

export function normalizeQuoteStatus(value: unknown, projectStage?: string | null): QuoteStatusValue {
  if (projectStage) return projectStageToLegacyQuoteStatus(projectStage) as QuoteStatusValue;
  if (isQuoteStatus(value)) return value;
  return projectStageToLegacyQuoteStatus(projectStage) as QuoteStatusValue || DEFAULT_QUOTE_STATUS;
}

export function getQuoteStatusInfo(value: unknown, projectStage?: string | null) {
  const normalized = normalizeQuoteStatus(value, projectStage);
  return QUOTE_STATUSES.find((status) => status.value === normalized) || QUOTE_STATUSES[2];
}
