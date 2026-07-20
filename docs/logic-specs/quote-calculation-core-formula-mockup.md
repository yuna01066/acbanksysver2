# 견적 핵심 산식 검증 목업

이 문서는 기존 견적 계산기에 직접 연결하지 않고, 새 산식과 마진 방향을 수기로 검토하기 위한 문서+표 기반 목업이다. 실제 DB 전체를 복제하지 않고 대표 샘플 단가를 문서 내부에 고정한다.

## 1. 수량 변수 분리

기존 문서의 `Q` 단일 표기는 수량 의미가 섞일 수 있으므로 아래처럼 분리한다.

| 변수 | 의미 | 적용 위치 | 중복 과금 방지 규칙 |
| --- | --- | --- | --- |
| `panelQty` | 선택한 원판 장수 | 원장 금액 `W`를 장수만큼 합산할 때 | 원판 구매 수량이다. 견적 항목 수량과 다시 곱하지 않는다. |
| `optionQty` | 특정 옵션의 수량 | 타공, 부속, 옵션별 개수/길이/코너 계산 | 옵션 행에만 곱한다. `lineQty`와 역할이 다르다. |
| `lineQty` | 견적 항목 수량 | 견적 합계 단계 | 계산 결과 `itemAmount`를 견적서에서 몇 번 반복할지 결정한다. |
| `productQty` | 제작물 수량 | 제품 기준 접착, 세팅비 배분, 수량 할인 | 제품 제작 상세 계산에만 사용한다. 원판 장수와 같다고 가정하지 않는다. |

## 2. 목업 샘플 기준값

아래 값은 검산용 고정값이다. 실제 DB 단가와 다를 수 있다.

| 항목 | 값 |
| --- | ---: |
| `P_5T_4x8_CLEAR_단면` | 92,700 |
| `P_5T_4x8_CLEAR_양면` | 97,900 |
| `P_10T_4x8_CLEAR_단면` | 185,400 |
| `P_5T_소3x6_CLEAR_단면` | 46,400 |
| `doubleSurface_4x8` | 5,200 |
| `materialSurcharge` | 별도 입력 |
| `colorMixing_5T` | 40,000 |
| `whitePigmentSurcharge_suri_jinbaek` | 별도 입력 |
| `rawOnlyMultiplier` | 1.8 |
| `simpleCutThinMultiplier` | 1.2 |
| `simpleCutThickMultiplier` | 1.8 |
| `mugipo45ThinMultiplier` | 3.2 |
| `mugipo45ThickMultiplier` | 3.3 |
| `mugipo90Multiplier` | 3.5 |
| `normalBondMultiplier` | 2.0 |
| `laborPremium90` | 1.12 |
| `cornerFinishFee` | 4,000 |
| `bevelFeePerM` | 3,000 |
| `productBondSetupFee` | 50,000 |
| `productBondRatePerM` | 15,000 |
| `mugipoBoxSetupFee` | 50,000 |
| `mugipoBoxBondRatePerM` | 44,000~45,000 |
| `mugipoBoxMinSalePrice_5T_250Cube` | 300,000 |
| `volumeDiscountK` | 0.15 |
| `edgeFinishingRate` | 0.5 |
| `bulgwangEdgeMultiplier` | 3.0 |
| `fabricationBaseMultiplier` | 1.3 |
| `complexCutSetupFee` | 70,000 |
| `laserThinFee` | 50,000 |
| `laserThickFee` | 70,000 |
| `laserFullThinSheetFee` | 200,000 |
| `cncGeneralFee` | 70,000 |
| `cncHeavyFee` | 100,000 |
| `cncInterlockingSlotFee` | 70,000 |
| `complexShapeFeeRange` | 200,000~300,000 |
| `uvBackPrintBaseAreaMm2` | 10,000 |
| `uvBackPrint1ColorBaseFee` | 10,000 |
| `uvBackPrint2ColorBaseFee` | 15,000 |
| `uvBackPrint3ColorBaseFee` | 30,000 |
| `uvBackPrintSheetAttachBaseFee` | 5,000 |
| `uvBackPrintHandlingBaseFee` | 10,000 |
| `uvBackSidePrintUnitSurcharge` | 3,000 |
| `uvSheetOutsourceUnitCostManual` | 건별 수동 입력 |
| `dyeOutsourceBaseAreaMm2` | 10,000 |
| `dyeOutsource1ColorBaseFee` | 30,000 |
| `interlockingAssemblyLossPremiumRate` | 30% |
| `cutCoverageThreshold` | 2/3 |
| `cutPieceSizeThreshold` | 300×300mm |
| `taxRate` | 10% |

### 2.1 원장 공급가 기준표

2026-06-01 기준 운영 단가는 A/B 공급사 단가표를 함께 반영한다. 기존 목업 표는 과거 검산용으로 남겨두며, 신규 견적 계산기 기준가는 아래 규칙이 우선한다.

- B 단가표의 `3X6(소)`는 내부 `소3*6`로, `정3X6`은 내부 `대3*6`로 매핑한다.
- 신규 견적 계산기 선택지는 `소3*6`, `대3*6` 두 구간만 유지한다. 기존 `3*6` row는 과거 견적 호환용 레거시 데이터로 비활성 보존한다.
- A 단가표의 색상판 표시는 테이프 포함가이므로 `A 단면 환산가 = A 표시가 - A 테이프 추가금`으로 계산한다.
- B 단가표는 단면 기준가로 사용한다.
- 기본 원판가 `P = ceil(max(A 단면 환산가, B 단면가) * 1.03 / 100) * 100`이다.
- 양단면, 사틴/아스텔, 브라이트/진백 추가금도 A/B 중 높은 추가금에 3% 버퍼를 적용하고 100원 단위로 올림한다.
- 사틴은 `대3*6`, `1*2`, `4*8`만 생산 가능 규격으로 선택한다.
- 아스텔은 `대3*6`, `4*5`, `대4*5`, `1*2`, `4*8`만 생산 가능 규격으로 선택한다.

대표 검산값은 다음과 같다.

| 조합 | 적용가 |
| --- | ---: |
| `5T 소3*6 CLEAR 단면` | 46,400 |
| `5T 대3*6 CLEAR 단면` | 53,100 |
| `5T 4*8 CLEAR 단면` | 92,700 |
| `10T 4*8 CLEAR 단면` | 185,400 |
| `20T 대3*6 CLEAR 단면` | 245,300 |

아래 표는 `2025.08.01 시행 장원산업 캐스팅 아크릴 단가표 (유광/재질 색상판)` 이미지에서 판독한 과거 유광 색상판 원장 공급가다. VAT 별도, 단위는 원이다. 목업에서 `P`는 이 공급가를 원천값으로 보고, 양면은 테이프(양면) 추가비를 더해 `W`를 만든다.

