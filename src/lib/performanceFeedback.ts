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

export const SAFE_PERFORMANCE_FEEDBACK_OPTIONS = new Set([
  ...STRENGTH_FEEDBACK_OPTIONS,
  ...IMPROVEMENT_FEEDBACK_OPTIONS,
  ...NEXT_ACTION_FEEDBACK_OPTIONS,
  ...SCORE_EVIDENCE_OPTIONS,
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
