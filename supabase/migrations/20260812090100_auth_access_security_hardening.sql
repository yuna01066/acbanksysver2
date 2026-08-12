-- Harden approval, page-policy, and company-master authorization boundaries.

CREATE OR REPLACE FUNCTION public.normalize_access_key(_key text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  normalized text;
BEGIN
  IF _key IS NULL THEN
    RETURN NULL;
  END IF;

  normalized := lower(btrim(_key));
  IF left(normalized, 1) <> '/' THEN
    RETURN normalized;
  END IF;

  normalized := split_part(split_part(normalized, '?', 1), '#', 1);
  normalized := regexp_replace(normalized, '/+', '/', 'g');
  IF length(normalized) > 1 THEN
    normalized := rtrim(normalized, '/');
  END IF;

  RETURN COALESCE(NULLIF(normalized, ''), '/');
END;
$$;

-- Remove case/slash-equivalent duplicates before normalizing the unique keys.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY public.normalize_access_key(page_key)
      ORDER BY
        CASE min_role
          WHEN 'admin' THEN 1
          WHEN 'moderator' THEN 2
          WHEN 'manager' THEN 3
          WHEN 'employee' THEN 4
          ELSE 5
        END,
        updated_at DESC,
        id
    ) AS row_rank
  FROM public.page_role_access
)
DELETE FROM public.page_role_access target
USING ranked
WHERE target.id = ranked.id
  AND ranked.row_rank > 1;

UPDATE public.page_role_access
SET page_key = public.normalize_access_key(page_key)
WHERE page_key IS DISTINCT FROM public.normalize_access_key(page_key);

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, public.normalize_access_key(page_key)
      ORDER BY
        CASE effect WHEN 'deny' THEN 1 ELSE 2 END,
        updated_at DESC,
        id
    ) AS row_rank
  FROM public.page_access_permissions
)
DELETE FROM public.page_access_permissions target
USING ranked
WHERE target.id = ranked.id
  AND ranked.row_rank > 1;

UPDATE public.page_access_permissions
SET page_key = public.normalize_access_key(page_key)
WHERE page_key IS DISTINCT FROM public.normalize_access_key(page_key);

CREATE OR REPLACE FUNCTION public.normalize_access_key_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.page_key := public.normalize_access_key(NEW.page_key);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_page_role_access_key ON public.page_role_access;
CREATE TRIGGER normalize_page_role_access_key
BEFORE INSERT OR UPDATE OF page_key ON public.page_role_access
FOR EACH ROW EXECUTE FUNCTION public.normalize_access_key_before_write();

DROP TRIGGER IF EXISTS normalize_page_access_permission_key ON public.page_access_permissions;
CREATE TRIGGER normalize_page_access_permission_key
BEFORE INSERT OR UPDATE OF page_key ON public.page_access_permissions
FOR EACH ROW EXECUTE FUNCTION public.normalize_access_key_before_write();

-- Explicit defaults for every route currently protected by PageAccessGuard.
-- Unknown guarded routes remain denied instead of inheriting an implicit allow.
INSERT INTO public.page_role_access (page_key, min_role)
VALUES
  ('/attendance', 'employee'),
  ('/branding-intakes', 'employee'),
  ('/calendar', 'employee'),
  ('/channel-talk-leads', 'employee'),
  ('/customer-quotes-summary', 'employee'),
  ('/exhibition-management', 'employee'),
  ('/leave-management', 'employee'),
  ('/material-orders', 'employee'),
  ('/meeting-reservations', 'manager'),
  ('/panel-size-comparison', 'employee'),
  ('/performance-review', 'employee'),
  ('/portfolio', 'employee'),
  ('/project-management', 'employee'),
  ('/quote-drafts', 'employee'),
  ('/quote-calculation-settings', 'admin'),
  ('/quotes-summary', 'employee'),
  ('/recipients', 'employee'),
  ('/references', 'employee'),
  ('/review-hub', 'employee'),
  ('/saved-quotes', 'employee'),
  ('/space-quote', 'employee'),
  ('/space-quotes', 'employee'),
  ('/team-chat', 'employee')
ON CONFLICT (page_key) DO NOTHING;

-- The quote wizard executes privileged AI/file processing and must not inherit
-- a weaker value from an incomplete or manually edited deployment.
INSERT INTO public.page_role_access (page_key, min_role)
VALUES ('/quote-wizard', 'admin')
ON CONFLICT (page_key) DO UPDATE
SET min_role = EXCLUDED.min_role,
    updated_at = now();

-- Master authorization is pinned once to an auth user id. Profile fields are
-- display data and must never become an authorization credential.
CREATE TABLE IF NOT EXISTS public.company_master_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_master_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_master_users FROM anon, authenticated;
GRANT ALL ON public.company_master_users TO service_role;

INSERT INTO public.company_master_users (user_id)
SELECT user_row.id
FROM auth.users user_row
WHERE lower(user_row.email) = 'acbank@acbank.co.kr'
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_company_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_master_users master_user
    JOIN public.profiles profile ON profile.id = master_user.user_id
    WHERE master_user.user_id = auth.uid()
      AND profile.is_approved IS TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.prevent_moderator_profile_email_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
    AND NEW.email IS DISTINCT FROM OLD.email
    AND public.has_role(auth.uid(), 'moderator'::public.app_role)
    AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
  THEN
    RAISE EXCEPTION 'Permission denied: moderators cannot change profile identity email';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_moderator_profile_email_update ON public.profiles;
CREATE TRIGGER prevent_moderator_profile_email_update
BEFORE UPDATE OF email ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_moderator_profile_email_update();

CREATE OR REPLACE FUNCTION public.can_access_feature(_feature_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_key text := public.normalize_access_key(_feature_key);
  minimum_role text;
  user_rank integer;
  minimum_rank integer;
  user_effect text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_approved_user() THEN
    RETURN FALSE;
  END IF;

  SELECT permission.effect INTO user_effect
  FROM public.page_access_permissions permission
  WHERE permission.page_key = normalized_key
    AND permission.user_id = auth.uid()
  LIMIT 1;

  IF user_effect = 'deny' THEN
    RETURN FALSE;
  ELSIF user_effect = 'allow' THEN
    RETURN TRUE;
  END IF;

  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    user_rank := 1;
  ELSIF public.has_role(auth.uid(), 'moderator'::public.app_role) THEN
    user_rank := 2;
  ELSIF public.has_role(auth.uid(), 'manager'::public.app_role) THEN
    user_rank := 3;
  ELSIF public.has_role(auth.uid(), 'employee'::public.app_role)
    OR public.has_role(auth.uid(), 'user'::public.app_role)
  THEN
    user_rank := 4;
  ELSE
    RETURN FALSE;
  END IF;

  SELECT role_access.min_role INTO minimum_role
  FROM public.page_role_access role_access
  WHERE role_access.page_key = normalized_key
  LIMIT 1;

  IF minimum_role IS NULL THEN
    RETURN FALSE;
  END IF;

  minimum_rank := CASE minimum_role
    WHEN 'admin' THEN 1
    WHEN 'moderator' THEN 2
    WHEN 'manager' THEN 3
    WHEN 'employee' THEN 4
    ELSE NULL
  END;

  RETURN minimum_rank IS NOT NULL AND user_rank <= minimum_rank;
END;
$$;

NOTIFY pgrst, 'reload schema';
