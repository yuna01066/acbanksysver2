
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
            
            // 양면 가격 설정 (단면 가격 + 테이프 가격)
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
                // 8T 이상: 양면만 (기본 가격 + 테이프 + 아스텔 추가금액)
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
              
              // 양면 가격 설정 (기본 가격 + 테이프 + 아스텔 추가금액)
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
            
            // 컬러 양면 가격 설정 (단면 가격 + 테이프 가격)
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
              
              // 진백 양면 가격 설정 (기본 가격 + 진백 추가 가격 + 테이프 가격)
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
  | 'cnc-simple' 
  | 'cnc-complex' 
  | 'none';

export type AdhesionProfile = 
  | 'auto'              // 45° vs 90° 자동 비교 후 더 저렴한 쪽
  | 'bond-normal' 
  | 'bond-mugipo-45' 
  | 'bond-mugipo-90' 
  | 'none';

export const ADHESION_CONFIG = {
  setupFee: 150_000,           // 무기포 세팅 고정비 S
  bondRatePerM: 42_000,        // 접착 길이 단가 r (상세모드에서만 사용)
  kVolume: 0.10,               // Q(n)=1/(1+k ln n) 계수
  laborPremium90: 1.12,        // 90° 무기포 인건비 프리미엄
  cornerFinishFee: 4_000,      // 90° 코너 마감 1개당 정액
  thinTrayMaxHeightMm: 60,     // 얕은 트레이 기준 높이
};

export const PROCESS_FACTORS: Record<Exclude<ProcessingProfile, 'auto'>, number> = {
  'simple-cutting': 0,         // 별도 처리(10T 기준 1.2/1.8)
  'laser-simple': 1.7,         // <10T 유리
  'laser-complex': 2.0,
  'cnc-simple': 1.8,
  'cnc-complex': 2.5,
  'none': 1.0,
};

export const BOND_FACTORS = {
  normal: 2.0,
  mugipo90: 2.3,
  mugipo45_thin: 2.2,          // T<10에서 45°
  mugipo45_thick: 2.3,         // T≥10에서 45°
} as const;

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
const autoPickProcessing = (t: number, isComplex: boolean): ProcessingProfile => {
  if (t < 10) return isComplex ? 'laser-complex' : 'laser-simple';
  return isComplex ? 'cnc-complex' : 'cnc-simple';
};

// 45° 무기포 배수 계산 (얕은 트레이 우대)
const bondFactor45 = (t: number, trayHeightMm?: number) => {
  if (t < 10) {
    if (trayHeightMm !== undefined && trayHeightMm <= ADHESION_CONFIG.thinTrayMaxHeightMm) {
      return 2.0; // 얕은 트레이 우대
    }
    return BOND_FACTORS.mugipo45_thin;
  }
  return BOND_FACTORS.mugipo45_thick;
};

// ========== 가공/접착 옵션 인터페이스 ==========

export interface ProcessingDeltaOptions {
  qty?: number;                // 수량 n (기본 1)
  isComplex?: boolean;         // 모양 복잡도(슬릿/다공 등)
  edgeRequested?: boolean;     // 엣지 격면을 별도 청구할지
  bevelLengthM?: number;       // 45° 베벨 총 길이(m)
  bevelFeePerM?: number;       // 베벨 m당 단가 (예: 3,000원)
  laserHoles?: number;         // 타공 개수(옵션)
  holeFee?: number;            // 타공 개당 단가
  corners90?: number;          // 90° 코너 개수(인건비 보정용)
  useDetailedBond?: boolean;   // true면 S/n + rL × Q(n) 적용
  joinLengthM?: number;        // 접착선 총 길이(상세모드용)
  trayHeightMm?: number;       // 트레이 높이(얕은 트레이 판정)
}

export interface ProcessingDeltaResult {
  procCost: number;            // 증분 총액
  descriptions: string[];      // 브레이크다운 라벨
  edgeIncluded: boolean;       // 접착에 엣지 포함 시 true
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

  let procCost = 0;
  const desc: string[] = [];
  let edgeIncluded = false;

  // 1) 가공 프로필 선택
  let pickedProcessing: ProcessingProfile = processing;
  if (processing === 'auto') pickedProcessing = autoPickProcessing(t, isComplex);

  if (pickedProcessing === 'simple-cutting') {
    const f = (t < 10 ? 1.2 : 1.8);
    procCost += materialCost * (f - 1);
    desc.push(`단순 재단 (×${f})`);
  } else if (pickedProcessing !== 'none') {
    const baseF = PROCESS_FACTORS[pickedProcessing as Exclude<ProcessingProfile, 'auto'>];
    const tf = thicknessFactor(t); // 두께계수는 가공에만 반영
    const fEff = baseF * tf;
    procCost += materialCost * (fEff - 1);
    desc.push(`${pickedProcessing} (×${fEff.toFixed(2)})`);
  }

