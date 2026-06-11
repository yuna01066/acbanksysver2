export type BrandingPackageId = 'basic' | 'standard' | 'open';
export type BrandingLeadTimeId = 'normal' | 'fast' | 'urgent';
export type BrandingOptimizationId = 'none' | 'basic' | 'launch' | 'expand';
export type BrandingAddonId =
  | 'story'
  | 'prints'
  | 'signageBasicDesign'
  | 'signageComplexDesign'
  | 'standingSignDesign'
  | 'webConcept'
  | 'webDesign'
  | 'webOpen'
  | 'webAiImages'
  | 'packageGoodsProduction';

export type BrandingAddon = {
  id: string;
  group: 'brand' | 'signageDesign' | 'web' | 'production';
  label: string;
  description: string;
  price: number;
  review?: boolean;
  separate?: boolean;
};

export type BrandingPricingInput = {
  packageId: BrandingPackageId;
  leadTimeId: BrandingLeadTimeId;
  optimizationTierId: BrandingOptimizationId;
  selectedAddons: string[];
  productionCost?: number;
  pmRate?: number;
};

export type BrandingPricingResult = {
  packageName: string;
  packagePrice: number;
  optimizationName: string;
  optimizationPrice: number;
  selectedAddons: BrandingAddon[];
  addonTotal: number;
  designBeforeRush: number;
  leadTimeName: string;
  leadTimeRate: number;
  rushFee: number;
  designTotal: number;
  productionCost: number;
  pmRate: number;
  pmFee: number;
  internalTotal: number;
  needsReview: boolean;
  customerEstimateText: string;
  internalBreakdown: string;
  separateReviewItems: string[];
  customerMessage: string;
  internalMessage: string;
};

export const brandingPackages = {
  basic: {
    id: 'basic',
    name: '브랜드 기본형',
    price: 220,
    summary: '브랜드를 시작하기 위한 최소 기준과 시각 방향을 정리합니다.',
    recommendedFor: '이미 이름이나 운영 방향은 있고, 로고·컬러·폰트 기준을 먼저 정리해야 하는 경우',
    includes: [
      '브랜드 방향성 정리',
      '레퍼런스 무드보드',
      '키 컬러/보조 컬러 제안',
      '폰트 방향 제안',
      '로고·심볼 기본 사용 가이드',
      '1p 브랜드 가이드 문서',
    ],
  },
  standard: {
    id: 'standard',
    name: '브랜드 런칭형',
    price: 440,
    summary: '브랜드 공개와 상담/소개에 필요한 기본 표현까지 구성합니다.',
    recommendedFor: '신규 런칭, 리브랜딩, 매장/서비스 오픈 전 고객에게 보여줄 문구와 적용 방향이 필요한 경우',
    includes: [
      '기본형 전체 포함',
      '네이밍/슬로건 방향 제안',
      '브랜드 스토리 초안',
      '브랜드 소개 문구',
      '고객 응대/상담 기본 카피',
      '사인 또는 공간 적용 방향 1종',
      '런칭 준비 체크리스트',
    ],
  },
  open: {
    id: 'open',
    name: '브랜드 오픈형',
    price: 880,
    summary: '오픈에 맞춰 웹·홍보물·제작 전달 방향까지 통합 구성합니다.',
    recommendedFor: '오픈 일정이 정해져 있고, 웹/홍보/사인/제작 전달 자료를 한 번에 정리해야 하는 경우',
    includes: [
      '런칭형 전체 포함',
      '홈페이지 3p 구성/톤앤매너 방향',
      '브랜드 톤 AI 이미지 5컷 방향',
      '홍보물 2종 디자인 방향',
      '사인/공간/매체 적용 검토',
      '제작·시공 전달용 기본안',
      '오픈 전 적용 항목 검수',
    ],
  },
} as const;

export const brandingLeadTimes = {
  normal: { id: 'normal', name: '일반 진행', label: '4-8주 소요', rate: 0 },
  fast: { id: 'fast', name: '빠른 진행', label: '2-3주 소요', rate: 0.15 },
  urgent: { id: 'urgent', name: '긴급 진행', label: '1-2주 소요', rate: 0.3 },
} as const;