| 두께 | 3*6 910*1810 | 대3*6 950*1860 | 4*5 1170*1475 | 대4*5 1250*1550 | 1*2 1050*2050 | 4*6 1250*1860 | 4*8 1250*2450 | 4*10 1250*3050 | 5*6 1550*1850 | 5*8 1550*2450 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1.3T | 23,200 | 25,200 | 25,200 | - | - | - | - | - | - | - |
| 1.5T | 23,200 | 25,200 | 25,200 | - | - | - | - | - | - | - |
| 2T | 23,200 | 25,200 | 25,200 | - | - | - | - | - | - | - |
| 3T | 30,000 | 32,600 | 31,900 | 35,600 | 39,700 | 42,500 | 55,100 | - | - | - |
| 4T | 39,300 | 43,100 | 42,100 | 47,400 | 52,500 | 56,200 | 73,600 | - | - | - |
| 5T | 44,900 | 49,900 | 48,900 | 58,600 | 64,700 | 69,200 | 90,600 | 170,000 | 118,700 | 156,200 |
| 6T | 59,300 | 64,100 | 62,600 | 70,700 | 77,300 | 83,200 | 106,600 | 203,800 | 142,400 | 187,200 |
| 8T | 78,000 | 84,600 | 82,100 | 92,600 | 102,200 | 110,700 | 145,100 | 270,500 | 188,300 | 248,000 |
| 10T | 96,500 | 103,600 | 101,600 | 114,600 | 126,700 | 136,200 | 179,600 | 336,500 | 232,800 | 307,400 |
| 12T | 125,800 | 135,700 | 131,900 | 148,900 | 164,400 | 177,000 | 234,600 | 438,100 | 302,300 | 399,000 |
| 15T | 156,300 | 168,400 | 164,700 | 186,100 | 205,700 | 221,200 | 293,100 | 546,200 | 376,500 | 499,400 |
| 20T | 213,100 | 229,500 | 224,700 | 254,200 | 280,900 | 302,500 | 401,600 | 750,200 | 515,500 | 683,600 |
| 25T | 276,700 | 298,300 | 292,300 | 331,500 | 366,200 | 395,200 | 526,300 | 984,700 | 675,700 | 898,700 |
| 30T | 338,900 | 365,700 | 358,000 | 407,900 | 450,500 | 487,300 | 650,900 | 1,220,800 | 835,900 | 1,115,100 |

테이프(양면) 추가비는 아래 값을 사용한다.

| 추가비 | 3*6 | 대3*6 | 4*5 | 대4*5 | 1*2 | 4*6 | 4*8 | 4*10 | 5*6 | 5*8 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 테이프(양면) | 2,000 | 2,600 | 2,600 | 2,600 | 3,200 | 3,200 | 3,600 | 5,000 | 6,000 | 7,000 |

#### 2.1.1 스리/진백 화이트 안료 추가금

단가표의 `스리`, `진백` 표기는 원장 기본 공급가가 아니라 화이트 안료가 추가될 때의 추가금으로 본다. 따라서 이 값은 `P`에 섞지 않고 `pigmentSurcharge`로 분리한다.

| 항목 | 적용 조건 | 계산 반영 | 비고 |
| --- | --- | --- | --- |
| 스리 화이트 안료 추가금 | 색상/조색 선택이 `스리`인 경우 | `W = P + surfaceSurcharge + whitePigmentSurcharge` | 원장 공급가 `P`와 별도 관리 |
| 진백 화이트 안료 추가금 | 색상/조색 선택이 `진백`인 경우 | `W = P + surfaceSurcharge + whitePigmentSurcharge` | 원장 공급가 `P`와 별도 관리 |

#### 2.1.2 재질 추가금

단가표의 재질 항목은 기본 유광 원장 공급가 `P`가 아니라 재질이 추가될 때의 추가금으로 본다. 따라서 사틴 같은 특정 명칭 대신 `재질 추가금`으로 표기하고 `materialSurcharge`에 반영한다.

| 항목 | 적용 조건 | 계산 반영 | 비고 |
| --- | --- | --- | --- |
| 재질 추가금 | 기본 유광이 아닌 재질 선택 시 | `W = P + surfaceSurcharge + materialSurcharge` | 원장 공급가 `P`와 별도 관리 |
| 아스텔 재질 | 아스텔 선택 시 | `W = P + surfaceSurcharge + materialSurcharge` | 단, 4*10 규격은 제작 불가 |

판독 메모: 현재 목업의 원장 공급가 표에는 확실히 읽히는 유광 색상판 원장 공급가와 테이프(양면) 추가비만 반영했다. `스리/진백` 금액은 화이트 안료 추가금 기준표로, 재질 금액은 재질 추가금 기준표로 별도 입력해야 한다.

### 2.2 파이프 원자재 금액 기준표

아래 값은 판재 원장 공급가와 별도로 관리하는 파이프 원자재 금액이다. 단위는 원이며, 목업에서는 `pipeMaterialCost` 원천값으로 사용한다.

| 품목 | 두께 | 길이 | 원자재 금액 | 1m 환산 | 비고 |
| --- | --- | ---: | ---: | ---: | --- |
| 600파이 파이프 | 5T | 2m | 780,000 | 390,000 | 2m 기준 공급가 |
| 600파이 파이프 | 5T | 1m | 390,000 | 390,000 | 2m 금액의 1m 환산값 |
| 800파이 파이프 | 5T | 1m | 582,500 | 582,500 | 1m 기준 공급가 |

## 3. 기준 모드

| 모드 | 사용 조건 | 핵심 기준금액 | 비고 |
| --- | --- | --- | --- |
| `sheet_based` | 기본 원판 견적, 빠른 견적, 접착선/코너/제품 유형이 없는 경우 | `ΣW` | 현재 앱의 빠른 견적 UX를 유지한다. |
| `product_based` | 박스/트레이, 접착선 길이, 코너 수, 제품 수량이 있는 경우 | `ΣW + 상세 제작비` | 접착선 길이, 코너, 세팅비, 수량 할인, 리스크 판정을 반영한다. |

전환 규칙: 기본은 `sheet_based`이고, `bondProductType in (box, tray)` 또는 `joinLengthM > 0` 또는 `corners90 > 0` 또는 `useDetailedBond = true`이면 `product_based` 검토 대상으로 본다.

운영 기준: 가공 없이 원판만 구매하는 `raw-only`는 빠른 견적 최소가가 아니라 별도 원판 판매 유형으로 보고 `ΣW × 1.8`을 적용한다. 재단/가공/접착이 포함된 견적과 혼동하지 않는다.

## 4. 재단 등급 분류

재단 등급은 제작 난이도보다 상담원이 실제로 구분하는 작업 성격을 우선한다.

| 등급 | 판정 기준 | 산식 방향 | 운영 메모 |
| --- | --- | --- | --- |
| 단순 재단 | 원판을 배송/화물비 절감 목적으로 분절하는 경우. 가로 또는 세로 1회 수준의 단순 절단. | 10T 미만 `ΣW × 1.2`, 10T 이상 `ΣW × 1.8` | 제품 부품을 빼곡히 만드는 가공이 아니라 납품을 쉽게 하기 위한 절단이다. |
| 복합 재단 | 한 판 사용 범위가 원판의 2/3 미만이고, 주요 재단물이 300×300mm보다 큰 경우. | `ΣW × 1.3 + 복합 재단 세팅비` | 원장 마진은 `1.3`으로 확보하고, 복합 재단 세팅비 기본값 `70,000`을 더한다. |
| 다중 재단 | 한 판 사용 범위가 원판의 2/3 이상이고, 300×300mm보다 작은 조각을 빼곡히 재단해야 하는 경우. | `ΣW × 1.3 + 작업시간 공임` | 조각 수, 배열 밀도, 타공/내부컷 여부에 따라 200,000~300,000원 이상 또는 검수 대상으로 본다. |
| 경계/혼합 | 2/3 근처, 300×300mm 전후, 큰 조각과 작은 조각이 섞인 경우. | `needs_review` 후 작업자가 등급 선택 | 자동 산식보다 작업시간 판단이 우선이다. |

## 5. 핵심 산식 표

