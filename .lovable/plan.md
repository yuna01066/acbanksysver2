# 공간 프로젝트 견적 탭 추가

기존 아크릴판 / 제품제작 견적과 **완전히 분리된** 별도 견적 흐름을 추가합니다. 자체 DB 테이블, 자체 폼 페이지, 자체 목록/상세 페이지를 갖습니다.

## 1. 데이터베이스

새 테이블 `space_project_quotes` 생성:
- 프로젝트 기본 정보: project_name, client_name, project_type(쇼룸/팝업/매장 등), location, scheduled_date
- 공간 규모: total_area, area_unit(평/㎡), floor_count, zones(JSON)
- 시공 항목 라인: items (JSON 배열 — 항목명, 규격, 수량, 단위, 단가, 금액)
- 비용 요약: subtotal, tax, total, cost_breakdown(JSON — 디자인비/시공비/자재비)
- 수신처 정보: recipient_company, recipient_contact, recipient_phone, recipient_email, recipient_address
- 메모/특기사항: memo
- 첨부: attachments (JSON, `quote-attachments` 버킷 재사용)
- 식별/메타: quote_number, quote_date, user_id, valid_until

RLS 정책:
- 본인 견적 CRUD 가능
- admin/moderator는 전체 조회/수정/삭제 가능 (`has_role` 사용)

## 2. 신규 페이지 / 컴포넌트

| 경로 | 역할 |
|---|---|
| `/space-quote` | 신규 작성 폼 (편집 시 `?id=xxx`) |
| `/space-quotes` | 저장된 공간 견적 목록 |
| `/space-quotes/:id` | 상세 보기 + 인쇄(PDF) |

- `SpaceProjectFormPage.tsx`: zod 스키마 검증, 시공 항목 라인 동적 추가/삭제, 자동 합계/부가세 계산(100원 단위 반올림), `QuoteAttachments` 재사용
- `SpaceProjectsListPage.tsx`: `SavedQuotesPage` UI 패턴 따라 검색/정렬
- `SpaceProjectDetailPage.tsx`: `PrintStyles` + `window.print()` 으로 PDF 출력 (기존 패턴 유지)

## 3. 진입점

- `MaterialSelection`에 3번째 카드 **"공간 프로젝트"** 추가
- `PanelCalculator`에서 해당 material 선택 시 `navigate('/space-quote')`로 이동 (기존 계산기 흐름과 분리)
- `Home.tsx` 빠른 링크에 "공간 프로젝트 견적" 메뉴 추가

## 4. 라우팅

`App.tsx`에 lazy 라우트 3개 추가, `PageAccessGuard`로 감싸서 권한 관리.

## 기술 노트

- 견적번호 생성: 기존 `generateQuoteNumber` 패턴 재사용 (`SP-MMDDhhmmss`)
- 100원 단위 반올림 규칙 준수 (총액/세액)
- 첨부 파일은 기존 `quote-attachments` 스토리지 버킷 + 서명 URL 재활용
- 디자인 토큰만 사용 (semantic tokens, HSL)
