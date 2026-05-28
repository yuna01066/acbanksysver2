-- Tighten scanner-reported RLS/storage/realtime exposure without changing app data shape.

-- ---------------------------------------------------------------------------
-- Safe read surfaces for staff-facing UI
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.profile_directory AS
SELECT
  id,
  full_name,
  department,
  position,
  job_title,
  rank_title,
  avatar_url,
  is_approved
FROM public.profiles
WHERE is_approved IS TRUE;

REVOKE ALL ON public.profile_directory FROM PUBLIC;
REVOKE ALL ON public.profile_directory FROM anon;
GRANT SELECT ON public.profile_directory TO authenticated;

CREATE OR REPLACE VIEW public.checked_in_employee_status AS
SELECT
  ar.user_id,
  ar.user_name,
  ar.check_in,
  ar.date,
  ar.status,
  p.avatar_url,
  p.department,
  p.position
FROM public.attendance_records ar
LEFT JOIN public.profiles p ON p.id = ar.user_id
WHERE ar.date = CURRENT_DATE
  AND ar.status IN ('checked_in', 'present');

REVOKE ALL ON public.checked_in_employee_status FROM PUBLIC;
REVOKE ALL ON public.checked_in_employee_status FROM anon;
GRANT SELECT ON public.checked_in_employee_status TO authenticated;

CREATE OR REPLACE VIEW public.company_public_info AS
SELECT
  id,
  company_name,
  ceo_name,
  business_number,
  address,
  detail_address,
  phone,
  fax,
  email,
  website,
  industry,
  business_type,
  established_date,
  logo_url,
  quote_notes,
  quote_consultation,
  quote_contact_phone,
  quote_contact_email,
  quote_contact_message
FROM public.company_info;

REVOKE ALL ON public.company_public_info FROM PUBLIC;
REVOKE ALL ON public.company_public_info FROM anon;
GRANT SELECT ON public.company_public_info TO authenticated;

CREATE OR REPLACE VIEW public.company_quote_defaults AS
SELECT
  id,
  company_name,
  ceo_name,
  business_number,
  address,
  detail_address,
  phone,
  fax,
  email,
  website,
  industry,
  business_type,
  logo_url,
  quote_bank_info,
  quote_notes,
  quote_consultation,
  quote_contact_phone,
  quote_contact_email,
  quote_contact_message
FROM public.company_info;

REVOKE ALL ON public.company_quote_defaults FROM PUBLIC;
REVOKE ALL ON public.company_quote_defaults FROM anon;
GRANT SELECT ON public.company_quote_defaults TO authenticated;

CREATE OR REPLACE FUNCTION public.check_workplace_distance(
  input_lat double precision,
  input_lng double precision
)
RETURNS TABLE (
  outside boolean,
  distance_meters double precision,
  radius_meters double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  workplace record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT workplace_lat, workplace_lng, COALESCE(workplace_radius, 500) AS workplace_radius
  INTO workplace
  FROM public.company_info
  WHERE workplace_lat IS NOT NULL
    AND workplace_lng IS NOT NULL
  LIMIT 1;

  IF workplace IS NULL OR input_lat IS NULL OR input_lng IS NULL THEN
    RETURN QUERY SELECT false, NULL::double precision, NULL::double precision;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    (
      6371000 * 2 * asin(
        sqrt(
          power(sin(radians(input_lat - workplace.workplace_lat) / 2), 2)
          + cos(radians(workplace.workplace_lat))
          * cos(radians(input_lat))
          * power(sin(radians(input_lng - workplace.workplace_lng) / 2), 2)
        )
      )
    ) > workplace.workplace_radius AS outside,
    (
      6371000 * 2 * asin(
        sqrt(
          power(sin(radians(input_lat - workplace.workplace_lat) / 2), 2)
          + cos(radians(workplace.workplace_lat))
          * cos(radians(input_lat))
          * power(sin(radians(input_lng - workplace.workplace_lng) / 2), 2)
        )
      )
    ) AS distance_meters,
    workplace.workplace_radius::double precision AS radius_meters;
END;
$$;

REVOKE ALL ON FUNCTION public.check_workplace_distance(double precision, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_workplace_distance(double precision, double precision) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_workplace_distance(double precision, double precision) TO authenticated;

-- ---------------------------------------------------------------------------
-- Profiles and attendance: remove broad staff-wide PII/GPS policies.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can read basic profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view today attendance" ON public.attendance_records;

-- ---------------------------------------------------------------------------
-- Company info: remove unauthenticated read access. Full table remains internal.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can read company info" ON public.company_info;
DROP POLICY IF EXISTS "Authenticated users can read company info" ON public.company_info;
DROP POLICY IF EXISTS "Admins and moderators can read company info" ON public.company_info;

CREATE POLICY "Admins and moderators can read company info"
ON public.company_info
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);

-- ---------------------------------------------------------------------------
-- Project milestones: restrict to project participants and managers.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view project milestones" ON public.project_milestones;
DROP POLICY IF EXISTS "Authenticated users can create milestones" ON public.project_milestones;
DROP POLICY IF EXISTS "Authenticated users can update milestones" ON public.project_milestones;
DROP POLICY IF EXISTS "Authenticated users can delete milestones" ON public.project_milestones;
DROP POLICY IF EXISTS "Project participants can view milestones" ON public.project_milestones;
DROP POLICY IF EXISTS "Project participants can create milestones" ON public.project_milestones;
DROP POLICY IF EXISTS "Project participants can update milestones" ON public.project_milestones;
DROP POLICY IF EXISTS "Project participants can delete milestones" ON public.project_milestones;

CREATE POLICY "Project participants can view milestones"
ON public.project_milestones
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
  OR public.is_project_owner(project_id, auth.uid())
  OR public.is_project_assigned(project_id, auth.uid())
);