| 단계 | 산식 | 설명 |
| --- | --- | --- |
| 원장 금액 | `W = P + surfaceSurcharge + materialSurcharge + pigmentSurcharge + colorMixingCost` | 원판 기본가에 면수, 재질, 안료, 조색 관련 금액을 더한다. |
| 다중 원판 합계 | `ΣW = Σ(W_i × panelQty_i)` | 여러 원판 선택 시 원판별 `W`를 먼저 합산한다. |
| 원판 단독 구매 | `processingCost = ΣW × (rawOnlyMultiplier - 1)` | 가공 없이 원판만 구매하는 경우다. 최종 금액은 `ΣW × 1.8`. |
| 단순 재단 10T 미만 | `processingCost = ΣW × (1.2 - 1)` | 원판 분절/화물비 절감용 절단이다. 최종 `ΣW × 1.2`. |
| 단순 재단 10T 이상 | `processingCost = ΣW × (1.8 - 1)` | 두꺼운 원판 분절 기준이다. 최종 `ΣW × 1.8`. |
| 복합 재단 | `processingCost = ΣW × (1.3 - 1) + complexCutSetupFee` | 원판 2/3 미만 범위, 300×300mm보다 큰 조각 중심. 최종 `ΣW × 1.3 + 70,000`. |
| 다중 재단 | `processingCost = ΣW × (1.3 - 1) + timeLaborFee` | 원판 2/3 이상 범위, 300×300mm보다 작은 조각을 빼곡히 재단. 최종 `ΣW × 1.3 + 작업시간 공임`. |
| 레이저 10T 이하 | `processingCost = ΣW × (1.3 - 1) + laserThinFee` | 최종 `ΣW × 1.3 + 50,000`. 배수보다 정액 공임 중심으로 본다. |
| 레이저 10T 초과 | `processingCost = ΣW × (1.3 - 1) + laserThickFee` | 최종 `ΣW × 1.3 + 70,000`. |
| 레이저 1T~2T 한판 전체 | `processingCost = ΣW × (1.3 - 1) + laserFullThinSheetFee` | 최종 `ΣW × 1.3 + 200,000`. |
| CNC 일반 | `processingCost = ΣW × (1.3 - 1) + cncGeneralFee` | 최종 `ΣW × 1.3 + 70,000`. |
| CNC 20T~30T | `processingCost = ΣW × (1.3 - 1) + cncHeavyFee` | 최종 `ΣW × 1.3 + 100,000`. |
| CNC 조립 홈/슬롯 | `cncInterlockingSlotCost = cncInterlockingSlotFee` | 10T 이상 조립형의 받침대 타공/끼움 홈은 레이저가 아니라 CNC로 깎아내는 기준을 우선한다. 위블로 수준의 40×10 슬롯 30EA 기준 기본 70,000으로 본다. |
| 복잡 형상 여러 개 | `processingCost = ΣW × (1.3 - 1) + complexShapeFee` | 최종 `ΣW × 1.3 + 200,000~300,000`. 작업시간 기준으로 정액 공임을 선택한다. |
| 일반 접착 | `adhesionCost = ΣW × (2.0 - 1)` | 최종 원판+접착 기준 `ΣW × 2.0`. |
| 45도 일반 접착 | `adhesionCost = ΣW × (2.0 - 1) + bevelLengthM × bevelFeePerM` | 베벨 길이가 있을 때만 추가한다. |
| 90도 일반 접착 | `adhesionCost = ΣW × (2.0 - 1) × laborPremium90 + corners90 × cornerFinishFee` | 90도 접착은 검수 권장이다. |
| 원판 기준 무기포 45도 | `adhesionCost = ΣW × (mugipo45Multiplier - 1)` | 최종 `ΣW × mugipo45Multiplier`. |
| 원판 기준 무기포 90도 | `adhesionCost = ΣW × (3.5 - 1) × laborPremium90 + corners90 × cornerFinishFee` | 코너가 있으면 검수 권장이다. |
| 제품 기준 상세 접착비 | `D = (setupFee / max(1, productQty) + ratePerM × joinLengthM) × V(productQty) × max(1, productQty)` | `V(n) = 1 / (1 + k × ln(max(1, n)))`. |
| 제품 기준 무기포 45도 | `adhesionCost = ΣW × (mugipo45Multiplier - 1) + D + bevelLengthM × bevelFeePerM` | 박스/트레이 등 상세 제작용. |
| 5T 무기포 6면체 박스 원장 기준 | `materialSaleBase = ΣW × 1.3` | 원장 공급가에 판매 기준 마진을 먼저 적용한다. |
| 5T 무기포 6면체 박스 접착공임 | `mugipoBoxLabor = mugipoBoxSetupFee + joinLengthM × mugipoBoxBondRatePerM` | 250각 기준은 접착선 3.0m, 공임 약 182,000원이다. |
| 5T 무기포 6면체 박스 최소판매가 보정 | `minimumAdjustment = max(0, minSalePrice - (materialSaleBase + mugipoBoxLabor))` | 접착공임과 별도 항목으로 둔다. 250각 5T 기준 최소판매가는 VAT 별도 300,000원. |
| 추가 옵션 `panel_rate` | `additionalCost = ΣW × R × optionQty + B × optionQty` | 엣지, 불광, 타공률 같은 원장 비례 옵션. |
| 경면 엣지 후가공비 | `mirrorEdgeCost = edgeLengthM × mirrorEdgeRatePerM` | 길이 기반 경면 엣지 후가공 기준금액이다. 위블로/NHF 검산에서는 기존 역산 단가 14,200원/m를 사용했다. |
| 불광 후가공비 | `bulgwangCost = mirrorEdgeCost × 3.0` | 불광은 경면 엣지 후가공비의 3배로 본다. 판매가 후단이 아니라 본체 가공 실원가에 먼저 더한 뒤 loss와 마진을 적용한다. |
| UV 배면인쇄 기준 면적 | `uvPrintAreaMm2 = uvPrintWidthMm × uvPrintHeightMm` | 실제 제품 전체 크기가 아니라 UV 배면인쇄가 들어가는 유효 인쇄 영역 기준이다. |
| UV 사이즈 계수 | `uvSizeFactor = max(1, ceil((uvPrintAreaMm2 / 10,000) × 10) / 10)` | 위블로 기준처럼 100×100mm 미만은 `1.0`으로 본다. 초과 사이즈는 100×100 면적 대비 0.1 단위로 올림한다. |
| UV 배면인쇄 도수별 인쇄비 | `uvPrintBaseFee = {1도: 10,000, 2도: 15,000, 3도: 30,000}[uvPrintColorCount]` | 각 금액은 100×100mm 미만 기준 인쇄비다. 4도 이상은 `needs_review`로 본다. |
| UV 배면인쇄 | `uvBackPrintCost = productQty × uvPrintBaseFee × uvSizeFactor` | 도수별 인쇄비와 사이즈 계수를 곱한다. |
| 후면 UV 인쇄 시트 부착 공임 | `uvSheetAttachCost = productQty × 5,000 × uvSizeFactor` | 5,000원은 100×100mm 미만 기준 부착 공임이다. UV 시트 제작 외주비는 포함하지 않는다. |
| UV 인쇄 작업비 | `uvHandlingCost = productQty × 10,000 × uvSizeFactor` | 10,000원은 100×100mm 미만 기준 단가다. 대형/정렬 난이도가 크면 `needs_review`로 올린다. |
| 배면인쇄 개당 추가비 | `uvBackSidePrintSurcharge = productQty × 3,000` | 배면인쇄 선택 시 개당 고정으로 추가한다. 사이즈 계수와 별도로 한 번 더 붙인다. |
| UV 내부 공임 합계 | `uvServiceCost = productQty × ((uvPrintBaseFee + 5,000 + 10,000) × uvSizeFactor + 3,000)` | 도수별 인쇄비, 부착 공임, 작업비, 배면인쇄 개당 추가비를 포함한다. |
| UV 시트 제작 외주 원가 | `uvSheetOutsourceCost = uvSheetOutsourceUnitCost × productQty` | UV 시트 제작 단가는 자동 단가에 포함하지 않고 외주비용 수동조정 라인으로 별도 입력한다. |
| UV 시트 제작 외주 판매가 | `uvSheetOutsourceSaleAmount = uvSheetOutsourceCost / (1 - targetGrossMarginRate)` | 외주비에도 마진을 붙여 판매할 때 적용한다. 원가 그대로 전달하는 예외 견적은 별도 수동 승인으로 처리한다. |
| UV 배면인쇄 추가옵션 합계 | `uvOptionCost = uvServiceCost + uvSheetOutsourceSaleAmount` | 외주비 입력 전에는 최종 견적을 `needs_review`로 둔다. 외주비 입력 후에도 외주 마진 적용 여부를 확인한다. |
| 염색 외주 기준 면적 | `dyeAreaMm2 = dyeWidthMm × dyeHeightMm` | 염색이 들어가는 유효 면적 기준이다. 제품 전체 크기와 다르면 염색 영역만 입력한다. |
| 염색 외주 사이즈 계수 | `dyeSizeFactor = max(1, ceil((dyeAreaMm2 / 10,000) × 10) / 10)` | 100×100mm 이하를 `1.0`으로 보고, 초과 사이즈는 100×100 면적 대비 0.1 단위로 올림한다. |
| 염색 외주 원가 | `dyeOutsourceCost = productQty × 30,000 × dyeSizeFactor × dyeColorCount` | 1가지 색상, 100×100mm 이하 기준 외주 공임비는 30,000원이다. 2색 이상은 임시로 색상 수를 곱하되 `needs_review`를 권장한다. |
| 염색 외주 판매가 | `dyeOutsourceSaleAmount = dyeOutsourceCost / (1 - targetGrossMarginRate)` | 외주 원가에도 마진을 붙이는 기본 정책이다. 실제 외주 견적서가 있으면 수동 입력값으로 대체한다. |
| 조립형 끼움 loss 원가 | `assemblyLossCost = fabricationActualCost × 0.3` | 암/수 끼움 구조처럼 두께 편차, 기계 오차, 테스트 조립, 재제작 loss가 예상되는 경우 원가성 리스크 비용으로 잡는다. |
| 조립형 끼움 loss 판매가 | `assemblyLossSaleAmount = assemblyLossCost / (1 - targetGrossMarginRate)` | loss 비용에도 목표 마진율을 적용한다. UV 내부 공임과 UV 시트 제작 외주비에는 적용하지 않는다. |
| 항목 금액 | `itemAmount = ΣW + processingCost + adhesionCost + additionalCost + minimumAdjustment` | 견적 항목 1줄의 계산 결과. 박스형 제품은 `materialSaleBase + mugipoBoxLabor + minimumAdjustment`처럼 별도 조립할 수 있다. |
| 견적 수량 반영 | `lineAmount = itemAmount × lineQty` | 견적서 항목 수량은 마지막에만 반영한다. |
| 소계 반올림 | `subtotal = round(ΣlineAmount / 100) × 100` | 100원 단위 반올림. |
| 부가세 | `tax = round(subtotal × taxRate)` | 부가세는 반올림된 소계 기준. |
| 총액 | `total = subtotal + tax` | 견적서 표시 총액. |

