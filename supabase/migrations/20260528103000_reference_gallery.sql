-- Add a separated reference gallery while reusing the existing portfolio image pipeline.

ALTER TABLE public.portfolio_posts
  ADD COLUMN IF NOT EXISTS gallery_type TEXT NOT NULL DEFAULT 'portfolio',
  ADD COLUMN IF NOT EXISTS memo TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_posts_gallery_type_check'
  ) THEN
    ALTER TABLE public.portfolio_posts
      ADD CONSTRAINT portfolio_posts_gallery_type_check
      CHECK (gallery_type IN ('portfolio', 'reference'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_portfolio_posts_gallery_type_created_at
  ON public.portfolio_posts(gallery_type, created_at DESC)
  WHERE archived_at IS NULL
    AND COALESCE(visibility, 'published') = 'published';

DROP FUNCTION IF EXISTS public.search_portfolio_posts(TEXT, TEXT[], TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.search_portfolio_posts(TEXT, TEXT[], TEXT, INTEGER, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.search_portfolio_posts(
  p_search_text TEXT DEFAULT NULL,
  p_category_keywords TEXT[] DEFAULT NULL,
  p_exact_keyword TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 24,
  p_offset INTEGER DEFAULT 0,
  p_gallery_type TEXT DEFAULT 'portfolio'
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  gallery_type TEXT,
  memo TEXT,
  category TEXT,
  client_name TEXT,
  project_year INTEGER,
  location TEXT,
  materials TEXT[],
  processes TEXT[],
  visibility TEXT,
  archived_at TIMESTAMPTZ,
  cover_image_id UUID,
  keywords TEXT[],
  created_by TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  image_count BIGINT,
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
      CASE
        WHEN p_gallery_type IN ('portfolio', 'reference') THEN p_gallery_type
        ELSE 'portfolio'
      END AS gallery_type,
      GREATEST(1, LEAST(COALESCE(p_limit, 24), 500)) AS page_limit,
      GREATEST(0, COALESCE(p_offset, 0)) AS page_offset
  ),
  matched AS (
    SELECT p.*
    FROM public.portfolio_posts p
    CROSS JOIN normalized n
    WHERE
      COALESCE(p.gallery_type, 'portfolio') = n.gallery_type
      AND COALESCE(p.visibility, 'published') = 'published'
      AND p.archived_at IS NULL
      AND (
        p_exact_keyword IS NULL
        OR COALESCE(p.keywords, '{}'::TEXT[]) @> ARRAY[p_exact_keyword]::TEXT[]
        OR p.category = p_exact_keyword
        OR COALESCE(p.materials, '{}'::TEXT[]) @> ARRAY[p_exact_keyword]::TEXT[]
        OR COALESCE(p.processes, '{}'::TEXT[]) @> ARRAY[p_exact_keyword]::TEXT[]
      )
      AND (
        n.search_text IS NULL
        OR p.title ILIKE '%' || n.search_text || '%'
        OR p.memo ILIKE '%' || n.search_text || '%'
        OR p.category ILIKE '%' || n.search_text || '%'
        OR p.client_name ILIKE '%' || n.search_text || '%'
        OR p.location ILIKE '%' || n.search_text || '%'
        OR p.project_year::TEXT ILIKE '%' || n.search_text || '%'
        OR EXISTS (
          SELECT 1
          FROM unnest(COALESCE(p.keywords, '{}'::TEXT[]) || COALESCE(p.materials, '{}'::TEXT[]) || COALESCE(p.processes, '{}'::TEXT[])) AS post_term(value)
          WHERE post_term.value ILIKE '%' || n.search_text || '%'
        )
        OR EXISTS (
          SELECT 1
          FROM public.portfolio_images image
          WHERE image.post_id = p.id
            AND COALESCE(image.delete_status, 'active') <> 'deleted'
            AND (
              image.file_name ILIKE '%' || n.search_text || '%'
              OR image.caption ILIKE '%' || n.search_text || '%'
            )
        )
      )
      AND (
        CARDINALITY(n.category_keywords) = 0
        OR EXISTS (
          SELECT 1
          FROM unnest(n.category_keywords) AS category_keyword(value)
          WHERE
            p.title ILIKE '%' || category_keyword.value || '%'
            OR p.memo ILIKE '%' || category_keyword.value || '%'
            OR p.category ILIKE '%' || category_keyword.value || '%'
            OR p.client_name ILIKE '%' || category_keyword.value || '%'
            OR p.location ILIKE '%' || category_keyword.value || '%'
            OR EXISTS (
              SELECT 1
              FROM unnest(COALESCE(p.keywords, '{}'::TEXT[]) || COALESCE(p.materials, '{}'::TEXT[]) || COALESCE(p.processes, '{}'::TEXT[])) AS post_term(value)
              WHERE post_term.value ILIKE '%' || category_keyword.value || '%'
            )
            OR EXISTS (
              SELECT 1
              FROM public.portfolio_images image
              WHERE image.post_id = p.id
                AND COALESCE(image.delete_status, 'active') <> 'deleted'
                AND (
                  image.file_name ILIKE '%' || category_keyword.value || '%'
                  OR image.caption ILIKE '%' || category_keyword.value || '%'
                )
            )
        )
      )
  )
  SELECT
    matched.id,
    matched.title,
    COALESCE(matched.gallery_type, 'portfolio') AS gallery_type,
    matched.memo,
    matched.category,
    matched.client_name,
    matched.project_year,
    matched.location,
    matched.materials,
    matched.processes,
    matched.visibility,
    matched.archived_at,
    matched.cover_image_id,
    matched.keywords,
    matched.created_by,
    matched.created_at,
    matched.updated_at,
    (
      SELECT COUNT(*)
      FROM public.portfolio_images image
      WHERE image.post_id = matched.id
        AND COALESCE(image.delete_status, 'active') <> 'deleted'
    ) AS image_count,
    COUNT(*) OVER() AS total_count
  FROM matched
  ORDER BY matched.created_at DESC
  LIMIT (SELECT page_limit FROM normalized)
  OFFSET (SELECT page_offset FROM normalized);
$$;

GRANT EXECUTE ON FUNCTION public.search_portfolio_posts(TEXT, TEXT[], TEXT, INTEGER, INTEGER, TEXT) TO authenticated;