  // 2) 접착 프로필 선택
  let pickedAdhesion: 'none' | 'normal' | '45°' | '90°' = 'none';

  if (adhesion === 'bond-normal') {
    const f = BOND_FACTORS.normal;
    procCost += materialCost * (f - 1);
    desc.push(`일반 접착 (×${f})`);
    pickedAdhesion = 'normal';
  } else if (adhesion === 'bond-mugipo-45' || adhesion === 'bond-mugipo-90' || adhesion === 'auto') {
    // 45°와 90°를 각각 계산해 최소 비용 선택(adhesion==='auto'일 때)
    const f45 = bondFactor45(t, opts.trayHeightMm);
    const f90 = BOND_FACTORS.mugipo90;

    // 배수 기반 증분
    let cost45 = materialCost * (f45 - 1);
    let cost90 = materialCost * (f90 - 1);

    // 90°는 인건비 프리미엄 + 코너 마감비
    cost90 = cost90 * ADHESION_CONFIG.laborPremium90
           + (opts.corners90 ?? 0) * ADHESION_CONFIG.cornerFinishFee;

    // 상세모드: S/n + rL에 Q(n) 적용(두 안에 동일 가중)
    if (opts.useDetailedBond) {
      const S = ADHESION_CONFIG.setupFee;
      const r = ADHESION_CONFIG.bondRatePerM;
      const L = opts.joinLengthM ?? 0;
      const Qn = volumeQ(n, ADHESION_CONFIG.kVolume);
      const detailed = (S / n + r * L) * Qn * n; // 총액
      cost45 += detailed;
      cost90 += detailed;
      desc.push(`무기포 상세 보정(S/n + rL) × Q(n=${n.toLocaleString()})`);
    }

    // 45° 베벨 정액(길이 기반)이 있으면 45°쪽에만 추가
    if (opts.bevelLengthM && opts.bevelFeePerM) {
      const bevelAdd = opts.bevelLengthM * opts.bevelFeePerM;
      cost45 += bevelAdd;
      desc.push(`45° 베벨 (+${bevelAdd.toLocaleString()}원)`);
    }

    // 선택 강제 vs 자동
    let chosenCost = cost45;
    pickedAdhesion = '45°';
    let chosenLabel = `무기포 45° (×${f45})`;

    if (adhesion === 'bond-mugipo-90') {
      chosenCost = cost90;
      pickedAdhesion = '90°';
      chosenLabel = `무기포 90° (×${f90}, 프리미엄×${ADHESION_CONFIG.laborPremium90}${(opts.corners90 ?? 0) ? `, 코너 ${opts.corners90}개` : ''})`;
    } else if (adhesion === 'auto') {
      if (cost90 < cost45) {
        chosenCost = cost90;
        pickedAdhesion = '90°';
        chosenLabel = `무기포 90° (×${f90}, 프리미엄×${ADHESION_CONFIG.laborPremium90}${(opts.corners90 ?? 0) ? `, 코너 ${opts.corners90}개` : ''})`;
      }
    }

    procCost += chosenCost;
    desc.push(chosenLabel);
    edgeIncluded = true; // 무기포는 레이저/엣지 포함 정의 → 별도 엣지 청구 OFF
  }

  // 3) 엣지(요청 시, 무기포 포함이면 비활성)
  if (opts.edgeRequested && !edgeIncluded) {
    const f = (t <= 10 ? 1.8 : 2.0);
    procCost += materialCost * (f - 1);
    desc.push(`엣지 격면 (×${f})`);
  }

  // 4) 기타 정액 옵션(타공 등)
  if ((opts.laserHoles ?? 0) > 0 && (opts.holeFee ?? 0) > 0) {
    const add = (opts.laserHoles! * opts.holeFee!);
    procCost += add;
    desc.push(`레이저 타공 ${opts.laserHoles}개 (+${add.toLocaleString()}원)`);
  }

