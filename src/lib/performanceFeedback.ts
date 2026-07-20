export const STRENGTH_FEEDBACK_OPTIONS = [
  '업무 정확도가 안정적입니다',
  '일정과 마감 공유가 좋습니다',
  '고객 응대가 차분합니다',
  '협업 요청에 빠르게 반응합니다',
  '문서와 기록 정리가 좋습니다',
  '문제 상황을 스스로 정리합니다',
  '품질 확인 습관이 좋습니다',
  '업무 우선순위 판단이 좋습니다',
];

export const IMPROVEMENT_FEEDBACK_OPTIONS = [
  '진행 상황 공유 빈도를 높이면 좋겠습니다',
  '마감 전 검수 기준을 더 명확히 하면 좋겠습니다',
  '업무 우선순위 정리가 더 필요합니다',
  '고객 요청사항 기록을 더 꼼꼼히 남기면 좋겠습니다',
  '협업자에게 필요한 정보를 더 일찍 공유하면 좋겠습니다',
  '반복 업무의 체크리스트 활용이 필요합니다',
  '예외 상황 보고 기준을 더 명확히 하면 좋겠습니다',
  '작업 완료 후 후속 확인이 더 필요합니다',
];

export const NEXT_ACTION_FEEDBACK_OPTIONS = [
  '주간 업무 우선순위를 먼저 공유하기',
  '마감 전 자체 체크리스트 확인하기',
  '고객 요청사항을 한 곳에 정리하기',
  '진행 지연 가능성을 빠르게 알리기',
  '업무 완료 후 결과와 다음 단계를 남기기',
  '반복 실수를 줄이기 위한 기준표 만들기',
];

export const SCORE_EVIDENCE_OPTIONS = [
  '정확도',
  '속도',
  '공유',
  '협업',
  '고객 응대',
  '문서화',
  '문제 해결',
  '완료 후 확인',
];

export const PERFORMANCE_COMPETENCY_AXES = [
  {
    key: 'execution',
    name: '업무 수행력',
    description: '담당 업무를 이해하고 안정적으로 실행하는 능력',
    evidenceOptions: ['업무 이해', '처리량', '실행력', '우선순위', '마감 준수', '재작업 감소'],
  },
  {
    key: 'quality',
    name: '정확도/품질',
    description: '오류를 줄이고 결과물 품질을 일정하게 유지하는 능력',
    evidenceOptions: ['정확도', '검수 습관', '오탈자 감소', '견적 오류 방지', '도면 확인', '완료 후 확인'],
  },
  {
    key: 'speed',
    name: '속도/납기 대응',
    description: '업무 속도, 납기 대응, 일정 리스크를 관리하는 능력',
    evidenceOptions: ['속도', '납기 관리', '빠른 응대', '지연 공유', '병목 해소', '일정 조정'],
  },
  {
    key: 'collaboration',
    name: '협업/소통',
    description: '팀원, 고객, 협업자와 필요한 정보를 명확히 주고받는 능력',
    evidenceOptions: ['공유', '협업', '고객 응대', '인수인계', '내부 소통', '갈등 완화'],
  },
  {
    key: 'ownership',
    name: '책임감/자기관리',
    description: '시간, 약속, 기록, 후속 확인을 책임 있게 관리하는 태도',
    evidenceOptions: ['시간 준수', '책임감', '문서화', '후속 확인', '자기 점검', '기록 정리'],
  },
  {
    key: 'problem_solving',
    name: '문제 해결력',
    description: '예상치 못한 문제를 파악하고 현실적인 대안을 제시하는 능력',
    evidenceOptions: ['문제 해결', '원인 분석', '대안 제시', '예외 처리', '개선 제안', '리스크 감지'],
  },
] as const;

export const PERFORMANCE_SCORE_GUIDE = [
  { score: 1, label: '1점', description: '반복 누락이 잦고 지속적인 지원이 필요합니다.' },
  { score: 3, label: '3점', description: '기본 수행은 가능하나 재작업이나 확인 지원이 자주 필요합니다.' },
  { score: 5, label: '5점', description: '업무 기준을 충족하며 일반 업무를 독립적으로 처리합니다.' },
  { score: 7, label: '7점', description: '안정적인 품질과 속도로 예외 상황 일부까지 대응합니다.' },
  { score: 9, label: '9점', description: '팀의 기준을 높이고 개선 또는 타인 지원까지 주도합니다.' },
] as const;

export interface PerformanceCategoryLike {
  id: string;
  name: string;
  description?: string | null;
}

