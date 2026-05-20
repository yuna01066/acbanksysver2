# Logic Specs

이 디렉터리는 화면 UI 기준서와 별개로 업무 로직의 동작 기준을 문서화한다. 목적은 계산식, 데이터 흐름, 검수 기준을 코드 수정 전에 확인할 수 있게 하는 것이다.

## 작성 원칙

- 실제 코드 흐름을 기준으로 쓴다.
- 운영자가 이해해야 하는 계산 의도와 개발자가 지켜야 할 구현 제약을 함께 적는다.
- 기존 저장 견적 금액, 계산 snapshot, 과거 이력은 문서만 보고 임의 변경하지 않는다.
- 수식/배수/차단 조건을 바꿀 때는 회귀 테스트 기준값을 함께 갱신한다.

## 문서 목록

- `quote-calculation-logic.md`: 견적 계산 로직
- `quote-calculation-flow-and-formulas.md`: 견적 계산 입력 흐름과 공식표
- `yield-calculation-logic.md`: 수율/네스팅 계산 로직

## 관련 UI 문서

- `docs/page-specs/calculator.md`
- `docs/page-specs/saved-quotes.md`
- `docs/page-specs/saved-quote-detail.md`
- `docs/page-specs/panel-management.md`
- `docs/page-specs/processing-price-management.md`
