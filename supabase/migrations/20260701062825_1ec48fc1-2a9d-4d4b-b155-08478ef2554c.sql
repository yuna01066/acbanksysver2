REVOKE ALL ON public.attendance_records_duplicate_backup_20260701 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.attendance_records_duplicate_backup_20260701 TO authenticated;
GRANT ALL ON public.attendance_records_duplicate_backup_20260701 TO service_role;
ALTER TABLE public.attendance_records_duplicate_backup_20260701 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view attendance duplicate backup"
ON public.attendance_records_duplicate_backup_20260701
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));