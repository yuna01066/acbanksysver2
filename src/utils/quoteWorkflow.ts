export const QUOTE_PROJECT_STAGES = [
  {
    value: 'reviewing',
    label: '검토중',
    description: '내부 검토 또는 금액 확인 중입니다.',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    value: 'quote_issued',
    label: '견적 발행',
    description: '고객에게 견적이 전달된 상태입니다.',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    value: 'revision_requested',
    label: '수정요청',
    description: '고객 또는 내부 수정 요청이 있는 상태입니다.',
    color: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  {
    value: 'on_hold',
    label: '보류',
    description: '일정 또는 의사결정 대기 상태입니다.',
    color: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  },
  {
    value: 'contracted',
    label: '수주',
    description: '수주가 확정되어 프로젝트로 전환된 상태입니다.',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    value: 'invoice_issued',
    label: '계산서 발행',
    description: '계산서가 발행된 상태입니다.',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    value: 'in_progress',
    label: '진행중',
    description: '제작 또는 납품 준비가 진행 중입니다.',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  {
    value: 'panel_ordered',
    label: '원판발주',
    description: '원판 발주가 진행된 상태입니다.',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  {
    value: 'manufacturing',
    label: '제작중',
    description: '제품 제작이 진행 중입니다.',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    value: 'completed',
    label: '제작완료',
    description: '제작이 완료된 상태입니다.',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  {
    value: 'delivery_scheduled',
    label: '납기 예정',
    description: '제작 완료 후 납품 또는 설치 예정인 상태입니다.',
    color: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  {
    value: 'delivered',
    label: '납기 완료',
    description: '고객 납품 또는 설치가 완료된 상태입니다.',
    color: 'bg-green-100 text-green-800 border-green-200',
  },
  {
    value: 'cancelled',
    label: '취소',
    description: '취소 또는 종료된 상태입니다.',
    color: 'bg-red-50 text-red-700 border-red-200',
  },
] as const;

export type ProjectStageValue = typeof QUOTE_PROJECT_STAGES[number]['value'];

export const SIMPLIFIED_QUOTE_STAGE_FILTERS = [
  {
    value: 'reviewing',
    label: '검토',
    description: '금액 확인 또는 내부 검토가 필요한 견적입니다.',
    stages: ['reviewing'],
    color: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    value: 'quote_issued',
    label: '발송',
    description: '고객에게 전달된 견적입니다.',
    stages: ['quote_issued'],
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    value: 'revision_requested',
    label: '수정요청',
    description: '고객 또는 내부 수정 요청이 있는 견적입니다.',
    stages: ['revision_requested'],
    color: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  {
    value: 'active',
    label: '진행',
    description: '수주 후 제작, 발주, 납기 준비가 진행 중입니다.',
    stages: ['contracted', 'invoice_issued', 'in_progress', 'panel_ordered', 'manufacturing', 'completed', 'delivery_scheduled'],
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    value: 'delivered',
    label: '완료',
    description: '납품 또는 설치가 완료된 견적입니다.',
    stages: ['delivered'],
    color: 'bg-green-100 text-green-800 border-green-200',
  },
  {
    value: 'on_hold',
    label: '보류',
    description: '일정 또는 의사결정이 대기 중인 견적입니다.',
    stages: ['on_hold'],
    color: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  },
  {
    value: 'cancelled',
    label: '취소',
    description: '취소 또는 종료된 견적입니다.',
    stages: ['cancelled'],
    color: 'bg-red-50 text-red-700 border-red-200',
  },
] as const;

export type SimplifiedQuoteStageFilterValue = typeof SIMPLIFIED_QUOTE_STAGE_FILTERS[number]['value'];

export type LegacyQuoteStatus =
  | 'draft'
  | 'reviewing'
  | 'sent'
  | 'revision_requested'
  | 'won'
  | 'on_hold'
  | 'cancelled';

const PROJECT_STAGE_VALUES = new Set<string>(QUOTE_PROJECT_STAGES.map((stage) => stage.value));

export const DEFAULT_PROJECT_STAGE: ProjectStageValue = 'quote_issued';

export const REISSUE_PROTECTED_PROJECT_STAGES = new Set<ProjectStageValue>([
  'contracted',
  'invoice_issued',
  'in_progress',
  'panel_ordered',
  'manufacturing',
  'completed',
  'delivery_scheduled',
  'delivered',
]);

export const FINAL_COMPLETED_PROJECT_STAGES = new Set<ProjectStageValue>([
  'completed',
  'delivered',
]);

export const CALENDAR_DELIVERY_PROJECT_STAGES = new Set<ProjectStageValue>([
  'contracted',
  'invoice_issued',
  'in_progress',
  'panel_ordered',
  'manufacturing',
  'completed',
  'delivery_scheduled',
  'delivered',
]);

export function isProjectStage(value: unknown): value is ProjectStageValue {
  return typeof value === 'string' && PROJECT_STAGE_VALUES.has(value);
}

export function legacyQuoteStatusToProjectStage(status?: string | null): ProjectStageValue {
  switch (status) {
    case 'reviewing':
      return 'reviewing';
    case 'revision_requested':
      return 'revision_requested';
    case 'on_hold':
      return 'on_hold';
    case 'won':
      return 'contracted';
    case 'cancelled':
      return 'cancelled';
    case 'sent':
    case 'draft':
    default:
      return DEFAULT_PROJECT_STAGE;
  }
}

export function normalizeProjectStage(stage?: string | null, legacyStatus?: string | null): ProjectStageValue {
  if (isProjectStage(stage)) return stage;
  return legacyQuoteStatusToProjectStage(legacyStatus || stage);
}

export function isReissueProtectedProjectStage(stage?: string | null, legacyStatus?: string | null): boolean {
  return REISSUE_PROTECTED_PROJECT_STAGES.has(normalizeProjectStage(stage, legacyStatus));
}

export function isFinalCompletedProjectStage(stage?: string | null, legacyStatus?: string | null): boolean {
  return FINAL_COMPLETED_PROJECT_STAGES.has(normalizeProjectStage(stage, legacyStatus));
}

export function isCalendarDeliveryProjectStage(stage?: string | null, legacyStatus?: string | null): boolean {
  return CALENDAR_DELIVERY_PROJECT_STAGES.has(normalizeProjectStage(stage, legacyStatus));
}

export function projectStageToLegacyQuoteStatus(stage?: string | null): LegacyQuoteStatus {
  switch (normalizeProjectStage(stage)) {
    case 'reviewing':
      return 'reviewing';
    case 'revision_requested':
      return 'revision_requested';
    case 'on_hold':
      return 'on_hold';
    case 'contracted':
    case 'invoice_issued':
    case 'in_progress':
    case 'panel_ordered':
    case 'manufacturing':
    case 'completed':
    case 'delivery_scheduled':
    case 'delivered':
      return 'won';
    case 'cancelled':
      return 'cancelled';
    case 'quote_issued':
    default:
      return 'sent';
  }
}

export function getStageInfo(value?: string | null) {
  const normalized = normalizeProjectStage(value);
  return QUOTE_PROJECT_STAGES.find((stage) => stage.value === normalized) || QUOTE_PROJECT_STAGES[1];
}

export function getSimplifiedStageInfo(stage?: string | null, legacyStatus?: string | null) {
  const normalized = normalizeProjectStage(stage, legacyStatus);
  return SIMPLIFIED_QUOTE_STAGE_FILTERS.find((filter) => filter.stages.includes(normalized)) || SIMPLIFIED_QUOTE_STAGE_FILTERS[1];
}

export function matchesSimplifiedStageFilter(
  stage: string | null | undefined,
  legacyStatus: string | null | undefined,
  filterValue: string,
): boolean {
  if (filterValue === 'all') return true;

  const normalized = normalizeProjectStage(stage, legacyStatus);
  const filter = SIMPLIFIED_QUOTE_STAGE_FILTERS.find((item) => item.value === filterValue);
  return filter ? filter.stages.includes(normalized) : normalized === filterValue;
}

export function parseValidUntilDate(validUntil?: string | null): Date | null {
  if (!validUntil || validUntil.trim() === '') return null;

  if (validUntil.includes('~')) {
    const parts = validUntil.split('~');
    const endPart = parts[parts.length - 1].trim();
    const nums = endPart.match(/\d+/g);
    if (nums && nums.length >= 3) {
      return new Date(parseInt(nums[0], 10), parseInt(nums[1], 10) - 1, parseInt(nums[2], 10));
    }
  }

  const korMatch = validUntil.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (korMatch) {
    return new Date(parseInt(korMatch[1], 10), parseInt(korMatch[2], 10) - 1, parseInt(korMatch[3], 10));
  }

  const dotMatch = validUntil.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (dotMatch) {
    return new Date(parseInt(dotMatch[1], 10), parseInt(dotMatch[2], 10) - 1, parseInt(dotMatch[3], 10));
  }

  return null;
}

export function isQuoteExpired(validUntil?: string | null, referenceDate = new Date()): boolean {
  const expiryDate = parseValidUntilDate(validUntil);
  if (!expiryDate) return false;

  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  expiryDate.setHours(0, 0, 0, 0);
  return expiryDate < today;
}

export function recalculateValidUntil(
  originalValidUntil: string | null | undefined,
  newQuoteDate: Date,
): string {
  const defaultDays = 14;
  let durationDays = defaultDays;

  if (originalValidUntil?.includes('~')) {
    const parts = originalValidUntil.split('~');
    const startNums = parts[0]?.match(/\d+/g);
    const endDate = parseValidUntilDate(originalValidUntil);
    if (startNums && startNums.length >= 3 && endDate) {
      const startDate = new Date(
        parseInt(startNums[0], 10),
        parseInt(startNums[1], 10) - 1,
        parseInt(startNums[2], 10),
      );
      const diff = Math.round((endDate.getTime() - startDate.getTime()) / 86400000);
      if (diff > 0 && diff < 366) durationDays = diff;
    }
  }

  const nextValidUntil = new Date(newQuoteDate);
  nextValidUntil.setDate(nextValidUntil.getDate() + durationDays);

  return `${newQuoteDate.toLocaleDateString('ko-KR')} ~ ${nextValidUntil.toLocaleDateString('ko-KR')}`;
}
