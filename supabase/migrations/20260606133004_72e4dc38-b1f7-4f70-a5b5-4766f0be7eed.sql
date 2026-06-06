DROP POLICY IF EXISTS "Authenticated users can receive app realtime topics" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send app realtime topics" ON realtime.messages;

CREATE POLICY "Authenticated users can receive app realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = ANY (ARRAY['employee-status'::text, 'panel-sizes-changes'::text, 'meeting-requests-popup'::text])
  OR (realtime.topic() = 'team-chat'::text AND public.is_approved_user())
  OR (realtime.topic() = 'home-channel-talk-inquiries'::text AND public.can_access_channel_talk_inbox(auth.uid()))
  OR realtime.topic() = ('user-notifications-'::text || (auth.uid())::text)
  OR realtime.topic() = ('direct-messages-'::text || (auth.uid())::text)
  OR realtime.topic() = ('direct-message-list-'::text || (auth.uid())::text)
  OR CASE
    WHEN realtime.topic() ~ '^project-updates-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text THEN (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
      OR public.is_project_owner((replace(realtime.topic(), 'project-updates-'::text, ''::text))::uuid, auth.uid())
      OR public.is_project_assigned((replace(realtime.topic(), 'project-updates-'::text, ''::text))::uuid, auth.uid())
    )
    ELSE false
  END
);

CREATE POLICY "Authenticated users can send app realtime topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() = ANY (ARRAY['employee-status'::text, 'panel-sizes-changes'::text, 'meeting-requests-popup'::text])
  OR (realtime.topic() = 'team-chat'::text AND public.is_approved_user())
  OR (realtime.topic() = 'home-channel-talk-inquiries'::text AND public.can_access_channel_talk_inbox(auth.uid()))
  OR realtime.topic() = ('user-notifications-'::text || (auth.uid())::text)
  OR realtime.topic() = ('direct-messages-'::text || (auth.uid())::text)
  OR realtime.topic() = ('direct-message-list-'::text || (auth.uid())::text)
  OR CASE
    WHEN realtime.topic() ~ '^project-updates-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text THEN (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'moderator'::public.app_role)
      OR public.is_project_owner((replace(realtime.topic(), 'project-updates-'::text, ''::text))::uuid, auth.uid())
      OR public.is_project_assigned((replace(realtime.topic(), 'project-updates-'::text, ''::text))::uuid, auth.uid())
    )
    ELSE false
  END
);