CREATE POLICY "Project participants can create milestones"
ON public.project_milestones
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
  OR public.is_project_owner(project_id, auth.uid())
  OR public.is_project_assigned(project_id, auth.uid())
);

CREATE POLICY "Project participants can update milestones"
ON public.project_milestones
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
  OR public.is_project_owner(project_id, auth.uid())
  OR public.is_project_assigned(project_id, auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
  OR public.is_project_owner(project_id, auth.uid())
  OR public.is_project_assigned(project_id, auth.uid())
);

CREATE POLICY "Project participants can delete milestones"
ON public.project_milestones
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
  OR public.is_project_owner(project_id, auth.uid())
  OR public.is_project_assigned(project_id, auth.uid())
);

-- ---------------------------------------------------------------------------
-- Recipient notes: remove unauthenticated/client-wide note reads.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view recipient notes" ON public.recipient_notes;
DROP POLICY IF EXISTS "Users can view relevant recipient notes" ON public.recipient_notes;

CREATE POLICY "Users can view relevant recipient notes"
ON public.recipient_notes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.recipients r
    WHERE r.id = recipient_notes.recipient_id
      AND r.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- Quote snapshots/history: remove all-employee snapshot reads.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can view quote versions" ON public.quote_versions;
DROP POLICY IF EXISTS "Authenticated users can insert quote versions" ON public.quote_versions;
DROP POLICY IF EXISTS "Users can view relevant quote versions" ON public.quote_versions;
DROP POLICY IF EXISTS "Users can insert relevant quote versions" ON public.quote_versions;

CREATE POLICY "Users can view relevant quote versions"
ON public.quote_versions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
  OR changed_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.saved_quotes sq
    WHERE sq.id = quote_versions.quote_id
      AND (
        sq.user_id = auth.uid()
        OR sq.issuer_id = auth.uid()
        OR sq.assigned_to = auth.uid()
      )
  )
);

CREATE POLICY "Users can insert relevant quote versions"
ON public.quote_versions
FOR INSERT
TO authenticated
WITH CHECK (
  changed_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.saved_quotes sq
      WHERE sq.id = quote_versions.quote_id
        AND (
          sq.user_id = auth.uid()
          OR sq.issuer_id = auth.uid()
          OR sq.assigned_to = auth.uid()
        )
    )
  )
);

DROP POLICY IF EXISTS "Authenticated users can view stage history" ON public.quote_stage_history;
DROP POLICY IF EXISTS "Authenticated users can insert stage history" ON public.quote_stage_history;
DROP POLICY IF EXISTS "Users can view relevant stage history" ON public.quote_stage_history;
DROP POLICY IF EXISTS "Users can insert relevant stage history" ON public.quote_stage_history;

