-- Independent meeting reservation management
CREATE TABLE public.meeting_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_type text NOT NULL CHECK (audience_type IN ('employee', 'client')),
  employee_meeting_type text NULL CHECK (
    employee_meeting_type IS NULL
    OR employee_meeting_type IN ('one_on_one', 'all_hands', 'team')
  ),
  client_meeting_type text NULL CHECK (
    client_meeting_type IS NULL
    OR client_meeting_type IN ('showroom_visit', 'production_consulting', 'external_meeting', 'exhibition_onsite', 'other')
  ),
  title text NOT NULL,
  description text NULL,
  meeting_date date NOT NULL,
  start_time text NOT NULL,
  end_time text NULL,
  location text NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'canceled')),
  recipient_id uuid NULL REFERENCES public.recipients(id) ON DELETE SET NULL,
  client_name text NULL,
  client_contact text NULL,
  participant_ids uuid[] NOT NULL DEFAULT '{}',
  participant_names text[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_reservations_employee_type_required CHECK (
    (audience_type = 'employee' AND employee_meeting_type IS NOT NULL AND client_meeting_type IS NULL)
    OR audience_type = 'client'
  ),
  CONSTRAINT meeting_reservations_client_type_required CHECK (
    (audience_type = 'client' AND client_meeting_type IS NOT NULL AND employee_meeting_type IS NULL)
    OR audience_type = 'employee'
  )
);

CREATE INDEX idx_meeting_reservations_date_time
  ON public.meeting_reservations(meeting_date, start_time);

CREATE INDEX idx_meeting_reservations_created_by
  ON public.meeting_reservations(created_by);

CREATE INDEX idx_meeting_reservations_status
  ON public.meeting_reservations(status);

CREATE INDEX idx_meeting_reservations_recipient_id
  ON public.meeting_reservations(recipient_id);

CREATE INDEX idx_meeting_reservations_participant_ids
  ON public.meeting_reservations USING gin(participant_ids);

ALTER TABLE public.meeting_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read meeting reservations"
ON public.meeting_reservations
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create meeting reservations"
ON public.meeting_reservations
FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update their meeting reservations"
ON public.meeting_reservations
FOR UPDATE
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can delete their meeting reservations"
ON public.meeting_reservations
FOR DELETE
USING (auth.uid() = created_by);

CREATE POLICY "Admins can manage meeting reservations"
ON public.meeting_reservations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can manage meeting reservations"
ON public.meeting_reservations
FOR ALL
USING (has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Managers can manage meeting reservations"
ON public.meeting_reservations
FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER update_meeting_reservations_updated_at
BEFORE UPDATE ON public.meeting_reservations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