## 6. DB 옵션 공식

`processing_options.pricing_method`가 명시된 옵션은 아래 산식을 따른다.

| `pricing_method` | 산식 | 수량 기준 |
| --- | --- | --- |
| `fixed_fee` | `cost = R × optionQty` | 옵션 수량 |
| `panel_multiplier` | `cost = ΣW × (M - 1) × optionQty + B × optionQty` | 옵션 수량 |
| `panel_rate` | `cost = ΣW × R × optionQty + B × optionQty` | 옵션 수량 |
| `per_unit` | `cost = R × optionQty + B × optionQty` | 옵션 수량 |
| `per_meter` | `cost = R × L × optionQty + B × optionQty` | 길이와 옵션 수량 |
| `per_corner` | `cost = R × C × optionQty + B × optionQty` | 코너 수와 옵션 수량 |
| `requires_review` | `cost = 0`, `status = needs_review` | 금액보다 상태 우선 |
| `legacy_multiplier` | 기존 `multiplier/base_cost` fallback | 기존 행 호환용 |

## 7. 예외 규칙

| 예외 | 적용 규칙 | 이유 |
| --- | --- | --- |
| 원판 기준 무기포 접착 | `sheet_based`에서는 `45-mugipo`, `bond-mugipo-45`가 DB `per_meter`로 등록되어 있어도 원판 배수 프로필을 우선한다. | 빠른 원판 견적에서 접착선 길이를 요구하지 않기 위해서다. |
| 제품 기준 무기포 접착 | `product_based`이고 DB `per_meter` 옵션이 명확히 선택된 경우 길이 기반 계산을 허용한다. | 제작물 상세 견적은 접착선 길이의 영향이 크다. |
| 스리/진백 안료 | `스리`, `진백`은 원장 공급가가 아니라 화이트 안료 추가금으로 `pigmentSurcharge`에 넣는다. | 원장가와 안료 추가금을 섞으면 색상별 마진과 DB 관리가 흐려진다. |
| 재질 추가금 | 사틴 같은 재질 표기는 `재질`로 통일하고 원장 공급가가 아니라 `materialSurcharge`에 넣는다. | 특정 재질명보다 추가금의 성격을 명확히 하기 위해서다. |
| 아스텔 4*10 | 재질이 아스텔이고 규격이 `4*10`이면 금액 계산 전에 `blocked`로 처리한다. | 해당 조합은 제작 불가 조건이므로 추가금 계산보다 차단이 우선이다. |
| 무기포 박스 최소판매가 | 접착공임은 `세팅비 + 접착선길이 × m당 공임`으로 계산하고, 목표 판매가에 모자라는 금액은 `minimumAdjustment`로 분리한다. | 실제 접착 원가/공임과 영업 하한가를 섞지 않아야 이후 단가 조정이 쉽다. |
| 다중 원판 가공 | 원판별 가공을 반복하지 않고 `ΣW`에 한 번 적용한다. | 동일 견적 항목 안에서 가공/접착 중복 과금을 막는다. |
| 단순 재단 | 배송/화물비 절감을 위한 원판 분절로만 적용한다. 작은 조각을 여러 개 뽑는 작업에는 단순 재단 배수를 쓰지 않는다. | 단순 재단을 제작 가공으로 쓰면 다중 재단 공임이 누락된다. |
| 복합/다중 재단 | 복합 재단은 `사용 범위 < 2/3` 및 `300×300mm 초과 조각`, 다중 재단은 `사용 범위 >= 2/3` 및 `300×300mm 미만 조각 밀집`으로 분류한다. | 같은 원장이라도 사용 면적과 조각 크기에 따라 작업시간이 크게 달라진다. |
| 레이저/CNC/복잡 형상 | `ΣW + processingCost = ΣW × 1.3 + fixedLaborFee`로 계산한다. DB 옵션으로 표현할 때는 `panel_multiplier M=1.3`, `base_cost=fixedLaborFee`가 맞다. | 원판 판매 기준 마진은 확보하고, 실제 난이도는 정액 공임으로 반영한다. |
| 추가 옵션 fallback | 기존 코드에는 `W`가 아닌 내부 `basePrice` 기준 경로가 있으므로, 신규 공식에서는 `ΣW` 기준으로 통일하는 것을 권장한다. | 양면/조색/다중 원판에서 기준금액 흔들림을 줄인다. |
| `lineQty` | 계산 엔진 내부 금액에는 곱하지 않고 견적 합계 단계에서만 곱한다. | 견적 항목 수량과 옵션 수량의 중복 반영을 막는다. |

## 8. 판정 표