export const brandingOptimizationTiers = {
  none: { id: 'none', name: '선택 안 함', price: 0, summary: '검색 최적화 산정에서 제외합니다.' },
  basic: { id: 'basic', name: '기본 최적화', price: 120, summary: '3페이지 기준 메타, H1-H3, FAQ 5개, 구조화 데이터 범위 확인' },
  launch: { id: 'launch', name: '런칭 최적화', price: 240, summary: '5페이지 기준 검색 의도 10개, 페이지 카피, AEO Q&A 10개, Organization/Service/Breadcrumb schema' },
  expand: { id: 'expand', name: '확장 최적화', price: 420, summary: '8페이지 기준 질문 클러스터, fact block, 내부 링크, 구조화 데이터/Search Console 체크' },
} as const;

export const brandingAddons: BrandingAddon[] = [
  { id: 'story', group: 'brand', label: '브랜드 스토리 보강', description: '소개글, 브랜드 톤, 기본 응대 문구를 보강합니다.', price: 80 },
  { id: 'prints', group: 'brand', label: '인쇄물 2종 디자인', description: '명함, 리플렛, 메뉴판 등 기본 인쇄물 방향을 잡습니다.', price: 120 },
  { id: 'signageBasicDesign', group: 'signageDesign', label: '기본 사인 디자인', description: '간판/현판류 1종 디자인 방향입니다.', price: 120 },
  { id: 'signageComplexDesign', group: 'signageDesign', label: '복합 사인 디자인', description: '여러 위치 또는 복합 사인 계획이 필요한 경우입니다.', price: 240, review: true },
  { id: 'standingSignDesign', group: 'signageDesign', label: '입간판/스탠딩 사인', description: '오프라인 유도 사인 디자인 방향입니다.', price: 90 },
  { id: 'webConcept', group: 'web', label: '웹 컨셉 보드', description: '홈페이지 톤앤매너와 핵심 화면 방향을 정리합니다.', price: 160 },
  { id: 'webDesign', group: 'web', label: '웹 상세 디자인', description: '주요 페이지 디자인을 더 구체화합니다.', price: 280, review: true },
  { id: 'webOpen', group: 'web', label: '웹 오픈 지원', description: '실제 구축·오픈 지원은 범위 확인 후 별도 산정합니다.', price: 0, separate: true },
  { id: 'webAiImages', group: 'web', label: 'AI 이미지 추가 제작', description: '브랜드 톤에 맞춘 AI 이미지를 추가 제작합니다.', price: 60 },
  { id: 'packageGoodsProduction', group: 'production', label: '패키지/굿즈 제작 검토', description: '실제 제작비는 사양 확인 후 별도 견적입니다.', price: 0, review: true, separate: true },
];

const addonGroupNames: Record<BrandingAddon['group'], string> = {
  brand: '브랜드 기본 구성',
  signageDesign: '사인·공간 적용',
  web: '웹·검색 최적화',
  production: '제작 검토',
};

export const BRANDING_PACKAGES = Object.values(brandingPackages).map((item) => ({
  id: item.id as BrandingPackageId,
  name: item.name,
  description: item.summary,
  recommendedFor: item.recommendedFor,
  displayPrice: `${item.price.toLocaleString('ko-KR')}만 원부터`,
  includes: [...item.includes],
}));

export const BRANDING_LEAD_TIMES = Object.values(brandingLeadTimes).map((item) => ({
  id: item.id as BrandingLeadTimeId,
  name: item.name,
  description: item.label,
  rate: item.rate,
}));

export const BRANDING_OPTIMIZATION_TIERS = Object.values(brandingOptimizationTiers).map((item) => ({
  id: item.id as BrandingOptimizationId,
  name: item.name,
  description: item.summary,
  displayPrice: item.price ? `${item.price.toLocaleString('ko-KR')}만 원` : '선택 안 함',
  price: item.price,
}));

export const BRANDING_ADDON_GROUPS = Object.entries(addonGroupNames).map(([group, name]) => ({
  id: group as BrandingAddon['group'],
  name,
  addons: brandingAddons
    .filter((addon) => addon.group === group)
    .map((addon) => ({
      ...addon,
      id: addon.id as BrandingAddonId,
      name: addon.label,
      displayPrice: addon.separate ? '별도 검토' : `${addon.price.toLocaleString('ko-KR')}만 원`,
    })),
}));

export const formatBrandingPrice = (value: number) =>
  `${Math.round(Number(value) || 0).toLocaleString('ko-KR')}만 원 내외`;

