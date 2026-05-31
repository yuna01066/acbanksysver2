CREATE OR REPLACE FUNCTION public.get_assistant_allowed_shortcut_ids(_user_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  common_shortcuts text[] := ARRAY[
    'tool-response-assistant',
    'tool-quote-wizard',
    'tool-meeting-booking',
    'route-calendar',
    'route-yield-calculator',
    'route-attendance',
    'route-my-page',
    'route-saved-quotes',
    'route-projects',
    'external-notion'
  ];
  admin_shortcuts text[] := ARRAY[
    'route-review-hub',
    'route-channel-talk',
    'route-admin-settings'
  ];
BEGIN
  IF _user_id IS NULL THEN
    RETURN ARRAY[]::text[];
  END IF;

  IF public.has_role(_user_id, 'admin'::public.app_role)
     OR public.has_role(_user_id, 'moderator'::public.app_role) THEN
    RETURN common_shortcuts || admin_shortcuts;
  END IF;

  RETURN common_shortcuts;
END;
$$;

CREATE OR REPLACE FUNCTION public.assistant_shortcut_ids_allowed(_ids text[])
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  allowed_ids text[] := public.get_assistant_allowed_shortcut_ids(auth.uid());
  total_count integer := COALESCE(cardinality(_ids), 0);
  distinct_count integer := 0;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF total_count < 1 OR total_count > 8 THEN
    RETURN false;
  END IF;

  SELECT COUNT(DISTINCT shortcut_id)
  INTO distinct_count
  FROM unnest(_ids) AS shortcut(shortcut_id);

  IF distinct_count <> total_count THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM unnest(_ids) AS shortcut(shortcut_id)
    WHERE shortcut_id IS NULL
       OR NOT shortcut_id = ANY(allowed_ids)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_assistant_shortcuts(shortcut_ids text[])
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  allowed_ids text[] := public.get_assistant_allowed_shortcut_ids(auth.uid());
  sanitized_ids text[];
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '28000';
  END IF;

  SELECT COALESCE(array_agg(shortcut_id ORDER BY first_position), ARRAY[]::text[])
  INTO sanitized_ids
  FROM (
    SELECT shortcut_id, MIN(ordinality) AS first_position
    FROM unnest(COALESCE(shortcut_ids, ARRAY[]::text[])) WITH ORDINALITY AS shortcut(shortcut_id, ordinality)
    WHERE shortcut_id = ANY(allowed_ids)
    GROUP BY shortcut_id
  ) AS ordered_shortcuts;

  sanitized_ids := sanitized_ids[1:8];

  IF COALESCE(cardinality(sanitized_ids), 0) < 1 THEN
    RAISE EXCEPTION 'At least one assistant shortcut is required'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.assistant_user_preferences (user_id, shortcut_ids)
  VALUES (current_user_id, sanitized_ids)
  ON CONFLICT (user_id)
  DO UPDATE SET
    shortcut_ids = EXCLUDED.shortcut_ids,
    updated_at = now();

  RETURN sanitized_ids;
END;
$$;

DROP POLICY IF EXISTS "Users can create own assistant preferences" ON public.assistant_user_preferences;
CREATE POLICY "Users can create own assistant preferences"
ON public.assistant_user_preferences
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.assistant_shortcut_ids_allowed(shortcut_ids)
);

DROP POLICY IF EXISTS "Users can update own assistant preferences" ON public.assistant_user_preferences;
CREATE POLICY "Users can update own assistant preferences"
ON public.assistant_user_preferences
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND public.assistant_shortcut_ids_allowed(shortcut_ids)
);

GRANT EXECUTE ON FUNCTION public.get_assistant_allowed_shortcut_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_shortcut_ids_allowed(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_assistant_shortcuts(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_assistant_allowed_shortcut_ids(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.assistant_shortcut_ids_allowed(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_assistant_shortcuts(text[]) TO service_role;
