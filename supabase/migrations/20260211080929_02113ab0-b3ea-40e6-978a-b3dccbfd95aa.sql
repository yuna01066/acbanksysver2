
-- 원판 발주 관리 테이블
CREATE TABLE public.material_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  material TEXT NOT NULL,
  quality TEXT NOT NULL,
  thickness TEXT NOT NULL,
  size_name TEXT NOT NULL,
  width NUMERIC NOT NULL DEFAULT 0,
  height NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  quote_item_summary TEXT,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'ordered',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.material_orders ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can manage all material orders"
ON public.material_orders FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Moderator full access
CREATE POLICY "Moderators can manage all material orders"
ON public.material_orders FOR ALL
USING (has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

-- Project assignees can view
CREATE POLICY "Project assignees can view material orders"
ON public.material_orders FOR SELECT
USING (
  project_id IS NOT NULL AND is_project_assigned(project_id, auth.uid())
);

-- Project owners can view
CREATE POLICY "Project owners can view material orders"
ON public.material_orders FOR SELECT
USING (
  project_id IS NOT NULL AND is_project_owner(project_id, auth.uid())
);

-- Users can manage their own orders
CREATE POLICY "Users can manage their own material orders"
ON public.material_orders FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Updated at trigger
CREATE TRIGGER update_material_orders_updated_at
BEFORE UPDATE ON public.material_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.material_orders;
