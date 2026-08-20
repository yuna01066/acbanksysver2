# 보안 · 린터 자동 수집 요약 리포트

- 생성 시각(UTC): 2026-08-20T07:43:29.801Z
- 생성 방법: `npm run security:report`
- 규칙 위반 항목: 🔴 0건 · 🟠 4건 · 🔵 0건 (개별 대상 총 87개)

## 요약 표

| 심각도 | 점검 항목 | 대상 수 | 상태 |
| --- | --- | --- | --- |
| 🟠 warn | SECURITY DEFINER 함수에 anon 실행 권한 존재 | 34 | 조치 검토 |
| 🟠 warn | SECURITY DEFINER 함수에 authenticated 실행 권한 존재 | 48 | 조치 검토 |
| 🔴 error | SECURITY DEFINER 함수 search_path 미고정 | 0 | 통과 |
| 🟠 warn | RLS 활성화되었으나 정책 없음 (접근 전면 차단) | 1 | 조치 검토 |
| 🔴 error | public 테이블에 RLS 미적용 | 0 | 통과 |
| 🟠 warn | USING (true) 로 전면 개방된 정책 | 4 | 조치 검토 |
| 🟠 warn | SECURITY DEFINER 뷰 | 0 | 통과 |
| 🔴 error | anon 역할에 테이블 쓰기 권한 부여 | 0 | 통과 |

## 상세

### 🟠 SECURITY DEFINER 함수에 anon 실행 권한 존재
- 린터 규칙: `0028_anon_security_definer_function_executable`
- 권장 조치: 공개 호출이 필요 없으면 REVOKE EXECUTE ON FUNCTION public.<fn> FROM anon; 또는 SECURITY INVOKER 로 변경
- 대상 34개:
  - `assistant_shortcut_ids_allowed(_ids text[])`
  - `calendar_replace_event_participants(_event_id uuid, _organizer_id uuid, _attendee_ids uuid[], _assignee_ids uuid[])`
  - `calendar_sync_announcement_event(_announcement_id uuid)`
  - `calendar_sync_company_holiday(_holiday_id uuid)`
  - `calendar_sync_leave_request(_leave_id uuid)`
  - `calendar_sync_peer_meeting(_feedback_id uuid)`
  - `calendar_sync_project(_project_id uuid)`
  - `calendar_sync_saved_quote(_quote_id uuid)`
  - `calendar_upsert_source_event(_source_type text, _source_id uuid, _source_subtype text, _title text, _description text, _starts_at timestamp with time zone, _ends_at timestamp with time zone, _all_day boolean, _location text, _visibility text, _status text, _created_by uuid, _created_by_name text, _team_department text, _recipient_id uuid, _client_name text, _client_contact text, _source_path text, _accent text, _icon_type text, _metadata jsonb)`
  - `can_access_project_approval(_project_id uuid, _user_id uuid)`
  - `cancel_approval_request(_request_id uuid, _note text)`
  - `create_approval_request(_payload jsonb)`
  - `create_calendar_event(payload jsonb)`
  - `delete_calendar_event(payload jsonb)`
  - `get_assistant_allowed_shortcut_ids(_user_id uuid)`
  - `get_calendar_dashboard_summary(range_start timestamp with time zone, range_end timestamp with time zone, scope text)`
  - `get_calendar_events(range_start timestamp with time zone, range_end timestamp with time zone, filters jsonb)`
  - `get_profile_display_name(_user_id uuid)`
  - `notify_approval_reviewers(_request_id uuid)`
  - `prevent_moderator_profile_email_update()`
  - `prevent_profile_admin_field_self_update()`
  - `prevent_sensitive_profile_self_update()`
  - `record_pay_statement_event(p_statement_id uuid, p_event_type text)`
  - `review_approval_request(_request_id uuid, _decision text, _review_note text)`
  - `save_assistant_shortcuts(shortcut_ids text[])`
  - `sync_announcement_calendar_event()`
  - `sync_company_holiday_calendar_event()`
  - `sync_leave_request_calendar_event()`
  - `sync_meeting_reservation_calendar_event()`
  - `sync_peer_meeting_calendar_event()`
  - `sync_project_assignment_calendar_event()`
  - `sync_project_calendar_event()`
  - `sync_saved_quote_calendar_events()`
  - `update_calendar_event(payload jsonb)`

