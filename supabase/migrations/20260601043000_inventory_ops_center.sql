-- Inventory and Imweb order operations center

CREATE TABLE IF NOT EXISTS public.imweb_order_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imweb_order_id uuid REFERENCES public.imweb_orders(id) ON DELETE CASCADE,
  imweb_order_no text NOT NULL UNIQUE,
  recipient_id uuid REFERENCES public.recipients(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.saved_quotes(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  link_status text NOT NULL DEFAULT 'unlinked' CHECK (
    link_status IN ('unlinked', 'linked_recipient', 'quote_created', 'project_created', 'archived')
  ),
  due_date date,
  memo text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imweb_order_links_assigned_to
  ON public.imweb_order_links (assigned_to)
  WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_imweb_order_links_recipient_id
  ON public.imweb_order_links (recipient_id)
  WHERE recipient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_imweb_order_links_project_id
  ON public.imweb_order_links (project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_imweb_order_links_status
  ON public.imweb_order_links (link_status);

CREATE TABLE IF NOT EXISTS public.imweb_product_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imweb_product_id uuid REFERENCES public.imweb_products(id) ON DELETE CASCADE,
  imweb_prod_no text NOT NULL UNIQUE,
  inventory_source_type text NOT NULL DEFAULT 'external_only' CHECK (
    inventory_source_type IN ('sample_chip', 'material_order', 'panel_catalog', 'external_only')
  ),
  sample_chip_inventory_id uuid REFERENCES public.sample_chip_inventory(id) ON DELETE SET NULL,
  material_order_id uuid REFERENCES public.material_orders(id) ON DELETE SET NULL,
  panel_size_id uuid REFERENCES public.panel_sizes(id) ON DELETE SET NULL,
  external_label text,
  min_stock_qty integer NOT NULL DEFAULT 0 CHECK (min_stock_qty >= 0),
  reorder_qty integer NOT NULL DEFAULT 0 CHECK (reorder_qty >= 0),
  auto_stock_sync boolean NOT NULL DEFAULT false,
  memo text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT imweb_product_mappings_source_consistency CHECK (
    (inventory_source_type = 'sample_chip' AND sample_chip_inventory_id IS NOT NULL)
    OR (inventory_source_type = 'material_order' AND material_order_id IS NOT NULL)
    OR (inventory_source_type = 'panel_catalog' AND panel_size_id IS NOT NULL)
    OR (inventory_source_type = 'external_only')
  )
);

CREATE INDEX IF NOT EXISTS idx_imweb_product_mappings_source
  ON public.imweb_product_mappings (inventory_source_type);

CREATE INDEX IF NOT EXISTS idx_imweb_product_mappings_sample_chip
  ON public.imweb_product_mappings (sample_chip_inventory_id)
  WHERE sample_chip_inventory_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.inventory_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  imweb_order_no text,
  imweb_prod_no text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_action_logs_created_at
  ON public.inventory_action_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_action_logs_actor_id
  ON public.inventory_action_logs (actor_id)
  WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_action_logs_order_no
  ON public.inventory_action_logs (imweb_order_no)
  WHERE imweb_order_no IS NOT NULL;

DROP TRIGGER IF EXISTS update_imweb_order_links_updated_at ON public.imweb_order_links;
CREATE TRIGGER update_imweb_order_links_updated_at
  BEFORE UPDATE ON public.imweb_order_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_imweb_product_mappings_updated_at ON public.imweb_product_mappings;
CREATE TRIGGER update_imweb_product_mappings_updated_at
  BEFORE UPDATE ON public.imweb_product_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.imweb_order_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imweb_product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_action_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and moderators can manage imweb order links" ON public.imweb_order_links;
CREATE POLICY "Admins and moderators can manage imweb order links"
ON public.imweb_order_links FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

DROP POLICY IF EXISTS "Assigned users can view imweb order links" ON public.imweb_order_links;
CREATE POLICY "Assigned users can view imweb order links"
ON public.imweb_order_links FOR SELECT TO authenticated
USING (assigned_to = auth.uid());

DROP POLICY IF EXISTS "Admins and moderators can manage imweb product mappings" ON public.imweb_product_mappings;
CREATE POLICY "Admins and moderators can manage imweb product mappings"
ON public.imweb_product_mappings FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

DROP POLICY IF EXISTS "Admins and moderators can view inventory action logs" ON public.inventory_action_logs;
CREATE POLICY "Admins and moderators can view inventory action logs"
ON public.inventory_action_logs FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);

DROP POLICY IF EXISTS "Users can view own inventory action logs" ON public.inventory_action_logs;
CREATE POLICY "Users can view own inventory action logs"
ON public.inventory_action_logs FOR SELECT TO authenticated
USING (actor_id = auth.uid());

DROP POLICY IF EXISTS "Admins and moderators can insert inventory action logs" ON public.inventory_action_logs;
CREATE POLICY "Admins and moderators can insert inventory action logs"
ON public.inventory_action_logs FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'moderator'::public.app_role)
);
