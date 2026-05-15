
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
  | 'laser-simple' 
  | 'laser-complex' 
  | 'laser-full'
  | 'cnc-simple' 
  | 'cnc-complex'
  | 'cnc-full'
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

// 기본 접착 관련 설정 (DB 값이 없을 때 사용)
export const DEFAULT_ADHESION_CONFIG: AdhesionConfigData = {
  setupFee: 150_000,
  bondRatePerM: 42_000,
  kVolume: 0.10,
  laborPremium90: 1.12,
  cornerFinishFee: 4_000,
  thinTrayMaxHeightMm: 60,
};

// 기본 가공 배수 (DB 값이 없을 때 사용)
export const DEFAULT_PROCESS_FACTORS: ProcessFactorsData = {
  'simple-cutting': 0,
  'laser-simple': 1.7,
  'laser-complex': 2.0,
  'laser-full': 2.5,
  'cnc-simple': 1.8,
  'cnc-complex': 2.5,
  'cnc-full': 3.0,
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
  'laser-simple': number;
  'laser-complex': number;
  'laser-full': number;
  'cnc-simple': number;
  'cnc-complex': number;
  'cnc-full': number;
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
  processFactors?: ProcessFactorsData;
  bondFactors?: BondFactorsData;
  processingOptions?: ProcessingOptionData[];
}

export interface ProcessingDeltaResult {
  procCost: number;            // 증분 총액
  descriptions: string[];      // 브레이크다운 라벨
  breakdown: { label: string; price: number }[];
  edgeIncluded: boolean;       // 접착에 엣지 포함 시 true
  hasAdhesion: boolean;        // 접착 가공 포함 여부
  picked: {
    processing: ProcessingProfile;
    adhesion: 'none' | 'normal' | '45°' | '90°';
  };
}

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
  const processFactors = opts.processFactors || DEFAULT_PROCESS_FACTORS;
  const bondFactors = opts.bondFactors || DEFAULT_BOND_FACTORS;

  let procCost = 0;
  const desc: string[] = [];
  const breakdown: { label: string; price: number }[] = [];
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

  if (pickedProcessing === 'simple-cutting') {
    const f = (t < 10 ? 1.2 : 1.8);
    addCost(`단순 재단 (원장×${f})`, materialCost * (f - 1));
  } else if (pickedProcessing !== 'none') {
    const baseF = processFactors[pickedProcessing as Exclude<ProcessingProfile, 'auto'>];
    const fEff = baseF || 1;
    addCost(`${pickedProcessing} (원장×${fEff.toFixed(2)})`, materialCost * (fEff - 1));
  }

  // 2) 접착 프로필 선택
  let pickedAdhesion: 'none' | 'normal' | '45°' | '90°' = 'none';

  if (adhesion === 'bond-normal' || adhesion === '45-normal' || adhesion === '90-normal') {
    const f = bondFactors.normal;
    let normalCost = materialCost * (f - 1);
    let label = `일반 접착 (원장×${f})`;

    if (adhesion === '45-normal') {
      pickedAdhesion = '45°';
      label = `45° 일반 접착 (원장×${f})`;
      if (opts.bevelLengthM && opts.bevelFeePerM) {
        const bevelAdd = opts.bevelLengthM * opts.bevelFeePerM;
        normalCost += bevelAdd;
        label += ` + 45° 베벨 ${opts.bevelLengthM}m`;
      }
    } else if (adhesion === '90-normal') {
      pickedAdhesion = '90°';
      normalCost = normalCost * adhesionConfig.laborPremium90
                 + (opts.corners90 ?? 0) * adhesionConfig.cornerFinishFee;
      label = `90° 일반 접착 (원장×${f}, 프리미엄×${adhesionConfig.laborPremium90}${(opts.corners90 ?? 0) ? `, 코너 ${opts.corners90}개` : ''})`;
    } else {
      pickedAdhesion = 'normal';
    }

    addCost(label, normalCost);
    hasAdhesion = true;
  } else if (
    adhesion === 'bond-mugipo-45' ||
    adhesion === 'bond-mugipo-90' ||
    adhesion === '45-mugipo' ||
    adhesion === '90-mugipo' ||
    adhesion === 'auto'
  ) {
    // 45°와 90°를 각각 계산해 최소 비용 선택(adhesion==='auto'일 때)
    const f45 = bondFactor45(t, opts.trayHeightMm, bondFactors, adhesionConfig);
    const f90 = bondFactors.mugipo90;

    // 배수 기반 증분
    let cost45 = materialCost * (f45 - 1);
    let cost90 = materialCost * (f90 - 1);

    // 90°는 인건비 프리미엄 + 코너 마감비
    cost90 = cost90 * adhesionConfig.laborPremium90
           + (opts.corners90 ?? 0) * adhesionConfig.cornerFinishFee;

    // 상세모드: S/n + rL에 Q(n) 적용(두 안에 동일 가중)
    if (opts.useDetailedBond) {
      const S = adhesionConfig.setupFee;
      const r = adhesionConfig.bondRatePerM;
      const L = opts.joinLengthM ?? 0;
      const Qn = volumeQ(n, adhesionConfig.kVolume);
      const detailed = (S / n + r * L) * Qn * n; // 총액
      cost45 += detailed;
      cost90 += detailed;
      desc.push(`무기포 상세 보정(S/n + rL) × Q(n=${n.toLocaleString()})`);
    }

    // 45° 베벨 정액(길이 기반)이 있으면 45°쪽에만 추가
    if (opts.bevelLengthM && opts.bevelFeePerM) {
      const bevelAdd = opts.bevelLengthM * opts.bevelFeePerM;
      cost45 += bevelAdd;
    }

    // 선택 강제 vs 자동
    let chosenCost = cost45;
    pickedAdhesion = '45°';
    let chosenLabel = `무기포 45° 접착 (원장×${f45})`;

    if (adhesion === 'bond-mugipo-90' || adhesion === '90-mugipo') {
      chosenCost = cost90;
      pickedAdhesion = '90°';
      chosenLabel = `무기포 90° 접착 (원장×${f90}, 프리미엄×${adhesionConfig.laborPremium90}${(opts.corners90 ?? 0) ? `, 코너 ${opts.corners90}개` : ''})`;
    } else if (adhesion === 'auto') {
      if (cost90 < cost45) {
        chosenCost = cost90;
        pickedAdhesion = '90°';
        chosenLabel = `무기포 90° 접착 (원장×${f90}, 프리미엄×${adhesionConfig.laborPremium90}${(opts.corners90 ?? 0) ? `, 코너 ${opts.corners90}개` : ''})`;
      }
    }

    addCost(chosenLabel, chosenCost);
    edgeIncluded = true; // 무기포는 레이저/엣지 포함 정의 → 별도 엣지 청구 OFF
    hasAdhesion = true;
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
  tapung?: boolean;                               // 타공
  mugwangPainting?: boolean;                      // 무광 도장
  processingOptionsData?: ProcessingOptionData[]; // DB에서 가져온 가공 옵션 데이터
  rawOnlyMultiplier?: number;                     // 원판 단독 구매 할증률 (DB에서 가져옴)
  adhesionConfig?: AdhesionConfigData;            // 접착 설정 (DB)
  processFactors?: ProcessFactorsData;            // 가공 배수 (DB)
  bondFactors?: BondFactorsData;                  // 접착 배수 (DB)
  selectedAdditionalOptions?: Record<string, number>; // 추가 옵션 수량
  totalWonJangBase?: number; // 여러 원장의 합계 (옵션 계산 시 기준가)
}

