-- The duplicate backup contains sensitive attendance history. Restrict it to
-- the service role even when either July guard migration created the table.
DO $$
BEGIN
  IF to_regclass('public.attendance_records_duplicate_backup_20260701') IS NOT NULL THEN
    ALTER TABLE public.attendance_records_duplicate_backup_20260701 ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.attendance_records_duplicate_backup_20260701 FROM anon, authenticated;
    GRANT ALL ON TABLE public.attendance_records_duplicate_backup_20260701 TO service_role;
  END IF;
END;
$$;
