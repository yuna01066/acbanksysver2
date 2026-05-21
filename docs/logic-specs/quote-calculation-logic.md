# 견적 계산 로직

## 기본 정보

- 주요 파일: `src/hooks/usePriceCalculation.ts`, `src/utils/priceCalculations.ts`, `src/utils/bubbleFreeBoxPricing.ts`
- 연결 화면: `/calculator?type=quote`, `/quote-drafts`, `/saved-quotes`, `/saved-quotes/:id`
- 연결 데이터: `panel_masters`, `panel_sizes`, `panel_option_surcharges`, `color_mixing_costs`, `processing_options`, `advanced_processing_settings`, `panel_pricing_versions`
- 계산 결과 타입: `CalculatePriceResult`
- 공식 요약: `docs/logic-specs/quote-calculation-flow-and-formulas.md`

## 계산 목적

견적 계산 로직은 판재 기준, 제품 제작 기준, 복합 가공 기준의 금액을 계산하고 직원이 고객에게 설명할 수 있는 breakdown을 남긴다. 기존 저장 견적은 저장 당시 snapshot 금액을 보호하고, 신규 계산만 최신 단가와 옵션을 사용한다.

## 입력 흐름

- 사용자는 소재, 품질, 두께, 원판 사이즈, 면수, 컬러/조색비, 가공 옵션, 접착 옵션, 추가 옵션, 수량을 선택한다.
- `usePriceCalculation`은 화면 상태와 Supabase 단가/옵션 데이터를 조립한다.
- 단일 원판은 `calculatePrice`를 한 번 호출한다.
- 여러 원판/사이즈는 각 원판의 원장 금액을 먼저 계산한 뒤, 가공/접착 옵션은 전체 원장 합계를 기준으로 한 번 계산한다.
- 수율 계산 결과에서 견적 계산으로 넘어온 경우 선택 원판 목록과 수율 추천 snapshot을 견적 항목에 포함한다.

## 계산 순서

1. 소재 검증
   - 현재 자동 계산은 `casting` 기준이다.
   - 지원하지 않는 소재는 `blocked`로 처리한다.
2. 원판 단가 결정
   - DB `panel_sizes` 활성 단가를 우선 사용한다.
   - DB 단가가 없으면 `glossyColorPricing`의 정적 fallback 단가를 사용한다.
   - 단가가 0이거나 없으면 `생산 불가 조합 또는 단가 미등록`으로 차단한다.
3. 표면/컬러 추가금
   - 브라이트는 CLEAR 유광 색상판 기본가에 브라이트/진백/스리 조색비가 더해지는 별도 재질이다.
   - 사틴은 별도 사틴 단가표가 아니라 CLEAR 유광 색상판 기본가 + 조색비 + 사틴 재질 추가금 + 양단면 추가금 구조로 계산한다.
   - 아스텔은 CLEAR 유광 색상판 기본가에 사틴/아스텔 추가금이 더해지는 구조를 우선한다.
   - 양단면은 `double_surface` DB 추가금이 있으면 우선 사용하고, 없으면 정적 양단면 추가금을 사용한다.
   - 브라이트/진백/스리 계열은 별도 조색비를 더한다.
   - 두께별 조색비는 DB `color_mixing_costs`가 있으면 우선한다.
4. 원장 금액 확정
   - 원장 금액은 원판 기본가 + 표면/컬러/조색비까지 포함한 금액이다.
   - 여러 원판 계산에서는 각 원장 금액을 합산한 `totalWonJangBase`를 가공 기준 금액으로 넘긴다.
5. 가공/접착 계산
   - `processing_options`의 활성 옵션을 우선 반영한다.
   - 알려진 프로필 옵션은 `calcProcessingDelta`로 통합 계산한다.
   - 일반 옵션은 계산 방식에 따라 고정비, 배수, 비율, m당 단가, 개당 단가, 코너당 단가로 처리한다.
   - 접착은 `calculateAdhesionCost`에서 일반 접착/무기포 45도/무기포 90도를 분리한다.
