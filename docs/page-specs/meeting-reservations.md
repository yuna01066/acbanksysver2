# 미팅 예약 관리

## 목적

- 공지사항에 섞여 있던 미팅/회의 예약을 독립 기능으로 분리한다.
- 위젯 형태로 어느 화면에나 배치할 수 있어야 한다.
- 직원 미팅과 클라이언트 미팅을 먼저 나누고, 각 미팅 유형을 빠르게 선택해 예약한다.

## 주요 파일

- 위젯: `src/components/MeetingBookingWidget.tsx`
- 페이지 래퍼: `src/pages/MeetingReservationsPage.tsx`
- 유형/상태 상수: `src/types/meetingReservations.ts`
- 데이터베이스: `supabase/migrations/20260521143000_meeting_reservations.sql`

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
