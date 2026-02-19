
-- 샘플칩 재고 테이블 (제품/색상별 현재 재고)
CREATE TABLE public.sample_chip_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  panel_master_id UUID REFERENCES public.panel_masters(id) ON DELETE CASCADE,
  color_name TEXT NOT NULL,
  color_code TEXT,
  stock_ea INTEGER NOT NULL DEFAULT 0,
  stock_set INTEGER NOT NULL DEFAULT 0,
  min_stock_ea INTEGER NOT NULL DEFAULT 0,
  min_stock_set INTEGER NOT NULL DEFAULT 0,
  memo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(panel_master_id, color_name)
);

-- 샘플칩 입출고 이력 테이블
CREATE TABLE public.sample_chip_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id UUID NOT NULL REFERENCES public.sample_chip_inventory(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('in', 'out')),
  quantity_ea INTEGER NOT NULL DEFAULT 0,
  quantity_set INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  recipient_name TEXT,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sample_chip_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_chip_transactions ENABLE ROW LEVEL SECURITY;

-- 샘플칩 재고: 모든 인증 사용자 읽기, admin/moderator 관리
CREATE POLICY "Authenticated users can view sample chip inventory"
  ON public.sample_chip_inventory FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage sample chip inventory"
  ON public.sample_chip_inventory FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can manage sample chip inventory"
  ON public.sample_chip_inventory FOR ALL
  USING (has_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

-- 샘플칩 입출고 이력: 모든 인증 사용자 읽기/생성, admin/moderator 관리
CREATE POLICY "Authenticated users can view transactions"
  ON public.sample_chip_transactions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create transactions"
  ON public.sample_chip_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all transactions"
  ON public.sample_chip_transactions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can manage all transactions"
  ON public.sample_chip_transactions FOR ALL
  USING (has_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_sample_chip_inventory_updated_at
  BEFORE UPDATE ON public.sample_chip_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