const clampProductionCost = (value: unknown) => {
  const next = Number(value || 0);
  if (!Number.isFinite(next) || next < 0) return 0;
  return Math.min(next, 10000);
};

export const calculateBrandingPricing = (input: BrandingPricingInput): BrandingPricingResult => {
  const pkg = brandingPackages[input.packageId] || brandingPackages.basic;
  const leadTime = brandingLeadTimes[input.leadTimeId] || brandingLeadTimes.normal;
  const optimization = brandingOptimizationTiers[input.optimizationTierId] || brandingOptimizationTiers.none;
  const selected = brandingAddons.filter((addon) => input.selectedAddons.includes(addon.id));
  const addonTotal = selected.reduce((sum, addon) => sum + addon.price, 0);
  const designBeforeRush = pkg.price + optimization.price + addonTotal;
  const rushFee = Math.round(designBeforeRush * leadTime.rate);
  const designTotal = designBeforeRush + rushFee;
  const productionCost = clampProductionCost(input.productionCost);
  const pmRate = Math.max(0, Math.min(Number(input.pmRate ?? 0.1), 1));
  const pmFee = Math.round(productionCost * pmRate);
  const internalTotal = designTotal + productionCost + pmFee;
  const needsReview = selected.some((addon) => addon.review || addon.separate) || optimization.id !== 'none' || leadTime.id !== 'normal' || productionCost > 0;

  const selectedSummary = selected.length
    ? selected.map((addon) => `${addon.label}${addon.separate ? '(별도)' : ''}`).join(', ')
    : '선택 옵션 없음';

  const productionNote = '제작비, 인쇄비, 시공비, 제품 제작비는 위 금액에 포함되지 않으며 사양 확인 후 별도 안내드립니다.';
  const trademarkNote = '상표 출원은 외부 전문 파트너 확인이 필요한 항목으로, 현재 위젯에서는 확정 비용을 산정하지 않습니다. 진행 시 별도 견적을 안내드립니다.';

  const customerMessage = [
    `선택하신 구성은 ${pkg.name} 기준입니다.`,
    `예상 범위는 ${formatBrandingPrice(designTotal)}입니다.`,
    `포함 작업은 ${pkg.includes.slice(0, 4).join(', ')}${pkg.includes.length > 4 ? ' 등' : ''}입니다.`,
    `진행 기간은 ${leadTime.label} 기준입니다.`,
    optimization.id !== 'none' ? `검색 최적화는 ${optimization.name} 기준으로 포함했습니다.` : '검색 최적화는 선택하지 않았습니다.',
    selected.length ? `추가 선택 항목: ${selectedSummary}` : '',
    productionNote,
    trademarkNote,
  ].filter(Boolean).join('\n');

  const internalMessage = [
    `[브랜딩 내부 산정]`,
    `패키지: ${pkg.name} / ${formatBrandingPrice(pkg.price)}`,
    `SEO/AEO/GEO: ${optimization.name} / ${formatBrandingPrice(optimization.price)}`,
    `추가 옵션: ${selectedSummary} / ${formatBrandingPrice(addonTotal)}`,
    `납기: ${leadTime.name} (${Math.round(leadTime.rate * 100)}%) / ${formatBrandingPrice(rushFee)}`,
    `고객 안내 예상금액: ${formatBrandingPrice(designTotal)}`,
    `제작비 참고: ${formatBrandingPrice(productionCost)}`,
    `PM 참고: ${Math.round(pmRate * 100)}% / ${formatBrandingPrice(pmFee)}`,
    `내부 검토 총액: ${formatBrandingPrice(internalTotal)}`,
    needsReview ? '검토 필요: 별도 제작/납기/최적화 항목이 포함되어 있습니다.' : '검토 필요 항목 없음',
  ].join('\n');

  return {
    packageName: pkg.name,
    packagePrice: pkg.price,
    optimizationName: optimization.name,
    optimizationPrice: optimization.price,
    selectedAddons: selected,
    addonTotal,
    designBeforeRush,
    leadTimeName: leadTime.name,
    leadTimeRate: leadTime.rate,
    rushFee,
    designTotal,
    productionCost,
    pmRate,
    pmFee,
    internalTotal,
    needsReview,
    customerEstimateText: formatBrandingPrice(designTotal),
    internalBreakdown: internalMessage,
    separateReviewItems: selected.filter((addon) => addon.review || addon.separate).map((addon) => addon.label),
    customerMessage,
    internalMessage,
  };
};