| 조건 | 상태 | 사유 |
| --- | --- | --- |
| 원판 단가가 없거나 0 이하 | `blocked` | 자동 견적 발행 불가. |
| 지원하지 않는 소재 | `blocked` | 현재 자동 계산은 casting 기준. |
| 아스텔 재질 + 4*10 규격 | `blocked` | 제작 불가 조합. |
| 제품 기준 박스형 + `T <= 5` + `joinLengthM >= 9` | `blocked` | 휨과 접착 품질 리스크가 큼. |
| 제품 기준 박스형 + `T <= 5` + `joinLengthM >= 7` | `needs_review` | 자동 발행 전 관리자 확인 필요. |
| 90도 접착 + `corners90 > 0` | `needs_review` | 마감 품질과 작업시간 검수 필요. |
| 무기포 자동 선택 | `needs_review` | 45도/90도 방식 미확정. |
| 제품 기준 접착인데 `joinLengthM <= 0` | `needs_review` | 상세 접착비 정확도 부족. |
| DB 옵션이 `requires_review` | `needs_review` | 관리자 설정상 수동 검수 대상. |
| 재단 등급이 경계/혼합 조건 | `needs_review` | 2/3 기준, 300×300 기준, 조각 밀집 여부를 작업자가 확인해야 한다. |
| UV 배면인쇄 `uvSizeFactor > 4` 또는 긴 변 300mm 초과 | `needs_review` | 대형 인쇄는 정렬, 시트 부착, 먼지/기포, 재작업 리스크가 커서 자동 단가만으로 발행하지 않는다. |
| UV 배면인쇄 `uvPrintColorCount >= 4` | `needs_review` | 4도 이상은 색상 분판, 정합, 테스트 인쇄 리스크가 커서 수동 견적으로 본다. |
| UV 시트 제작 외주비 미입력 | `needs_review` | UV 시트 제작 단가는 외주비용 수동조정 항목으로 따로 입력해야 최종 견적이 완성된다. 입력 후에는 외주비 마진 적용 여부를 확인한다. |
| 염색 외주 `dyeSizeFactor > 4` 또는 긴 변 300mm 초과 | `needs_review` | 대형 염색은 색 균일도, 테스트 샘플, 외주 납기 리스크가 커서 외주 견적 확인을 우선한다. |
| 염색 외주 `dyeColorCount >= 2` | `needs_review` | 현재 기준값은 1가지 색상 기준이므로 다색 염색은 색상 수 곱셈으로 임시 계산하되 외주 확인을 권장한다. |
| 조립형 암/수 끼움 구조 | `needs_review` | 두께 편차와 기계 오차로 끼움 불량/재제작 loss가 생길 수 있으므로 `assemblyLossCost` 30%를 원가에 더한 뒤 목표 마진율을 적용하고, 조립 테스트를 전제로 검수한다. |
| 10T 이상 조립형 + 끼움 슬롯/타공 | `needs_review` | 받침대 타공은 레이저가 아니라 CNC 홈/포켓 가공으로 산정한다. 공차 테스트가 필요하므로 `cncInterlockingSlotFee`를 적용하고 검수한다. |
| 불광 후가공 선택 | `needs_review` | 불광은 경면 엣지 후가공비의 3배를 본체 실원가에 추가하므로, 경면 기준 길이와 단가 확인 후 마진 적용 전 원가에 반영한다. |

## 9. 테스트 가능한 입력 표 템플릿

이 표를 복사해 시나리오를 추가하면 수기로 계산을 비교할 수 있다.

| ID | 품질 | 두께 | 사이즈 | 면수 | 조색비 | `panelQty` | 가공 | 사용범위 | 최소 조각 | 접착 | `optionQty` | `productQty` | 접착선 m | 코너 | `lineQty` |
| --- | --- | --- | --- | --- | ---: | ---: | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: |
| T-blank | CLEAR | 5T | 4x8 | 단면 | 0 | 1 | none | 0% | - | none | 1 | 1 | 0 | 0 | 1 |

## 10. 계산 결과 표 템플릿

| ID | `W` | `ΣW` | 가공비 | 접착비 | 추가옵션비 | `itemAmount` | `lineAmount` | `subtotal` | `tax` | `total` | 상태 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| T-blank | 90,600 | 90,600 | 0 | 0 | 0 | 90,600 | 90,600 | 90,600 | 9,060 | 99,660 | `calculable` |

## 11. 시나리오별 검증 행

