export const PORTFOLIO_CATEGORY_FILTERS = [
  { key: 'all', label: '전체', keywords: [] },
  { key: 'interior', label: '인테리어', keywords: ['인테리어', '공간', '로비', '매장', '쇼룸', '오피스', '팝업'] },
  { key: 'fabrication', label: '제작가공', keywords: ['제작가공', '제작', '가공', '레이저', 'cnc', '절곡', '접합'] },
  { key: 'detail', label: '디테일', keywords: ['디테일', '마감', '코너', '접착', '모서리'] },
  { key: 'signage', label: '사인/디스플레이', keywords: ['사인', '디스플레이', '진열', '전시', '팝업'] },
  { key: 'etc', label: '기타', keywords: ['기타'] },
] as const;

export type PortfolioCategoryKey = typeof PORTFOLIO_CATEGORY_FILTERS[number]['key'];

export function getPortfolioCategoryKeywords(categoryKey: string): string[] {
  return [...(PORTFOLIO_CATEGORY_FILTERS.find(filter => filter.key === categoryKey)?.keywords || [])];
}

export function getPortfolioCategoryKey(value?: string | null): PortfolioCategoryKey {
  if (!value) return 'all';
  const normalized = value.trim().toLowerCase();
  const matched = PORTFOLIO_CATEGORY_FILTERS.find(filter => (
    filter.key === normalized || filter.label.toLowerCase() === normalized
  ));
  return matched?.key || 'all';
}

export function getPortfolioCategoryLabel(categoryKey: string): string {
  return PORTFOLIO_CATEGORY_FILTERS.find(filter => filter.key === categoryKey)?.label || '전체';
}
