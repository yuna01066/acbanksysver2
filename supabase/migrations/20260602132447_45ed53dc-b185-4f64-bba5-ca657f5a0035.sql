-- 1. Enable RLS on channel_talk_conversations and add staff-scoped policies
ALTER TABLE public.channel_talk_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved staff can view channel talk conversations"
ON public.channel_talk_conversations
FOR SELECT
TO authenticated
USING (public.can_access_channel_talk_inbox((SELECT auth.uid())));

CREATE POLICY "Approved staff can update channel talk conversations"
ON public.channel_talk_conversations
FOR UPDATE
TO authenticated
USING (public.can_access_channel_talk_inbox((SELECT auth.uid())))
WITH CHECK (public.can_access_channel_talk_inbox((SELECT auth.uid())));

-- 2. Tighten portfolio_collections and portfolio_collection_items policies
DROP POLICY IF EXISTS "Authenticated users can manage portfolio collections" ON public.portfolio_collections;
DROP POLICY IF EXISTS "Authenticated users can manage portfolio collection items" ON public.portfolio_collection_items;

CREATE POLICY "Approved staff can manage portfolio collections"
ON public.portfolio_collections
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'moderator')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'employee')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'moderator')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'employee')
);

CREATE POLICY "Approved staff can manage portfolio collection items"
ON public.portfolio_collection_items
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'moderator')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'employee')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'moderator')
  OR public.has_role(auth.uid(), 'manager')
  OR public.has_role(auth.uid(), 'employee')
);