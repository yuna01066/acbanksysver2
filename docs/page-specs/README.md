# Page UI Specs

이 디렉터리는 페이지별 UI 수정 기준서를 모아두는 공간이다. Markdown 파일은 화면 렌더링 소스가 아니라, Lovable/Codex/개발자가 UI를 수정할 때 따라야 할 기준 문서로 사용한다.

## 사용 원칙

- 화면 코드는 기존 React/TSX 구조를 유지한다.
- 문서는 페이지 목적, 레이아웃 우선순위, 톤앤매너, 수정 가능 영역, 위험한 변경 지점을 설명한다.
- 새 페이지를 추가하거나 주요 UI를 바꾸면 `_template.md`를 복사해 같은 형식으로 문서를 만든다.
- 문서에는 실제 고객명, 연락처, 견적 금액, 비밀키 같은 민감 정보를 넣지 않는다.
- 계산, 저장, 권한, 파일 업로드 로직은 문서만 보고 임의 변경하지 않는다.

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