export type ObjectiveReviewCategory<T extends PerformanceCategoryLike> = T & {
  objectiveKey: string;
  objectiveName: string;
  objectiveDescription: string;
  evidenceOptions: string[];
  originalName: string;
};

const categoryKeywordMap: Array<{ keywords: string[]; axisIndex: number }> = [
  { keywords: ['수행', '전문', '실행'], axisIndex: 0 },
  { keywords: ['정확', '품질', '꼼꼼'], axisIndex: 1 },
  { keywords: ['속도', '납기', '일정'], axisIndex: 2 },
  { keywords: ['협업', '소통', '커뮤니케이션', '고객'], axisIndex: 3 },
  { keywords: ['책임', '성실', '자기', '시간'], axisIndex: 4 },
  { keywords: ['문제', '해결', '개선'], axisIndex: 5 },
];

const usedAxisIndexesFor = <T extends PerformanceCategoryLike>(categories: T[], currentIndex: number) =>
  categories.slice(0, currentIndex).map((category, index) => {
    const matched = categoryKeywordMap.find(({ keywords }) => keywords.some(keyword => category.name.includes(keyword)));
    return matched?.axisIndex ?? index % PERFORMANCE_COMPETENCY_AXES.length;
  });

export const getObjectiveReviewCategories = <T extends PerformanceCategoryLike>(categories: T[]): ObjectiveReviewCategory<T>[] =>
  categories.slice(0, PERFORMANCE_COMPETENCY_AXES.length).map((category, index) => {
    const matched = categoryKeywordMap.find(({ keywords }) => keywords.some(keyword => category.name.includes(keyword)));
    const usedIndexes = usedAxisIndexesFor(categories, index);
    let axisIndex = matched?.axisIndex ?? index % PERFORMANCE_COMPETENCY_AXES.length;

    if (usedIndexes.includes(axisIndex)) {
      axisIndex = PERFORMANCE_COMPETENCY_AXES.findIndex((_, candidateIndex) => !usedIndexes.includes(candidateIndex));
      if (axisIndex < 0) axisIndex = index % PERFORMANCE_COMPETENCY_AXES.length;
    }

    const axis = PERFORMANCE_COMPETENCY_AXES[axisIndex];
    return {
      ...category,
      objectiveKey: axis.key,
      objectiveName: axis.name,
      objectiveDescription: axis.description,
      evidenceOptions: [...axis.evidenceOptions],
      originalName: category.name,
    };
  });

export const getScoreGuideForScore = (score: number) => {
  const nearest = PERFORMANCE_SCORE_GUIDE.reduce((closest, item) =>
    Math.abs(item.score - score) < Math.abs(closest.score - score) ? item : closest,
  );
  return nearest;
};

export const SAFE_PERFORMANCE_FEEDBACK_OPTIONS = new Set([
  ...STRENGTH_FEEDBACK_OPTIONS,
  ...IMPROVEMENT_FEEDBACK_OPTIONS,
  ...NEXT_ACTION_FEEDBACK_OPTIONS,
  ...SCORE_EVIDENCE_OPTIONS,
  ...PERFORMANCE_COMPETENCY_AXES.flatMap(axis => axis.evidenceOptions),
]);

export const splitFeedbackText = (value?: string | null) =>
  (value || '')
    .split(/\n|,/)
    .map(item => item.trim().replace(/^[-•]\s*/, ''))
    .filter(Boolean);

export const serializeFeedbackSelections = (items: string[]) => items.join('\n');

export const toggleFeedbackSelection = (items: string[], value: string) =>
  items.includes(value) ? items.filter(item => item !== value) : [...items, value];

export const keepStructuredFeedbackOnly = (value?: string | null) =>
  serializeFeedbackSelections(
    splitFeedbackText(value).filter(item => SAFE_PERFORMANCE_FEEDBACK_OPTIONS.has(item)),
  );

export const summarizeStructuredFeedback = (
  entries: Array<string | null | undefined>,
  fallback: string,
  maxItems = 6,
) => {
  const counts = new Map<string, number>();

  entries.forEach(entry => {
    splitFeedbackText(entry)
      .filter(item => SAFE_PERFORMANCE_FEEDBACK_OPTIONS.has(item))
      .forEach(item => counts.set(item, (counts.get(item) || 0) + 1));
  });

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (sorted.length === 0) return fallback;

  return sorted
    .slice(0, maxItems)
    .map(([label, count]) => `- ${label}${count > 1 ? ` (${count}회 선택)` : ''}`)
    .join('\n');
};
