export type QuoteStyleType = 'panel' | 'fabrication' | 'space' | 'mixed';

export interface QuoteStyleProfile {
  type: QuoteStyleType;
  label: string;
  title: string;
  subtitle: string;
  description: string;
  itemListTitle: string;
  customerItemListTitle: string;
  basisLabel: string;
  chips: string[];
  badgeClassName: string;
  panelClassName: string;
}

const QUOTE_STYLE_PROFILES: Record<QuoteStyleType, QuoteStyleProfile> = {
  panel: {
    type: 'panel',
    label: '판재 기준',
    title: '아크릴 판재 견적서',
    subtitle: 'Panel Material Quotation',
    description: '판재 단가, 두께/색상, 규격, 가공 옵션을 기준으로 산출한 견적입니다.',
    itemListTitle: '판재 견적 항목',
    customerItemListTitle: '견적 상세 내역',
    basisLabel: '판재 단가 기준',
    chips: ['원판/판재', '두께/색상', '가공 옵션'],
    badgeClassName: 'bg-blue-50 text-blue-700 border-blue-200',
    panelClassName: 'bg-blue-50/60 border-blue-200',
  },
  fabrication: {
    type: 'fabrication',
    label: '제품 제작 기준',
    title: '제품 제작 견적서',
    subtitle: 'Fabrication Quotation',
    description: '완제품 형태, 제작 난이도, 작업 판단과 수량을 반영해 산출한 견적입니다.',
    itemListTitle: '제품 제작 항목',
    customerItemListTitle: '제작 견적 상세 내역',
    basisLabel: '엔지니어 판단 기준',
    chips: ['완제품', '난이도 판단', '수동 단가'],
    badgeClassName: 'bg-amber-50 text-amber-700 border-amber-200',
    panelClassName: 'bg-amber-50/60 border-amber-200',
  },
  space: {
    type: 'space',
    label: '공간 기준',
    title: '공간 프로젝트 견적서',
    subtitle: 'Space Project Quotation',
    description: '공간 규모, 구역별 항목, 디자인/시공/자재 범위를 기준으로 산출한 견적입니다.',
    itemListTitle: '공간 시공 항목',
    customerItemListTitle: '공간 견적 상세 내역',
    basisLabel: '공간 프로젝트 기준',
    chips: ['공간 규모', '구역별 항목', '시공 범위'],
    badgeClassName: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    panelClassName: 'bg-emerald-50/60 border-emerald-200',
  },
  mixed: {
    type: 'mixed',
    label: '복합 기준',
    title: '복합 견적서',
    subtitle: 'Mixed Quotation',
    description: '판재 계산 항목과 제품 제작 판단 항목이 함께 포함된 견적입니다.',
    itemListTitle: '복합 견적 항목',
    customerItemListTitle: '복합 견적 상세 내역',
    basisLabel: '판재 + 제작 기준',
    chips: ['판재 계산', '제품 제작', '혼합 항목'],
    badgeClassName: 'bg-slate-100 text-slate-700 border-slate-300',
    panelClassName: 'bg-slate-50 border-slate-200',
  },
};

export const getQuoteStyleProfile = (type: QuoteStyleType = 'panel') => {
  return QUOTE_STYLE_PROFILES[type] || QUOTE_STYLE_PROFILES.panel;
};

export const isFabricationQuoteItem = (item: any): boolean => {
  const snapshot = item?.calculationSnapshot || item?.calculation_snapshot;
  const selectedOptions = snapshot?.selectedOptions || snapshot?.selected_options || {};

  return (
    item?.quoteStyle === 'fabrication'
    || item?.quote_style === 'fabrication'
    || item?.material === '제품 제작'
    || item?.processing === 'manual'
    || Boolean(selectedOptions?.manualProductItem)
    || Boolean(snapshot?.manualProductItem)
  );
};

export const getQuoteStyleForItem = (item: any): QuoteStyleType => {
  return isFabricationQuoteItem(item) ? 'fabrication' : 'panel';
};

export const detectQuoteStyleFromItems = (items: any[] = []): QuoteStyleType => {
  const normalizedItems = Array.isArray(items) ? items.filter(Boolean) : [];

  if (normalizedItems.length === 0) {
    return 'panel';
  }

  const fabricationCount = normalizedItems.filter(isFabricationQuoteItem).length;

  if (fabricationCount === 0) {
    return 'panel';
  }

  if (fabricationCount === normalizedItems.length) {
    return 'fabrication';
  }

  return 'mixed';
};
