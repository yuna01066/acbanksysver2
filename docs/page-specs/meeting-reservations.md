# 미팅 예약 관리

## 목적

- 공지사항에 섞여 있던 미팅/회의 예약을 독립 기능으로 분리한다.
- 위젯 형태로 어느 화면에나 배치할 수 있어야 한다.
- 직원 미팅과 클라이언트 미팅을 먼저 나누고, 각 미팅 유형을 빠르게 선택해 예약한다.

## 주요 파일

- 위젯: `src/components/MeetingBookingWidget.tsx`
- 대시보드 간편 조작: `src/components/TodayWorkCard.tsx`
- 페이지 래퍼: `src/pages/MeetingReservationsPage.tsx`
- 유형/상태 상수: `src/types/meetingReservations.ts`
- 데이터베이스: `supabase/migrations/20260521143000_meeting_reservations.sql`

## 주요 기능

- 월간 캘린더에서 날짜별 예약 유무를 확인하고 날짜를 선택해 목록을 필터링한다.
- 예약 목록에서 항목을 선택하면 상세 패널을 열어 제목, 날짜, 시간, 상태, 장소, 참석자, 내용 등을 수정한다.
- 예약 등록, 예약 수정, 상태 변경 시 참석자와 관련 담당자에게 `notifications` 알림을 발송한다.
- 전체 회의에 참석자를 명시하지 않으면 승인된 직원 전체를 알림 대상으로 본다.
- 홈 대시보드의 `오늘 처리할 일` 카드에서 예정 미팅을 확인하고, 권한이 있으면 `예약 -> 확정`, `확정 -> 완료` 상태를 빠르게 변경한다.
- 홈 대시보드 `프로젝트 캘린더`에도 독립 미팅 예약을 표시하고, 이벤트 클릭 시 해당 예약 상세로 이동한다.
- 공지사항에서 `회의` 또는 `미팅`을 등록하면 독립 미팅 예약으로 연결 생성하고, 연결된 공지 일정은 캘린더/대시보드에서 중복 표시하지 않는다.

## 분류

- 직원 미팅: `1:1`, `전체 회의`, `팀별 회의`
- 클라이언트 미팅: `쇼룸 방문`, `제작 상담`, `외부 미팅`, `박람회 현장 상담`, `기타 미팅`

## 데이터 모델

- `meeting_reservations` 테이블을 사용한다.
- 공지사항 테이블과 분리되어 있으며, `audience_type`, 직원/클라이언트 세부 유형, 날짜, 시간, 장소, 참석자, 거래처, 상태를 저장한다.
- 상태는 `scheduled`, `confirmed`, `completed`, `canceled`를 사용한다.

## 디자인

- `/Users/acbank002/Documents/컬러 파인더/DESIGN.md` 기준의 흑백/소프트 그레이 중심 위젯 톤을 따른다.
- 색상은 상태 표시와 선택 상태에만 제한적으로 쓴다.
- 카드형 반복 요소는 8px radius, 버튼은 pill 형태를 유지한다.

## 공개 예약 API (`public-meeting-booking`)

### `get-schedule` action

공개 예약 링크(`link_type = partner_room`)의 회의실 일정을 외부 캘린더 UI에서 조회할 때 사용한다. 확정된 일정과 승인 대기 중인 요청을 `confirmed` / `pending` 블록으로 반환한다.

**Endpoint**

```text
POST https://zwloyqcwyfkimwkohpnd.supabase.co/functions/v1/public-meeting-booking
```

(`verify_jwt = false`이므로 Authorization 헤더 없이 호출 가능)

**Request body**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `action` | `string` | O | `"get-schedule"` |
| `slug` | `string` | O | 공개 예약 링크 슬러그 |
| `view` | `"month" \| "week" \| "day"` | O | 조회 범위 |
| `date` | `YYYY-MM-DD` | O | `view` 기준 앵커 날짜(week 는 해당 주, month 는 해당 월) |
| `accessCode` | `string` | X | 링크에 접근 코드가 설정된 경우 필요 |

**`view`별 조회 범위**