  return {
    procCost,
    descriptions: desc,
    edgeIncluded,
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
  processingType: string,
  inquiryType: 'raw-only' | 'with-processing' = 'with-processing'
): ProcessingCostCalculation => {
  const thicknessValue = parseFloat(thickness.replace('T', ''));
  let baseMultiplier = 1;
  let additionalCost = 0;
  let description = '';

  // 문의 유형에 따른 기본 계수 적용
  if (inquiryType === 'raw-only') {
    baseMultiplier = 1.3; // 원장만 문의
    description = '원장 단독 구매';
  } else {
    baseMultiplier = 1.2; // 재단/가공 포함 문의
  }

  // 가공 유형별 추가 계산
  switch (processingType) {
    case 'raw-only':
      // 원장만 구매는 이미 위에서 처리됨
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
      if (thicknessValue <= 10) {
        baseMultiplier = 1.8;
        description = '엣지 격면 마감 (10T 이하)';
      } else {
        baseMultiplier = 2.0;
        description = '엣지 격면 마감 (10T 초과)';
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

// V2: 증분 방식 가격 계산 (문의 배수는 자재비에만, 가공/접착은 증분으로)
export interface CalculatePriceV2Options {
  inquiryType?: 'with-processing' | 'raw-only';  // 문의 유형
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
}

export const calculatePrice = (
  materialId: string,
  qualityId: string,
  thickness: string,
  size: string,
  surface: string,
  colorType?: string,
  processingType?: string,
  colorMixingCost: number = 0,
  options?: CalculatePriceV2Options
): { totalPrice: number; breakdown: { label: string; price: number }[] } => {
  const breakdown: { label: string; price: number }[] = [];
  
  if (materialId !== 'casting') {
    return { totalPrice: 0, breakdown: [{ label: '지원되지 않는 소재', price: 0 }] };
  }

  // 사이즈에서 실제 키 추출 (예: "소3*6 (850*1750)" -> "소3*6")
  const sizeKey = size.split(' ')[0];

  // 1) 기본 단면 가격 가져오기 (원자재 비용)
  let basePrice = 0;
  
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
    
    // 진백 추가금액
    if (colorType === '진백') {
      const jinbaekPrice = jinbaekPrices[sizeKey as keyof typeof jinbaekPrices] || 0;
      if (jinbaekPrice > 0) {
        breakdown.push({ label: '진백 추가금액', price: jinbaekPrice });
        basePrice += jinbaekPrice;
      }
    }
  }

  // 2) 양면 추가금액 (자재비에 포함)
  if (surface === '양면') {
    let doubleSidePrice = 0;
    
    if (qualityId === 'astel-color') {
      doubleSidePrice = tapePrices[sizeKey as keyof typeof tapePrices] || 0;
      breakdown.push({ label: '양면 테이프 추가금액', price: doubleSidePrice });
    } else if (qualityId === 'satin-color') {
      doubleSidePrice = satinDoubleSideSurcharge[sizeKey as keyof typeof satinDoubleSideSurcharge] || 0;
      breakdown.push({ label: '사틴 양면 추가금액', price: doubleSidePrice });
    } else {
      doubleSidePrice = tapePrices[sizeKey as keyof typeof tapePrices] || 0;
      breakdown.push({ label: '양면 테이프 추가금액', price: doubleSidePrice });
    }
    
    basePrice += doubleSidePrice;
  }

  // 3) 조색비 추가 (자재비에 포함)
  if (colorMixingCost > 0) {
    breakdown.push({ label: '조색비', price: colorMixingCost });
    basePrice += colorMixingCost;
  }

  // 4) 문의 배수 적용 (자재비에만!)
  let materialCost = basePrice;
  const inquiryType = options?.inquiryType || (processingType === 'raw-only' ? 'raw-only' : 'with-processing');
  
  if (inquiryType === 'raw-only') {
    const inquiryDelta = basePrice * 0.8; // ×1.8 → 증분 +80%
    breakdown.push({ label: '원장 단독 구매 할증 (×1.8)', price: inquiryDelta });
    materialCost += inquiryDelta;
  } else {
    const inquiryDelta = basePrice * 0.2; // ×1.2 → 증분 +20%
    breakdown.push({ label: '가공 포함 문의 할증 (×1.2)', price: inquiryDelta });
    materialCost += inquiryDelta;
  }

  let totalPrice = materialCost;

  // 5) 새로운 V2 방식: 가공/접착 증분 계산
  if (options && (options.processing || options.adhesion)) {
    const processing = options.processing || 'none';
    const adhesion = options.adhesion || 'none';
    
    // 단순 재단의 경우 순수 자재비 기준, 다른 가공은 할증 적용된 자재비 기준
    const costBasisForProcessing = (processing === 'simple-cutting') ? basePrice : materialCost;
    
    const deltaResult = calcProcessingDelta(
      costBasisForProcessing,
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
      }
    );

    // 증분 비용 추가
    totalPrice += deltaResult.procCost;
    
    // breakdown에 상세 설명 추가
    deltaResult.descriptions.forEach(desc => {
      breakdown.push({ label: desc, price: 0 }); // 개별 항목은 설명만, 총액은 아래에
    });
    
    if (deltaResult.procCost > 0) {
      breakdown.push({ label: '가공/접착 총 증분', price: deltaResult.procCost });
    }
  }
  // 6) 레거시 방식 (processingType이 문자열로 전달된 경우)
  else if (processingType && processingType !== 'raw-only') {
    const inquiryTypeOld: 'raw-only' | 'with-processing' = 'with-processing';
    const processingCost = calculateProcessingCost(totalPrice, thickness, processingType, inquiryTypeOld);
    
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

