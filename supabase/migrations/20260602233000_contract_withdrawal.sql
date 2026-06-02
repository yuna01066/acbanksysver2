-- Add electronic contract withdrawal state and audit event.

ALTER TABLE public.employment_contracts
  ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS withdrawn_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS withdrawn_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_employment_contracts_withdrawn_at
  ON public.employment_contracts(withdrawn_at)
  WHERE status = 'withdrawn';

ALTER TABLE public.contract_events
  DROP CONSTRAINT IF EXISTS contract_events_event_type_check;

ALTER TABLE public.contract_events
  ADD CONSTRAINT contract_events_event_type_check
  CHECK (event_type IN ('requested', 'opened', 'signed', 'rejected', 'downloaded', 'withdrawn'));

COMMENT ON COLUMN public.employment_contracts.withdrawn_at IS
  'Timestamp when an admin or moderator withdrew a requested electronic contract before signing.';
COMMENT ON COLUMN public.employment_contracts.withdrawn_by IS
  'Admin or moderator user id that withdrew the electronic contract.';
COMMENT ON COLUMN public.employment_contracts.withdrawn_reason IS
  'Optional reason shown to admins and employees for withdrawing the electronic contract.';

NOTIFY pgrst, 'reload schema';