| `view` | `range.startDate` | `range.endDate` | 비고 |
|--------|-------------------|-----------------|------|
| `day` | `date` | `date` | 단일 날짜 |
| `week` | `date`가 포함된 주의 일요일 | 토요일 | 서울 기준 주단위(일~토) |
| `month` | 해당 월 1일 | 마지막 일 | 서울 기준 월단위 |

**Response schema**

```typescript
{
  view: "month" | "week" | "day",
  range: {
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    startsAt: string;  // ISO 8601 (서울 기준 구간 시작)
    endsAt: string;    // ISO 8601 (서울 기준 구간 끝, exclusive)
  },
  resources: {
    id: string;
    name: string;
    floor: string | null;
  }[],
  rules: {
    allowedWeekdays: number[]; // 0(일) ~ 6(토)
    startTime: string;         // HH:MM
    endTime: string;           // HH:MM
    slotMinutes: number;
    durationMinutes: number;
  },
  blocks: Block[]
}
```

**`Block` 객체**

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | `string` | `event:{event_id}:{resource_id}` 또는 `request:{request_id}` |
| `kind` | `"confirmed" \| "pending"` | 확정 일정 / 승인 대기 요청 |
| `resourceId` | `string \| null` | 회의실 ID |
| `resourceName` | `string` | 회의실 이름(미지정 시 `"미지정"`) |
| `date` | `YYYY-MM-DD` | 서울 기준 날짜 |
| `startsAt` | `ISO 8601` | 시작 시각 |
| `endsAt` | `ISO 8601` | 종료 시각 |
| `allDay` | `boolean` | 종일 여부 |
| `time` | `HH:MM` | 서울 기준 시작 시각 |
| `label` | `string` | 화면 표시용 라벨. 예: `"09:00 - 10:00"`, `"종일 예약"`, `"09:00 - 10:00 (승인 대기)"` |
| `sourceType` | `string \| null` | `confirmed`인 경우 `calendar_events.source_type`, `pending`인 경우 `"public_booking_request"` |

**Privacy 규칙**

공개 응답에는 절대 다음 민감 필드를 포함하지 않는다: `title`, `description`, `requesterName`, `phone`, `email`, `purpose`, `notes`, `companyName`. 블록은 `resourceName`과 `time` 레이블만 노출한다.

**예시 응답 — `view: "day"`**

```json
{
  "view": "day",
  "range": {
    "startDate": "2026-08-27",
    "endDate": "2026-08-27",
    "startsAt": "2026-08-27T00:00:00.000+09:00",
    "endsAt": "2026-08-28T00:00:00.000+09:00"
  },
  "resources": [
    { "id": "res-1", "name": "1층 회의실", "floor": "1층" },
    { "id": "res-2", "name": "2층 회의실", "floor": "2층" }
  ],
  "rules": {
    "allowedWeekdays": [1, 2, 3, 4, 5],
    "startTime": "09:00",
    "endTime": "18:00",
    "slotMinutes": 30,
    "durationMinutes": 60
  },
  "blocks": [
    {
      "id": "event:evt-101:res-1",
      "kind": "confirmed",
      "resourceId": "res-1",
      "resourceName": "1층 회의실",
      "date": "2026-08-27",
      "startsAt": "2026-08-27T10:00:00.000+09:00",
      "endsAt": "2026-08-27T11:00:00.000+09:00",
      "allDay": false,
      "time": "10:00",
      "label": "10:00 - 11:00",
      "sourceType": "external_booking"
    },
    {
      "id": "request:req-202",
      "kind": "pending",
      "resourceId": "res-2",
      "resourceName": "2층 회의실",
      "date": "2026-08-27",
      "startsAt": "2026-08-27T14:00:00.000+09:00",
      "endsAt": "2026-08-27T15:00:00.000+09:00",
      "allDay": false,
      "time": "14:00",
      "label": "14:00 - 15:00 (승인 대기)",
      "sourceType": "public_booking_request"
    }
  ]
}
```

**예시 응답 — `view: "week"`**

