-- Track Popbill operations before the external side effect so interrupted
-- issue/cancel flows can be reconciled without issuing a duplicate document.
ALTER TABLE public.tax_invoices
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS pending_operation text,
  ADD COLUMN IF NOT EXISTS sync_error text,
  ADD COLUMN IF NOT EXISTS external_action_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tax_invoices_sync_status_check'
      AND conrelid = 'public.tax_invoices'::regclass
  ) THEN
    ALTER TABLE public.tax_invoices
      ADD CONSTRAINT tax_invoices_sync_status_check
      CHECK (sync_status IN ('synced', 'pending', 'required')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tax_invoices_pending_operation_check'
      AND conrelid = 'public.tax_invoices'::regclass
  ) THEN
    ALTER TABLE public.tax_invoices
      ADD CONSTRAINT tax_invoices_pending_operation_check
      CHECK (pending_operation IS NULL OR pending_operation IN ('issue', 'cancel')) NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.tax_invoices
  VALIDATE CONSTRAINT tax_invoices_sync_status_check;

ALTER TABLE public.tax_invoices
  VALIDATE CONSTRAINT tax_invoices_pending_operation_check;

-- Popbill requires a partner-assigned document number to be unique. Mirroring
-- that rule locally makes the same management key the idempotency anchor.
CREATE UNIQUE INDEX IF NOT EXISTS tax_invoices_popbill_mgt_key_unique_idx
  ON public.tax_invoices (popbill_mgt_key)
  WHERE popbill_mgt_key IS NOT NULL AND btrim(popbill_mgt_key) <> '';

CREATE INDEX IF NOT EXISTS tax_invoices_sync_status_idx
  ON public.tax_invoices (sync_status)
  WHERE sync_status <> 'synced';

COMMENT ON COLUMN public.tax_invoices.sync_status IS
  'Local reconciliation state for Popbill side effects: synced, pending, or required.';
COMMENT ON COLUMN public.tax_invoices.pending_operation IS
  'Popbill operation that must be reconciled before another issue/cancel attempt.';
COMMENT ON COLUMN public.tax_invoices.sync_error IS
  'Last local/external operation error retained for administrator recovery.';
COMMENT ON COLUMN public.tax_invoices.external_action_at IS
  'Timestamp when Popbill confirmed the latest issue or cancel action.';

-- The page and Popbill Edge Function are restricted to administrators and the
-- approved company master. Moderators retain read-only operational visibility.
DROP POLICY IF EXISTS "Moderators can manage all tax invoices"
  ON public.tax_invoices;
DROP POLICY IF EXISTS "Moderators can view all tax invoices"
  ON public.tax_invoices;

CREATE POLICY "Moderators can view all tax invoices"
  ON public.tax_invoices FOR SELECT
  USING (public.has_role(auth.uid(), 'moderator'::public.app_role));

-- Legacy self-service draft writes conflict with the admin-only issuing page
-- and could otherwise create or alter a recovery marker outside that boundary.
DROP POLICY IF EXISTS "Users can create their own tax invoices"
  ON public.tax_invoices;
DROP POLICY IF EXISTS "Users can update their own draft tax invoices"
  ON public.tax_invoices;

DROP POLICY IF EXISTS "Company master can manage all tax invoices"
  ON public.tax_invoices;

CREATE POLICY "Company master can manage all tax invoices"
  ON public.tax_invoices FOR ALL
  USING (public.is_company_master())
  WITH CHECK (public.is_company_master());
