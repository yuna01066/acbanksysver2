-- Remaining security hardening after Lovable scanner follow-up.
-- This migration is intentionally idempotent because Lovable Cloud may already
-- contain part of the prior hardening state.

-- ---------------------------------------------------------------------------
-- Employee contracts: employees must not update contract records directly.
-- Signing/rejection/open/download events go through the contract-actions Edge
-- Function, which validates identity, storage evidence, and audit logging.
-- ---------------------------------------------------------------------------

ALTER TABLE public.employment_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update their own contracts" ON public.employment_contracts;
DROP POLICY IF EXISTS "Employees can update their own contracts" ON public.employment_contracts;
DROP POLICY IF EXISTS "Users can modify their own contracts" ON public.employment_contracts;
DROP POLICY IF EXISTS "Employees can modify their own contracts" ON public.employment_contracts;

-- Keep direct employee read-only access to their own contracts.
DROP POLICY IF EXISTS "Users can view their own contracts" ON public.employment_contracts;
CREATE POLICY "Users can view their own contracts"
ON public.employment_contracts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Notifications: remove any broad insert policy that lets an employee create
-- notifications for arbitrary users. Self-insert remains for existing UI-local
-- reminder flows; admin/moderator flows may still insert for others.
-- ---------------------------------------------------------------------------

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert any notification" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins and moderators can insert notifications" ON public.notifications;

CREATE POLICY "Users can insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins and moderators can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'moderator'::app_role)
);

-- ---------------------------------------------------------------------------
-- Profiles: keep sensitive profile rows available only to the employee themself
-- and admins. Staff directory reads should use public.profile_directory.
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read basic profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view approved profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Moderators can view all profiles" ON public.profiles;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- Dependents: resident registration numbers are high sensitivity. Keep user
-- self-service and admin access; remove moderator-wide access.
-- ---------------------------------------------------------------------------

ALTER TABLE public.tax_dependents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Moderators can manage all dependents" ON public.tax_dependents;

-- ---------------------------------------------------------------------------
-- Realtime private channels: require per-user topics for notifications and
-- direct messages. Server-side postgres_changes filters are also applied in
-- the client for direct_messages.
-- ---------------------------------------------------------------------------

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can receive app realtime topics" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send app realtime topics" ON realtime.messages;

CREATE POLICY "Authenticated users can receive app realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() IN (
    'employee-status',
    'team-chat',
    'panel-sizes-changes',
    'meeting-requests-popup',
    'home-channel-talk-inquiries'
  )
  OR (
    realtime.topic() = 'user-notifications-' || auth.uid()::text
  )
  OR (
    realtime.topic() = 'direct-messages-' || auth.uid()::text
    OR realtime.topic() = 'direct-message-list-' || auth.uid()::text
  )
  OR (
    CASE WHEN realtime.topic() ~ '^project-updates-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'moderator'::app_role)
      OR public.is_project_owner(replace(realtime.topic(), 'project-updates-', '')::uuid, auth.uid())
      OR public.is_project_assigned(replace(realtime.topic(), 'project-updates-', '')::uuid, auth.uid())
    ELSE false END
  )
);

CREATE POLICY "Authenticated users can send app realtime topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() IN (
    'employee-status',
    'team-chat',
    'panel-sizes-changes',
    'meeting-requests-popup',
    'home-channel-talk-inquiries'
  )
  OR (
    realtime.topic() = 'user-notifications-' || auth.uid()::text
  )
  OR (
    realtime.topic() = 'direct-messages-' || auth.uid()::text
    OR realtime.topic() = 'direct-message-list-' || auth.uid()::text
  )
  OR (
    CASE WHEN realtime.topic() ~ '^project-updates-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'moderator'::app_role)
      OR public.is_project_owner(replace(realtime.topic(), 'project-updates-', '')::uuid, auth.uid())
      OR public.is_project_assigned(replace(realtime.topic(), 'project-updates-', '')::uuid, auth.uid())
    ELSE false END
  )
);

-- ---------------------------------------------------------------------------
-- Storage scanner clarity: keep quote/recipient buckets private and explicitly
-- grant admin/moderator read policies in the final migration state.
-- ---------------------------------------------------------------------------

UPDATE storage.buckets
SET public = false
WHERE id IN ('quote-pdfs', 'quote-attachments', 'recipient-documents', 'employee-contracts');

DROP POLICY IF EXISTS "Admins can read all quote PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Moderators can read all quote PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all recipient documents" ON storage.objects;
DROP POLICY IF EXISTS "Moderators can read all recipient documents" ON storage.objects;

CREATE POLICY "Admins can read all quote PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'quote-pdfs' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can read all quote PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'quote-pdfs' AND public.has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins can read all recipient documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'recipient-documents' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can read all recipient documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'recipient-documents' AND public.has_role(auth.uid(), 'moderator'::app_role));

NOTIFY pgrst, 'reload schema';