| ID | 목적 | 입력 요약 | 핵심 공식 | 예상 금액 | 상태 |
| --- | --- | --- | --- | --- | --- |
| S1 | 원판 단독 구매 | 5T 4x8 CLEAR 단면, `panelQty=1`, `lineQty=1`, raw-only | `ΣW=90,600`; 가공비 `90,600×0.8=72,480`; `itemAmount=163,080`; `subtotal=163,100`; `tax=16,310`; `total=179,410` | 항목 163,080 / 총액 179,410 | `calculable` |
| S2 | 단순 재단 10T 미만 | 5T 4x8 CLEAR 단면, 배송용 원판 분절 | `ΣW=90,600`; 가공비 `90,600×0.2=18,120`; `itemAmount=108,720`; `subtotal=108,700`; `tax=10,870`; `total=119,570` | 항목 108,720 / 총액 119,570 | `calculable` |
| S3 | 단순 재단 10T 이상 | 10T 4x8 CLEAR 단면, 배송용 원판 분절 | `ΣW=160,000`; 가공비 `160,000×0.8=128,000`; `itemAmount=288,000`; `subtotal=288,000`; `tax=28,800`; `total=316,800` | 항목 288,000 / 총액 316,800 | `calculable` |
| S4 | 원판 기준 무기포 45도 | 5T 4x8 CLEAR 단면, `sheet_based`, 무기포 45도 | `ΣW=90,600`; 접착비 `90,600×2.2=199,320`; `itemAmount=289,920`; `subtotal=289,900`; `tax=28,990`; `total=318,890` | 항목 289,920 / 총액 318,890 | `calculable` |
| S5 | 제품 기준 박스 무기포 45도 | 5T 4x8 CLEAR 단면, `product_based`, `productQty=1`, `joinLengthM=4.2`, 무기포 45도 | `D=(50,000+15,000×4.2)×1=113,000`; 접착비 `90,600×2.2+113,000=312,320`; `itemAmount=402,920`; `subtotal=402,900`; `tax=40,290`; `total=443,190` | 항목 402,920 / 총액 443,190 | `calculable` |
| S6 | 90도 접착 + 코너 검수 | 5T 4x8 CLEAR 단면, 무기포 90도, `corners90=4` | 접착비 `(90,600×2.5)×1.12+4×4,000=269,680`; `itemAmount=360,280`; `subtotal=360,300`; `tax=36,030`; `total=396,330` | 항목 360,280 / 총액 396,330 | `needs_review` |
| S7 | 다중 원판 + 추가 옵션 | 5T 4x8 단면 1장 + 양면 1장, 엣지 `panel_rate=0.5` | `ΣW=90,600+94,200=184,800`; 추가옵션 `184,800×0.5=92,400`; `itemAmount=277,200`; `subtotal=277,200`; `tax=27,720`; `total=304,920` | 항목 277,200 / 총액 304,920 | `calculable` |
| S8 | DB `panel_multiplier + base_cost` | 5T 4x8 CLEAR 단면, DB 옵션 `M=1.8`, `B=150,000` | 가공비 `90,600×0.8+150,000=222,480`; `itemAmount=313,080`; `subtotal=313,100`; `tax=31,310`; `total=344,410` | 항목 313,080 / 총액 344,410 | `calculable` |
| S9 | 견적 수량/옵션 수량 분리 | 5T 4x8 CLEAR 단면, `per_unit R=5,000`, `optionQty=2`, `lineQty=3` | 추가옵션 `5,000×2=10,000`; `itemAmount=100,600`; `lineAmount=100,600×3=301,800`; `subtotal=301,800`; `tax=30,180`; `total=331,980` | 항목 100,600 / 총액 331,980 | `calculable` |
| S10 | 소계 100원 반올림 + 부가세 | 수기 검증용 항목금액 100,050, `lineQty=1` | `lineAmount=100,050`; `subtotal=round(100,050/100)×100=100,100`; `tax=10,010`; `total=110,110` | 항목 100,050 / 총액 110,110 | `calculable` |
| S11 | 레이저 10T 이하 정액 공임 | 5T 4x8 CLEAR 단면, 레이저 10T 이하 | 가공비 `90,600×0.3+50,000=77,180`; `itemAmount=167,780`; `subtotal=167,800`; `tax=16,780`; `total=184,580` | 항목 167,780 / 총액 184,580 | `calculable` |
| S12 | CNC 20T~30T 정액 공임 | 중량 원장 샘플 `ΣW=160,000`으로 검산, CNC 중량 가공 | 가공비 `160,000×0.3+100,000=148,000`; `itemAmount=308,000`; `subtotal=308,000`; `tax=30,800`; `total=338,800` | 항목 308,000 / 총액 338,800 | `calculable` |
| S13 | 복합 재단 분류 | 5T 4x8 CLEAR 단면, 사용범위 60%, 조각 400×400 이상, 복합 재단 세팅비 | 가공비 `90,600×0.3+70,000=97,180`; `itemAmount=187,780`; `subtotal=187,800`; `tax=18,780`; `total=206,580` | 항목 187,780 / 총액 206,580 | `calculable` |
| S14 | 다중 재단 분류 | 5T 4x8 CLEAR 단면, 사용범위 80%, 300×300 미만 조각 밀집, 작업시간 공임 200,000~300,000 | 가공비 `90,600×0.3+200,000~300,000=227,180~327,180`; `itemAmount=317,780~417,780`; 부가세 포함 총액 `349,580~459,580` | 항목 317,780~417,780 / 총액 349,580~459,580 | `needs_review` |
| S15 | 5T 250각 6면체 무기포 박스 역산 | 5T 4x8 CLEAR 단면, 접착선 3.0m, VAT 별도 목표가 300,000 | 원장판매 `90,600×1.3=117,780`; 접착공임 `50,000+3.0×44,000=182,000`; 계산가 `299,780`; 최소판매가 보정 `220`; 최종 `300,000` | 접착공임 182,000 / 보정 220 / 최종 300,000 | `calculable` |
| S16 | 아스텔 4*10 제작 불가 | 아스텔 재질, 4*10 규격 | 금액 계산 전에 차단 | 견적 발행 불가 | `blocked` |
| S17 | 사각 반복 재단 마진율 선택 | NHF 사각 재단 예시, 추정 원가 386,600, 동일 규격 사각 6EA, C컷+유광+경면 | 단순 사각 반복 재단 밴드 25~28%; 엣지 가공 2개 이상으로 `targetGrossMarginRate=27%`; `386,600/(1-0.27)=529,589`; `subtotal=529,600`; `tax=52,960`; `total=582,560` | 부가세 별도 529,600 / 총액 582,560 | `calculable` |
| S18 | 위블로 스탠드 + UV 배면인쇄 옵션 | 10T 3x6 CLEAR 양면, 스탠드 30EA, 받침대 30EA, 암/수 끼움 조립형, 받침대 CNC 슬롯 40×10 30EA, 불광 후가공, UV 인쇄영역 100×100mm 미만, UV 배면인쇄 2도/부착공임/작업비/배면 추가비 30EA, UV 시트 제작 외주비 10,000/EA | `uvSizeFactor=1.0`; 기존 본체 실원가 `549,210`; 경면 엣지 `19.8m×14,200=281,160`; 불광 `281,160×3.0=843,480`; 본체 실원가 `1,392,690`; 본체+loss 판매가 `(1,392,690+1,392,690×30%)/(1-0.3)=2,586,424`; UV 내부 공임 `990,000`; UV 시트 외주 판매가 `300,000/(1-0.3)=428,571`; `subtotal=4,005,000`; `tax=400,500`; `total=4,405,500` | 부가세 별도 4,005,000 / 총액 4,405,500 | `needs_review` |
| S21 | 위블로 조립형 본체 loss 프리미엄 | UV 제외, 10T 3x6 CLEAR 양면, 스탠드 30EA, 받침대 30EA, 암/수 끼움 조립형, 받침대 CNC 슬롯 40×10 30EA, 불광 후가공 | 기존 본체 실원가 `549,210`; 불광 `281,160×3.0=843,480`; 본체 실원가 `1,392,690`; loss 원가 `1,392,690×30%=417,807`; 마진 포함 본체 판매가 `(1,392,690+417,807)/(1-0.3)=2,586,424`; `subtotal=2,586,400`; `tax=258,640`; `total=2,845,040` | 부가세 별도 2,586,400 / 총액 2,845,040 | `needs_review` |
| S19 | UV 배면인쇄 사이즈 환산 | UV 인쇄영역 150×150mm, `productQty=10`, UV 배면인쇄 2도/부착공임/작업비/배면 추가비, UV 시트 제작 외주비 별도 | `uvSizeFactor=ceil((22,500/10,000)×10)/10=2.3`; UV 내부 공임 `10×(30,000×2.3+3,000)=720,000`; 외주비 `uvSheetOutsourceCost=manual` | UV 내부 공임 720,000 + 외주비 manual | `needs_review` |
| S20 | UV 배면인쇄 도수별 내부 공임 | UV 인쇄영역 100×100mm 미만, `productQty=1`, 부착공임/작업비/배면 추가비 포함, UV 시트 제작 외주비 제외 | 1도 `10,000+5,000+10,000+3,000=28,000`; 2도 `15,000+5,000+10,000+3,000=33,000`; 3도 `30,000+5,000+10,000+3,000=48,000` | 내부 공임 1도 28,000 / 2도 33,000 / 3도 48,000 + 외주비 별도 | `calculable` |
| S22 | 염색 외주 1색 사이즈 환산 | 염색 영역 100×100mm 이하, `productQty=10`, 1가지 색상, 목표 마진율 30% | `dyeSizeFactor=1.0`; 염색 외주 원가 `10×30,000×1.0×1=300,000`; 염색 외주 판매가 `300,000/(1-0.3)=428,571`; `subtotal=428,600`; `tax=42,860`; `total=471,460` | 외주 원가 300,000 / 부가세 별도 428,600 / 총액 471,460 | `calculable` |

## 12. 마진 개발 방향

배수 공식만으로는 재료비와 작업 난이도가 지나치게 묶인다. 신규 공식은 아래 요소를 분리해서 조합하는 방향이 좋다.

목표 마진율은 작업군별 기본 범위를 두되, 같은 작업군 안에서도 형상 난이도와 반복 가능성에 따라 하위 밴드를 선택한다. 특히 사각형 반복 재단처럼 작업 예측이 쉬운 건은 고객 체감가를 낮추기 위해 낮은 밴드를 우선 적용한다.

