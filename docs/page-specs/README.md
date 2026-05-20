# Page UI Specs

이 디렉터리는 페이지별 UI 수정 기준서를 모아두는 공간이다. Markdown 파일은 화면 렌더링 소스가 아니라, Lovable/Codex/개발자가 UI를 수정할 때 따라야 할 기준 문서로 사용한다.

## 사용 원칙

- 화면 코드는 기존 React/TSX 구조를 유지한다.
- 문서는 페이지 목적, 레이아웃 우선순위, 톤앤매너, 수정 가능 영역, 위험한 변경 지점을 설명한다.
- 새 페이지를 추가하거나 주요 UI를 바꾸면 `_template.md`를 복사해 같은 형식으로 문서를 만든다.
- 문서에는 실제 고객명, 연락처, 견적 금액, 비밀키 같은 민감 정보를 넣지 않는다.
- 계산, 저장, 권한, 파일 업로드 로직은 문서만 보고 임의 변경하지 않는다.

## 문서 작성 기준

- Route와 주요 파일은 실제 `src/App.tsx` 라우트와 일치시킨다.
- UI 구조는 사용자가 화면을 읽는 순서대로 쓴다. 개발 파일 구조 순서가 아니라 업무 흐름 순서가 우선이다.
- "자주 수정하는 요소"에는 Lovable이나 Codex에 맡겨도 되는 표현/배치/상태 문구를 적는다.
- "연결 데이터와 주의점"에는 기능이 깨지기 쉬운 저장, 계산, 권한, 파일, 외부 연동을 명시한다.
- "상세 설계 기준"에는 다음 수정자가 바로 판단할 수 있도록 강조 순서, 버튼 위치, 카드 높이, 빈 상태 기준을 적는다.
- "검수 시나리오"는 화면을 실제로 열어 확인할 최소 행동 기준이다.

## 수정 워크플로우

1. 수정할 페이지의 `.md` 기준서를 먼저 확인한다.
2. 기준서에 없는 UI 변경은 먼저 기준서에 의도를 추가한다.
3. React/TSX 수정은 기준서의 "연결 데이터와 주의점"을 벗어나지 않게 한다.
4. 수정 후 데스크톱과 모바일 폭에서 주요 액션, 스크롤, 빈 상태를 확인한다.
5. 계산/저장/권한 화면은 UI 변경처럼 보여도 `tsc --noEmit` 또는 빌드 확인을 우선한다.

## 파일명 규칙

- 파일명은 route를 기준으로 kebab-case를 사용한다.
- 동적 라우트는 대표 화면명으로 작성한다. 예: `/saved-quotes/:id` -> `saved-quote-detail.md`
- 리다이렉트 전용 route는 별도 문서로 만들지 않고 실제 도착 페이지 문서에 기록한다.
- 한 화면이 여러 route에서 재사용되면 주요 route를 문서 제목에 쓰고 나머지는 "기본 정보"에 함께 적는다.

## 1차 작성 범위

- 홈/대시보드: `home-dashboard.md`
- 견적/수율: `calculator.md`, `quote-drafts.md`, `saved-quotes.md`, `saved-quote-detail.md`
- 프로젝트/거래처: `project-management.md`, `recipients.md`, `material-orders.md`
- 가격/원판 관리: `panel-management.md`, `price-management.md`, `processing-price-management.md`
- 관리자/설정: `admin-settings.md`, `company-settings.md`
- 채널톡/응대: `channel-talk-leads.md`, `response-assistant.md`, `response-assistant-management.md`
- 직원 업무: `employee-profiles.md`, `attendance.md`, `leave-management.md`, `team-chat.md`, `announcements.md`

## 향후 확장 기준

- 낮은 위험 문구는 추후 `src/content/pageMeta.ts` 같은 콘텐츠 레이어로 분리할 수 있다.
- MDX는 공지, 도움말, 설정 안내처럼 저장/계산 로직이 없는 문서형 화면에만 제한한다.
- 견적, 프로젝트, 계산기처럼 업무 데이터와 연결된 화면은 Markdown/MDX를 화면 소스로 쓰지 않는다.

## 문서 품질 기준

- 문서만 읽고 "무엇을 강조해야 하는지"와 "무엇을 건드리면 위험한지"가 보여야 한다.
- 단순 설명보다 다음 수정자가 실수하지 않게 하는 기준을 우선한다.
- 화면 캡처 기반 지적 사항은 기준서에 일반 규칙으로 환원한다. 예: 특정 버튼 겹침 -> 상단 fixed/toolbar 간격 기준.
- 같은 성격의 카드는 여러 페이지에서 같은 제목 크기, 아이콘 크기, 배지 규칙을 공유한다.