export interface ProcessingOptionData {
  option_id: string;
  name: string;
  option_type?: string;
  category?: string;
  multiplier?: number;
  base_cost?: number;
  is_active?: boolean;
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
  'laser-simple': 'laser-simple',
  'laser-complex': 'laser-complex',
  'laser-full': 'laser-full',
  'cnc-simple': 'cnc-simple',
  'cnc-complex': 'cnc-complex',
  'cnc-full': 'cnc-full',
};

const ADHESION_PROFILE_IDS: Record<string, AdhesionProfile> = {
  'bond-normal': 'bond-normal',
  'bond-mugipo-auto': 'auto',
  'bond-mugipo-45': 'bond-mugipo-45',
  'bond-mugipo-90': 'bond-mugipo-90',
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
  'laser-simple': getOptionMultiplier(options, ['laser-simple']) ?? DEFAULT_PROCESS_FACTORS['laser-simple'],
  'laser-complex': getOptionMultiplier(options, ['laser-complex']) ?? DEFAULT_PROCESS_FACTORS['laser-complex'],
  'laser-full': getOptionMultiplier(options, ['laser-full']) ?? DEFAULT_PROCESS_FACTORS['laser-full'],
  'cnc-simple': getOptionMultiplier(options, ['cnc-simple']) ?? DEFAULT_PROCESS_FACTORS['cnc-simple'],
  'cnc-complex': getOptionMultiplier(options, ['cnc-complex']) ?? DEFAULT_PROCESS_FACTORS['cnc-complex'],
  'cnc-full': getOptionMultiplier(options, ['cnc-full']) ?? DEFAULT_PROCESS_FACTORS['cnc-full'],
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
): { totalPrice: number; breakdown: { label: string; price: number }[] } => {
  const breakdown: { label: string; price: number }[] = [];
  
  if (materialId !== 'casting') {
    return { totalPrice: 0, breakdown: [{ label: '지원되지 않는 소재', price: 0 }] };
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
    return {
      totalPrice: 0,
      breakdown: [{
        label: `생산 불가 조합 또는 단가 미등록: ${qualityId} / ${thickness} / ${sizeKey}`,
        price: 0
      }]
    };
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

  // ===== 원장 금액 계산 완료 =====
  // 원장 = 원판금액 + 면수(양단면) + 조색비
  // 여러 원장인 경우, totalWonJangBase로 전달된 값을 사용
  const wonJang = options?.totalWonJangBase || basePrice;
  
  console.log('원장 기준:', { wonJang, basePrice, totalWonJangBase: options?.totalWonJangBase });
  
  // 6) processingType이 있는 경우 슬롯 기반 처리
  if (processingType && processingType !== '' && options?.processingOptionsData) {
    const processingOptionsData = options?.processingOptionsData || [];
    const selectedOptionIds = processingType.split('|').filter(Boolean);
    const hasDetailedProcessingInputs =
      !!options.useDetailedBond ||
      (options.joinLengthM ?? 0) > 0 ||
      (options.bevelLengthM ?? 0) > 0 ||
      (options.corners90 ?? 0) > 0 ||
      options.trayHeightMm !== undefined;
    
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
    let fallbackAdhesion: AdhesionProfile = 'none';
    const optionIdsForGenericCalculation: string[] = [];

    selectedOptionIds.forEach(optionId => {
      const option = processingOptionsData.find(opt => opt.option_id === optionId && opt.is_active);
      const needsProfileDelta =
        isKnownProfileOptionId(optionId) &&
        (
          hasDetailedProcessingInputs ||
          !option ||
          (
            (option.multiplier === undefined || option.multiplier === null || option.multiplier === 0) &&
            (option.base_cost === undefined || option.base_cost === null || option.base_cost === 0)
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
          processFactors: buildProcessFactorsFromOptions(processingOptionsData),
          bondFactors: buildBondFactorsFromOptions(processingOptionsData),
          processingOptions: processingOptionsData,
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
        const rawOnlyCharge = wonJang * ((options.rawOnlyMultiplier || 1.8) - 1);
        breakdown.push({
          label: `원판 단독 구매 할증 (×${options.rawOnlyMultiplier || 1.8})`,
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
        processFactors: buildProcessFactorsFromOptions(processingOptionsData),
        bondFactors: buildBondFactorsFromOptions(processingOptionsData),
        processingOptions: processingOptionsData,
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
  
  const getOptionData = (optionId: string, defaultMultiplier: number) => {
    const dbOption = processingOptionsData.find(opt => opt.option_id === optionId);
    return {
      multiplier: dbOption?.multiplier ?? defaultMultiplier,
      baseCost: dbOption?.base_cost ?? 0,
      name: dbOption?.name ?? optionId
    };
  };

  if (options?.edgeFinishing) {
    const optionData = getOptionData('edgeFinishing', 0.5);
    const cost = basePrice * optionData.multiplier + optionData.baseCost;
    breakdown.push({ 
      label: `${optionData.name} (원판×${optionData.multiplier})`, 
      price: cost 
    });
    totalPrice += cost;
  }

  if (options?.bulgwang) {
    const optionData = getOptionData('bulgwang', 0.5);
    const cost = basePrice * optionData.multiplier + optionData.baseCost;
    breakdown.push({ 
      label: `${optionData.name} (원판×${optionData.multiplier})`, 
      price: cost 
    });
    totalPrice += cost;
  }

  if (options?.tapung) {
    const optionData = getOptionData('tapung', 0.2);
    const cost = basePrice * optionData.multiplier + optionData.baseCost;
    breakdown.push({ 
      label: `${optionData.name} (원판×${optionData.multiplier})`, 
      price: cost 
    });
    totalPrice += cost;
  }

  if (options?.mugwangPainting) {
    const optionData = getOptionData('mugwangPainting', 2.0);
    const cost = basePrice * optionData.multiplier + optionData.baseCost;
    breakdown.push({ 
      label: `${optionData.name} (원판×${optionData.multiplier})`, 
      price: cost 
    });
    totalPrice += cost;
  }

  return { totalPrice, breakdown };
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
