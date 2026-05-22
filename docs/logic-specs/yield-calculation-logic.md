# 수율/네스팅 계산 로직

## 문서 목적

이 문서는 현재 내부 시스템의 수율 계산 로직을 코드 기준으로 정리한 기준서다. 수율 계산기는 정확한 전역 최적화 엔진이라기보다, 브라우저에서 빠르게 실행 가능한 휴리스틱 네스팅 계산기다. 따라서 결과는 실제 제작 판단을 보조하는 추천안이며, 대량/복잡한 재단에서는 직원 검수가 필요하다.

## 주요 파일

- 화면: `src/components/YieldCalculator.tsx`
- 입력/DB hook: `src/hooks/useYieldCalculator.ts`
- 메인 네스팅 엔진: `src/utils/yieldOptimization.ts`
- 복합 원판 조합: `src/utils/panelCombinationCalculator.ts`
- 추천안 표시/견적 연동: `src/components/UnifiedRecommendations.tsx`
- 단일 원판 썸네일: `src/components/NestingThumbnail.tsx`
- 복합 조합 썸네일: `src/components/CombinationThumbnail.tsx`
- 레거시/보조 네스팅: `src/utils/optimizedNesting.ts`

## 연결 화면과 데이터

- 연결 화면: `/calculator?type=yield`, `/calculator?type=quote`
- 원판 데이터: `panel_masters`, `panel_sizes`
- 프리셋 저장: `yield_cut_presets`
- 계산 이력 저장: `yield_calculation_history`
- 견적 연동 snapshot: `YieldRecommendationSnapshot`

## 전체 흐름

1. 사용자가 재질, 두께, 재단 조각의 가로/세로/수량을 입력한다.
2. `useAvailablePanelSizes(selectedQuality, selectedThickness)`가 사용 가능한 원판 후보를 가져온다.
3. `YieldCalculator.handleCalculate()`가 유효한 조각만 숫자로 정규화한다.
4. 각 원판 후보마다 `calculateYieldPlan()`을 실행한다.
5. 단일 원판 추천 결과를 정렬한다.
6. `calculatePanelCombinations()`로 복합 원판 조합도 계산한다.
7. `UnifiedRecommendations`가 단일/복합 추천을 합쳐서 표시한다.
8. 사용자가 추천안을 적용하면 원판 규격, 장수, 두께, 재질, 수율 snapshot이 견적 계산기로 넘어간다.

## 입력 정규화

입력값은 `CutItem` 형태로 관리된다.

```ts
interface CutItem {
  id: string;
  width: string;
  height: string;
  quantity: string;
}
```

계산 직전에는 아래 조건을 만족하는 항목만 사용한다.

- `width`, `height`, `quantity`가 모두 존재해야 한다.
- `parseFloat(width) > 0`
- `parseFloat(height) > 0`
- `parseInt(quantity) > 0`

계산용 구조는 다음처럼 변환된다.

```ts
{
  width: number;
  height: number;
  quantity: number;
  id: `item-${index}`;
}
```

## 원판 후보 산출

`useAvailablePanelSizes()`는 선택한 재질/두께 기준으로 원판 후보를 만든다.

### DB 우선 기준

`panel_masters.quality = selectedQuality`로 원판 master를 찾고, 해당 master의 `panel_sizes` 중 아래 조건을 만족하는 데이터를 가져온다.

- `panel_master_id = panelMaster.id`
- `thickness = selectedThickness`
- `is_active = true`

DB 데이터가 있으면 원판 치수와 가격은 아래 순서로 결정한다.

- 폭: `actual_width`가 있으면 사용, 없으면 fallback 치수 사용
- 높이: `actual_height`가 있으면 사용, 없으면 fallback 치수 사용
- 단가: `price`

### fallback 기준

DB 활성 원판이 없으면 정적 단가표와 기본 규격 치수를 사용한다.

```ts
const baseSizeMapping = {
  '3*6': { width: 860, height: 1750 },
  '대3*6': { width: 900, height: 1800 },
  '4*5': { width: 1120, height: 1425 },
  '대4*5': { width: 1200, height: 1500 },
  '1*2': { width: 1000, height: 2000 },
  '4*6': { width: 1200, height: 1800 },
  '4*8': { width: 1200, height: 2400 },
  '4*10': { width: 1200, height: 3000 },
  '5*6': { width: 1500, height: 1800 },
  '5*8': { width: 1500, height: 2400 },
};
```

fallback 치수에는 두께 보정이 적용된다.

| 두께 | 가용 치수 보정 |
| --- | --- |
| 1.3T 이상 10T 미만 | 폭/높이 +20mm |
| 10T 이상 20T 이하 | 보정 없음 |
| 20T 초과 30T 이하 | 폭/높이 -50mm |

