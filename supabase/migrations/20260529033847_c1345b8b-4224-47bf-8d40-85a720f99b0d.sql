CREATE INDEX IF NOT EXISTS idx_portfolio_images_post_active_cover
  ON public.portfolio_images(post_id, is_main DESC, display_order, created_at)
  WHERE delete_status <> 'deleted';

DROP FUNCTION IF EXISTS public.get_portfolio_post_main_images(UUID[]);

CREATE OR REPLACE FUNCTION public.get_portfolio_post_main_images(
  p_post_ids UUID[]
)
RETURNS TABLE (
  id UUID,
  post_id UUID,
  drive_file_id TEXT,
  drive_folder_id TEXT,
  drive_path TEXT,
  file_name TEXT,
  caption TEXT,
  width INTEGER,
  height INTEGER,
  dominant_color TEXT,
  taken_at TIMESTAMPTZ,
  thumbnail_url TEXT,
  image_url TEXT,
  thumbnail_bucket TEXT,
  thumbnail_path TEXT,
  thumbnail_width INTEGER,
  thumbnail_height INTEGER,
  display_order INTEGER,
  is_main BOOLEAN,
  file_size BIGINT,
  mime_type TEXT,
  storage_provider TEXT,
  uploaded_by TEXT,
  access_level TEXT,
  delete_status TEXT,
  delete_error TEXT,
  created_at TIMESTAMPTZ,
  image_count BIGINT
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      image.*,
      COUNT(*) OVER (PARTITION BY image.post_id) AS image_count,
      ROW_NUMBER() OVER (
        PARTITION BY image.post_id
        ORDER BY
          (post.cover_image_id IS NOT NULL AND image.id = post.cover_image_id) DESC,
          image.is_main DESC,
          image.display_order ASC,
          image.created_at ASC
      ) AS row_rank
    FROM public.portfolio_images image
    JOIN public.portfolio_posts post ON post.id = image.post_id
    WHERE image.post_id = ANY(COALESCE(p_post_ids, '{}'::UUID[]))
      AND COALESCE(image.delete_status, 'active') <> 'deleted'
  )
  SELECT
    ranked.id, ranked.post_id, ranked.drive_file_id, ranked.drive_folder_id, ranked.drive_path,
    ranked.file_name, ranked.caption, ranked.width, ranked.height, ranked.dominant_color, ranked.taken_at,
    ranked.thumbnail_url, ranked.image_url, ranked.thumbnail_bucket, ranked.thumbnail_path,
    ranked.thumbnail_width, ranked.thumbnail_height, ranked.display_order, ranked.is_main,
    ranked.file_size, ranked.mime_type, ranked.storage_provider, ranked.uploaded_by,
    ranked.access_level, ranked.delete_status, ranked.delete_error, ranked.created_at, ranked.image_count
  FROM ranked
  WHERE ranked.row_rank = 1
  ORDER BY ranked.post_id;
$$;

DROP FUNCTION IF EXISTS public.search_portfolio_posts(TEXT, TEXT[], TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.search_portfolio_posts(
  p_search_text TEXT DEFAULT NULL,
  p_category_keywords TEXT[] DEFAULT NULL,
  p_exact_keyword TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 24,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID, title TEXT, category TEXT, client_name TEXT, project_year INTEGER, location TEXT,
  materials TEXT[], processes TEXT[], visibility TEXT, archived_at TIMESTAMPTZ, cover_image_id UUID,
  keywords TEXT[], created_by TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  image_count BIGINT, total_count BIGINT
)
LANGUAGE sql SECURITY INVOKER STABLE SET search_path = public
AS $$
  WITH normalized AS (
    SELECT
      NULLIF(BTRIM(p_search_text), '') AS search_text,
      COALESCE(p_category_keywords, '{}'::TEXT[]) AS category_keywords,
      GREATEST(1, LEAST(COALESCE(p_limit, 24), 500)) AS page_limit,
      GREATEST(0, COALESCE(p_offset, 0)) AS page_offset
  ),
  matched AS (
    SELECT p.* FROM public.portfolio_posts p CROSS JOIN normalized n
    WHERE COALESCE(p.visibility, 'published') = 'published' AND p.archived_at IS NULL
      AND (p_exact_keyword IS NULL
        OR COALESCE(p.keywords, '{}'::TEXT[]) @> ARRAY[p_exact_keyword]::TEXT[]
        OR p.category = p_exact_keyword
        OR COALESCE(p.materials, '{}'::TEXT[]) @> ARRAY[p_exact_keyword]::TEXT[]
        OR COALESCE(p.processes, '{}'::TEXT[]) @> ARRAY[p_exact_keyword]::TEXT[])
      AND (n.search_text IS NULL
        OR p.title ILIKE '%' || n.search_text || '%'
        OR p.category ILIKE '%' || n.search_text || '%'
        OR p.client_name ILIKE '%' || n.search_text || '%'
        OR p.location ILIKE '%' || n.search_text || '%'
        OR p.project_year::TEXT ILIKE '%' || n.search_text || '%'
        OR EXISTS (SELECT 1 FROM unnest(COALESCE(p.keywords,'{}'::TEXT[]) || COALESCE(p.materials,'{}'::TEXT[]) || COALESCE(p.processes,'{}'::TEXT[])) AS post_term(value) WHERE post_term.value ILIKE '%' || n.search_text || '%')
        OR EXISTS (SELECT 1 FROM public.portfolio_images image WHERE image.post_id = p.id AND COALESCE(image.delete_status,'active') <> 'deleted' AND (image.file_name ILIKE '%' || n.search_text || '%' OR image.caption ILIKE '%' || n.search_text || '%')))
      AND (CARDINALITY(n.category_keywords) = 0
        OR EXISTS (SELECT 1 FROM unnest(n.category_keywords) AS category_keyword(value)
          WHERE p.title ILIKE '%' || category_keyword.value || '%'
            OR p.category ILIKE '%' || category_keyword.value || '%'
            OR p.client_name ILIKE '%' || category_keyword.value || '%'
            OR p.location ILIKE '%' || category_keyword.value || '%'
            OR EXISTS (SELECT 1 FROM unnest(COALESCE(p.keywords,'{}'::TEXT[]) || COALESCE(p.materials,'{}'::TEXT[]) || COALESCE(p.processes,'{}'::TEXT[])) AS post_term(value) WHERE post_term.value ILIKE '%' || category_keyword.value || '%')
            OR EXISTS (SELECT 1 FROM public.portfolio_images image WHERE image.post_id = p.id AND COALESCE(image.delete_status,'active') <> 'deleted' AND (image.file_name ILIKE '%' || category_keyword.value || '%' OR image.caption ILIKE '%' || category_keyword.value || '%'))))
  )
  SELECT matched.id, matched.title, matched.category, matched.client_name, matched.project_year, matched.location,
    matched.materials, matched.processes, matched.visibility, matched.archived_at, matched.cover_image_id,
    matched.keywords, matched.created_by, matched.created_at, matched.updated_at,
    (SELECT COUNT(*) FROM public.portfolio_images image WHERE image.post_id = matched.id AND COALESCE(image.delete_status,'active') <> 'deleted') AS image_count,
    COUNT(*) OVER() AS total_count
  FROM matched ORDER BY matched.created_at DESC
  LIMIT (SELECT page_limit FROM normalized) OFFSET (SELECT page_offset FROM normalized);
$$;

GRANT EXECUTE ON FUNCTION public.get_portfolio_post_main_images(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_portfolio_posts(TEXT, TEXT[], TEXT, INTEGER, INTEGER) TO authenticated;