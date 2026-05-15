export type BubbleFreeBoxJointAngle = '45' | '90';
export type BubbleFreeBoxComplexity = 'standard' | 'polygon' | 'precision';

export interface BubbleFreeBoxPricingInput {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  thicknessMm: number;
  quantity: number;
  panelUnitPrice: number;
  manualSheetCount?: number;
  jointAngle: BubbleFreeBoxJointAngle;
  complexity: BubbleFreeBoxComplexity;
}

export interface BubbleFreeBoxPricingBreakdownItem {
  label: string;
  price: number;
}

export interface BubbleFreeBoxPricingResult {
  feasible: boolean;
  reviewRequired: boolean;
  warnings: string[];
  automaticSheetCount: number;
  sheetCount: number;
  materialCostTotal: number;
  materialCostPerUnit: number;
  sizeMultiplier: number;
  jointMultiplier: number;
  complexityMultiplier: number;
  quantityFactor: number;
  minimumUnitPrice: number;
  recommendedUnitPrice: number;
  totalPrice: number;
  breakdown: BubbleFreeBoxPricingBreakdownItem[];
}

const PANEL_4X8 = {
  label: '4*8',
  widthMm: 1250,
  heightMm: 2450,
};

const roundUp = (value: number, unit = 1000) => Math.ceil(value / unit) * unit;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const interpolate = (value: number, start: number, end: number, startResult: number, endResult: number) => {
  const t = clamp((value - start) / (end - start), 0, 1);
  return startResult + (endResult - startResult) * t;
};

const getSizeMultiplier = (maxSideMm: number) => {
  if (maxSideMm <= 350) return 3.35;
  if (maxSideMm <= 400) return interpolate(maxSideMm, 350, 400, 3.35, 3.8);
  if (maxSideMm <= 650) return interpolate(maxSideMm, 400, 650, 3.8, 5.8);
  if (maxSideMm <= 750) return interpolate(maxSideMm, 650, 750, 5.8, 6.8);
  return 7.2;
};

const getMinimumUnitPrice = (maxSideMm: number) => {
  if (maxSideMm <= 400) return 300_000;
  if (maxSideMm <= 650) return interpolate(maxSideMm, 400, 650, 300_000, 525_000);
  if (maxSideMm <= 750) return interpolate(maxSideMm, 650, 750, 525_000, 650_000);
  return 0;
};

const getComplexityMultiplier = (complexity: BubbleFreeBoxComplexity) => {
  if (complexity === 'polygon') return 1.25;
  if (complexity === 'precision') return 1.45;
  return 1;
};

const getQuantityFactor = (quantity: number) => {
  if (quantity <= 1) return 1;
  return Math.max(0.86, 1 - Math.log(quantity) * 0.04);
};

const getWasteFactor = (complexity: BubbleFreeBoxComplexity) => {
  if (complexity === 'polygon') return 1.18;
  if (complexity === 'precision') return 1.25;
  return 1.08;
};

export const calculateBubbleFreeBoxPricing = ({
  widthMm,
  depthMm,
  heightMm,
  thicknessMm,
  quantity,
  panelUnitPrice,
  manualSheetCount,
  jointAngle,
  complexity,
}: BubbleFreeBoxPricingInput): BubbleFreeBoxPricingResult => {
  const safeQuantity = Math.max(1, Math.floor(quantity || 1));
  const maxSideMm = Math.max(widthMm || 0, depthMm || 0, heightMm || 0);
  const panelArea = PANEL_4X8.widthMm * PANEL_4X8.heightMm;
  const faceAreaPerUnit = 2 * ((widthMm * depthMm) + (widthMm * heightMm) + (depthMm * heightMm));
  const grossArea = Math.max(0, faceAreaPerUnit * safeQuantity);
  const automaticSheetCount = Math.max(1, Math.ceil((grossArea * getWasteFactor(complexity)) / panelArea));
  const sheetCount = manualSheetCount && manualSheetCount > 0
    ? Math.max(1, Math.ceil(manualSheetCount))
    : automaticSheetCount;

  const materialCostTotal = Math.max(0, panelUnitPrice || 0) * sheetCount;
  const materialCostPerUnit = materialCostTotal / safeQuantity;
  const sizeMultiplier = getSizeMultiplier(maxSideMm);
  const jointMultiplier = jointAngle === '90' ? 1.22 : 1;
  const complexityMultiplier = getComplexityMultiplier(complexity);
  const quantityFactor = getQuantityFactor(safeQuantity);
  const minimumUnitPrice = getMinimumUnitPrice(maxSideMm);

  const warnings: string[] = [];
  let feasible = true;
  let reviewRequired = false;

  if (!widthMm || !depthMm || !heightMm) {
    feasible = false;
    warnings.push('가로, 세로, 높이를 모두 입력해야 합니다.');
  }

  if (!thicknessMm || thicknessMm <= 0) {
    feasible = false;
    warnings.push('두께를 입력해야 합니다.');
  }

  if (thicknessMm <= 5 && maxSideMm >= 800) {
    feasible = false;
    warnings.push('5T 이하 800mm급 6면체 박스는 강성 부족으로 제작 불가 처리합니다.');
  } else if (thicknessMm <= 5 && maxSideMm >= 700) {
    reviewRequired = true;
    warnings.push('5T 700mm 이상 박스는 처짐/휘어짐 리스크가 있어 관리자 확인이 필요합니다.');
  }

  if (thicknessMm < 5 && maxSideMm >= 600) {
    feasible = false;
    warnings.push('5T 미만 600mm 이상 박스는 제작 안정성이 낮아 제작 불가로 보는 것이 안전합니다.');
  }

  const materialBasedUnitPrice = materialCostPerUnit * sizeMultiplier;
  const benchmarkUnitPrice = Math.max(materialBasedUnitPrice, minimumUnitPrice);
  const adjustedUnitPrice = benchmarkUnitPrice * jointMultiplier * complexityMultiplier * quantityFactor;
  const recommendedUnitPrice = feasible ? roundUp(adjustedUnitPrice) : 0;
  const totalPrice = recommendedUnitPrice * safeQuantity;

  const fabricationCost = Math.max(0, totalPrice - materialCostTotal);
  const breakdown = feasible
    ? [
        {
          label: `${PANEL_4X8.label} 원판 ${sheetCount}장 x ${Math.max(0, panelUnitPrice || 0).toLocaleString()}원`,
          price: materialCostTotal,
        },
        {
          label: `무기포 ${jointAngle}도 박스 제작 공임/리스크`,
          price: fabricationCost,
        },
      ]
    : [];

  return {
    feasible,
    reviewRequired,
    warnings,
    automaticSheetCount,
    sheetCount,
    materialCostTotal,
    materialCostPerUnit,
    sizeMultiplier,
    jointMultiplier,
    complexityMultiplier,
    quantityFactor,
    minimumUnitPrice,
    recommendedUnitPrice,
    totalPrice,
    breakdown,
  };
};
