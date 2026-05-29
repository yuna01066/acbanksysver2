CREATE TABLE IF NOT EXISTS public.assistant_user_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  shortcut_ids text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assistant_user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own assistant preferences" ON public.assistant_user_preferences;
CREATE POLICY "Users can view own assistant preferences"
ON public.assistant_user_preferences
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own assistant preferences" ON public.assistant_user_preferences;
CREATE POLICY "Users can create own assistant preferences"
ON public.assistant_user_preferences
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own assistant preferences" ON public.assistant_user_preferences;
CREATE POLICY "Users can update own assistant preferences"
ON public.assistant_user_preferences
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own assistant preferences" ON public.assistant_user_preferences;
CREATE POLICY "Users can delete own assistant preferences"
ON public.assistant_user_preferences
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_assistant_user_preferences_updated_at ON public.assistant_user_preferences;
CREATE TRIGGER update_assistant_user_preferences_updated_at
BEFORE UPDATE ON public.assistant_user_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_user_preferences TO authenticated;
GRANT ALL ON public.assistant_user_preferences TO service_role;
