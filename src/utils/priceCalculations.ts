
import { CASTING_QUALITIES } from "@/types/calculator";
import { PricingData, createPriceKey } from "@/types/pricing";
import { 
  glossyColorSinglePrices, 
  glossyStandardSinglePrices, 
  astelColorSinglePrices,
  satinColorSinglePrices,
  tapePrices,
  astelDoubleSideSurcharge,
  satinDoubleSideSurcharge,
  jinbaekPrices 
} from "@/data/glossyColorPricing";

export type CalculationStatus = 'calculable' | 'needs_review' | 'blocked';
export const PRICING_ENGINE_V2_VERSION = 'pricing-engine-v2-core-260520' as const;
export const FORMULA_DOC_VERSION = 260520 as const;

export type CalculationLineItemSource =
  | 'panel'
  | 'surcharge'
  | 'processing'
  | 'adhesion'
  | 'additional'
  | 'post_processing'
  | 'mirror'
  | 'outsourcing'
  | 'validation'
  | 'manual';

export interface CalculationLineItem {
  code: string;
  label: string;
  amount: number;
  source: CalculationLineItemSource;
  reason?: string;
}

export interface PriceBreakdownItem {
  label: string;
  price: number;
  code?: string;
  source?: CalculationLineItemSource;
  reason?: string;
}

export interface CalculatePriceResult {
  totalPrice: number;
  breakdown: PriceBreakdownItem[];
  status: CalculationStatus;
  lineItems: CalculationLineItem[];
  warnings: string[];
  blockedReasons: string[];
  snapshotVersion: typeof PRICING_ENGINE_V2_VERSION;
  formulaDocVersion: typeof FORMULA_DOC_VERSION;
}

export type ProcessingPricingMethod =
  | 'legacy_multiplier'
  | 'fixed_fee'
  | 'panel_multiplier'
  | 'panel_rate'
  | 'per_unit'
  | 'per_meter'
  | 'per_corner'
  | 'requires_review';

const slugifyCalculationCode = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'calculation-item';