CREATE POLICY "Users can view relevant stage history"
ON public.quote_stage_history
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
  OR changed_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.saved_quotes sq
    WHERE sq.id = quote_stage_history.quote_id
      AND (
        sq.user_id = auth.uid()
        OR sq.issuer_id = auth.uid()
        OR sq.assigned_to = auth.uid()
      )
  )
);

CREATE POLICY "Users can insert relevant stage history"
ON public.quote_stage_history
FOR INSERT
TO authenticated
WITH CHECK (
  changed_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.saved_quotes sq
      WHERE sq.id = quote_stage_history.quote_id
        AND (
          sq.user_id = auth.uid()
          OR sq.issuer_id = auth.uid()
          OR sq.assigned_to = auth.uid()
        )
    )
  )
);

DROP POLICY IF EXISTS "Authenticated users can view quote activity history" ON public.quote_activity_history;
DROP POLICY IF EXISTS "Authenticated users can insert quote activity history" ON public.quote_activity_history;
DROP POLICY IF EXISTS "Users can view relevant quote activity history" ON public.quote_activity_history;
DROP POLICY IF EXISTS "Users can insert relevant quote activity history" ON public.quote_activity_history;

CREATE POLICY "Users can view relevant quote activity history"
ON public.quote_activity_history
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
  OR actor_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.saved_quotes sq
    WHERE sq.id = quote_activity_history.quote_id
      AND (
        sq.user_id = auth.uid()
        OR sq.issuer_id = auth.uid()
        OR sq.assigned_to = auth.uid()
      )
  )
);

CREATE POLICY "Users can insert relevant quote activity history"
ON public.quote_activity_history
FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.saved_quotes sq
      WHERE sq.id = quote_activity_history.quote_id
        AND (
          sq.user_id = auth.uid()
          OR sq.issuer_id = auth.uid()
          OR sq.assigned_to = auth.uid()
        )
    )
  )
);

-- ---------------------------------------------------------------------------
-- Pricing/cost tables: authenticated read, admin/moderator write.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can read panel masters" ON public.panel_masters;
DROP POLICY IF EXISTS "Anyone can read panel sizes" ON public.panel_sizes;
DROP POLICY IF EXISTS "Anyone can read color mixing costs" ON public.color_mixing_costs;
DROP POLICY IF EXISTS "Anyone can read adhesive costs" ON public.adhesive_costs;
DROP POLICY IF EXISTS "Anyone can read processing options" ON public.processing_options;
DROP POLICY IF EXISTS "Anyone can read color options" ON public.color_options;
DROP POLICY IF EXISTS "Anyone can read advanced processing settings" ON public.advanced_processing_settings;
DROP POLICY IF EXISTS "Anyone can read processing categories" ON public.processing_categories;
DROP POLICY IF EXISTS "Anyone can read slot types" ON public.slot_types;
DROP POLICY IF EXISTS "Anyone can read category logic slots" ON public.category_logic_slots;
DROP POLICY IF EXISTS "Anyone can read panel option surcharges" ON public.panel_option_surcharges;

DROP POLICY IF EXISTS "Authenticated users can manage panel masters" ON public.panel_masters;
DROP POLICY IF EXISTS "Authenticated users can manage panel sizes" ON public.panel_sizes;
DROP POLICY IF EXISTS "Authenticated users can manage processing options" ON public.processing_options;
DROP POLICY IF EXISTS "Authenticated users can manage processing categories" ON public.processing_categories;
DROP POLICY IF EXISTS "Authenticated users can manage slot types" ON public.slot_types;
DROP POLICY IF EXISTS "Authenticated users can manage category logic slots" ON public.category_logic_slots;
DROP POLICY IF EXISTS "Authenticated users can manage color options" ON public.color_options;
DROP POLICY IF EXISTS "Authenticated users can manage color mixing costs" ON public.color_mixing_costs;
DROP POLICY IF EXISTS "Authenticated users can manage adhesive costs" ON public.adhesive_costs;
DROP POLICY IF EXISTS "Authenticated users can manage advanced processing settings" ON public.advanced_processing_settings;
DROP POLICY IF EXISTS "Authenticated users can manage pricing versions" ON public.panel_pricing_versions;
DROP POLICY IF EXISTS "Authenticated users can manage panel option surcharges" ON public.panel_option_surcharges;

