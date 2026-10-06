BEGIN;

-- No backfill/default: all existing requests keep NULL and their historical basis.
ALTER TABLE public.leave_requests ADD COLUMN deducts_annual_leave BOOLEAN;

COMMENT ON COLUMN public.leave_requests.deducts_annual_leave IS
  'Annual balance basis fixed on INSERT. NULL preserves legacy annual/monthly/half-day rules; legacy summer is not deducted.';

CREATE OR REPLACE FUNCTION public.snapshot_leave_annual_deduction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Ignore caller-provided flags and dates, including older/cached clients.
    NEW.deducts_annual_leave := NEW.leave_type IN ('annual', 'monthly', 'half_am', 'half_pm', 'summer');
  ELSIF NEW.deducts_annual_leave IS DISTINCT FROM OLD.deducts_annual_leave
     OR NEW.leave_type IS DISTINCT FROM OLD.leave_type THEN
    RAISE EXCEPTION '신청 시 확정된 휴가 유형과 연차 차감 기준은 변경할 수 없습니다. 취소 후 다시 신청해 주세요.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.snapshot_leave_annual_deduction() FROM PUBLIC, anon, authenticated;

-- Trigger activation is the cutover: approval and leave dates do not change it.
CREATE TRIGGER snapshot_leave_annual_deduction
BEFORE INSERT OR UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.snapshot_leave_annual_deduction();

COMMIT;