```json
{
  "view": "week",
  "range": {
    "startDate": "2026-08-23",
    "endDate": "2026-08-29",
    "startsAt": "2026-08-23T00:00:00.000+09:00",
    "endsAt": "2026-08-30T00:00:00.000+09:00"
  },
  "resources": [
    { "id": "res-1", "name": "1층 회의실", "floor": "1층" },
    { "id": "res-2", "name": "2층 회의실", "floor": "2층" }
  ],
  "rules": { "allowedWeekdays": [1,2,3,4,5], "startTime": "09:00", "endTime": "18:00", "slotMinutes": 30, "durationMinutes": 60 },
  "blocks": [
    {
      "id": "event:evt-101:res-1",
      "kind": "confirmed",
      "resourceId": "res-1",
      "resourceName": "1층 회의실",
      "date": "2026-08-25",
      "startsAt": "2026-08-25T10:00:00.000+09:00",
      "endsAt": "2026-08-25T11:00:00.000+09:00",
      "allDay": false,
      "time": "10:00",
      "label": "10:00 - 11:00",
      "sourceType": "external_booking"
    },
    {
      "id": "event:evt-102:res-2",
      "kind": "confirmed",
      "resourceId": "res-2",
      "resourceName": "2층 회의실",
      "date": "2026-08-27",
      "startsAt": "2026-08-27T13:00:00.000+09:00",
      "endsAt": "2026-08-27T14:00:00.000+09:00",
      "allDay": false,
      "time": "13:00",
      "label": "13:00 - 14:00",
      "sourceType": "external_booking"
    }
  ]
}
```

**예시 응답 — `view: "month"`**

```json
{
  "view": "month",
  "range": {
    "startDate": "2026-08-01",
    "endDate": "2026-08-31",
    "startsAt": "2026-08-01T00:00:00.000+09:00",
    "endsAt": "2026-09-01T00:00:00.000+09:00"
  },
  "resources": [
    { "id": "res-1", "name": "1층 회의실", "floor": "1층" },
    { "id": "res-2", "name": "2층 회의실", "floor": "2층" }
  ],
  "rules": { "allowedWeekdays": [1,2,3,4,5], "startTime": "09:00", "endTime": "18:00", "slotMinutes": 30, "durationMinutes": 60 },
  "blocks": [
    {
      "id": "event:evt-201:res-1",
      "kind": "confirmed",
      "resourceId": "res-1",
      "resourceName": "1층 회의실",
      "date": "2026-08-05",
      "startsAt": "2026-08-05T09:00:00.000+09:00",
      "endsAt": "2026-08-05T10:00:00.000+09:00",
      "allDay": false,
      "time": "09:00",
      "label": "09:00 - 10:00",
      "sourceType": "external_booking"
    }
  ]
}
```

**오류 응답**

| 상황 | HTTP 상태 | 응답 예시 |
|------|-----------|-----------|
| `slug` 누락 / `view` 오류 / `date` 형식 오류 | `400` | `{"error":"예약 링크가 필요습니다."}` |
| 접근 코드 불일치 | `403` | `{"error":"접근 코드가 올바르지 않습니다."}` |
| GET 요청 | `405` | `{"error":"Method not allowed"}` |

**자동 검증**

- 스키마 검증: `scripts/lib/get-schedule-schema.mjs`
- 통합 테스트: `scripts/test-get-schedule-integration.mjs` (month/week/day 200, 잘못된 입력 400, GET 405)
- E2E: `tests/e2e/public-booking.spec.ts` 내 `public-meeting-booking get-schedule` describe 블록

**응답 캐시 (성능)**

- `get-schedule` 결과(blocks/range/resources/rules)는 `link_id : view : date` 키로 캐시됩니다.
- 2단 구성: L1은 Edge Function 인스턴스 메모리, L2는 공용 테이블 `public_booking_schedule_cache`(service role 전용). 인스턴스가 교체되어도 L2에서 재사용됩니다.
- TTL 기본 60초, 환경변수 `GET_SCHEDULE_CACHE_TTL_MS`로 조정(0 이하로 두면 캐시 비활성화).
- 응답에 `cached`(boolean)와 캐시 적중 시 `cachedAt`(ISO)이 포함됩니다.
- 예약 생성/승인/거절 시 해당 링크의 캐시를 즉시 무효화하므로 일정 변경이 지연 노출되지 않습니다.
- 관련 로그 이벤트: `get-schedule.cache_hit`(`cacheSource`: memory|shared), `cache_store`, `cache_invalidated`, `cache_read_failed`, `cache_write_failed`.
