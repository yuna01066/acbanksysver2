# Settings Area Rollout Checklist

## 목적

관리자 설정/회사 설정 분리와 승인 요청 구조가 운영 Supabase 프로젝트에 정상 적용되었는지 확인한다.

## 운영 적용 확인

- Supabase 프로젝트: `zwloyqcwyfkimwkohpnd`
- 적용 대상 migration: `20260522120000_settings_area_separation_and_approval.sql`
- 로컬 환경에서 Supabase CLI가 없으면 운영 대시보드 SQL editor 또는 배포 파이프라인에서 확인한다.

## SQL 확인 항목

```sql
select to_regclass('public.settings_change_requests') as settings_change_requests;

select
  proname
from pg_proc
where proname in (
  'is_company_master',
  'approve_settings_change_request',
  'reject_settings_change_request',
  'can_access_feature'
)
order by proname;

select id, email
from public.profiles
where lower(email) = 'acbank@acbank.co.kr';
```

## 수동 시나리오

- 마스터가 아닌 admin/moderator는 `/company-settings` 접근이 차단된다.
- 마스터 계정도 비밀번호 재입력 전에는 회사 설정 내용이 노출되지 않는다.
- moderator가 상담 응대 보조 instruction 또는 아이콘을 변경하면 승인 요청으로 저장된다.
- admin이 승인하면 설정이 실제 반영된다.
- admin이 거부하면 원본 설정은 변경되지 않는다.
