# Panel Pricing Migration — 롤백 · 재적용 런북

대상 migration: `supabase/migrations/20260720090000_panel_prices_ab_buffer_2026.sql`
(A/B 원판 상한 2026-06-01 + 3% 버퍼, `panel_sizes` / `panel_option_surcharges` 갱신)

이 문서는 위 migration이 **부분 성공/실패**한 경우 안전하게 되돌리거나 재적용하는 절차입니다.
운영 DB에서는 반드시 순서를 지켜 수행하세요.

---

## 0. 사전 원칙

- 이 migration은 단일 트랜잭션(`BEGIN;` 없이 Lovable Cloud가 자동으로 트랜잭션 처리)으로 실행됩니다.
  전체 성공하거나 전체 실패해야 합니다. **부분 커밋이 발생했다면 재시도 전에 원인부터 조사**하세요.
- `panel_sizes`, `panel_option_surcharges`, `panel_pricing_versions`는 견적 계산에 직접 연결되므로
  롤백/재적용 중에는 **신규 견적 생성/저장을 잠시 금지**하고 운영팀에 공지합니다.
- 롤백 전에 반드시 아래 명령으로 현재 상태 스냅샷을 확보하세요.

```bash
psql -c "COPY (SELECT * FROM public.panel_sizes)                TO STDOUT WITH CSV HEADER" > /mnt/documents/backup_panel_sizes_$(date +%Y%m%d_%H%M).csv
psql -c "COPY (SELECT * FROM public.panel_option_surcharges)    TO STDOUT WITH CSV HEADER" > /mnt/documents/backup_panel_option_surcharges_$(date +%Y%m%d_%H%M).csv
psql -c "COPY (SELECT * FROM public.panel_pricing_versions)     TO STDOUT WITH CSV HEADER" > /mnt/documents/backup_panel_pricing_versions_$(date +%Y%m%d_%H%M).csv
```

---

## 1. 상태 진단

먼저 자동 검증 스크립트를 실행해 현재 상태를 파악합니다.

```bash
bun run verify:panel-migration
```

- `status: ok` → 재적용 불필요. 정상 상태.
- `status: failed` → `scripts/reports/panel-migration-state-<ts>.json`에 상세 실패 목록이 저장됩니다.
  실패 카테고리별 조치는 아래 §3 참조.

추가로 다음을 확인합니다.

```bash
# 새 pricing version이 활성인지
psql -c "SELECT id, version_name, is_active, effective_from FROM public.panel_pricing_versions WHERE version_name = 'A/B 원판 상한 2026-06-01 + 3%';"

# 새 버전으로 태깅된 행 수 (예상: panel_sizes ≈ 42+, surcharges ≈ 8+)
psql -c "SELECT (SELECT COUNT(*) FROM public.panel_sizes ps JOIN public.panel_pricing_versions v ON v.id=ps.pricing_version_id WHERE v.version_name='A/B 원판 상한 2026-06-01 + 3%') AS sizes, (SELECT COUNT(*) FROM public.panel_option_surcharges s JOIN public.panel_pricing_versions v ON v.id=s.pricing_version_id WHERE v.version_name='A/B 원판 상한 2026-06-01 + 3%') AS surcharges;"
```

---

## 2. 롤백 절차

> **주의**: 롤백은 이전 활성 pricing version으로 되돌리는 것이지, seed 이전 원본 가격을
> 복원하는 것이 아닙니다. 원본이 필요하면 §0에서 확보한 CSV 스냅샷으로 복구하세요.

### 2-A. 신규 버전 비활성 + 이전 버전 재활성 (권장)

`panel_pricing_versions.idx_panel_pricing_versions_single_active`가 `is_active=true`인 행을
**단 하나**만 허용하므로 아래 순서로 수행합니다.