export const classifyCalculationLineItem = (
  item: Pick<PriceBreakdownItem, 'label' | 'source'>
): CalculationLineItemSource => {
  if (item.source) return item.source;

  const label = item.label;
  if (/생산 불가|단가 미등록|지원되지 않는|검수/.test(label)) return 'validation';
  if (/미러|증착|하드코팅/.test(label)) return 'mirror';
  if (/불광|경면|유광 엣지|엣지/.test(label)) return 'post_processing';
  if (/원판 단독 구매|레이저|CNC|재단|가공/.test(label)) return 'processing';
  if (/접착|무기포|본드|45°|90°/.test(label)) return 'adhesion';
  if (/타공|도장|마감/.test(label)) return 'additional';
  if (/양단면|조색비|추가금액|추가금|사틴|아스텔|브라이트|진백|스리/.test(label)) return 'surcharge';
  if (/기본가|색상판|보급판|CLEAR|원장 #/.test(label)) return 'panel';

  return 'manual';
};

const normalizeCalculationResult = (
  totalPrice: number,
  breakdown: PriceBreakdownItem[],
  warnings: string[] = [],
  blockedReasons: string[] = []
): CalculatePriceResult => {
  const lineItems = breakdown.map((item, index) => ({
    code: item.code || `${classifyCalculationLineItem(item)}-${slugifyCalculationCode(item.label)}-${index + 1}`,
    label: item.label,
    amount: item.price,
    source: classifyCalculationLineItem(item),
    reason: item.reason,
  }));

  return {
    totalPrice,
    breakdown,
    status: blockedReasons.length > 0 ? 'blocked' : warnings.length > 0 ? 'needs_review' : 'calculable',
    lineItems,
    warnings,
    blockedReasons,
    snapshotVersion: PRICING_ENGINE_V2_VERSION,
    formulaDocVersion: FORMULA_DOC_VERSION,
  };
};

export const initializeGlossyColorPrices = (): PricingData => {
  const initialPrices: PricingData = {};
  const glossyColorQuality = CASTING_QUALITIES.find(q => q.id === 'glossy-color');
  
  if (glossyColorQuality) {
    Object.entries(glossyColorSinglePrices).forEach(([thickness, sizeData]) => {
      if (glossyColorQuality.thicknesses.includes(thickness)) {
        Object.entries(sizeData).forEach(([size, price]) => {
          if (glossyColorQuality.sizes.includes(size)) {
            // 단면 가격 설정
            const singleKey = createPriceKey('casting', 'glossy-color', thickness, size, '단면');
            initialPrices[singleKey] = price;
            
            // 양면 가격 설정 (단면 가격 + 양단면 추가금)
            const tapePrice = tapePrices[size as keyof typeof tapePrices] || 0;
            if (tapePrice > 0) {
              const doubleKey = createPriceKey('casting', 'glossy-color', thickness, size, '양면');
              initialPrices[doubleKey] = price + tapePrice;
            }
          }
        });
      }
    });
  }

  return initialPrices;
};

export const initializeAstelColorPrices = (): PricingData => {
  const initialPrices: PricingData = {};
  const astelColorQuality = CASTING_QUALITIES.find(q => q.id === 'astel-color');
  
  if (astelColorQuality) {
    Object.entries(astelColorSinglePrices).forEach(([thickness, sizeData]) => {
      if (astelColorQuality.thicknesses.includes(thickness)) {
        Object.entries(sizeData).forEach(([size, price]) => {
          if (astelColorQuality.sizes.includes(size)) {
            const thicknessValue = parseFloat(thickness.replace('T', ''));
            
            // 소1*2 특별 규칙: 6T 이하는 단면만, 8T 이상은 양면만
            if (size === '소1*2') {
              if (thicknessValue <= 6) {
                // 6T 이하: 단면만 (기본 가격 + 아스텔 추가금액)
                const astelSurcharge = astelDoubleSideSurcharge[size as keyof typeof astelDoubleSideSurcharge] || 0;
                const singleKey = createPriceKey('casting', 'astel-color', thickness, size, '단면');
                initialPrices[singleKey] = price + astelSurcharge;
              } else {
                // 8T 이상: 양면만 (기본 가격 + 양단면 + 아스텔 추가금액)
                const tapePrice = tapePrices[size as keyof typeof tapePrices] || 0;
                const astelSurcharge = astelDoubleSideSurcharge[size as keyof typeof astelDoubleSideSurcharge] || 0;
                const doubleKey = createPriceKey('casting', 'astel-color', thickness, size, '양면');
                initialPrices[doubleKey] = price + tapePrice + astelSurcharge;
              }
            } else {
              // 다른 사이즈는 기존 로직 적용
              // 단면 가격 설정 (기본 가격 + 아스텔 추가금액)
              const astelSurcharge = astelDoubleSideSurcharge[size as keyof typeof astelDoubleSideSurcharge] || 0;
              const singleKey = createPriceKey('casting', 'astel-color', thickness, size, '단면');
              initialPrices[singleKey] = price + astelSurcharge;
              
              // 양면 가격 설정 (기본 가격 + 양단면 + 아스텔 추가금액)
              const tapePrice = tapePrices[size as keyof typeof tapePrices] || 0;
              if (tapePrice > 0) {
                const doubleKey = createPriceKey('casting', 'astel-color', thickness, size, '양면');
                initialPrices[doubleKey] = price + tapePrice + astelSurcharge;
              }
            }
          }
        });
      }
    });
  }

  return initialPrices;
};

export const initializeSatinColorPrices = (): PricingData => {
  const initialPrices: PricingData = {};
  const satinColorQuality = CASTING_QUALITIES.find(q => q.id === 'satin-color');
  
  if (satinColorQuality) {
    Object.entries(satinColorSinglePrices).forEach(([thickness, sizeData]) => {
      if (satinColorQuality.thicknesses.includes(thickness)) {
        Object.entries(sizeData).forEach(([size, price]) => {
          if (satinColorQuality.sizes.includes(size)) {
            // 단면 가격 설정
            const singleKey = createPriceKey('casting', 'satin-color', thickness, size, '단면');
            initialPrices[singleKey] = price;
            
            // 양면 가격 설정 (단면 가격 + 사틴 양면 추가금액)
            const doubleSideSurcharge = satinDoubleSideSurcharge[size as keyof typeof satinDoubleSideSurcharge] || 0;
            if (doubleSideSurcharge > 0) {
              const doubleKey = createPriceKey('casting', 'satin-color', thickness, size, '양면');
              initialPrices[doubleKey] = price + doubleSideSurcharge;
            }
          }
        });
      }
    });
  }

  return initialPrices;
};

export const initializeGlossyStandardPrices = (): PricingData => {
  const initialPrices: PricingData = {};
  const glossyStandardQuality = CASTING_QUALITIES.find(q => q.id === 'glossy-standard');
  
  if (glossyStandardQuality) {
    Object.entries(glossyStandardSinglePrices).forEach(([thickness, sizeData]) => {
      if (glossyStandardQuality.thicknesses.includes(thickness)) {
        Object.entries(sizeData).forEach(([size, price]) => {
          if (glossyStandardQuality.sizes.includes(size)) {
            // 컬러 단면 가격 설정
            const colorSingleKey = createPriceKey('casting', 'glossy-standard', thickness, size, '단면', '컬러');
            initialPrices[colorSingleKey] = price;
            
            // 컬러 양면 가격 설정 (단면 가격 + 양단면 추가금)
            const tapePrice = tapePrices[size as keyof typeof tapePrices] || 0;
            if (tapePrice > 0) {
              const colorDoubleKey = createPriceKey('casting', 'glossy-standard', thickness, size, '양면', '컬러');
              initialPrices[colorDoubleKey] = price + tapePrice;
            }

            // 진백 단면 가격 설정 (기본 가격 + 진백 추가 가격)
            const jinbaekPrice = jinbaekPrices[size as keyof typeof jinbaekPrices] || 0;
            if (jinbaekPrice > 0) {
              const jinbaekSingleKey = createPriceKey('casting', 'glossy-standard', thickness, size, '단면', '진백');
              initialPrices[jinbaekSingleKey] = price + jinbaekPrice;
              
              // 진백 양면 가격 설정 (기본 가격 + 진백 추가 가격 + 양단면 추가금)
              if (tapePrice > 0) {
                const jinbaekDoubleKey = createPriceKey('casting', 'glossy-standard', thickness, size, '양면', '진백');
                initialPrices[jinbaekDoubleKey] = price + jinbaekPrice + tapePrice;
              }
            }
          }
        });
      }
    });
  }

  return initialPrices;
};

// ========== 박스 제작 로직: 타입 및 상수 정의 ==========

export type ProcessingProfile = 
  | 'auto' 
  | 'simple-cutting' 
  | 'complex-cutting'
  | 'laser-simple' 
  | 'laser-complex' 
  | 'laser-full'
  | 'laser-cutting-simple'
  | 'laser-cutting-full'
  | 'cnc-simple' 
  | 'cnc-complex'
  | 'cnc-full'
  | 'cnc-general'
  | 'cnc-heavy'
  | 'complex-shapes'
  | 'none';

export type AdhesionProfile = 
  | 'auto'              // 45° vs 90° 자동 비교 후 더 저렴한 쪽
  | 'bond-normal' 
  | 'bond-mugipo-45' 
  | 'bond-mugipo-90'
  | '45-normal'         // 45° 절단면 가공 + 일반 접착
  | '45-mugipo'         // 45° 절단면 가공 + 무기포 접착
  | '90-normal'         // 90° 절단면 가공 + 일반 접착
  | '90-mugipo'         // 90° 절단면 가공 + 무기포 접착
  | 'none';

export type AdhesionBasis = 'sheet_based' | 'product_based';

export interface NormalizedAdhesionSelection {
  profile: AdhesionProfile;
  mode: 'none' | 'normal' | 'mugipo';
  angle: '45' | '90' | 'auto' | null;
}

export interface AdhesionCalculationInput {
  basis: AdhesionBasis;
  materialCost: number;
  thickness: string;
  adhesion: AdhesionProfile;
  qty?: number;
  bevelLengthM?: number;
  bevelFeePerM?: number;
  corners90?: number;
  useDetailedBond?: boolean;
  joinLengthM?: number;
  trayHeightMm?: number;
  bondProductType?: 'flat' | 'tray' | 'box';
  adhesionConfig?: AdhesionConfigData;
  formulaConstants?: FormulaConstantsData;
  bondFactors?: BondFactorsData;
}

export interface AdhesionCalculationResult {
  cost: number;
  breakdown: PriceBreakdownItem[];
  picked: 'none' | 'normal' | '45°' | '90°';
  edgeIncluded: boolean;
  hasAdhesion: boolean;
  warnings: string[];
  blockedReasons: string[];
}

// 기본 접착 관련 설정 (DB 값이 없을 때 사용)
export const DEFAULT_ADHESION_CONFIG: AdhesionConfigData = {
  setupFee: 50_000,
  bondRatePerM: 15_000,
  kVolume: 0.15,
  laborPremium90: 1.12,
  cornerFinishFee: 4_000,
  thinTrayMaxHeightMm: 60,
};

export interface FormulaConstantsData {
  rawOnlyMultiplier: number;
  simpleCutThinMultiplier: number;
  simpleCutThickMultiplier: number;
  fabricationBaseMultiplier: number;
  complexCutSetupFee: number;
  laserThinFee: number;
  laserThickFee: number;
  laserFullThinSheetFee: number;
  cncGeneralFee: number;
  cncHeavyFee: number;
  complexShapeFee: number;
  mugipoBoxSetupFee: number;
  mugipoBoxBondRatePerM: number;
  mugipoBoxMinSalePrice5T250Cube: number;
  polishedEdgeRatePerM: number;
  bulgwangFinishMultiplier: number;
  mirrorHardCoating3x6: number;
  mirrorHardCoating4x8: number;
}

export const DEFAULT_FORMULA_CONSTANTS: FormulaConstantsData = {
  rawOnlyMultiplier: 1.8,
  simpleCutThinMultiplier: 1.2,
  simpleCutThickMultiplier: 1.8,
  fabricationBaseMultiplier: 1.3,
  complexCutSetupFee: 70_000,
  laserThinFee: 50_000,
  laserThickFee: 70_000,
  laserFullThinSheetFee: 200_000,
  cncGeneralFee: 70_000,
  cncHeavyFee: 100_000,
  complexShapeFee: 250_000,
  mugipoBoxSetupFee: 50_000,
  mugipoBoxBondRatePerM: 45_000,
  mugipoBoxMinSalePrice5T250Cube: 300_000,
  polishedEdgeRatePerM: 14_200,
  bulgwangFinishMultiplier: 3.0,
  mirrorHardCoating3x6: 200_000,
  mirrorHardCoating4x8: 300_000,
};

// 기본 가공 배수 (레거시 DB multiplier fallback)
export const DEFAULT_PROCESS_FACTORS: ProcessFactorsData = {
  'simple-cutting': 0,
  'complex-cutting': DEFAULT_FORMULA_CONSTANTS.fabricationBaseMultiplier,
  'laser-simple': DEFAULT_FORMULA_CONSTANTS.fabricationBaseMultiplier,
  'laser-complex': DEFAULT_FORMULA_CONSTANTS.fabricationBaseMultiplier,
  'laser-full': DEFAULT_FORMULA_CONSTANTS.fabricationBaseMultiplier,
  'laser-cutting-simple': DEFAULT_FORMULA_CONSTANTS.fabricationBaseMultiplier,
  'laser-cutting-full': DEFAULT_FORMULA_CONSTANTS.fabricationBaseMultiplier,
  'cnc-simple': DEFAULT_FORMULA_CONSTANTS.fabricationBaseMultiplier,
  'cnc-complex': DEFAULT_FORMULA_CONSTANTS.fabricationBaseMultiplier,
  'cnc-full': DEFAULT_FORMULA_CONSTANTS.fabricationBaseMultiplier,
  'cnc-general': DEFAULT_FORMULA_CONSTANTS.fabricationBaseMultiplier,
  'cnc-heavy': DEFAULT_FORMULA_CONSTANTS.fabricationBaseMultiplier,
  'complex-shapes': DEFAULT_FORMULA_CONSTANTS.fabricationBaseMultiplier,
  'none': 1.0,
};

// 기본 접착 배수 (DB 값이 없을 때 사용)
export const DEFAULT_BOND_FACTORS: BondFactorsData = {
  normal: 2.0,
  mugipo90: 3.5,
  mugipo45_thin: 3.2,
  mugipo45_thick: 3.3,
};

// 접착 관련 설정 인터페이스
export interface AdhesionConfigData {
  setupFee: number;
  bondRatePerM: number;
  kVolume: number;
  laborPremium90: number;
  cornerFinishFee: number;
  thinTrayMaxHeightMm: number;
}

// 가공 배수 설정
export interface ProcessFactorsData {
  'simple-cutting': number;
  'complex-cutting': number;
  'laser-simple': number;
  'laser-complex': number;
  'laser-full': number;
  'laser-cutting-simple': number;
  'laser-cutting-full': number;
  'cnc-simple': number;
  'cnc-complex': number;
  'cnc-full': number;
  'cnc-general': number;
  'cnc-heavy': number;
  'complex-shapes': number;
  'none': number;
}

// 접착 배수 설정
export interface BondFactorsData {
  normal: number;
  mugipo90: number;
  mugipo45_thin: number;
  mugipo45_thick: number;
}

// 두께계수 (가공 배수에만 적용)
const thicknessFactor = (t: number) => {
  if (t <= 3) return 1.2;
  if (t <= 5) return 1.5;
  if (t <= 8) return 1.8;
  if (t <= 12) return 2.0;
  return 2.8;
};

// 볼륨 할인 계수
const volumeQ = (n: number, k: number) => 
  1 / (1 + k * Math.log(Math.max(1, n)));

// 가공 프로필 자동 선택
const autoPickProcessing = (
  t: number, 
  isComplex: boolean, 
  processingOptions?: ProcessingOptionData[]
): ProcessingProfile => {
  // DB에서 가져온 옵션이 있으면 활성화된 것만 사용
  if (processingOptions && processingOptions.length > 0) {
    const activeOptions = processingOptions.filter(opt => opt.is_active !== false);
    
    if (t < 10) {
      if (isComplex) {
        const option = activeOptions.find(opt => opt.option_id === 'laser-complex');
        return option ? 'laser-complex' : 'laser-simple';
      } else {
        const option = activeOptions.find(opt => opt.option_id === 'laser-simple');
        return option ? 'laser-simple' : 'laser-simple';
      }
    } else {
      if (isComplex) {
        const option = activeOptions.find(opt => opt.option_id === 'cnc-complex');
        return option ? 'cnc-complex' : 'cnc-simple';
      } else {
        const option = activeOptions.find(opt => opt.option_id === 'cnc-simple');
        return option ? 'cnc-simple' : 'cnc-simple';
      }
    }
  }
  
  // 기본 로직 (DB 옵션이 없을 경우)
  if (t < 10) return isComplex ? 'laser-complex' : 'laser-simple';
  return isComplex ? 'cnc-complex' : 'cnc-simple';
};

// 45° 무기포 배수 계산 (얕은 트레이 우대)
const bondFactor45 = (
  t: number, 
  trayHeightMm: number | undefined, 
  bondFactors: BondFactorsData = DEFAULT_BOND_FACTORS,
  adhesionConfig: AdhesionConfigData = DEFAULT_ADHESION_CONFIG
) => {
  if (t < 10) {
    if (trayHeightMm !== undefined && trayHeightMm <= adhesionConfig.thinTrayMaxHeightMm) {
      return 2.0; // 얕은 트레이 우대
    }
    return bondFactors.mugipo45_thin;
  }
  return bondFactors.mugipo45_thick;
};

export const normalizeAdhesionSelection = (adhesion: AdhesionProfile): NormalizedAdhesionSelection => {
  if (adhesion === 'none') {
    return { profile: 'none', mode: 'none', angle: null };
  }

  if (adhesion === 'auto') {
    return { profile: 'auto', mode: 'mugipo', angle: 'auto' };
  }

  if (adhesion === 'bond-normal') {
    return { profile: 'bond-normal', mode: 'normal', angle: null };
  }

  if (adhesion === 'bond-mugipo-45' || adhesion === '45-mugipo') {
    return { profile: '45-mugipo', mode: 'mugipo', angle: '45' };
  }

  if (adhesion === 'bond-mugipo-90' || adhesion === '90-mugipo') {
    return { profile: '90-mugipo', mode: 'mugipo', angle: '90' };
  }

  if (adhesion === '45-normal') {
    return { profile: '45-normal', mode: 'normal', angle: '45' };
  }

  if (adhesion === '90-normal') {
    return { profile: '90-normal', mode: 'normal', angle: '90' };
  }

  return { profile: adhesion, mode: 'none', angle: null };
};

export const calculateAdhesionCost = ({
  basis,
  materialCost,
  thickness,
  adhesion,
  qty = 1,
  bevelLengthM,
  bevelFeePerM,
  corners90 = 0,
  useDetailedBond = false,
  joinLengthM = 0,
  trayHeightMm,
  bondProductType = 'flat',
  adhesionConfig = DEFAULT_ADHESION_CONFIG,
  bondFactors = DEFAULT_BOND_FACTORS,
}: AdhesionCalculationInput): AdhesionCalculationResult => {
  const t = parseFloat(thickness.replace('T', ''));
  const normalized = normalizeAdhesionSelection(adhesion);
  const breakdown: PriceBreakdownItem[] = [];
  const warnings: string[] = [];
  const blockedReasons: string[] = [];

  if (normalized.mode === 'none' || materialCost <= 0) {
    return {
      cost: 0,
      breakdown,
      picked: 'none',
      edgeIncluded: false,
      hasAdhesion: false,
      warnings,
      blockedReasons,
    };
  }

  const addBreakdown = (item: PriceBreakdownItem) => {
    if (!Number.isFinite(item.price) || item.price <= 0) return;
    breakdown.push({ ...item, source: 'adhesion' });
  };

  let picked: AdhesionCalculationResult['picked'] = 'normal';
  let edgeIncluded = false;

  if (normalized.mode === 'normal') {
    const f = bondFactors.normal;
    let cost = materialCost * (f - 1);
    let label = basis === 'sheet_based'
      ? `일반 접착 추가금 (원판 총액×${f})`
      : `일반 접착 제작비 (원장×${f})`;
    let code = 'adhesion-normal';

    if (normalized.angle === '45') {
      picked = '45°';
      code = 'adhesion-normal-45';
      label = basis === 'sheet_based'
        ? `45° 일반 접착 추가금 (원판 총액×${f})`
        : `45° 일반 접착 제작비 (원장×${f})`;
      if (bevelLengthM && bevelFeePerM) {
        cost += bevelLengthM * bevelFeePerM;
        label += ` + 45° 베벨 ${bevelLengthM}m`;
      }
    } else if (normalized.angle === '90') {
      picked = '90°';
      code = 'adhesion-normal-90';
      cost = cost * adhesionConfig.laborPremium90 + corners90 * adhesionConfig.cornerFinishFee;
      label = basis === 'sheet_based'
        ? `90° 일반 접착 추가금 (원판 총액×${f}, 프리미엄×${adhesionConfig.laborPremium90}${corners90 ? `, 코너 ${corners90}개` : ''})`
        : `90° 일반 접착 제작비 (원장×${f}, 프리미엄×${adhesionConfig.laborPremium90}${corners90 ? `, 코너 ${corners90}개` : ''})`;
      warnings.push('90도 접착은 마감 품질 확보에 시간이 많이 들어 최종 발행 전 검수를 권장합니다.');
    }

    addBreakdown({ label, price: cost, code });
    return {
      cost,
      breakdown,
      picked,
      edgeIncluded,
      hasAdhesion: true,
      warnings,
      blockedReasons,
    };
  }

  const f45 = bondFactor45(t, trayHeightMm, bondFactors, adhesionConfig);
  const f90 = bondFactors.mugipo90;
  let cost45 = materialCost * (f45 - 1);
  let cost90 = materialCost * (f90 - 1);

  cost90 = cost90 * adhesionConfig.laborPremium90 + corners90 * adhesionConfig.cornerFinishFee;

  if (basis === 'product_based' && useDetailedBond) {
    const detailed = (adhesionConfig.setupFee / Math.max(1, qty) + adhesionConfig.bondRatePerM * joinLengthM)
      * volumeQ(qty, adhesionConfig.kVolume)
      * Math.max(1, qty);
    cost45 += detailed;
    cost90 += detailed;
  }

  if (bevelLengthM && bevelFeePerM) {
    cost45 += bevelLengthM * bevelFeePerM;
  }

  let chosenCost = cost45;
  let chosenFactor = f45;
  picked = '45°';
  let code = 'adhesion-mugipo-45';

  if (normalized.angle === '90') {
    chosenCost = cost90;
    chosenFactor = f90;
    picked = '90°';
    code = 'adhesion-mugipo-90';
  } else if (normalized.angle === 'auto') {
    warnings.push('무기포 접착 자동 선택은 기준 금액으로 계산됩니다. 45도/90도 마감 방식이 정해진 경우 직접 선택해야 정확합니다.');
    if (cost90 < cost45) {
      chosenCost = cost90;
      chosenFactor = f90;
      picked = '90°';
      code = 'adhesion-mugipo-90';
    }
  }

  if (picked === '90°') {
    warnings.push('90도 무기포 접착은 마감 품질 확보에 시간이 많이 들어 최종 발행 전 검수를 권장합니다.');
  }

  const labelPrefix = basis === 'sheet_based'
    ? `무기포 ${picked} 접착 추가금`
    : `무기포 ${picked} 접착 제작비`;
  const labelBase = basis === 'sheet_based'
    ? `원판 총액×${chosenFactor}`
    : `원장×${chosenFactor}`;
  const label = picked === '90°'
    ? `${labelPrefix} (${labelBase}, 프리미엄×${adhesionConfig.laborPremium90}${corners90 ? `, 코너 ${corners90}개` : ''})`
    : `${labelPrefix} (${labelBase})`;

  addBreakdown({
    label,
    price: chosenCost,
    code,
    reason: basis === 'sheet_based'
      ? '원판 기준 무기포 접착은 원판 총액 배수의 추가금으로 계산됩니다.'
      : '제품제작 기준 무기포 접착은 제작 형태와 상세 조건을 반영한 추가금입니다.',
  });

  edgeIncluded = true;

  const isProductBasedBoxLike = basis === 'product_based' && (bondProductType === 'box' || corners90 >= 8);
  if (isProductBasedBoxLike && t <= 5 && joinLengthM >= 9) {
    blockedReasons.push('5T 대형 6면체 박스는 휨과 접착 품질 리스크가 커서 자동 견적으로 발행할 수 없습니다. 두께 상향 또는 수동 검수가 필요합니다.');
  } else if (isProductBasedBoxLike && t <= 5 && joinLengthM >= 7) {
    warnings.push('5T 6면체 박스는 크기가 커질수록 휨과 접착 품질 리스크가 있어 관리자 검수가 필요합니다.');
  }

  if (basis === 'product_based' && joinLengthM <= 0) {
    warnings.push('접착선 길이가 없어 접착비가 배수 기준으로만 계산되었습니다. 정확도를 높이려면 제품 유형 또는 접착선 길이를 입력하세요.');
  }

  return {
    cost: chosenCost,
    breakdown,
    picked,
    edgeIncluded,
    hasAdhesion: true,
    warnings,
    blockedReasons,
  };
};

// ========== 가공/접착 옵션 인터페이스 ==========

export interface ProcessingDeltaOptions {
  qty?: number;
  isComplex?: boolean;
  edgeRequested?: boolean;
  bevelLengthM?: number;
  bevelFeePerM?: number;
  laserHoles?: number;
  holeFee?: number;
  corners90?: number;
  useDetailedBond?: boolean;
  joinLengthM?: number;
  trayHeightMm?: number;
  adhesionConfig?: AdhesionConfigData;
  formulaConstants?: FormulaConstantsData;
  processFactors?: ProcessFactorsData;
  bondFactors?: BondFactorsData;
  processingOptions?: ProcessingOptionData[];
  bondProductType?: 'flat' | 'tray' | 'box';
  adhesionBasis?: AdhesionBasis;
  onWarnings?: (warnings: string[]) => void;
  onBlockedReasons?: (blockedReasons: string[]) => void;
}

export interface ProcessingDeltaResult {
  procCost: number;            // 증분 총액
  descriptions: string[];      // 브레이크다운 라벨
  breakdown: PriceBreakdownItem[];
  edgeIncluded: boolean;       // 접착에 엣지 포함 시 true
  hasAdhesion: boolean;        // 접착 가공 포함 여부
  picked: {
    processing: ProcessingProfile;
    adhesion: 'none' | 'normal' | '45°' | '90°';
  };
}

const getProcessingFormula = (
  profile: ProcessingProfile,
  thicknessValue: number,
  constants: FormulaConstantsData
): { multiplier: number; fixedFee: number; label: string } | null => {
  switch (profile) {
    case 'simple-cutting': {
      const multiplier = thicknessValue < 10
        ? constants.simpleCutThinMultiplier
        : constants.simpleCutThickMultiplier;
      return { multiplier, fixedFee: 0, label: `단순 재단 (원장×${multiplier})` };
    }
    case 'complex-cutting':
      return {
        multiplier: constants.fabricationBaseMultiplier,
        fixedFee: constants.complexCutSetupFee,
        label: `복합 재단 (원장×${constants.fabricationBaseMultiplier} + 공임 ${constants.complexCutSetupFee.toLocaleString()}원)`,
      };
    case 'laser-simple':
    case 'laser-cutting-simple':
      return {
        multiplier: constants.fabricationBaseMultiplier,
        fixedFee: thicknessValue <= 10 ? constants.laserThinFee : constants.laserThickFee,
        label: `레이저 재단 (원장×${constants.fabricationBaseMultiplier} + 공임 ${(thicknessValue <= 10 ? constants.laserThinFee : constants.laserThickFee).toLocaleString()}원)`,
      };
    case 'laser-complex':
      return {
        multiplier: constants.fabricationBaseMultiplier,
        fixedFee: constants.laserThickFee,
        label: `레이저 복합 재단 (원장×${constants.fabricationBaseMultiplier} + 공임 ${constants.laserThickFee.toLocaleString()}원)`,
      };
    case 'laser-full':
    case 'laser-cutting-full':
      return {
        multiplier: constants.fabricationBaseMultiplier,
        fixedFee: thicknessValue <= 2 ? constants.laserFullThinSheetFee : constants.laserThickFee,
        label: `전체 레이저 재단 (원장×${constants.fabricationBaseMultiplier} + 공임 ${(thicknessValue <= 2 ? constants.laserFullThinSheetFee : constants.laserThickFee).toLocaleString()}원)`,
      };
    case 'cnc-simple':
    case 'cnc-general':
      return {
        multiplier: constants.fabricationBaseMultiplier,
        fixedFee: constants.cncGeneralFee,
        label: `CNC 일반 가공 (원장×${constants.fabricationBaseMultiplier} + 공임 ${constants.cncGeneralFee.toLocaleString()}원)`,
      };
    case 'cnc-complex':
    case 'cnc-full':
    case 'cnc-heavy':
      return {
        multiplier: constants.fabricationBaseMultiplier,
        fixedFee: constants.cncHeavyFee,
        label: `CNC 고강도 가공 (원장×${constants.fabricationBaseMultiplier} + 공임 ${constants.cncHeavyFee.toLocaleString()}원)`,
      };
    case 'complex-shapes':
      return {
        multiplier: constants.fabricationBaseMultiplier,
        fixedFee: constants.complexShapeFee,
        label: `복잡 형상 가공 (원장×${constants.fabricationBaseMultiplier} + 공임 ${constants.complexShapeFee.toLocaleString()}원)`,
      };
    default:
      return null;
  }
};

/**
 * 가공/접착 증분 계산 (V2 로직)
 * materialCost: 자재비(이미 ×1.2/×1.3 적용된 값)
 * thickness: '5T' 같은 문자열
 * processing: 가공 프로필('auto' 지원)
 * adhesion: 접착 프로필('auto' 지원)
 */
export const calcProcessingDelta = (
  materialCost: number,
  thickness: string,
  processing: ProcessingProfile,
  adhesion: AdhesionProfile,
  opts: ProcessingDeltaOptions = {}
): ProcessingDeltaResult => {
  const t = parseFloat(thickness.replace('T', ''));
  const n = opts.qty ?? 1;
  const isComplex = !!opts.isComplex;

  // DB에서 가져온 설정 또는 기본값 사용
  const adhesionConfig = opts.adhesionConfig || DEFAULT_ADHESION_CONFIG;
  const formulaConstants = opts.formulaConstants || DEFAULT_FORMULA_CONSTANTS;
  const processFactors = opts.processFactors || DEFAULT_PROCESS_FACTORS;
  const bondFactors = opts.bondFactors || DEFAULT_BOND_FACTORS;

  let procCost = 0;
  const desc: string[] = [];
  const breakdown: PriceBreakdownItem[] = [];
  let edgeIncluded = false;
  let hasAdhesion = false;

  const addCost = (label: string, price: number) => {
    if (!Number.isFinite(price) || price <= 0) return;
    procCost += price;
    desc.push(label);
    breakdown.push({ label, price });
  };

  // 1) 가공 프로필 선택
  let pickedProcessing: ProcessingProfile = processing;
  if (processing === 'auto') pickedProcessing = autoPickProcessing(t, isComplex, opts.processingOptions);

  const processingFormula = getProcessingFormula(pickedProcessing, t, formulaConstants);
  if (processingFormula) {
    addCost(
      processingFormula.label,
      materialCost * (processingFormula.multiplier - 1) + processingFormula.fixedFee
    );
  } else if (pickedProcessing !== 'none') {
    const baseF = processFactors[pickedProcessing as Exclude<ProcessingProfile, 'auto'>] || 1;
    addCost(`${pickedProcessing} (원장×${baseF.toFixed(2)})`, materialCost * (baseF - 1));
  }

  // 2) 접착 프로필 선택
  const adhesionResult = calculateAdhesionCost({
    basis: opts.adhesionBasis || (opts.bondProductType === 'box' ? 'product_based' : 'sheet_based'),
    materialCost,
    thickness,
    adhesion,
    qty: n,
    bevelLengthM: opts.bevelLengthM,
    bevelFeePerM: opts.bevelFeePerM,
    corners90: opts.corners90,
    useDetailedBond: opts.useDetailedBond,
    joinLengthM: opts.joinLengthM,
    trayHeightMm: opts.trayHeightMm,
    bondProductType: opts.bondProductType,
    adhesionConfig,
    formulaConstants,
    bondFactors,
  });

  adhesionResult.breakdown.forEach(item => {
    addCost(item.label, item.price);
    const latest = breakdown[breakdown.length - 1];
    if (latest) {
      latest.code = item.code;
      latest.source = item.source;
      latest.reason = item.reason;
    }
  });
  edgeIncluded = adhesionResult.edgeIncluded;
  hasAdhesion = adhesionResult.hasAdhesion;
  const pickedAdhesion = adhesionResult.picked;
  if (adhesionResult.warnings.length > 0) {
    desc.push(...adhesionResult.warnings);
    opts.onWarnings?.(adhesionResult.warnings);
  }
  if (adhesionResult.blockedReasons.length > 0) {
    opts.onBlockedReasons?.(adhesionResult.blockedReasons);
  }

  // 3) 엣지(요청 시, 무기포 포함이면 비활성)
  if (opts.edgeRequested && !edgeIncluded) {
    // 10T 미만: 원판비용 × 0.8 (배수 1.8 - 1)
    // 10T 이상: 원판비용 × 0.5
    const edgeMultiplier = t < 10 ? 0.8 : 0.5;
    const displayFactor = t < 10 ? 1.8 : 1.5;
    addCost(`엣지 경면 (원장×${displayFactor})`, materialCost * edgeMultiplier);
  }

  // 4) 기타 정액 옵션(타공 등)
  if ((opts.laserHoles ?? 0) > 0 && (opts.holeFee ?? 0) > 0) {
    const add = (opts.laserHoles! * opts.holeFee!);
    addCost(`레이저 타공 ${opts.laserHoles}개 (+${add.toLocaleString()}원)`, add);
  }

  return {
    procCost,
    descriptions: desc,
    breakdown,
    edgeIncluded,
    hasAdhesion,
    picked: {
      processing: pickedProcessing,
      adhesion: pickedAdhesion,
    },
  };
};

// ========== 레거시 인터페이스 (하위 호환성) ==========

export interface ProcessingCostCalculation {
  baseMultiplier: number;
  additionalCost: number;
  description: string;
}

export const calculateProcessingCost = (
  basePrice: number,
  thickness: string,
  processingType: string
): ProcessingCostCalculation => {
  const thicknessValue = parseFloat(thickness.replace('T', ''));
  let baseMultiplier = 1;
  let additionalCost = 0;
  let description = '';

  // 가공 유형별 추가 계산
  switch (processingType) {
    case 'raw-only':
      baseMultiplier = 1.8;
      description = '원판 단독 구매 (자재비 ×1.8)';
      break;

    case 'simple-cutting':
      if (thicknessValue < 10) {
        baseMultiplier = 1.2;
        description = '단순 재단 (10T 미만)';
      } else {
        baseMultiplier = 1.8;
        description = '단순 재단 (10T 이상)';
      }
      break;

    case 'complex-cutting':
      baseMultiplier = 1.2;
      description = '복합 재단 (도면 기반 다수 커팅)';
      break;

    case 'edge-finishing':
      if (thicknessValue < 10) {
        baseMultiplier = 1.8;
        description = '엣지 경면 마감 (10T 미만)';
      } else {
        baseMultiplier = 1.5;
        description = '엣지 경면 마감 (10T 이상)';
      }
      break;

    case 'bubble-free-adhesion':
      baseMultiplier = 3.0;
      description = '무기포 접착';
      break;

    case 'laser-cutting-simple':
      if (thicknessValue <= 10) {
        additionalCost = 50000;
        description = '레이저 커팅 (단순 모양, 10T 이하)';
      } else {
        baseMultiplier = 1.2;
        additionalCost = 70000;
        description = '레이저 커팅 (10T 초과, 복합 가공)';
      }
      break;

    case 'laser-cutting-full':
      if (thicknessValue <= 2) {
        additionalCost = 200000;
        description = '전체 레이저 커팅 (1~2T)';
      } else {
        baseMultiplier = 1.2;
        additionalCost = 70000;
        description = '레이저 커팅 (복합 가공)';
      }
      break;

    case 'cnc-general':
      additionalCost = 70000;
      description = 'CNC 일반 가공';
      break;

    case 'cnc-heavy':
      if (thicknessValue >= 20) {
        additionalCost = 100000;
        description = 'CNC 고강도 가공 (20~30T)';
      } else {
        additionalCost = 70000;
        description = 'CNC 일반 가공';
      }
      break;

    case 'complex-shapes':
      additionalCost = 175000; // 150,000~200,000의 중간값
      description = '복잡한 모양 가공 (여러 형태 포함)';
      break;

    default:
      description = '가공 없음';
      break;
  }

  return {
    baseMultiplier,
    additionalCost,
    description
  };
};

// V2: 증분 방식 가격 계산
export interface CalculatePriceV2Options {
  processing?: ProcessingProfile;                 // 가공 프로필
  adhesion?: AdhesionProfile;                     // 접착 프로필
  qty?: number;                                   // 수량
  isComplex?: boolean;                            // 복잡도
  edgeRequested?: boolean;                        // 엣지 요청
  bevelLengthM?: number;                          // 베벨 길이
  bevelFeePerM?: number;                          // 베벨 단가
  laserHoles?: number;                            // 타공 개수
  holeFee?: number;                               // 타공 단가
  corners90?: number;                             // 90도 코너 개수
  useDetailedBond?: boolean;                      // 상세 접착 계산
  joinLengthM?: number;                           // 접착선 길이
  trayHeightMm?: number;                          // 트레이 높이
  edgeFinishing?: boolean;                        // 엣지 경면 마감
  bulgwang?: boolean;                             // 불광 마감
  polishedEdgeLengthM?: number;                   // 경면/불광 기준 엣지 길이
  tapung?: boolean;                               // 타공
  mugwangPainting?: boolean;                      // 무광 도장
  processingOptionsData?: ProcessingOptionData[]; // DB에서 가져온 가공 옵션 데이터
  rawOnlyMultiplier?: number;                     // 원판 단독 구매 할증률 (DB에서 가져옴)
  formulaConstants?: FormulaConstantsData;        // 산식 v2 기준 상수 (DB)
  adhesionConfig?: AdhesionConfigData;            // 접착 설정 (DB)
  processFactors?: ProcessFactorsData;            // 가공 배수 (DB)
  bondFactors?: BondFactorsData;                  // 접착 배수 (DB)
  adhesionBasis?: AdhesionBasis;                  // 원판 기준/제품제작 기준 접착 계산 분기
  selectedAdditionalOptions?: Record<string, number>; // 추가 옵션 수량
  totalWonJangBase?: number; // 여러 원장의 합계 (옵션 계산 시 기준가)
  selectedPanelSizesForOptions?: Array<{ size: string; quantity: number }>; // 원판 장수 기준 옵션용
  bondProductType?: 'flat' | 'tray' | 'box';
}

export interface ProcessingOptionData {
  option_id: string;
  name: string;
  option_type?: string;
  category?: string;
  multiplier?: number;
  base_cost?: number;
  is_active?: boolean;
  pricing_method?: ProcessingPricingMethod | null;
  unit?: string | null;
  rate?: number | null;
  requires_review?: boolean | null;
}

export interface ColorMixingCostData {
  thickness: string;
  cost: number;
}

export interface PanelOptionSurchargeData {
  quality_id: string;
  surcharge_type: 'double_surface' | 'satin_astel' | 'bright_pigment';
  size_name: string;
  cost: number;
  is_active: boolean;
}

export interface PanelSizeData {
  size_name: string;
  thickness: string;
  price?: number;
  is_active: boolean;
}

const PROCESSING_PROFILE_IDS: Record<string, ProcessingProfile> = {
  'auto': 'auto',
  'simple-cutting': 'simple-cutting',
  'complex-cutting': 'complex-cutting',
  'laser-simple': 'laser-simple',
  'laser-complex': 'laser-complex',
  'laser-full': 'laser-full',
  'laser-cutting-simple': 'laser-cutting-simple',
  'laser-cutting-full': 'laser-cutting-full',
  'cnc-simple': 'cnc-simple',
  'cnc-complex': 'cnc-complex',
  'cnc-full': 'cnc-full',
  'cnc-general': 'cnc-general',
  'cnc-heavy': 'cnc-heavy',
  'complex-shapes': 'complex-shapes',
  'bubble-free-adhesion': 'none',
};

const ADHESION_PROFILE_IDS: Record<string, AdhesionProfile> = {
  'bond-normal': 'bond-normal',
  'bond-mugipo-auto': 'auto',
  'bond-mugipo-45': 'bond-mugipo-45',
  'bond-mugipo-90': 'bond-mugipo-90',
  'bubble-free-adhesion': 'bond-mugipo-45',
  '45-normal': '45-normal',
  '45-mugipo': '45-mugipo',
  '90-normal': '90-normal',
  '90-mugipo': '90-mugipo',
};

const getOptionByIds = (options: ProcessingOptionData[], ids: string[]) =>
  ids
    .map(id => options.find(option => option.option_id === id && option.is_active !== false))
    .find(Boolean);

const getOptionMultiplier = (options: ProcessingOptionData[], ids: string[]) => {
  const option = getOptionByIds(options, ids);
  return typeof option?.multiplier === 'number' && option.multiplier > 0
    ? option.multiplier
    : undefined;
};

const buildProcessFactorsFromOptions = (options: ProcessingOptionData[]): ProcessFactorsData => ({
  ...DEFAULT_PROCESS_FACTORS,
  'complex-cutting': getOptionMultiplier(options, ['complex-cutting']) ?? DEFAULT_PROCESS_FACTORS['complex-cutting'],
  'laser-simple': getOptionMultiplier(options, ['laser-simple']) ?? DEFAULT_PROCESS_FACTORS['laser-simple'],
  'laser-complex': getOptionMultiplier(options, ['laser-complex']) ?? DEFAULT_PROCESS_FACTORS['laser-complex'],
  'laser-full': getOptionMultiplier(options, ['laser-full']) ?? DEFAULT_PROCESS_FACTORS['laser-full'],
  'laser-cutting-simple': getOptionMultiplier(options, ['laser-cutting-simple']) ?? DEFAULT_PROCESS_FACTORS['laser-cutting-simple'],
  'laser-cutting-full': getOptionMultiplier(options, ['laser-cutting-full']) ?? DEFAULT_PROCESS_FACTORS['laser-cutting-full'],
  'cnc-simple': getOptionMultiplier(options, ['cnc-simple']) ?? DEFAULT_PROCESS_FACTORS['cnc-simple'],
  'cnc-complex': getOptionMultiplier(options, ['cnc-complex']) ?? DEFAULT_PROCESS_FACTORS['cnc-complex'],
  'cnc-full': getOptionMultiplier(options, ['cnc-full']) ?? DEFAULT_PROCESS_FACTORS['cnc-full'],
  'cnc-general': getOptionMultiplier(options, ['cnc-general']) ?? DEFAULT_PROCESS_FACTORS['cnc-general'],
  'cnc-heavy': getOptionMultiplier(options, ['cnc-heavy']) ?? DEFAULT_PROCESS_FACTORS['cnc-heavy'],
  'complex-shapes': getOptionMultiplier(options, ['complex-shapes']) ?? DEFAULT_PROCESS_FACTORS['complex-shapes'],
});

const buildBondFactorsFromOptions = (options: ProcessingOptionData[]): BondFactorsData => {
  const mugipo45 = getOptionMultiplier(options, ['45-mugipo', 'bond-mugipo-45']);
  return {
    ...DEFAULT_BOND_FACTORS,
    normal: getOptionMultiplier(options, ['bond-normal', '45-normal', '90-normal']) ?? DEFAULT_BOND_FACTORS.normal,
    mugipo90: getOptionMultiplier(options, ['90-mugipo', 'bond-mugipo-90']) ?? DEFAULT_BOND_FACTORS.mugipo90,
    mugipo45_thin: mugipo45 ?? DEFAULT_BOND_FACTORS.mugipo45_thin,
    mugipo45_thick: mugipo45 ?? DEFAULT_BOND_FACTORS.mugipo45_thick,
  };
};

const isKnownProfileOptionId = (optionId: string) =>
  Boolean(PROCESSING_PROFILE_IDS[optionId] || ADHESION_PROFILE_IDS[optionId]);

const shouldUseRateMultiplier = (option: ProcessingOptionData) => {
  return (
    option.option_type === 'additional' ||
    option.category === 'additional' ||
    option.multiplier === undefined ||
    option.multiplier < 1
  );
};

const getNumericOptionValue = (...values: Array<number | null | undefined>) => {
  const value = values.find(v => typeof v === 'number' && Number.isFinite(v));
  return value ?? 0;
};

type ConfiguredOptionCost = {
  cost: number;
  label: string;
  reason?: string;
  source?: CalculationLineItemSource;
};

const normalizePanelSizeKey = (size: string) => size.split(' ')[0].trim();

const isOptionId = (option: ProcessingOptionData, ids: string[]) =>
  ids.includes(option.option_id);

const getConfiguredOptionSource = (option: ProcessingOptionData): CalculationLineItemSource => {
  if (isOptionId(option, ['mirrorHardCoating', 'mirror-hard-coating', 'mirrorDeposition', 'mirror-deposition'])) {
    return 'mirror';
  }

  if (isOptionId(option, ['edgeFinishing', 'polishedEdge', 'polished-edge', 'bulgwang', 'bulgwangFinish', 'bulgwang-finish'])) {
    return 'post_processing';
  }

  if (option.option_type === 'adhesion') return 'adhesion';
  if (option.option_type === 'additional' || option.category === 'additional') return 'additional';

  return 'processing';
};

const getMirrorHardCoatingUnitCost = (
  sizeKey: string,
  constants: FormulaConstantsData
) => {
  const normalizedSize = normalizePanelSizeKey(sizeKey);

  if (normalizedSize.includes('4*8')) return constants.mirrorHardCoating4x8;
  if (normalizedSize.includes('3*6')) return constants.mirrorHardCoating3x6;

  return null;
};

const calculateMirrorHardCoatingCost = (
  quantity: number,
  fallbackSizeKey: string,
  constants: FormulaConstantsData,
  options?: CalculatePriceV2Options
): ConfiguredOptionCost => {
  const selectedPanels = options?.selectedPanelSizesForOptions?.length
    ? options.selectedPanelSizesForOptions
    : [{ size: fallbackSizeKey, quantity: 1 }];
  let total = 0;
  const unsupportedSizes: string[] = [];
  const details: string[] = [];

  selectedPanels.forEach(panel => {
    const panelQty = Math.max(0, panel.quantity || 0);
    if (panelQty <= 0) return;

    const sizeKey = normalizePanelSizeKey(panel.size);
    const unitCost = getMirrorHardCoatingUnitCost(sizeKey, constants);

    if (unitCost === null) {
      unsupportedSizes.push(sizeKey);
      return;
    }

    const lineCost = unitCost * panelQty * Math.max(1, quantity);
    total += lineCost;
    details.push(`${sizeKey} ${panelQty}장 × ${unitCost.toLocaleString()}원`);
  });

  const reason = unsupportedSizes.length > 0
    ? `미러 증착용 하드코팅은 3*6/4*8 기준만 자동 계산됩니다. 확인 필요: ${Array.from(new Set(unsupportedSizes)).join(', ')}`
    : undefined;

  return {
    cost: total,
    label: details.length > 0
      ? `미러 증착용 하드코팅 (${details.join(', ')})`
      : '미러 증착용 하드코팅 (수동 검수 필요)',
    reason,
    source: 'mirror' as CalculationLineItemSource,
  };
};

const calculateConfiguredOptionCost = (
  option: ProcessingOptionData,
  wonJang: number,
  quantity: number,
  fallbackSizeKey: string,
  constants: FormulaConstantsData,
  options?: CalculatePriceV2Options
): ConfiguredOptionCost | null => {
  const method = option.pricing_method || 'legacy_multiplier';
  const baseCost = option.base_cost ?? 0;
  const storedRateLooksLikeBaseCost =
    baseCost !== 0 && option.rate !== null && option.rate !== undefined && option.rate === baseCost;
  const multiplier = method === 'panel_multiplier'
    ? getNumericOptionValue(
        option.multiplier,
        storedRateLooksLikeBaseCost ? undefined : option.rate,
        1
      )
    : (option.multiplier ?? 0);
  const rate = method === 'fixed_fee'
    ? getNumericOptionValue(option.rate, option.base_cost)
    : getNumericOptionValue(
        storedRateLooksLikeBaseCost ? undefined : option.rate,
        option.multiplier
      );
  const joinLength = options?.joinLengthM ?? 0;
  const bevelLength = options?.bevelLengthM ?? 0;
  const polishedEdgeLength = options?.polishedEdgeLengthM ?? 0;
  const length = option.unit === 'bevel_m' || /bevel/i.test(option.option_id)
    ? bevelLength
    : joinLength;
  const withBaseCost = (cost: number, label: string) => {
    if (!baseCost || method === 'fixed_fee') {
      return { cost, label };
    }

    const baseCostTotal = baseCost * quantity;
    const baseCostLabel = quantity > 1
      ? `기본비 ${baseCost.toLocaleString()}원 × ${quantity}`
      : `기본비 ${baseCost.toLocaleString()}원`;

    return {
      cost: cost + baseCostTotal,
      label: `${label} + ${baseCostLabel}`,
    };
  };

  if (isOptionId(option, ['edgeFinishing', 'polishedEdge', 'polished-edge'])) {
    if (polishedEdgeLength > 0) {
      return {
        cost: constants.polishedEdgeRatePerM * polishedEdgeLength * quantity,
        label: `${option.name} (${constants.polishedEdgeRatePerM.toLocaleString()}원/m × ${polishedEdgeLength.toFixed(2)}m${quantity > 1 ? ` × ${quantity}` : ''})`,
        source: 'post_processing' as CalculationLineItemSource,
      };
    }

    const fallbackRate = option.multiplier || 0.5;
    return {
      cost: wonJang * fallbackRate * quantity,
      label: `${option.name} (경면/유광 엣지 길이 미입력, 원장×${fallbackRate})`,
      reason: '경면/유광 엣지 길이가 없어 기존 원판 비례 금액으로 임시 계산했습니다. 최종 발행 전 엣지 길이 확인이 필요합니다.',
      source: 'post_processing' as CalculationLineItemSource,
    };
  }

  if (isOptionId(option, ['bulgwang', 'bulgwangFinish', 'bulgwang-finish'])) {
    if (polishedEdgeLength > 0) {
      const polishedEdgeCost = constants.polishedEdgeRatePerM * polishedEdgeLength;
      return {
        cost: polishedEdgeCost * constants.bulgwangFinishMultiplier * quantity,
        label: `${option.name} (경면/유광 엣지 ${polishedEdgeCost.toLocaleString()}원 × ${constants.bulgwangFinishMultiplier}${quantity > 1 ? ` × ${quantity}` : ''})`,
        reason: '불광은 표면 투명도와 매끄러움을 높이는 후가공입니다. 미러증착과 별도로 계산됩니다.',
        source: 'post_processing' as CalculationLineItemSource,
      };
    }

    const fallbackRate = option.multiplier || 0.5;
    return {
      cost: wonJang * fallbackRate * constants.bulgwangFinishMultiplier * quantity,
      label: `${option.name} (경면/유광 엣지 길이 미입력, 원장×${fallbackRate}×${constants.bulgwangFinishMultiplier})`,
      reason: '불광 기준 엣지 길이가 없어 기존 원판 비례 금액으로 임시 계산했습니다. 최종 발행 전 경면/유광 엣지 길이 확인이 필요합니다.',
      source: 'post_processing' as CalculationLineItemSource,
    };
  }

  if (isOptionId(option, ['mirrorHardCoating', 'mirror-hard-coating'])) {
    return calculateMirrorHardCoatingCost(quantity, fallbackSizeKey, constants, options);
  }

  if (method === 'requires_review') {
    return {
      cost: 0,
      label: `${option.name} (수동 검수 필요)`,
      reason: '관리자 설정에서 수동 검수 옵션으로 지정되었습니다.',
      source: getConfiguredOptionSource(option),
    };
  }

  if (method === 'fixed_fee') {
    return {
      cost: rate * quantity,
      label: quantity > 1 ? `${option.name} (${rate.toLocaleString()}원 × ${quantity})` : `${option.name}`,
    };
  }

  if (method === 'panel_multiplier') {
    return withBaseCost(
      wonJang * (multiplier - 1) * quantity,
      quantity > 1 ? `${option.name} (원장×${multiplier}) x${quantity}개` : `${option.name} (최종 원장×${multiplier})`
    );
  }

  if (method === 'panel_rate') {
    return withBaseCost(
      wonJang * rate * quantity,
      quantity > 1 ? `${option.name} (원장×${rate}) x${quantity}개` : `${option.name} (원장×${rate})`
    );
  }

  if (method === 'per_unit') {
    return withBaseCost(
      rate * quantity,
      `${option.name} (${rate.toLocaleString()}원/개 × ${quantity})`
    );
  }

  if (method === 'per_meter') {
    return withBaseCost(
      rate * length * quantity,
      `${option.name} (${rate.toLocaleString()}원/m × ${length.toFixed(2)}m${quantity > 1 ? ` × ${quantity}` : ''})`
    );
  }

  if (method === 'per_corner') {
    const corners = options?.corners90 ?? 0;
    return withBaseCost(
      rate * corners * quantity,
      `${option.name} (${rate.toLocaleString()}원/코너 × ${corners}개${quantity > 1 ? ` × ${quantity}` : ''})`
    );
  }

  return null;
};

const collectProductionGuardrails = (
  thickness: string,
  selectedAdhesion: AdhesionProfile,
  opts?: CalculatePriceV2Options
) => {
  const t = parseFloat(thickness.replace('T', ''));
  const isProductBased = opts?.adhesionBasis === 'product_based';
  const joinLength = opts?.joinLengthM ?? 0;
  const corners = opts?.corners90 ?? 0;
  const isBoxLike = isProductBased && (opts?.bondProductType === 'box' || corners >= 8);
  const usesAdhesion =
    selectedAdhesion !== 'none' ||
    (isProductBased && ((opts?.useDetailedBond ?? false) || joinLength > 0 || corners > 0));

  const warnings: string[] = [];
  const blockedReasons: string[] = [];

  if (!usesAdhesion) {
    return { warnings, blockedReasons };
  }

  if (isBoxLike && t <= 5 && joinLength >= 9) {
    blockedReasons.push('5T 대형 6면체 박스는 휨과 접착 품질 리스크가 커서 자동 견적으로 발행할 수 없습니다. 두께 상향 또는 수동 검수가 필요합니다.');
  } else if (isBoxLike && t <= 5 && joinLength >= 7) {
    warnings.push('5T 6면체 박스는 크기가 커질수록 휨과 접착 품질 리스크가 있어 관리자 검수가 필요합니다.');
  }

  if ((selectedAdhesion === 'bond-mugipo-90' || selectedAdhesion === '90-mugipo' || selectedAdhesion === '90-normal') && corners > 0) {
    warnings.push('90도 접착은 마감 품질 확보에 시간이 많이 들어 최종 발행 전 검수를 권장합니다.');
  }

  if (selectedAdhesion === 'auto') {
    warnings.push('무기포 접착 자동 선택은 기준 금액으로 계산됩니다. 45도/90도 마감 방식이 정해진 경우 직접 선택해야 정확합니다.');
  }

  if (isProductBased && (selectedAdhesion !== 'none' || opts?.useDetailedBond) && joinLength <= 0) {
    warnings.push('접착선 길이가 없어 접착비가 배수 기준으로만 계산되었습니다. 정확도를 높이려면 제품 유형 또는 접착선 길이를 입력하세요.');
  }

  return { warnings, blockedReasons };
};

export const calculatePrice = (
  materialId: string,
  qualityId: string,
  thickness: string,
  size: string,
  surface: string,
  colorType?: string,
  processingType?: string,
  colorMixingCost: number = 0,
  options?: CalculatePriceV2Options & {
    colorMixingCostsData?: ColorMixingCostData[];
    panelSizesData?: PanelSizeData[];
    basePanelSizesData?: PanelSizeData[];
    optionSurchargesData?: PanelOptionSurchargeData[];
  }
): CalculatePriceResult => {
  const breakdown: PriceBreakdownItem[] = [];
  const warnings: string[] = [];
  const blockedReasons: string[] = [];
  const formulaConstants: FormulaConstantsData = {
    ...DEFAULT_FORMULA_CONSTANTS,
    ...(options?.formulaConstants || {}),
  };
  
  if (materialId !== 'casting') {
    return normalizeCalculationResult(
      0,
      [{ label: '지원되지 않는 소재', price: 0, source: 'validation', code: 'unsupported-material' }],
      [],
      ['지원되지 않는 소재입니다.']
    );
  }

  // 사이즈에서 실제 키 추출 (예: "소3*6 (850*1750)" -> "소3*6")
  const sizeKey = size.split(' ')[0];
  const optionSurchargesData = options?.optionSurchargesData || [];
  const findOptionSurcharge = (type: PanelOptionSurchargeData['surcharge_type']) => {
    const matchingSurcharges = optionSurchargesData.filter(surcharge =>
      surcharge.surcharge_type === type &&
      surcharge.size_name === sizeKey &&
      surcharge.is_active &&
      (surcharge.quality_id === qualityId || surcharge.quality_id === 'global')
    );
    return matchingSurcharges.find(surcharge => surcharge.quality_id === qualityId) || matchingSurcharges[0];
  };
  const isBrightPigmentColor = (value?: string) => {
    if (!value) return false;
    return /진백|스리|브라이트|bright/i.test(value);
  };

  // 1) 기본 단면 가격 가져오기 (원자재 비용)
  let basePrice = 0;
  const hasWonJangBaseOverride =
    typeof options?.totalWonJangBase === 'number' &&
    options.totalWonJangBase > 0;
  
  // DB에서 가져온 panel_sizes 데이터를 우선 사용
  const panelSizesData = options?.panelSizesData || [];
  const dbPanelSize = panelSizesData.find(
    ps => ps.size_name === sizeKey && ps.thickness === thickness && ps.is_active
  );
  
  const finishSurcharge = qualityId === 'astel-color' || qualityId === 'satin-color'
    ? findOptionSurcharge('satin_astel')
    : undefined;

  if (finishSurcharge && finishSurcharge.cost > 0) {
    const clearDbPanelSize = options?.basePanelSizesData?.find(
      ps => ps.size_name === sizeKey && ps.thickness === thickness && ps.is_active
    );
    const clearPrices = glossyColorSinglePrices[thickness as keyof typeof glossyColorSinglePrices];
    const clearBasePrice = clearDbPanelSize?.price && clearDbPanelSize.price > 0
      ? clearDbPanelSize.price
      : clearPrices?.[sizeKey as keyof typeof clearPrices] || 0;

    if (clearBasePrice > 0) {
      basePrice = clearBasePrice;
      breakdown.push({ label: 'CLEAR 유광 색상판 기본가', price: basePrice });
      breakdown.push({ label: '사틴/아스텔 추가금 (DB)', price: finishSurcharge.cost });
      basePrice += finishSurcharge.cost;
    }
  }

  // DB에 가격이 있으면 우선 사용
  if (basePrice === 0 && dbPanelSize?.price && dbPanelSize.price > 0) {
    basePrice = dbPanelSize.price;
    breakdown.push({ label: `${qualityId} 기본가 (DB)`, price: basePrice });
  } else if (basePrice === 0) {
    // DB에 없으면 하드코딩된 값 사용 (fallback)
    if (qualityId === 'glossy-color') {
      const prices = glossyColorSinglePrices[thickness as keyof typeof glossyColorSinglePrices];
      basePrice = prices?.[sizeKey as keyof typeof prices] || 0;
      breakdown.push({ label: '유광 색상판 기본가', price: basePrice });
    } else if (qualityId === 'astel-color') {
      const prices = astelColorSinglePrices[thickness as keyof typeof astelColorSinglePrices];
      basePrice = prices?.[sizeKey as keyof typeof prices] || 0;
      breakdown.push({ label: '아스텔 색상판 기본가', price: basePrice });
      
      // 아스텔 추가금액
      const astelSurcharge = astelDoubleSideSurcharge[sizeKey as keyof typeof astelDoubleSideSurcharge] || 0;
      if (astelSurcharge > 0) {
        breakdown.push({ label: '아스텔 추가금액', price: astelSurcharge });
        basePrice += astelSurcharge;
      }
    } else if (qualityId === 'satin-color') {
      const prices = satinColorSinglePrices[thickness as keyof typeof satinColorSinglePrices];
      basePrice = prices?.[sizeKey as keyof typeof prices] || 0;
      breakdown.push({ label: '사틴 색상판 기본가', price: basePrice });
    } else if (qualityId === 'glossy-standard') {
      const prices = glossyStandardSinglePrices[thickness as keyof typeof glossyStandardSinglePrices];
      basePrice = prices?.[sizeKey as keyof typeof prices] || 0;
      breakdown.push({ label: '유광 보급판 기본가', price: basePrice });
      
    }
  }

  if (basePrice <= 0) {
    return normalizeCalculationResult(
      0,
      [{
        label: `생산 불가 조합 또는 단가 미등록: ${qualityId} / ${thickness} / ${sizeKey}`,
        price: 0,
        source: 'validation',
        code: 'missing-panel-price',
        reason: '선택한 재질, 두께, 원판 사이즈에 사용할 수 있는 단가가 없습니다.',
      }],
      [],
      [`생산 불가 조합 또는 단가 미등록: ${qualityId} / ${thickness} / ${sizeKey}`]
    );
  }

  const dbBrightPigmentSurcharge = findOptionSurcharge('bright_pigment');
  if (isBrightPigmentColor(colorType)) {
    const brightPigmentCost = dbBrightPigmentSurcharge?.cost && dbBrightPigmentSurcharge.cost > 0
      ? dbBrightPigmentSurcharge.cost
      : jinbaekPrices[sizeKey as keyof typeof jinbaekPrices] || 0;

    if (brightPigmentCost > 0) {
      breakdown.push({
        label: dbBrightPigmentSurcharge ? '브라이트/진백/스리 조색비 (DB)' : '브라이트/진백/스리 조색비',
        price: brightPigmentCost
      });
      basePrice += brightPigmentCost;
    }
  }

  // 2) 양면 추가금액 (자재비에 포함)
  if (surface === '양면') {
    let doubleSidePrice = 0;
    const dbDoubleSurfaceSurcharge = findOptionSurcharge('double_surface');
    
    if (dbDoubleSurfaceSurcharge && dbDoubleSurfaceSurcharge.cost > 0) {
      doubleSidePrice = dbDoubleSurfaceSurcharge.cost;
      breakdown.push({ label: '양단면 추가금 (DB)', price: doubleSidePrice });
    } else {
      if (qualityId === 'astel-color') {
        doubleSidePrice = tapePrices[sizeKey as keyof typeof tapePrices] || 0;
        breakdown.push({ label: '양단면 추가금', price: doubleSidePrice });
      } else if (qualityId === 'satin-color') {
        doubleSidePrice = satinDoubleSideSurcharge[sizeKey as keyof typeof satinDoubleSideSurcharge] || 0;
        breakdown.push({ label: '사틴 양단면 추가금', price: doubleSidePrice });
      } else {
        doubleSidePrice = tapePrices[sizeKey as keyof typeof tapePrices] || 0;
        breakdown.push({ label: '양단면 추가금', price: doubleSidePrice });
      }
    }
    
    basePrice += doubleSidePrice;
  }

  // 3) 조색비 추가 (자재비에 포함)
  let finalColorMixingCost = colorMixingCost;
  
  // DB에서 가져온 조색비가 있으면 우선 사용
  const colorMixingCostsData = options?.colorMixingCostsData || [];
  const dbColorMixingCost = colorMixingCostsData.find(c => c.thickness === thickness);
  
  if (dbColorMixingCost && dbColorMixingCost.cost > 0 && colorMixingCost === 0) {
    finalColorMixingCost = dbColorMixingCost.cost;
  }
  
  if (finalColorMixingCost > 0) {
    const label = dbColorMixingCost ? '조색비 (DB)' : '조색비';
    breakdown.push({ label, price: finalColorMixingCost });
    basePrice += finalColorMixingCost;
  }

  if (hasWonJangBaseOverride) {
    // 여러 원판/사이즈 계산에서는 실제 선택 규격의 생산 가능 여부만 검증한 뒤,
    // 가공 옵션 산출 기준을 전체 원장 합계로 전환한다.
    basePrice = options.totalWonJangBase!;
  }

  // 4) 원판 단독 구매 할증은 슬롯 기반 로직(771번 이후)에서 처리됨

  // 5) 기본 가격 설정
  let totalPrice = basePrice;
  let effectiveAdhesionForGuardrails: AdhesionProfile = 'none';

  // ===== 원장 금액 계산 완료 =====
  // 원장 = 원판금액 + 면수(양단면) + 조색비
  // 여러 원장인 경우, totalWonJangBase로 전달된 값을 사용
  const wonJang = options?.totalWonJangBase || basePrice;
  
  console.log('원장 기준:', { wonJang, basePrice, totalWonJangBase: options?.totalWonJangBase });
  
  // 6) processingType이 있는 경우 슬롯 기반 처리
  if (processingType && processingType !== '' && processingType !== 'none' && options?.processingOptionsData) {
    const processingOptionsData = options?.processingOptionsData || [];
    const selectedOptionIds = processingType.split('|').filter(Boolean);
    console.log('Processing multiple options:', {
      processingType,
      selectedOptionIds,
      wonJang,
      availableOptions: processingOptionsData.map(opt => ({
        id: opt.option_id,
        name: opt.name,
        multiplier: opt.multiplier,
        base_cost: opt.base_cost
      }))
    });
    
    // 추가 옵션 수량 정보 가져오기
    const additionalOptionsQuantities = options?.selectedAdditionalOptions || {};

    let fallbackProcessing: ProcessingProfile = 'none';
    let fallbackAdhesion: AdhesionProfile = selectedOptionIds.some(optionId => ADHESION_PROFILE_IDS[optionId])
      ? 'none'
      : options?.adhesion || 'none';
    const optionIdsForGenericCalculation: string[] = [];

    selectedOptionIds.forEach(optionId => {
      const option = processingOptionsData.find(opt => opt.option_id === optionId && opt.is_active);
      const isSheetBasedAdhesionProfile =
        Boolean(ADHESION_PROFILE_IDS[optionId]) &&
        (options?.adhesionBasis || 'sheet_based') === 'sheet_based';
      if (ADHESION_PROFILE_IDS[optionId]) {
        effectiveAdhesionForGuardrails = ADHESION_PROFILE_IDS[optionId];
      }
      const isFormulaProcessingProfile = Boolean(PROCESSING_PROFILE_IDS[optionId]);
      const needsProfileDelta =
        isFormulaProcessingProfile ||
        isSheetBasedAdhesionProfile ||
        isKnownProfileOptionId(optionId) &&
        (
          !option ||
          (
            (option.multiplier === undefined || option.multiplier === null || option.multiplier === 0) &&
            (option.base_cost === undefined || option.base_cost === null || option.base_cost === 0) &&
            (option.rate === undefined || option.rate === null || option.rate === 0)
          )
        );

      if (needsProfileDelta) {
        fallbackProcessing = PROCESSING_PROFILE_IDS[optionId] || fallbackProcessing;
        fallbackAdhesion = ADHESION_PROFILE_IDS[optionId] || fallbackAdhesion;
        return;
      }

      optionIdsForGenericCalculation.push(optionId);
    });

    if (fallbackProcessing !== 'none' || fallbackAdhesion !== 'none') {
      effectiveAdhesionForGuardrails = fallbackAdhesion;
      const delta = calcProcessingDelta(
        wonJang,
        thickness,
        fallbackProcessing,
        fallbackAdhesion,
        {
          qty: options.qty,
          isComplex: options.isComplex,
          edgeRequested: options.edgeRequested,
          bevelLengthM: options.bevelLengthM,
          bevelFeePerM: options.bevelFeePerM,
          laserHoles: options.laserHoles,
          holeFee: options.holeFee,
          corners90: options.corners90,
          useDetailedBond: options.useDetailedBond,
          joinLengthM: options.joinLengthM,
          trayHeightMm: options.trayHeightMm,
          adhesionConfig: options.adhesionConfig,
          formulaConstants,
          processFactors: buildProcessFactorsFromOptions(processingOptionsData),
          bondFactors: buildBondFactorsFromOptions(processingOptionsData),
          processingOptions: processingOptionsData,
          bondProductType: options.bondProductType,
          adhesionBasis: options.adhesionBasis || (options.bondProductType === 'box' || options.bondProductType === 'tray' ? 'product_based' : 'sheet_based'),
          onWarnings: nextWarnings => warnings.push(...nextWarnings),
          onBlockedReasons: nextBlockedReasons => blockedReasons.push(...nextBlockedReasons),
        }
      );

      delta.breakdown.forEach(item => {
        breakdown.push(item);
        totalPrice += item.price;
      });
    }

    // 선택된 각 옵션의 multiplier와 base_cost 적용
    optionIdsForGenericCalculation.forEach(optionId => {
      const option = processingOptionsData.find(opt => opt.option_id === optionId && opt.is_active);
      console.log(`Looking for option: ${optionId}`, option);
      
      if (option) {
        // 수량 정보 확인 (기본값 1)
        const quantity = additionalOptionsQuantities[optionId] || 1;
        if (option.requires_review) {
          warnings.push(`${option.name} 옵션은 관리자 검수가 필요합니다.`);
        }
        const configuredOptionCost = calculateConfiguredOptionCost(option, wonJang, quantity, sizeKey, formulaConstants, options);
        if (configuredOptionCost) {
          if (configuredOptionCost.reason) {
            warnings.push(configuredOptionCost.reason);
          }
          breakdown.push({
            label: configuredOptionCost.label,
            price: configuredOptionCost.cost,
            source: configuredOptionCost.source || getConfiguredOptionSource(option),
            code: `option-${option.option_id}`,
            reason: configuredOptionCost.reason,
          });
          totalPrice += configuredOptionCost.cost;
          return;
        }
        
        // raw-only 옵션 특별 처리: 원판에 대한 할증
        if (option.option_id === 'raw-only' && option.multiplier) {
          // 원판 할증 = 원장 × (배수 - 1)
          const rawOnlyCharge = wonJang * (option.multiplier - 1);
          breakdown.push({ 
            label: `원판 단독 구매 할증 (×${option.multiplier})`, 
            price: rawOnlyCharge 
          });
          totalPrice += rawOnlyCharge;
          console.log(`Applied raw-only surcharge: ${rawOnlyCharge} (원장: ${wonJang} × (${option.multiplier} - 1))`);
        }
        // 일반 옵션 비용
        else if (option.multiplier !== undefined && option.multiplier !== null && option.multiplier !== 0) {
          // DB에서 additional(추가옵션) multiplier는 UI에도 "원판금액 × multiplier"로 노출되므로
          // (multiplier - 1)이 아니라 "원장 × multiplier"로 계산해야 음수가 나오지 않습니다.
          // 또한 multiplier < 1인 케이스들도 동일하게 "원장 × multiplier"로 취급합니다.
          const isRateMultiplier = shouldUseRateMultiplier(option);

          const optionCost = isRateMultiplier
            ? wonJang * option.multiplier * quantity
            : wonJang * (option.multiplier - 1) * quantity;

          const label = quantity > 1
            ? `${option.name} (×${option.multiplier}) x${quantity}개`
            : `${option.name} (${isRateMultiplier ? '원장×' : '최종 원장×'}${option.multiplier})`;

          breakdown.push({ label, price: optionCost });
          totalPrice += optionCost;

          console.log(
            `Applied option cost for ${option.name}: ${optionCost} ` +
            `(원장: ${wonJang} × ${isRateMultiplier ? option.multiplier : `(${option.multiplier} - 1)`} × ${quantity})`
          );
        }
        
        // base_cost가 있으면 "기본 비용" 적용 (음수 포함)
        if (option.base_cost !== undefined && option.base_cost !== null && option.base_cost !== 0) {
          const baseCostTotal = option.base_cost * quantity;
          const label = quantity > 1
            ? `${option.name} x${quantity}개`
            : `${option.name}`;
          breakdown.push({ label, price: baseCostTotal });
          totalPrice += baseCostTotal;
          console.log(`Applied base_cost for ${option.name}: ${baseCostTotal}`);
        }
      } else if (optionId === 'raw-only') {
        const rawOnlyMultiplier = options.rawOnlyMultiplier || formulaConstants.rawOnlyMultiplier;
        const rawOnlyCharge = wonJang * (rawOnlyMultiplier - 1);
        breakdown.push({
          label: `원판 단독 구매 할증 (×${rawOnlyMultiplier})`,
          price: rawOnlyCharge,
        });
        totalPrice += rawOnlyCharge;
      } else {
        console.warn(`Option not found: ${optionId}`);
      }
    });
  }
  // 배수 중첩 방식: 가공/접착 계산 (원판 단독 구매가 아닌 경우만)
  else if (processingType !== 'raw-only' && options && (options.processing || options.adhesion)) {
    const processing = options.processing || 'none';
    const adhesion = options.adhesion || 'none';
    const processingOptionsData = options?.processingOptionsData || [];
    effectiveAdhesionForGuardrails = adhesion;

    const delta = calcProcessingDelta(
      wonJang,
      thickness,
      processing,
      adhesion,
      {
        qty: options.qty,
        isComplex: options.isComplex,
        edgeRequested: options.edgeRequested,
        bevelLengthM: options.bevelLengthM,
        bevelFeePerM: options.bevelFeePerM,
        laserHoles: options.laserHoles,
        holeFee: options.holeFee,
        corners90: options.corners90,
        useDetailedBond: options.useDetailedBond,
        joinLengthM: options.joinLengthM,
        trayHeightMm: options.trayHeightMm,
        adhesionConfig: options.adhesionConfig,
        formulaConstants,
        processFactors: buildProcessFactorsFromOptions(processingOptionsData),
        bondFactors: buildBondFactorsFromOptions(processingOptionsData),
        processingOptions: processingOptionsData,
        bondProductType: options.bondProductType,
        adhesionBasis: options.adhesionBasis || (options.bondProductType === 'box' || options.bondProductType === 'tray' ? 'product_based' : 'sheet_based'),
        onWarnings: nextWarnings => warnings.push(...nextWarnings),
        onBlockedReasons: nextBlockedReasons => blockedReasons.push(...nextBlockedReasons),
      }
    );

    delta.breakdown.forEach(item => {
      breakdown.push(item);
      totalPrice += item.price;
    });
  }
  // 6) 레거시 방식 (processingType이 문자열로 전달된 경우)
  else if (processingType && processingType !== 'raw-only') {
    const processingCost = calculateProcessingCost(totalPrice, thickness, processingType);
    
    // 기본 계수 적용
    if (processingCost.baseMultiplier !== 1) {
      const multiplierCost = totalPrice * (processingCost.baseMultiplier - 1);
      breakdown.push({ label: `${processingCost.description} (×${processingCost.baseMultiplier})`, price: multiplierCost });
      totalPrice *= processingCost.baseMultiplier;
    }
    
    // 추가 비용 적용
    if (processingCost.additionalCost > 0) {
      breakdown.push({ label: `${processingCost.description} 추가비용`, price: processingCost.additionalCost });
      totalPrice += processingCost.additionalCost;
    }
  }

  // 추가 옵션들 - 맨 마지막에 적용
  // DB에서 가져온 처리 옵션 데이터 사용 (있으면 우선 사용, 없으면 기본값)
  const processingOptionsData = options?.processingOptionsData || [];
  const selectedOptionSet = new Set([
    ...(processingType ? processingType.split('|').filter(Boolean) : []),
    ...Object.entries(options?.selectedAdditionalOptions || {})
      .filter(([, quantity]) => quantity > 0)
      .map(([optionId]) => optionId),
  ]);
  
  const getOptionData = (optionId: string, defaultMultiplier: number) => {
    const dbOption = processingOptionsData.find(opt => opt.option_id === optionId);
    return {
      multiplier: dbOption?.multiplier ?? defaultMultiplier,
      baseCost: dbOption?.base_cost ?? 0,
      name: dbOption?.name ?? optionId
    };
  };

  if (options?.edgeFinishing && !selectedOptionSet.has('edgeFinishing')) {
    const optionData = getOptionData('edgeFinishing', 0.5);
    const polishedEdgeLength = options.polishedEdgeLengthM ?? 0;
    const cost = polishedEdgeLength > 0
      ? formulaConstants.polishedEdgeRatePerM * polishedEdgeLength
      : wonJang * optionData.multiplier + optionData.baseCost;
    if (polishedEdgeLength <= 0) {
      warnings.push('경면/유광 엣지 길이가 없어 기존 원판 비례 금액으로 임시 계산했습니다. 최종 발행 전 엣지 길이 확인이 필요합니다.');
    }
    breakdown.push({ 
      label: polishedEdgeLength > 0
        ? `${optionData.name} (${formulaConstants.polishedEdgeRatePerM.toLocaleString()}원/m × ${polishedEdgeLength.toFixed(2)}m)`
        : `${optionData.name} (경면/유광 엣지 길이 미입력, 원장×${optionData.multiplier})`,
      price: cost,
      source: 'post_processing',
      code: 'option-edgeFinishing',
    });
    totalPrice += cost;
  }

  if (options?.bulgwang && !selectedOptionSet.has('bulgwang')) {
    const optionData = getOptionData('bulgwang', 0.5);
    const polishedEdgeLength = options.polishedEdgeLengthM ?? 0;
    const cost = polishedEdgeLength > 0
      ? formulaConstants.polishedEdgeRatePerM * polishedEdgeLength * formulaConstants.bulgwangFinishMultiplier
      : wonJang * optionData.multiplier * formulaConstants.bulgwangFinishMultiplier + optionData.baseCost;
    warnings.push(polishedEdgeLength > 0
      ? '불광은 표면 투명도와 매끄러움을 높이는 후가공입니다. 미러증착과 별도로 계산됩니다.'
      : '불광 기준 엣지 길이가 없어 기존 원판 비례 금액으로 임시 계산했습니다. 최종 발행 전 경면/유광 엣지 길이 확인이 필요합니다.'
    );
    breakdown.push({ 
      label: polishedEdgeLength > 0
        ? `${optionData.name} (경면/유광 엣지 ${formatPrice(formulaConstants.polishedEdgeRatePerM * polishedEdgeLength)} × ${formulaConstants.bulgwangFinishMultiplier})`
        : `${optionData.name} (경면/유광 엣지 길이 미입력, 원장×${optionData.multiplier}×${formulaConstants.bulgwangFinishMultiplier})`,
      price: cost,
      source: 'post_processing',
      code: 'option-bulgwang',
    });
    totalPrice += cost;
  }

  if (options?.tapung && !selectedOptionSet.has('tapung')) {
    const optionData = getOptionData('tapung', 0.2);
    const cost = basePrice * optionData.multiplier + optionData.baseCost;
    breakdown.push({ 
      label: `${optionData.name} (원판×${optionData.multiplier})`, 
      price: cost 
    });
    totalPrice += cost;
  }

  if (options?.mugwangPainting && !selectedOptionSet.has('mugwangPainting')) {
    const optionData = getOptionData('mugwangPainting', 2.0);
    const cost = basePrice * optionData.multiplier + optionData.baseCost;
    breakdown.push({ 
      label: `${optionData.name} (원판×${optionData.multiplier})`, 
      price: cost 
    });
    totalPrice += cost;
  }

  const guardrails = collectProductionGuardrails(thickness, effectiveAdhesionForGuardrails, options);
  warnings.push(...guardrails.warnings);
  blockedReasons.push(...guardrails.blockedReasons);

  return normalizeCalculationResult(
    totalPrice,
    breakdown,
    Array.from(new Set(warnings)),
    Array.from(new Set(blockedReasons))
  );
};

export const formatPrice = (price: number): string => {
  return `₩${Math.round(price).toLocaleString()}`;
};

export const exportPricingData = (pricingData: PricingData): void => {
  const jsonData = JSON.stringify(pricingData, null, 2);
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pricing-data.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