후보 원판은 면적 기준 오름차순으로 정렬한다.

```ts
panels.sort((a, b) => a.width * a.height - b.width * b.height)
```

## 절단 간격

`getYieldSpacing()`에서 두께별 조각 간격을 결정한다.

```ts
const thickness = parseFloat(selectedThickness?.replace('T', '') || '0');
return thickness < 10 ? 6 : 8;
```

- 10T 미만: 6mm
- 10T 이상: 8mm

이 간격은 조각 간 충돌 검사에 사용된다.

## 단일 원판 배치 로직

메인 함수는 `calculateYieldPlan(items, panelW, panelH, selectedThickness)`다.

### 1. 사전 배치 가능성 검사

모든 조각이 회전 포함 원판 안에 들어갈 수 있는지 먼저 확인한다.

```ts
(item.width <= panelW && item.height <= panelH) ||
(item.height <= panelW && item.width <= panelH)
```

하나라도 들어갈 수 없으면 다음 결과를 반환한다.

- `canFitAll = false`
- `panelsNeeded = 0`
- `score = Infinity`

### 2. 정렬 전략 4개 시도

각 원판 후보마다 4가지 정렬 전략을 모두 시도한다.

| 전략 | 기준 |
| --- | --- |
| `area` | 면적 큰 순 |
| `long-edge` | 긴 변 큰 순 |
| `wide-first` | 폭 큰 순 |
| `tall-first` | 높이 큰 순 |

각 전략은 동일 입력으로 독립 계산되고, 가장 낮은 score의 전략 결과가 최종 선택된다.

### 3. 원판 반복 배치

한 장에 모든 조각이 들어가지 않으면 같은 규격 원판을 추가하며 반복한다.

- 최대 원판 수: `MAX_PANELS = 50`
- 한 원판에 하나도 배치하지 못하면 반복 중단
- 각 원판 배치 후 `placedCounts`만큼 남은 수량을 차감

## 한 장 안에서의 배치 방식

`packSinglePanel()`이 실제 한 장 안의 배치를 수행한다.

### 후보 좌표

시작 후보는 `(0, 0)`이다. 조각 하나를 배치할 때마다 새 후보 좌표를 추가한다.

```ts
{ x: best.x + best.width + spacing, y: best.y }
{ x: best.x, y: best.y + best.height + spacing }
```

즉, 기존 배치물의 오른쪽과 아래쪽을 다음 후보 위치로 삼는다.

### 회전 허용

각 조각은 두 방향을 모두 시도한다.

```ts
[
  { width: item.width, height: item.height, rotated: false },
  { width: item.height, height: item.width, rotated: true },
]
```

회전 배치에는 작은 penalty가 붙는다.

```ts
candidateScore += orientation.rotated ? 2 : 0
```

### 충돌 검사

기존 배치물과 겹치거나, 조각 간 간격을 침범하면 배치하지 않는다.

```ts
!(x >= pos.x + pos.width + spacing ||
  x + width + spacing <= pos.x ||
  y >= pos.y + pos.height + spacing ||
  y + height + spacing <= pos.y)
```

### 후보 위치 점수

`scoreCandidate()`는 후보 위치를 아래 기준으로 점수화한다.

- 배치 후 bounding area가 작을수록 유리
- 위쪽/오른쪽으로 과도하게 밀릴수록 불리
- 오른쪽 또는 아래쪽에 큰 잔재가 남을수록 유리
- 잔재 폭과 높이의 균형이 크게 깨지면 불리

현재 식은 다음 구조다.

```ts
boundingArea * 0.001
+ y * 10
+ x
+ Math.abs((panelW - usedRight) - (panelH - usedBottom)) * 0.02
- largestOffcut * 0.0004
```

## 잔재 분석

`analyzeOffcuts()`가 잔재를 계산한다.

### 면적 기준

- 사용 면적: 배치된 조각의 면적 합
- 폐기 면적: `panelW * panelH - placedArea`
- 재활용 가능 최소 기준: `300 x 300mm`

### 잔재 후보

배치된 조각의 bounding 영역을 기준으로 세 가지 사각 잔재 후보를 만든다.

1. 오른쪽 잔재
2. 아래쪽 잔재
3. 오른쪽 아래 모서리 잔재

```ts
[
  { width: panelW - usedRight, height: panelH },
  { width: usedRight, height: panelH - usedBottom },
  { width: panelW - usedRight, height: panelH - usedBottom },
]
```

이 중 `300 x 300mm` 이상인 후보를 재활용 가능 잔재로 본다. 가장 큰 후보는 `largestReusableRect`로 저장된다.

### 조각난 잔재 penalty

재활용성이 낮은 잔재는 `fragmentationPenalty`로 점수에 불리하게 반영한다.

