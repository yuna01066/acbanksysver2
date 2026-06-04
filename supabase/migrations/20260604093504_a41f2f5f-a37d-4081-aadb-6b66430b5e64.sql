DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
  ) THEN
    EXECUTE 'CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $fn$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $fn$;';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.calendar_user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_view text NOT NULL DEFAULT 'month' CHECK (default_view IN ('month', 'week', 'day')),
  visible_calendar_keys text[] NOT NULL DEFAULT ARRAY['mine', 'company']::text[],
  source_filters text[] NOT NULL DEFAULT ARRAY['quote', 'project', 'meeting', 'people', 'room']::text[],
  calendar_colors jsonb NOT NULL DEFAULT '{}'::jsonb,
  week_starts_on integer NOT NULL DEFAULT 0 CHECK (week_starts_on BETWEEN 0 AND 6),
  workday_start text NOT NULL DEFAULT '09:00',
  workday_end text NOT NULL DEFAULT '18:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calendar_diary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  diary_date date NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, diary_date)
);

CREATE TABLE IF NOT EXISTS public.calendar_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#2563eb',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calendar_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.calendar_teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_diary_entries_owner_date ON public.calendar_diary_entries(owner_id, diary_date);
CREATE INDEX IF NOT EXISTS idx_calendar_teams_active_name ON public.calendar_teams(is_active, name);
CREATE INDEX IF NOT EXISTS idx_calendar_team_members_user ON public.calendar_team_members(user_id, team_id);

ALTER TABLE public.calendar_user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_diary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own calendar settings" ON public.calendar_user_settings;
CREATE POLICY "Users can manage own calendar settings" ON public.calendar_user_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own diary entries" ON public.calendar_diary_entries;
CREATE POLICY "Users can manage own diary entries" ON public.calendar_diary_entries FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Authenticated users can view active calendar teams" ON public.calendar_teams;
CREATE POLICY "Authenticated users can view active calendar teams" ON public.calendar_teams FOR SELECT USING (auth.role() = 'authenticated' AND is_active IS TRUE);

DROP POLICY IF EXISTS "Admins can manage calendar teams" ON public.calendar_teams;
CREATE POLICY "Admins can manage calendar teams" ON public.calendar_teams FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));

DROP POLICY IF EXISTS "Authenticated users can view calendar team members" ON public.calendar_team_members;
CREATE POLICY "Authenticated users can view calendar team members" ON public.calendar_team_members FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage calendar team members" ON public.calendar_team_members;
CREATE POLICY "Admins can manage calendar team members" ON public.calendar_team_members FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'moderator'::public.app_role));

DROP TRIGGER IF EXISTS update_calendar_user_settings_updated_at ON public.calendar_user_settings;
CREATE TRIGGER update_calendar_user_settings_updated_at BEFORE UPDATE ON public.calendar_user_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_calendar_diary_entries_updated_at ON public.calendar_diary_entries;
CREATE TRIGGER update_calendar_diary_entries_updated_at BEFORE UPDATE ON public.calendar_diary_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_calendar_teams_updated_at ON public.calendar_teams;
CREATE TRIGGER update_calendar_teams_updated_at BEFORE UPDATE ON public.calendar_teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_user_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_diary_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_team_members TO authenticated;
GRANT ALL ON public.calendar_user_settings, public.calendar_diary_entries, public.calendar_teams, public.calendar_team_members TO service_role;

NOTIFY pgrst, 'reload schema';