DROP POLICY IF EXISTS "Authenticated users can view panel masters" ON public.panel_masters;
DROP POLICY IF EXISTS "Authenticated users can view panel sizes" ON public.panel_sizes;
DROP POLICY IF EXISTS "Authenticated users can view color mixing costs" ON public.color_mixing_costs;
DROP POLICY IF EXISTS "Authenticated users can view adhesive costs" ON public.adhesive_costs;
DROP POLICY IF EXISTS "Authenticated users can view processing options" ON public.processing_options;
DROP POLICY IF EXISTS "Authenticated users can view processing categories" ON public.processing_categories;
DROP POLICY IF EXISTS "Authenticated users can view slot types" ON public.slot_types;
DROP POLICY IF EXISTS "Authenticated users can view category logic slots" ON public.category_logic_slots;
DROP POLICY IF EXISTS "Authenticated users can view color options" ON public.color_options;
DROP POLICY IF EXISTS "Authenticated users can view advanced processing settings" ON public.advanced_processing_settings;
DROP POLICY IF EXISTS "Authenticated users can view panel option surcharges" ON public.panel_option_surcharges;

CREATE POLICY "Authenticated users can view panel masters"
ON public.panel_masters FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can view panel sizes"
ON public.panel_sizes FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can view color mixing costs"
ON public.color_mixing_costs FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can view adhesive costs"
ON public.adhesive_costs FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can view processing options"
ON public.processing_options FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can view processing categories"
ON public.processing_categories FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can view slot types"
ON public.slot_types FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can view category logic slots"
ON public.category_logic_slots FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can view color options"
ON public.color_options FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can view advanced processing settings"
ON public.advanced_processing_settings FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can view panel option surcharges"
ON public.panel_option_surcharges FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- Storage policy cleanup.
-- ---------------------------------------------------------------------------

UPDATE storage.buckets
SET public = false
WHERE id IN ('avatars', 'quote-pdfs', 'quote-attachments', 'internal-project-docs', 'portfolio-thumbnails');

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read avatars" ON storage.objects;

CREATE POLICY "Authenticated users can read avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can upload internal docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view internal docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete internal docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own internal project docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own internal project docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own internal project docs" ON storage.objects;

CREATE POLICY "Users can upload own internal project docs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'internal-project-docs'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  )
);

CREATE POLICY "Users can view own internal project docs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'internal-project-docs'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  )
);

CREATE POLICY "Users can delete own internal project docs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'internal-project-docs'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  )
);

-- ---------------------------------------------------------------------------
-- Realtime private channel authorization.
-- Supabase private channels use realtime.messages RLS by topic.
-- ---------------------------------------------------------------------------

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'realtime'
      AND tablename = 'messages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON realtime.messages', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Authenticated users can receive app realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() IN (
    'employee-status',
    'team-chat',
    'user-notifications',
    'dm-list-refresh',
    'panel-sizes-changes',
    'meeting-requests-popup',
    'home-channel-talk-inquiries'
  )
  OR realtime.topic() LIKE 'dm-%'
  OR realtime.topic() LIKE 'project-updates-%'
);

CREATE POLICY "Authenticated users can send app realtime topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() IN (
    'employee-status',
    'team-chat',
    'user-notifications',
    'dm-list-refresh',
    'panel-sizes-changes',
    'meeting-requests-popup',
    'home-channel-talk-inquiries'
  )
  OR realtime.topic() LIKE 'dm-%'
  OR realtime.topic() LIKE 'project-updates-%'
);

COMMENT ON VIEW public.profile_directory IS 'Safe employee directory for UI; excludes email, phone, address, bank, salary, resident number, and other PII.';
COMMENT ON VIEW public.checked_in_employee_status IS 'Current checked-in employees without GPS/location payloads.';
COMMENT ON VIEW public.company_public_info IS 'Company display information without bank account or workplace GPS coordinates.';
COMMENT ON VIEW public.company_quote_defaults IS 'Quote-facing company display/default text, separated from workplace GPS settings.';
COMMENT ON FUNCTION public.check_workplace_distance(double precision, double precision) IS 'Checks attendance location distance without exposing stored workplace coordinates to the client.';