### 🟠 SECURITY DEFINER 함수에 authenticated 실행 권한 존재
- 린터 규칙: `0029_authenticated_security_definer_function_executable`
- 권장 조치: 정책 헬퍼(has_role, is_approved_user 등)는 정상. 그 외 관리 기능 함수는 EXECUTE 권한 회수 검토
- 대상 48개:
  - `approve_settings_change_request(_request_id uuid, _review_note text)`
  - `assistant_shortcut_ids_allowed(_ids text[])`
  - `calendar_replace_event_participants(_event_id uuid, _organizer_id uuid, _attendee_ids uuid[], _assignee_ids uuid[])`
  - `calendar_sync_announcement_event(_announcement_id uuid)`
  - `calendar_sync_company_holiday(_holiday_id uuid)`
  - `calendar_sync_leave_request(_leave_id uuid)`
  - `calendar_sync_peer_meeting(_feedback_id uuid)`
  - `calendar_sync_project(_project_id uuid)`
  - `calendar_sync_saved_quote(_quote_id uuid)`
  - `calendar_upsert_source_event(_source_type text, _source_id uuid, _source_subtype text, _title text, _description text, _starts_at timestamp with time zone, _ends_at timestamp with time zone, _all_day boolean, _location text, _visibility text, _status text, _created_by uuid, _created_by_name text, _team_department text, _recipient_id uuid, _client_name text, _client_contact text, _source_path text, _accent text, _icon_type text, _metadata jsonb)`
  - `can_access_channel_talk_inbox(_user_id uuid)`
  - `can_access_feature(_feature_key text)`
  - `can_access_project_approval(_project_id uuid, _user_id uuid)`
  - `can_manage_channel_talk_lead(_lead_id uuid, _user_id uuid)`
  - `cancel_approval_request(_request_id uuid, _note text)`
  - `check_workplace_distance(input_lat double precision, input_lng double precision)`
  - `create_approval_request(_payload jsonb)`
  - `create_calendar_event(payload jsonb)`
  - `delete_calendar_event(payload jsonb)`
  - `get_assistant_allowed_shortcut_ids(_user_id uuid)`
  - `get_calendar_dashboard_summary(range_start timestamp with time zone, range_end timestamp with time zone, scope text)`
  - `get_calendar_events(range_start timestamp with time zone, range_end timestamp with time zone, filters jsonb)`
  - `get_employee_online_status()`
  - `get_profile_display_name(_user_id uuid)`
  - `has_role(_user_id uuid, _role app_role)`
  - `is_approved_user(_user_id uuid)`
  - `is_company_master()`
  - `is_project_assigned(_project_id uuid, _user_id uuid)`
  - `is_project_owner(_project_id uuid, _user_id uuid)`
  - `mark_employee_offline()`
  - `notify_approval_reviewers(_request_id uuid)`
  - `prevent_moderator_profile_email_update()`
  - `prevent_profile_admin_field_self_update()`
  - `prevent_sensitive_profile_self_update()`
  - `record_pay_statement_event(p_statement_id uuid, p_event_type text)`
  - `reject_settings_change_request(_request_id uuid, _review_note text)`
  - `review_approval_request(_request_id uuid, _decision text, _review_note text)`
  - `save_assistant_shortcuts(shortcut_ids text[])`
  - `sync_announcement_calendar_event()`
  - `sync_company_holiday_calendar_event()`
  - ...외 8개

### 🔴 SECURITY DEFINER 함수 search_path 미고정
- 린터 규칙: `function_search_path_mutable`
- 권장 조치: ALTER FUNCTION public.<fn> SET search_path = public; 적용
- 해당 항목 없음 ✅

### 🟠 RLS 활성화되었으나 정책 없음 (접근 전면 차단)
- 린터 규칙: `0008_rls_enabled_no_policy`
- 권장 조치: 필요한 SELECT/INSERT 정책 추가 또는 테이블 사용 여부 재검토
- 대상 1개:
  - `company_master_users`

### 🔴 public 테이블에 RLS 미적용
- 린터 규칙: `0013_rls_disabled_in_public`
- 권장 조치: ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY; 후 정책 작성
- 해당 항목 없음 ✅

### 🟠 USING (true) 로 전면 개방된 정책
- 권장 조치: auth.uid() 기반 소유자 조건 또는 is_approved_user()/has_role() 조건으로 축소
- 대상 4개:
  - `page_role_access :: Authenticated users can read page role access [SELECT]`
  - `panel_pricing_versions :: Authenticated users can view pricing versions [SELECT]`
  - `portfolio_collection_items :: Authenticated users can view portfolio collection items [SELECT]`
  - `portfolio_collections :: Authenticated users can view portfolio collections [SELECT]`

### 🟠 SECURITY DEFINER 뷰
- 린터 규칙: `0010_security_definer_view`
- 권장 조치: security_invoker=on 으로 재정의하여 호출자 RLS 가 적용되게 변경
- 해당 항목 없음 ✅

### 🔴 anon 역할에 테이블 쓰기 권한 부여
- 권장 조치: REVOKE INSERT/UPDATE/DELETE ... FROM anon; 후 Edge Function 경유로 전환
- 해당 항목 없음 ✅

## 판단 기준 메모

- RLS 정책 헬퍼(`has_role`, `is_approved_user`, 트리거 함수)는 SECURITY DEFINER 가 정상이며 `authenticated` 실행 권한이 필요합니다.
- `search_path` 미고정 SECURITY DEFINER 함수는 예외 없이 수정 대상입니다.
- `anon` 쓰기 권한은 공개 위젯(상담/예약 접수)에서도 사용하지 않고 Edge Function 을 경유합니다.
