CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

ALTER TABLE public.portfolio_images
  ADD COLUMN IF NOT EXISTS file_size BIGINT CHECK (file_size IS NULL OR file_size >= 0),
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'google_drive',
  ADD COLUMN IF NOT EXISTS uploaded_by TEXT;

CREATE INDEX IF NOT EXISTS idx_portfolio_posts_created_at
  ON public.portfolio_posts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_posts_keywords_gin
  ON public.portfolio_posts USING GIN (keywords);

CREATE INDEX IF NOT EXISTS idx_portfolio_images_post_order
  ON public.portfolio_images(post_id, display_order);

CREATE INDEX IF NOT EXISTS idx_portfolio_images_drive_file_id
  ON public.portfolio_images(drive_file_id);

DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_portfolio_posts_title_trgm ON public.portfolio_posts USING GIN (title gin_trgm_ops)';
EXCEPTION WHEN undefined_object THEN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_portfolio_posts_title_trgm ON public.portfolio_posts USING GIN (title extensions.gin_trgm_ops)';
END $$;

DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_portfolio_images_file_name_trgm ON public.portfolio_images USING GIN (file_name gin_trgm_ops)';
EXCEPTION WHEN undefined_object THEN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_portfolio_images_file_name_trgm ON public.portfolio_images USING GIN (file_name extensions.gin_trgm_ops)';
END $$;

CREATE OR REPLACE FUNCTION public.search_portfolio_posts(
  p_search_text TEXT DEFAULT NULL,
  p_category_keywords TEXT[] DEFAULT NULL,
  p_exact_keyword TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 24,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  keywords TEXT[],
  created_by TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  WITH normalized AS (
    SELECT
      NULLIF(BTRIM(p_search_text), '') AS search_text,
      COALESCE(p_category_keywords, '{}'::TEXT[]) AS category_keywords,
      GREATEST(1, LEAST(COALESCE(p_limit, 24), 500)) AS page_limit,
      GREATEST(0, COALESCE(p_offset, 0)) AS page_offset
  ),
  matched AS (
    SELECT p.*
    FROM public.portfolio_posts p
    CROSS JOIN normalized n
    WHERE
      (p_exact_keyword IS NULL OR COALESCE(p.keywords, '{}'::TEXT[]) @> ARRAY[p_exact_keyword]::TEXT[])
      AND (
        n.search_text IS NULL
        OR p.title ILIKE '%' || n.search_text || '%'
        OR EXISTS (
          SELECT 1
          FROM unnest(COALESCE(p.keywords, '{}'::TEXT[])) AS post_keyword(value)
          WHERE post_keyword.value ILIKE '%' || n.search_text || '%'
        )
        OR EXISTS (
          SELECT 1
          FROM public.portfolio_images image
          WHERE image.post_id = p.id
            AND image.file_name ILIKE '%' || n.search_text || '%'
        )
      )
      AND (
        CARDINALITY(n.category_keywords) = 0
        OR EXISTS (
          SELECT 1
          FROM unnest(n.category_keywords) AS category_keyword(value)
          WHERE
            p.title ILIKE '%' || category_keyword.value || '%'
            OR EXISTS (
              SELECT 1
              FROM unnest(COALESCE(p.keywords, '{}'::TEXT[])) AS post_keyword(value)
              WHERE post_keyword.value ILIKE '%' || category_keyword.value || '%'
            )
            OR EXISTS (
              SELECT 1
              FROM public.portfolio_images image
              WHERE image.post_id = p.id
                AND image.file_name ILIKE '%' || category_keyword.value || '%'
            )
        )
      )
  )
  SELECT
    matched.id,
    matched.title,
    matched.keywords,
    matched.created_by,
    matched.created_at,
    matched.updated_at,
    COUNT(*) OVER() AS total_count
  FROM matched, normalized
  ORDER BY matched.created_at DESC
  LIMIT normalized.page_limit
  OFFSET normalized.page_offset;
$$;

GRANT EXECUTE ON FUNCTION public.search_portfolio_posts(TEXT, TEXT[], TEXT, INTEGER, INTEGER) TO authenticated;