6. 추가 옵션
   - 엣지 경면, 불광, 타공, 무광도장 등 보조 옵션을 마지막에 더한다.
   - 이미 `processing_options`로 선택된 옵션은 중복 적용하지 않는다.
7. 생산 가능성 guardrail
   - 접착/두께/제품 형태 기준으로 `warnings` 또는 `blockedReasons`를 추가한다.
   - 차단 사유가 있으면 결과 상태는 `blocked`, 경고만 있으면 `needs_review`다.

## 출력 구조

- `totalPrice`: 최종 계산 금액
- `breakdown`: 화면 표시용 `{ label, price, code, source, reason }`
- `lineItems`: 내부 추적용 `{ code, label, amount, source, reason }`
- `status`: `calculable | needs_review | blocked`
- `warnings`: 발행 전 검수 권장 사유
- `blockedReasons`: 자동 견적 발행 차단 사유
- `snapshotVersion`: 현재 `pricing-engine-v1`

## 접착 계산 기준

- `sheet_based`
  - 원판 기준 견적에서 사용한다.
  - 원판 총액 기준 배수의 추가금으로 단순 계산한다.
  - 원판 기준 무기포 접착은 직원이 빠르게 견적을 내기 위한 기준이므로 제품 치수/접착선 길이 입력을 요구하지 않는다.
- `product_based`
  - 제품 제작 기준 견적에서 사용한다.
  - 박스/트레이/평면, 접착선 길이, 코너 수, 수량, 난이도 계수를 반영할 수 있다.
  - 90도 무기포는 품질 리스크가 있어 검수 경고를 남긴다.
- 대형 5T 박스
  - 5T 대형 6면체 박스는 휨과 접착 품질 리스크가 커서 자동 견적 차단 또는 검수 필요로 처리한다.

## 상태 판단 기준

- `calculable`: 단가와 옵션이 정상이고 경고/차단 사유가 없다.
- `needs_review`: 계산은 가능하지만 90도 접착, 대형 제작, 수동 검수 옵션 등 확인이 필요하다.
- `blocked`: 단가 미등록, 생산 불가 조합, 제작 불가 조건 등 자동 발행하면 안 되는 상태다.

## 금지/주의 변경

- 단가표 변경이 기존 저장 견적 금액에 자동 반영되면 안 된다.
- `breakdown` 라벨 문자열만으로 중복 계산 여부를 판단하는 방식은 피한다.
- DB 옵션과 하드코딩 프로필이 같은 비용을 동시에 적용하지 않게 한다.
- 원판 기준 무기포 접착에 제품 제작용 접착선 길이 입력을 다시 섞지 않는다.
- 고객용 견적서에는 내부 검수용 사유와 DB 테이블명 같은 표현을 노출하지 않는다.

## 회귀 테스트 기준

- 단가 미등록 조합은 `blocked`와 명확한 사유를 반환한다.
- 원판 단독 구매는 원장 금액과 할증이 분리된 breakdown을 남긴다.
- 다중 원판 선택은 원장별 금액을 먼저 합산하고 가공비는 전체 원장 기준으로 한 번만 적용한다.
- 무기포 45도/90도 접착은 중복 적용되지 않는다.
- 350x350x350 5T 6면체 무기포 45도는 운영 기준 약 30만원 범위에 들어야 한다.
- 600x600x600 5T 6면체 무기포 45도는 운영 기준 약 48만원 범위에 들어야 한다.
- 800x800x800 5T 박스는 자동 발행 차단 또는 검수 필요 상태가 되어야 한다.

## 수정 체크리스트

- [ ] 신규 계산 결과가 `status`, `warnings`, `blockedReasons`를 올바르게 반환하는가?
- [ ] `breakdown`과 `lineItems`의 금액 합계가 `totalPrice`와 맞는가?
- [ ] DB 단가 우선, 정적 fallback 후순위 규칙이 유지되는가?
- [ ] 기존 저장 견적 snapshot을 재계산하지 않는가?
- [ ] 가격 회귀 테스트와 `tsc --noEmit`을 통과하는가?
