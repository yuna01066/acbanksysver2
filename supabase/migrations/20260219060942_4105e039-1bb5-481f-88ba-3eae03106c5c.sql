
-- 아임웹 상품 캐시 테이블
CREATE TABLE public.imweb_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imweb_prod_no text NOT NULL UNIQUE,
  name text NOT NULL,
  price numeric DEFAULT 0,
  stock_qty integer DEFAULT 0,
  image_url text,
  category text,
  status text DEFAULT 'sale',
  raw_data jsonb DEFAULT '{}'::jsonb,
  synced_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 아임웹 주문 캐시 테이블
CREATE TABLE public.imweb_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imweb_order_no text NOT NULL UNIQUE,
  order_date timestamp with time zone,
  buyer_name text,
  buyer_email text,
  buyer_phone text,
  total_price numeric DEFAULT 0,
  order_status text DEFAULT 'ordered',
  items jsonb DEFAULT '[]'::jsonb,
  raw_data jsonb DEFAULT '{}'::jsonb,
  synced_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 아임웹 동기화 로그
CREATE TABLE public.imweb_sync_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type text NOT NULL, -- 'products', 'orders', 'inventory'
  status text NOT NULL DEFAULT 'running', -- 'running', 'success', 'error'
  total_count integer DEFAULT 0,
  synced_count integer DEFAULT 0,
  error_message text,
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  user_id uuid NOT NULL,
  user_name text NOT NULL
);

-- RLS
ALTER TABLE public.imweb_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imweb_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imweb_sync_logs ENABLE ROW LEVEL SECURITY;

-- imweb_products: 인증된 사용자 조회, 관리자/중간관리자 관리
CREATE POLICY "Authenticated users can view products" ON public.imweb_products FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage products" ON public.imweb_products FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators can manage products" ON public.imweb_products FOR ALL USING (has_role(auth.uid(), 'moderator')) WITH CHECK (has_role(auth.uid(), 'moderator'));

-- imweb_orders: 인증된 사용자 조회, 관리자/중간관리자 관리
CREATE POLICY "Authenticated users can view orders" ON public.imweb_orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage orders" ON public.imweb_orders FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators can manage orders" ON public.imweb_orders FOR ALL USING (has_role(auth.uid(), 'moderator')) WITH CHECK (has_role(auth.uid(), 'moderator'));

-- imweb_sync_logs: 인증된 사용자 조회, 관리자/중간관리자 관리
CREATE POLICY "Authenticated users can view sync logs" ON public.imweb_sync_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage sync logs" ON public.imweb_sync_logs FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators can manage sync logs" ON public.imweb_sync_logs FOR ALL USING (has_role(auth.uid(), 'moderator')) WITH CHECK (has_role(auth.uid(), 'moderator'));

-- updated_at 트리거
CREATE TRIGGER update_imweb_products_updated_at BEFORE UPDATE ON public.imweb_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_imweb_orders_updated_at BEFORE UPDATE ON public.imweb_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