```sql
-- migration 실행 (지원 도구) 을 통해 수행하세요.
BEGIN;

-- 1) 새 버전 비활성
UPDATE public.panel_pricing_versions
SET is_active = false
WHERE version_name = 'A/B 원판 상한 2026-06-01 + 3%';

-- 2) 이전 버전 재활성 (실제 대상 version_name을 사전 확인 후 지정)
UPDATE public.panel_pricing_versions
SET is_active = true
WHERE version_name = '<직전 활성 버전명>';

-- 3) 3*6 레거시 활성화, 신규 소3*6/대3*6 비활성화 (필요한 경우에만)
--    ※ 견적 계산은 pricing_version_id로 정렬되므로, 대부분 이 단계는 생략 가능합니다.

COMMIT;
NOTIFY pgrst, 'reload schema';
```

### 2-B. 새 버전 관련 행 완전 삭제 (긴급, 데이터 유실 가능)

`panel_sizes`/`panel_option_surcharges`에는 `pricing_version_id ON DELETE SET NULL`가 걸려있어
버전을 지우면 참조가 NULL로 남습니다. 원본 seed는 그대로 유지되므로 대부분 안전합니다.

```sql
BEGIN;
DELETE FROM public.panel_pricing_versions
WHERE version_name = 'A/B 원판 상한 2026-06-01 + 3%';
COMMIT;
NOTIFY pgrst, 'reload schema';
```

주의: `saved_quotes.pricing_version_id` 참조도 NULL이 됩니다.
이미 저장된 견적 금액은 스냅샷이므로 금액은 변하지 않지만, **버전 추적 링크가 끊깁니다**.
과거 견적을 다수 링크한 상태라면 §2-A를 우선하세요.

---

## 3. 재적용 (Retry) 절차

`verify:panel-migration`이 `failed`로 나온 경우 다음 순서로 재시도합니다.

1. **원인 확인**: `scripts/reports/panel-migration-state-<ts>.json`의 `failures[]` 카테고리별로
   - `panel_sizes.missing_active_row` → seed 미삽입. migration 재실행 필요.
   - `panel_sizes.expected_active_but_inactive` → `is_active` 갱신 실패. 재실행 필요.
   - `panel_sizes.legacy_size_still_active` → 레거시 3*6 비활성화 누락. 재실행 필요.
   - `surcharge.missing_or_inactive` / `unexpected_active_size` / `cost_mismatch` → 서차지 seed 실패. 재실행 필요.
   - `pricing_version.missing` → 새 버전 자체가 없음. migration 전체 재실행 필요.

2. **재실행**: migration 파일은 `ON CONFLICT ... DO UPDATE`와 `is_active = EXCLUDED` 패턴을
   사용해 **idempotent**합니다. 아래 명령으로 그대로 다시 적용합니다.

   ```bash
   # Lovable Cloud SQL Migration 도구를 통해
   # supabase/migrations/20260720090000_panel_prices_ab_buffer_2026.sql 재실행
   ```

3. **PostgREST schema cache reload**:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

4. **검증**:
   ```bash
   bun run verify:panel-migration            # 상태 검증
   bun run test:pricing:ab-e2e               # A/B 버퍼 계산 E2E
   bun run test:pricing:saved-quotes         # 기존 견적 불변 확인
   ```

3개 스크립트가 모두 `ok`이면 재적용 성공입니다.

---

## 4. 실패해서는 안 되는 것 (Red Flags)

다음 상태는 **즉시 롤백**하고 원인 조사 대상입니다.

- `panel_pricing_versions.is_active = true` 인 행이 2개 이상 (unique index 위반, 신규 견적 실패)
- `bun run test:pricing:saved-quotes` 가 실패 (기존 견적 금액 변경 = 데이터 무결성 위반)
- 신규 버전 태깅된 `panel_sizes` 중 `price` 가 seed 값과 다름 (수동 수정 흔적)

---

## 5. 자동 경고

`scripts/verify-panel-migration-state.mjs`는 실패 시 다음을 자동 출력합니다.
- 실패 카테고리별 첫 5건 요약
- 전체 리포트 파일 경로
- 본 런북 링크 (`docs/operations/panel-migration-rollback-runbook.md`)

CI 또는 배포 파이프라인에서 exit code(1)를 감지해 알림으로 연결하세요.
