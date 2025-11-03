-- 1. saved_quotes: moderator가 모든 견적 조회/수정 가능
CREATE POLICY "Moderators can view all quotes" 
ON public.saved_quotes 
FOR SELECT 
USING (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Moderators can update all quotes" 
ON public.saved_quotes 
FOR UPDATE 
USING (has_role(auth.uid(), 'moderator'::app_role));

-- 2. profiles: moderator가 모든 프로필 조회 가능
CREATE POLICY "Moderators can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'moderator'::app_role));

-- 3. 가격/설정 테이블들: moderator도 관리 가능
CREATE POLICY "Moderators can manage panel masters" 
ON public.panel_masters 
FOR ALL 
USING (has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Moderators can manage panel sizes" 
ON public.panel_sizes 
FOR ALL 
USING (has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Moderators can manage processing options" 
ON public.processing_options 
FOR ALL 
USING (has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Moderators can manage processing categories" 
ON public.processing_categories 
FOR ALL 
USING (has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Moderators can manage slot types" 
ON public.slot_types 
FOR ALL 
USING (has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Moderators can manage category logic slots" 
ON public.category_logic_slots 
FOR ALL 
USING (has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Moderators can manage color options" 
ON public.color_options 
FOR ALL 
USING (has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Moderators can manage color mixing costs" 
ON public.color_mixing_costs 
FOR ALL 
USING (has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Moderators can manage adhesive costs" 
ON public.adhesive_costs 
FOR ALL 
USING (has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Moderators can manage advanced processing settings" 
ON public.advanced_processing_settings 
FOR ALL 
USING (has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

-- 4. user_roles: moderator는 조회만 가능
CREATE POLICY "Moderators can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (has_role(auth.uid(), 'moderator'::app_role));