| 작업군 | 기본 목표 마진율 | 하위 적용 기준 | 운영 메모 |
| --- | ---: | --- | --- |
| 반복 가능한 평판 재단/엣지 작업 | 25~35% | 단순 사각 반복 재단은 25~28% | 사각형, 동일 규격 반복, 타공/곡선/내부컷 없음. 고객에게 합리적으로 보여야 하므로 낮은 밴드 적용. |
| 반복 가능한 평판 재단/엣지 작업 | 25~35% | 일반 평판 재단+엣지는 28~32% | 면취, 유광, 경면처럼 길이 기반 가공이 있으나 형상이 단순한 경우. |
| 반복 가능한 평판 재단/엣지 작업 | 25~35% | 혼합 형상, 치수 변형, 검수 부담이 있으면 32~35% | 작업시간 예측이 흔들리거나 재작업 리스크가 있는 경우. |
| 작업자 숙련도 필요한 후가공 | 35~45% | 표준 후가공은 35~40%, 난이도 높으면 40~45% | 수작업 품질 차이가 판매가에 반영되어야 한다. |
| 접착/박스/무기포/실패 리스크 있음 | 40~55% | 일반 접착은 40~45%, 무기포/박스는 45~55% | 실패 시 재작업 비용이 커서 높은 마진율을 둔다. |
| 급납기/복잡도 높음/도면 불명확 | 50% 이상 또는 `needs_review` | 자동 산식보다 검수 우선 | 납기, 도면 불명확, 품질 리스크가 겹치면 발행 전 확인한다. |

목표 마진율 기준 판매가는 아래 산식으로 검산한다.

`targetSalePrice = actualCost / (1 - targetGrossMarginRate)`

### 12.1 통합 견적 공식 v2

신규 계산은 금액을 한 번에 만들지 않고, 원가성 제작 기준금액, loss, 마진, UV/외주 옵션을 단계별로 분리한다. 특히 불광, CNC 홈, 조립형 loss는 마진 적용 전에 본체 제작 기준금액에 반영한다.

| 단계 | 변수 | 산식 | 비고 |
| --- | --- | --- | --- |
| 1. 원장 단가 | `W` | `P + surfaceSurcharge + materialSurcharge + pigmentSurcharge + colorMixingCost` | 단면/양면, 재질, 안료, 조색을 먼저 반영한다. |
| 2. 원장 합계 | `sheetCost` | `Σ(W_i × panelQty_i)` | 원판 장수 기준이다. `lineQty`를 곱하지 않는다. |
| 3. 기본 재단/가공 기준금액 | `cutBaseCost` | `sheetCost × fabricationBaseMultiplier + selectedSetupFee` | 복합 재단/CNC/레이저/복잡 형상은 `1.3 + 정액공임` 구조를 사용한다. |
| 4. 경면 엣지 | `mirrorEdgeCost` | `edgeLengthM × mirrorEdgeRatePerM` | C컷, 유광, 경면처럼 길이 기반 엣지 후가공을 분리한다. |
| 5. 불광 | `bulgwangCost` | `mirrorEdgeCost × bulgwangEdgeMultiplier` | 불광 선택 시 경면 엣지 후가공비의 3배를 본체 기준금액에 추가한다. |
| 6. CNC 조립 홈 | `cncInterlockingSlotCost` | `cncInterlockingSlotFee` | 10T 이상 조립형 끼움 슬롯/타공은 레이저가 아니라 CNC 기준을 우선한다. |
| 7. 본체 제작 기준금액 | `fabricationCostBasis` | `cutBaseCost + mirrorEdgeCost + bulgwangCost + cncInterlockingSlotCost + otherFabricationCost` | 마진 적용 전 본체 기준금액이다. |
| 8. 조립형 loss | `assemblyLossCost` | `fabricationCostBasis × interlockingAssemblyLossPremiumRate` | 암/수 끼움 구조일 때만 적용한다. |
| 9. 본체 판매가 | `fabricationSaleAmount` | `(fabricationCostBasis + assemblyLossCost) / (1 - targetGrossMarginRate)` | loss에도 마진율을 적용한다. |
| 10. UV 내부 공임 | `uvServiceCost` | `productQty × ((uvPrintBaseFee + 5,000 + 10,000) × uvSizeFactor + 3,000)` | 도수별 인쇄비, 부착공임, 작업비, 배면인쇄 개당 추가비만 포함한다. |
| 11. UV 시트 외주 원가 | `uvSheetOutsourceCost` | `uvSheetOutsourceUnitCost × productQty` | 외주 시트 제작비는 자동 단가와 분리한다. |
| 12. UV 시트 외주 판매가 | `uvSheetOutsourceSaleAmount` | `uvSheetOutsourceCost / (1 - targetGrossMarginRate)` | 외주비에도 마진을 붙이는 기본 정책이다. 원가 전달은 수동 승인 예외다. |
| 13. 염색 외주 원가 | `dyeOutsourceCost` | `productQty × 30,000 × dyeSizeFactor × dyeColorCount` | 100×100mm 이하, 1가지 색상 기준 30,000원을 원가로 본다. |
| 14. 염색 외주 판매가 | `dyeOutsourceSaleAmount` | `dyeOutsourceCost / (1 - targetGrossMarginRate)` | 외주비에도 마진을 붙이는 기본 정책이다. 실제 외주 견적이 있으면 수동 입력값으로 대체한다. |
| 15. 판매 소계 | `quoteSubtotalRaw` | `fabricationSaleAmount + uvServiceCost + uvSheetOutsourceSaleAmount + dyeOutsourceSaleAmount + passThroughCost + manualAdjustment` | 마진 적용 대상과 비대상 항목을 합친 VAT 별도 원시 금액이다. |
| 16. 100원 반올림 | `subtotal` | `round(quoteSubtotalRaw / 100) × 100` | 모든 견적 발행 전 동일하게 적용한다. |
| 17. 부가세 | `tax` | `round(subtotal × taxRate)` | 반올림된 소계 기준이다. |
| 18. 총액 | `total` | `subtotal + tax` | 고객 표시 총액이다. |

상태값은 금액과 별도로 계산한다. `blocked`는 견적 발행 불가, `needs_review`는 계산값은 만들되 상담원/관리자 확인이 필요한 상태다.

```text
if blockedCondition:
  status = "blocked"
else if needsReviewCondition:
  status = "needs_review"
else:
  status = "calculable"
```

위블로 같은 조립형 UV 건의 계산 순서는 아래처럼 고정한다.

```text
sheetCost = 98,500
cutBaseCost = 98,500 × 1.3 + 70,000
mirrorEdgeCost = 19.8 × 14,200
bulgwangCost = mirrorEdgeCost × 3.0
cncInterlockingSlotCost = 70,000

fabricationCostBasis
= cutBaseCost + mirrorEdgeCost + bulgwangCost + cncInterlockingSlotCost

assemblyLossCost = fabricationCostBasis × 30%
fabricationSaleAmount = (fabricationCostBasis + assemblyLossCost) / (1 - 30%)

uvServiceCost = 30 × ((15,000 + 5,000 + 10,000) × 1.0 + 3,000)
uvSheetOutsourceSaleAmount = (30 × 10,000) / (1 - 30%)
dyeOutsourceSaleAmount = 0

subtotal = round((fabricationSaleAmount + uvServiceCost + uvSheetOutsourceSaleAmount + dyeOutsourceSaleAmount) / 100) × 100
tax = round(subtotal × 10%)
total = subtotal + tax
```

### 12.2 마진율 선택 계산 로직

마진율은 작업군을 먼저 선택한 뒤, 같은 작업군 안에서 형상/반복/리스크 점수로 하위 밴드를 고른다. 자동 계산 결과에는 `targetGrossMarginRate`, `marginBand`, `marginReason`을 같이 저장해 상담원이 가격 근거를 확인할 수 있게 한다.

