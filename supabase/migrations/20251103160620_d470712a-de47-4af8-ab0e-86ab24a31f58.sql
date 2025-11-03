-- 모든 설정 테이블의 관리 정책을 관리자 전용으로 변경

-- 1. panel_masters
DROP POLICY IF EXISTS "Authenticated users can manage panel masters" ON public.panel_masters;
CREATE POLICY "Admins can manage panel masters" 
ON public.panel_masters 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. panel_sizes  
DROP POLICY IF EXISTS "Authenticated users can manage panel sizes" ON public.panel_sizes;
CREATE POLICY "Admins can manage panel sizes" 
ON public.panel_sizes 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. processing_options
DROP POLICY IF EXISTS "Authenticated users can manage processing options" ON public.processing_options;
CREATE POLICY "Admins can manage processing options" 
ON public.processing_options 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. processing_categories
DROP POLICY IF EXISTS "Authenticated users can manage processing categories" ON public.processing_categories;
CREATE POLICY "Admins can manage processing categories" 
ON public.processing_categories 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5. slot_types
DROP POLICY IF EXISTS "Authenticated users can manage slot types" ON public.slot_types;
CREATE POLICY "Admins can manage slot types" 
ON public.slot_types 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 6. category_logic_slots
DROP POLICY IF EXISTS "Authenticated users can manage category logic slots" ON public.category_logic_slots;
CREATE POLICY "Admins can manage category logic slots" 
ON public.category_logic_slots 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 7. color_options
DROP POLICY IF EXISTS "Authenticated users can manage color options" ON public.color_options;
CREATE POLICY "Admins can manage color options" 
ON public.color_options 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 8. color_mixing_costs
DROP POLICY IF EXISTS "Authenticated users can manage color mixing costs" ON public.color_mixing_costs;
CREATE POLICY "Admins can manage color mixing costs" 
ON public.color_mixing_costs 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 9. adhesive_costs
DROP POLICY IF EXISTS "Authenticated users can manage adhesive costs" ON public.adhesive_costs;
CREATE POLICY "Admins can manage adhesive costs" 
ON public.adhesive_costs 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 10. advanced_processing_settings
DROP POLICY IF EXISTS "Authenticated users can manage advanced processing settings" ON public.advanced_processing_settings;
CREATE POLICY "Admins can manage advanced processing settings" 
ON public.advanced_processing_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));