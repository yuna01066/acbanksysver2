CREATE TABLE IF NOT EXISTS public.quote_wizard_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'uploaded', 'queued', 'analyzing', 'completed', 'failed', 'expired')),
  source text NOT NULL DEFAULT 'internal_app'
    CHECK (source IN ('internal_app', 'widget', 'worker')),
  review_status text NOT NULL DEFAULT 'needs_review'
    CHECK (review_status IN ('calculable', 'needs_review', 'blocked', 'converted')),
  customer_note text,
  result_id uuid,
  converted_draft_id uuid REFERENCES public.quote_drafts(id) ON DELETE SET NULL,
  error_message text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quote_wizard_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.quote_wizard_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  file_size bigint,
  kind text NOT NULL DEFAULT 'unknown'
    CHECK (kind IN ('pdf', 'image', 'dxf', 'dwg', 'source', 'unknown')),
  source text NOT NULL DEFAULT 'upload',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quote_wizard_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL UNIQUE REFERENCES public.quote_wizard_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'worker',
  analysis_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  yield_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  formula_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'needs_review'
    CHECK (status IN ('calculable', 'needs_review', 'blocked')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.quote_wizard_jobs
    ADD CONSTRAINT quote_wizard_jobs_result_id_fkey
    FOREIGN KEY (result_id) REFERENCES public.quote_wizard_results(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.quote_wizard_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_wizard_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_wizard_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own quote wizard jobs" ON public.quote_wizard_jobs;
CREATE POLICY "Users can view own quote wizard jobs" ON public.quote_wizard_jobs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own quote wizard jobs" ON public.quote_wizard_jobs;
CREATE POLICY "Users can create own quote wizard jobs" ON public.quote_wizard_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own quote wizard jobs" ON public.quote_wizard_jobs;
CREATE POLICY "Users can update own quote wizard jobs" ON public.quote_wizard_jobs FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own quote wizard files" ON public.quote_wizard_files;
CREATE POLICY "Users can view own quote wizard files" ON public.quote_wizard_files FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own quote wizard files" ON public.quote_wizard_files;
CREATE POLICY "Users can create own quote wizard files" ON public.quote_wizard_files FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own quote wizard results" ON public.quote_wizard_results;
CREATE POLICY "Users can view own quote wizard results" ON public.quote_wizard_results FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own quote wizard results" ON public.quote_wizard_results;
CREATE POLICY "Users can create own quote wizard results" ON public.quote_wizard_results FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own quote wizard results" ON public.quote_wizard_results;
CREATE POLICY "Users can update own quote wizard results" ON public.quote_wizard_results FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage quote wizard jobs" ON public.quote_wizard_jobs;
CREATE POLICY "Admins can manage quote wizard jobs" ON public.quote_wizard_jobs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can manage quote wizard files" ON public.quote_wizard_files;
CREATE POLICY "Admins can manage quote wizard files" ON public.quote_wizard_files FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can manage quote wizard results" ON public.quote_wizard_results;
CREATE POLICY "Admins can manage quote wizard results" ON public.quote_wizard_results FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_quote_wizard_jobs_updated_at ON public.quote_wizard_jobs;
CREATE TRIGGER update_quote_wizard_jobs_updated_at BEFORE UPDATE ON public.quote_wizard_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_quote_wizard_results_updated_at ON public.quote_wizard_results;
CREATE TRIGGER update_quote_wizard_results_updated_at BEFORE UPDATE ON public.quote_wizard_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_quote_wizard_jobs_user_status ON public.quote_wizard_jobs(user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_wizard_jobs_expires_at ON public.quote_wizard_jobs(expires_at);
CREATE INDEX IF NOT EXISTS idx_quote_wizard_files_job_id ON public.quote_wizard_files(job_id);
CREATE INDEX IF NOT EXISTS idx_quote_wizard_files_expires_at ON public.quote_wizard_files(expires_at);
CREATE INDEX IF NOT EXISTS idx_quote_wizard_results_job_id ON public.quote_wizard_results(job_id);
CREATE INDEX IF NOT EXISTS idx_quote_wizard_results_expires_at ON public.quote_wizard_results(expires_at);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('quote-wizard-temp','quote-wizard-temp',false,52428800,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif','application/dxf','image/vnd.dxf','application/acad','application/x-acad','application/octet-stream'])
ON CONFLICT (id) DO UPDATE SET public=false, file_size_limit=EXCLUDED.file_size_limit, allowed_mime_types=EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users can upload own quote wizard temp files" ON storage.objects;
CREATE POLICY "Users can upload own quote wizard temp files" ON storage.objects FOR INSERT WITH CHECK (bucket_id='quote-wizard-temp' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users can read own quote wizard temp files" ON storage.objects;
CREATE POLICY "Users can read own quote wizard temp files" ON storage.objects FOR SELECT USING (bucket_id='quote-wizard-temp' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users can delete own quote wizard temp files" ON storage.objects;
CREATE POLICY "Users can delete own quote wizard temp files" ON storage.objects FOR DELETE USING (bucket_id='quote-wizard-temp' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.cleanup_expired_quote_wizard_data()
RETURNS TABLE(deleted_jobs integer, deleted_storage_objects integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage
AS $$
BEGIN
  WITH expired_paths AS (
    SELECT DISTINCT file_path FROM public.quote_wizard_files file
    WHERE file.expires_at < now() OR EXISTS (
      SELECT 1 FROM public.quote_wizard_jobs job
      WHERE job.id = file.job_id AND (job.expires_at < now() OR job.status = 'expired'))),
  deleted_objects AS (
    DELETE FROM storage.objects object USING expired_paths path
    WHERE object.bucket_id='quote-wizard-temp' AND object.name = path.file_path
    RETURNING 1)
  SELECT count(*)::integer INTO deleted_storage_objects FROM deleted_objects;
  DELETE FROM public.quote_wizard_jobs WHERE expires_at < now() OR status='expired';
  GET DIAGNOSTICS deleted_jobs = ROW_COUNT;
  RETURN NEXT;
END; $$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_quote_wizard_rows()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE summary record;
BEGIN
  SELECT * INTO summary FROM public.cleanup_expired_quote_wizard_data();
  RETURN COALESCE(summary.deleted_jobs, 0);
END; $$;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $$
DECLARE existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id FROM cron.job WHERE jobname='cleanup-expired-quote-wizard-data' LIMIT 1;
  IF existing_job_id IS NOT NULL THEN PERFORM cron.unschedule(existing_job_id); END IF;
  PERFORM cron.schedule('cleanup-expired-quote-wizard-data','15 * * * *','select public.cleanup_expired_quote_wizard_data();');
END; $$;

INSERT INTO public.page_role_access (page_key, min_role)
VALUES ('/quote-wizard', 'admin')
ON CONFLICT (page_key) DO UPDATE SET min_role='admin', updated_at=now();