| 입력 변수 | 의미 | 예시 |
| --- | --- | --- |
| `workFamily` | 작업군 | `flat_edge`, `skilled_post_process`, `bond_mugipo`, `urgent_or_unclear` |
| `shapeType` | 형상 난이도 | `rectangle`, `mixed`, `curve`, `complex` |
| `isRepeatedSameSize` | 동일 규격 반복 여부 | `true`이면 낮은 밴드 우선 |
| `hasHoleOrInnerCut` | 타공/내부컷 여부 | `true`이면 마진율 상향 |
| `hasCurveOrComplexShape` | 곡선/복잡 형상 여부 | `true`이면 마진율 상향 또는 검수 |
| `edgeProcessCount` | C컷, 유광, 경면 등 엣지 후가공 개수 | 0, 1, 2, 3 |
| `quantity` | 제품 수량 | 소량이면 세팅비 회수 필요 |
| `riskFlags` | 급납기, 도면 불명확, 실패 리스크 | 있으면 상향 또는 `needs_review` |

| 판정 조건 | 기본 밴드 | 자동 선택 규칙 |
| --- | ---: | --- |
| `workFamily=flat_edge`, `shapeType=rectangle`, `isRepeatedSameSize=true`, 내부컷/곡선 없음 | 25~28% | `25% + simpleRectMarginStep`, 최대 28% |
| 일반 평판 재단+엣지 | 28~32% | `28% + flatEdgeMarginStep`, 최대 32% |
| 혼합 형상/치수 변형/검수 부담 있음 | 32~35% | `32% + reviewBurdenStep`, 최대 35% |
| 숙련 후가공 | 35~45% | 표준 35~40%, 난이도 높으면 40~45% |
| 접착/박스/무기포 | 40~55% | 일반 접착 40~45%, 무기포/박스 45~55% |
| 급납기/도면 불명확/고위험 | 50% 이상 | 자동 발행보다 `needs_review` 우선 |

단순 사각 반복 재단의 `simpleRectMarginStep`은 아래처럼 계산한다.

| 조건 | 가산 |
| --- | ---: |
| C컷, 유광, 경면 등 엣지 후가공이 1개 이상 | +1% |
| 엣지 후가공이 2개 이상 | +1% |
| 수량이 3EA 이하 | +1% |
| 치수/색상/납기 확인 부담이 있음 | +1% |

```text
if workFamily == "flat_edge"
  and shapeType == "rectangle"
  and isRepeatedSameSize == true
  and hasHoleOrInnerCut == false
  and hasCurveOrComplexShape == false:
    marginRate = 0.25
    if edgeProcessCount >= 1: marginRate += 0.01
    if edgeProcessCount >= 2: marginRate += 0.01
    if quantity <= 3: marginRate += 0.01
    if hasMinorReviewBurden: marginRate += 0.01
    targetGrossMarginRate = min(marginRate, 0.28)
    marginBand = "simple_rect_repeat_25_28"
else:
    use workFamily band table

targetSalePrice = actualCost / (1 - targetGrossMarginRate)
subtotal = round(targetSalePrice / 100) * 100
tax = round(subtotal * taxRate)
total = subtotal + tax
```

NHF 사각 재단 예시는 동일 규격 사각 6EA이고 내부컷/곡선이 없지만 C컷, 유광, 경면 엣지 후가공이 함께 있으므로 `25% + 2% = 27%`를 적용한다.

| 요소 | 현재 취약점 | 개발 방향 | 예시 산식 |
| --- | --- | --- | --- |
| 재료 마진 | 모든 가공이 원장 금액 배수에 종속된다. | 레이저/CNC/복잡 형상은 원장 기준 `ΣW × 1.3`을 먼저 잡고 정액 공임을 더한다. | `fabricationBase = ΣW × 1.3` |
| 최소 작업비 | 작은 원판 고난도 작업이 과소견적될 수 있다. | 가공/접착별 최소 작업비를 둔다. | `processingCost = max(calculatedCost, minWorkFee)` |
| 최소판매가 보정 | 접착공임 자체를 올려 최소가를 맞추면 실제 공임 데이터가 흐려진다. | 계산된 공임과 판매 하한 보정액을 별도 라인으로 둔다. | `minimumAdjustment = max(0, minSalePrice - calculatedPrice)` |
| 재단 등급 | 단순/복합/다중 재단이 같은 재단으로 묶이면 공임이 누락된다. | 배송용 분절, 2/3 미만 대형 조각, 2/3 이상 소형 조각 밀집을 분리한다. | `cutGrade = simple | complex | dense` |
| 세팅비 | 1개 제작과 다량 제작의 준비 시간이 다르다. | 제품 기준에 세팅비를 명시하고 `productQty`로 배분한다. | `setupPart = setupFee / productQty` |
| m당 단가 | 접착선이 긴 박스가 단순 배수로 과소평가될 수 있다. | 접착선/베벨/커팅 길이 단가를 별도 관리한다. | `lengthCharge = ratePerM × joinLengthM` |
| 코너 단가 | 90도 접착과 코너 마감 리스크가 숨겨진다. | 코너당 비용과 검수 상태를 같이 반영한다. | `cornerCharge = corners90 × cornerFinishFee` |
| 난이도 프리미엄 | 단순/복잡 구분이 거칠다. | 복잡도 계수를 가공비에만 적용한다. | `complexityCharge = baseLabor × complexityFactor` |
| 리스크 프리미엄 | 품질 리스크가 가격과 상태에 분리되지 않는다. | 금액 프리미엄과 `needs_review`를 함께 둔다. | `riskCharge = baseLabor × riskPremiumRate` |
| 수량 할인 | 수량 할인이 모든 항목에 뭉뚱그려 적용될 수 있다. | 세팅비/반복 공임에만 할인 계수를 적용한다. | `V(n)=1/(1+k×ln(n))` |

## 13. 검토 체크리스트

- [ ] `panelQty`, `optionQty`, `lineQty`, `productQty`가 각 시나리오에서 한 번씩만 적용되는가?
- [ ] 다중 원판은 원판별 `W`를 합산한 뒤 가공/접착을 한 번만 적용하는가?
- [ ] 단순 재단은 배송용 원판 분절에만 적용되는가?
- [ ] 복합 재단과 다중 재단은 사용 범위 2/3 및 300×300mm 기준으로 분리되는가?
- [ ] `sheet_based` 무기포는 접착선 길이를 요구하지 않는가?
- [ ] `product_based` 접착은 접착선 길이, 코너, 제품 수량을 반영하는가?
- [ ] 스리/진백은 원장 공급가가 아니라 화이트 안료 추가금으로 분리되는가?
- [ ] 재질은 특정 표면명 대신 재질 추가금으로 분리되는가?
- [ ] 아스텔 4*10 조합은 금액 계산 전에 `blocked` 처리되는가?
- [ ] DB `panel_multiplier + base_cost`가 배수와 기본비를 모두 보존하는가?
- [ ] 레이저/CNC/복잡 형상은 `ΣW × 1.3 + 정액공임`으로 계산되는가?
- [ ] 불광, CNC 슬롯, 엣지 후가공이 마진 적용 전 `fabricationCostBasis`에 포함되는가?
- [ ] 조립형 loss가 판매가가 아니라 `fabricationCostBasis` 기준 원가로 계산된 뒤 마진이 적용되는가?
- [ ] UV 내부 공임과 UV 시트 외주비가 분리되고, 외주비 마진 적용 여부가 명시되는가?
- [ ] 염색 외주 공임은 100×100mm 이하 1색 30,000원 기준으로 면적/색상 수를 환산하고, 외주 마진 적용 여부가 명시되는가?
- [ ] `blocked`, `needs_review`, `calculable` 상태가 금액 계산과 별도로 저장되는가?
- [ ] 소계 반올림 후 부가세 계산이 모든 저장/발행 흐름에서 동일한가?
- [ ] 마진 요소가 재료비, 세팅비, 길이, 코너, 난이도, 리스크로 분해되어 설명 가능한가?
