
DROP POLICY IF EXISTS "Authenticated users can read meeting reservations" ON public.meeting_reservations;
CREATE POLICY "Approved users can read meeting reservations"
  ON public.meeting_reservations FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_approved = true)
  );

DROP POLICY IF EXISTS "Authenticated users can delete portfolio images" ON public.portfolio_images;
DROP POLICY IF EXISTS "Authenticated users can update portfolio images" ON public.portfolio_images;
CREATE POLICY "Owners or staff can delete portfolio images"
  ON public.portfolio_images FOR DELETE
  USING (
    uploaded_by = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  );
CREATE POLICY "Owners or staff can update portfolio images"
  ON public.portfolio_images FOR UPDATE
  USING (
    uploaded_by = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  )
  WITH CHECK (
    uploaded_by = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  );

DROP POLICY IF EXISTS "Authenticated users can delete portfolio posts" ON public.portfolio_posts;
DROP POLICY IF EXISTS "Authenticated users can update portfolio posts" ON public.portfolio_posts;
CREATE POLICY "Owners or staff can delete portfolio posts"
  ON public.portfolio_posts FOR DELETE
  USING (
    created_by = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  );
CREATE POLICY "Owners or staff can update portfolio posts"
  ON public.portfolio_posts FOR UPDATE
  USING (
    created_by = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  )
  WITH CHECK (
    created_by = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  );

DROP POLICY IF EXISTS "Authenticated users can update quote templates" ON public.quote_templates;
DROP POLICY IF EXISTS "Authenticated users can delete quote templates" ON public.quote_templates;
CREATE POLICY "Owners or staff can update quote templates"
  ON public.quote_templates FOR UPDATE
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  );
CREATE POLICY "Owners or staff can delete quote templates"
  ON public.quote_templates FOR DELETE
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  );

DROP POLICY IF EXISTS "Authenticated users can manage quote template sections" ON public.quote_template_sections;
CREATE POLICY "Owners or staff can insert quote template sections"
  ON public.quote_template_sections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quote_templates t
      WHERE t.id = template_id
        AND (
          t.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'moderator'::app_role)
        )
    )
  );
CREATE POLICY "Owners or staff can update quote template sections"
  ON public.quote_template_sections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.quote_templates t
      WHERE t.id = template_id
        AND (
          t.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'moderator'::app_role)
        )
    )
  );
CREATE POLICY "Owners or staff can delete quote template sections"
  ON public.quote_template_sections FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.quote_templates t
      WHERE t.id = template_id
        AND (
          t.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'moderator'::app_role)
        )
    )
  );

DROP POLICY IF EXISTS "Authenticated users can manage quote template items" ON public.quote_template_items;
CREATE POLICY "Owners or staff can insert quote template items"
  ON public.quote_template_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quote_template_sections s
      JOIN public.quote_templates t ON t.id = s.template_id
      WHERE s.id = section_id
        AND (
          t.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'moderator'::app_role)
        )
    )
  );
CREATE POLICY "Owners or staff can update quote template items"
  ON public.quote_template_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.quote_template_sections s
      JOIN public.quote_templates t ON t.id = s.template_id
      WHERE s.id = section_id
        AND (
          t.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'moderator'::app_role)
        )
    )
  );
CREATE POLICY "Owners or staff can delete quote template items"
  ON public.quote_template_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.quote_template_sections s
      JOIN public.quote_templates t ON t.id = s.template_id
      WHERE s.id = section_id
        AND (
          t.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'moderator'::app_role)
        )
    )
  );

DROP POLICY IF EXISTS "Authenticated users can manage links" ON public.exhibition_links;
CREATE POLICY "Owners or staff can manage exhibition links"
  ON public.exhibition_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.exhibitions e
      WHERE e.id = exhibition_id
        AND (
          e.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'moderator'::app_role)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exhibitions e
      WHERE e.id = exhibition_id
        AND (
          e.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'moderator'::app_role)
        )
    )
  );

DROP POLICY IF EXISTS "Authenticated users can manage checklist items" ON public.exhibition_checklist_items;
CREATE POLICY "Owners or staff can manage exhibition checklist items"
  ON public.exhibition_checklist_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.exhibitions e
      WHERE e.id = exhibition_id
        AND (
          e.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'moderator'::app_role)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exhibitions e
      WHERE e.id = exhibition_id
        AND (
          e.created_by = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'moderator'::app_role)
        )
    )
  );

NOTIFY pgrst, 'reload schema';