```ts
fragmentationPenalty = scrapArea + Math.max(0, wasteArea - reusableArea) * 0.5
```

## 최종 score 기준

`calculateYieldPlan()`의 최종 score는 다음 구조다.

```ts
(canFitAll ? 0 : 10_000_000_000)
+ panelsNeeded * 1_000_000_000
+ wasteArea
+ aggregateOffcut.scrapArea * 1.5
+ aggregateOffcut.fragmentationPenalty
- aggregateOffcut.largestReusableRect.area * 0.6
```

의미는 다음과 같다.

1. 모든 조각을 배치하지 못하면 크게 불리하다.
2. 원판 장수 최소화가 가장 강하게 우선된다.
3. 같은 장수에서는 폐기 면적이 적을수록 유리하다.
4. 조각난 잔재가 많으면 불리하다.
5. 재활용 가능한 큰 사각 잔재가 남으면 유리하다.

## 단일 원판 결과 정렬

`YieldCalculator`는 각 원판 후보의 결과를 다시 정렬한다.

우선순위:

1. `panelsNeeded` 적은 순
2. `wasteArea` 적은 순. 단, 차이가 1000㎟ 이하이면 다음 기준으로 넘어감
3. `largestReusableRect.area` 큰 순. 단, 차이가 1000㎟ 이하이면 다음 기준으로 넘어감
4. `surplus` 적은 순
5. `efficiency` 높은 순. 단, 차이가 1% 이하이면 다음 기준으로 넘어감
6. `score` 낮은 순

## 복합 원판 조합

`calculatePanelCombinations()`는 한 가지 원판 규격만 쓰는 경우 외에, 서로 다른 원판을 섞는 경우를 계산한다.

### 계산 흐름

1. 모든 원판 후보에 대해 단일 원판 계획을 계산한다.
2. `plan.score` 기준으로 정렬한다.
3. 상위 최대 5개 원판을 조합 후보로 사용한다.
4. 후보 원판 두 개씩 조합한다.
5. 첫 번째 원판으로 배치한 뒤 남은 조각을 두 번째 원판에 배치한다.
6. 모든 조각이 배치된 조합만 결과로 남긴다.

### 복합 조합 score

```ts
totalPanels * 1_000_000_000
+ totalWasteArea
+ scrapArea * 1.5
- largestReusable * 0.6
```

복합 조합도 원판 수 최소화를 가장 우선한다.

### 복합 조합 정렬

1. `totalCost` 적은 순. 현재 의미는 금액이 아니라 총 원판 장수다.
2. `totalWasteArea` 적은 순. 단, 차이가 1000㎟ 이하이면 다음 기준으로 넘어감
3. `score` 낮은 순

## 출력 구조

`YieldPlanResult` 주요 필드:

| 필드 | 의미 |
| --- | --- |
| `piecesPerPanel` | 원판당 평균 배치 조각 수 |
| `panelsNeeded` | 필요한 원판 장수 |
| `efficiency` | 전체 원판 면적 대비 조각 면적 비율 |
| `wasteArea` | 총 잔여 면적 |
| `canFitAll` | 모든 조각을 배치했는지 여부 |
| `placedCounts` | 조각 ID별 배치 수량 |
| `offcut` | 잔재 분석 결과 |
| `layoutPanels` | 원판별 좌표 배치 결과 |
| `score` | 추천 우선순위 점수 |

## 추천안 UI 표시

`UnifiedRecommendations`는 단일 원판 결과와 복합 원판 조합을 합쳐서 보여준다.

표시 정보:

- 추천 타입: 단일 원판 / 복합 조합
- 효율
- 원판 규격과 가용 사이즈
- 원판 장수
- 총 필요 수량
- 총 생산량
- 잔재 면적
- 원판 금액
- 재활용 가능 잔재 최대 사각형
- 여분 생산 여부
- 네스팅 썸네일

중복 추천은 일부 제거한다.

- 효율 차이가 ±0.5% 이하
- 원판 수가 동일
- 조합안보다 단일 원판안이 있으면 단일 원판을 우선 표시

## 견적 계산 연동

추천안을 견적 계산기로 적용하면 아래 값이 넘어간다.

```ts
{
  quality,
  thickness,
  size,
  quantity,
  panels,
  yieldRecommendation,
}
```

단일 원판 추천:

- `size = panelSize`
- `quantity = panelsNeeded`

복합 조합 추천:

- `panels = [{ size, quantity }, ...]`
- 대표 `size`, `quantity`는 첫 번째 원판 기준

견적 계산은 수율 결과 금액을 그대로 확정하지 않는다. 수율 결과는 원판 규격/장수와 계산 근거 snapshot으로 넘어가고, 최종 금액은 견적 계산 엔진에서 단가, 가공, 후가공, 추가금을 다시 계산한다.

