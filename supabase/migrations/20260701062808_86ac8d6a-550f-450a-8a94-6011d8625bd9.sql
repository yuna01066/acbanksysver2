BEGIN;

CREATE TABLE IF NOT EXISTS public.attendance_records_duplicate_backup_20260701 AS
WITH ranked AS (
  SELECT
    ar.*,
    count(*) OVER (PARTITION BY ar.user_id, ar.date) AS duplicate_count,
    row_number() OVER (
      PARTITION BY ar.user_id, ar.date
      ORDER BY
        (ar.check_in IS NULL) ASC,
        (ar.check_out IS NULL) ASC,
        ar.check_in ASC NULLS LAST,
        ar.check_out DESC NULLS LAST,
        ar.created_at ASC NULLS LAST,
        ar.id ASC
    ) AS duplicate_rank
  FROM public.attendance_records ar
)
SELECT *
FROM ranked
WHERE duplicate_count > 1;

COMMENT ON TABLE public.attendance_records_duplicate_backup_20260701 IS
  'Backup of attendance duplicate rows before enforcing one row per user/date. Created by 20260701043000_attendance_daily_unique_guard.';

WITH duplicate_groups AS (
  SELECT
    ar.user_id,
    ar.date,
    (array_agg(ar.id ORDER BY
      (ar.check_in IS NULL) ASC,
      (ar.check_out IS NULL) ASC,
      ar.check_in ASC NULLS LAST,
      ar.check_out DESC NULLS LAST,
      ar.created_at ASC NULLS LAST,
      ar.id ASC
    ))[1] AS keep_id,
    (array_agg(ar.user_name ORDER BY ar.created_at DESC NULLS LAST) FILTER (WHERE ar.user_name IS NOT NULL AND ar.user_name <> ''))[1] AS merged_user_name,
    min(ar.check_in) FILTER (WHERE ar.check_in IS NOT NULL) AS merged_check_in,
    max(ar.check_out) FILTER (WHERE ar.check_out IS NOT NULL) AS merged_check_out,
    (array_agg(ar.check_in_location ORDER BY ar.check_in ASC NULLS LAST) FILTER (WHERE ar.check_in_location IS NOT NULL))[1] AS merged_check_in_location,
    (array_agg(ar.check_out_location ORDER BY ar.check_out DESC NULLS LAST) FILTER (WHERE ar.check_out_location IS NOT NULL))[1] AS merged_check_out_location,
    string_agg(DISTINCT nullif(ar.location_memo, ''), ' | ') AS merged_location_memo,
    string_agg(DISTINCT nullif(ar.memo, ''), ' | ') AS merged_memo,
    min(ar.created_at) AS merged_created_at
  FROM public.attendance_records ar
  GROUP BY ar.user_id, ar.date
  HAVING count(*) > 1
),
merged AS (
  UPDATE public.attendance_records ar
  SET
    user_name = COALESCE(g.merged_user_name, ar.user_name),
    check_in = COALESCE(g.merged_check_in, ar.check_in),
    check_out = COALESCE(g.merged_check_out, ar.check_out),
    check_in_location = COALESCE(g.merged_check_in_location, ar.check_in_location),
    check_out_location = COALESCE(g.merged_check_out_location, ar.check_out_location),
    location_memo = COALESCE(nullif(g.merged_location_memo, ''), ar.location_memo),
    memo = COALESCE(nullif(g.merged_memo, ''), ar.memo),
    status = CASE
      WHEN g.merged_check_out IS NOT NULL THEN 'checked_out'
      WHEN g.merged_check_in IS NOT NULL THEN 'checked_in'
      ELSE ar.status
    END,
    created_at = COALESCE(g.merged_created_at, ar.created_at),
    updated_at = now()
  FROM duplicate_groups g
  WHERE ar.id = g.keep_id
  RETURNING ar.id
)
DELETE FROM public.attendance_records ar
USING duplicate_groups g
WHERE ar.user_id = g.user_id
  AND ar.date = g.date
  AND ar.id <> g.keep_id;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_user_id_date_unique_idx
ON public.attendance_records (user_id, date);

COMMIT;