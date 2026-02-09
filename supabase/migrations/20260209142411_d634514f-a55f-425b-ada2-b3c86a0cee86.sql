
-- Create incident_reports table
CREATE TABLE public.incident_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  title TEXT NOT NULL,
  incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  cause_analysis TEXT,
  prevention_measures TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  requested_by UUID,
  requested_by_name TEXT,
  requested_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  review_comment TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  cycle_id UUID REFERENCES public.performance_review_cycles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

-- Users can view their own reports
CREATE POLICY "Users can view their own incident reports"
ON public.incident_reports FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own reports
CREATE POLICY "Users can create their own incident reports"
ON public.incident_reports FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own draft/requested reports
CREATE POLICY "Users can update their own incident reports"
ON public.incident_reports FOR UPDATE
USING (auth.uid() = user_id AND status IN ('draft', 'requested'));

-- Users can delete their own draft reports
CREATE POLICY "Users can delete their own draft incident reports"
ON public.incident_reports FOR DELETE
USING (auth.uid() = user_id AND status = 'draft');

-- Admins full access
CREATE POLICY "Admins can manage all incident reports"
ON public.incident_reports FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Moderators full access
CREATE POLICY "Moderators can manage all incident reports"
ON public.incident_reports FOR ALL
USING (has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_incident_reports_updated_at
BEFORE UPDATE ON public.incident_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for incident report attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('incident-attachments', 'incident-attachments', false);

-- Storage policies
CREATE POLICY "Users can upload their own incident attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'incident-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own incident attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'incident-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own incident attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'incident-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all incident attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'incident-attachments' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can view all incident attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'incident-attachments' AND has_role(auth.uid(), 'moderator'::app_role));