## 프리셋과 이력 저장

### 프리셋

`yield_cut_presets`에 사용자별 재단 조각 입력값을 저장한다.

- 저장값: `name`, `cut_items`
- 용도: 반복 입력 재사용

### 계산 이력

`yield_calculation_history`에 최근 계산 결과를 저장한다.

- 저장값: 재질, 두께, 입력 조각, 단일 결과, 복합 조합, 최고 효율, 총 원판 장수
- 조회: 최근 20개

## 현재 구현상 주의점

### 1. 전역 최적해 보장 아님

현재 로직은 후보 좌표 기반 휴리스틱이다. 모든 가능한 배치를 탐색하지 않는다. 따라서 복잡한 조각 조합에서는 사람 눈에 더 나은 배치가 있을 수 있다.

### 2. 많은 수량에서 느려질 수 있음

조각 수량이 많아질수록 후보 좌표와 전략 반복이 늘어난다. 브라우저 메인 스레드에서 실행되기 때문에 큰 입력에서는 화면이 멈추거나 튕길 수 있다.

### 3. UI 문구와 코드 기준 차이

수율 화면 문구에는 "원판 마진 80mm"가 표시되어 있으나, 현재 메인 계산 코드 `yieldOptimization.ts`에는 별도 80mm margin 차감이 없다. 현재는 DB의 `actual_width/actual_height` 또는 fallback 가용 치수를 그대로 사용한다. 이 문구는 실제 운영 기준에 맞게 정리해야 한다.

### 4. `optimizedNesting.ts`는 현재 메인 경로가 아님

`optimizedNesting.ts`에도 네스팅 함수가 있지만, 현재 `YieldCalculator`의 메인 계산은 `yieldOptimization.ts`의 `calculateYieldPlan()`을 사용한다. 수정 시 두 파일 중 실제 사용 경로를 혼동하면 안 된다.

### 5. 복합 조합의 `totalCost` 명칭

`calculatePanelCombinations()`의 `totalCost`는 현재 금액이 아니라 총 원판 장수 의미로 사용된다. 실제 금액은 `totalPanelPrice`에 별도로 계산된다. 추후 유지보수 시 명칭 정리가 필요하다.

## 개선 후보

1. 대량 입력 계산을 Web Worker 또는 서버 계산으로 분리한다.
2. 같은 크기 조각은 입력 단계에서 합산해 계산량을 줄인다.
3. 원판 후보 전체를 항상 계산하지 않고, 자주 쓰는 규격 우선 계산 후 확장한다.
4. 잔재 평가 기준을 업무 기준에 맞게 더 명확히 만든다.
   - 예: 최소 재사용 크기 300x300 고정 여부
   - 길쭉한 잔재와 정사각형 잔재의 가치 차이
   - 다음 주문에 재사용하기 좋은 잔재 형태
5. 결과에 "자동 계산 신뢰도" 또는 "수동 검수 필요" 상태를 추가한다.
6. UI의 "원판 마진 80mm" 문구와 실제 계산 치수 기준을 일치시킨다.

## 회귀 테스트 기준

- 원판에 들어갈 수 없는 조각은 `canFitAll=false`, `panelsNeeded=0`이어야 한다.
- 같은 조각 수에서는 원판 장수가 적은 계획이 우선되어야 한다.
- 원판 장수가 같으면 폐기 면적이 적고 재활용 가능 잔재가 큰 계획이 우선되어야 한다.
- 10T 미만/이상에서 간격이 각각 6mm/8mm로 적용되어야 한다.
- DB `actual_width`, `actual_height`가 있으면 fallback 치수보다 우선되어야 한다.
- 추천안을 견적 계산으로 넘긴 뒤 원판 규격과 장수가 바뀌면 안 된다.
- 복합 원판 추천에서 `placedCounts` 합계가 입력 수량과 일치해야 한다.

## 수정 체크리스트

- [ ] `yieldOptimization.ts`와 실제 화면 계산 경로가 일치하는가?
- [ ] `placedCounts` 합계가 실제 배치 조각 수와 일치하는가?
- [ ] `efficiency`, `wasteArea`, `offcut` 계산이 모두 mm 기준 면적을 쓰는가?
- [ ] 원판 후보별 단가와 장수 계산이 화면 표시와 일치하는가?
- [ ] 대량 입력에서 UI가 멈추지 않는지 확인했는가?
- [ ] 추천안을 견적 계산으로 넘긴 후 원판 규격/장수/두께/재질이 유지되는가?
- [ ] 잔재 최대 사각형 표시가 실제 배치와 크게 어긋나지 않는가?
- [ ] 수율 화면 문구와 실제 margin/가용 치수 기준이 일치하는가?
