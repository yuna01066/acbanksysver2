-- Portfolio tablet consulting mode: searchable metadata, image notes, and collection-ready schema.

ALTER TABLE public.portfolio_posts
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS project_year INTEGER,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS materials TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS processes TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cover_image_id UUID;

ALTER TABLE public.portfolio_images
  ADD COLUMN IF NOT EXISTS caption TEXT,
  ADD COLUMN IF NOT EXISTS width INTEGER,
  ADD COLUMN IF NOT EXISTS height INTEGER,
  ADD COLUMN IF NOT EXISTS dominant_color TEXT,
  ADD COLUMN IF NOT EXISTS taken_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_posts_visibility_check'
  ) THEN
    ALTER TABLE public.portfolio_posts
      ADD CONSTRAINT portfolio_posts_visibility_check
      CHECK (visibility IN ('published', 'private', 'archived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_posts_cover_image_id_fkey'
  ) THEN
    ALTER TABLE public.portfolio_posts
      ADD CONSTRAINT portfolio_posts_cover_image_id_fkey
      FOREIGN KEY (cover_image_id)
      REFERENCES public.portfolio_images(id)
      ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.portfolio_posts
SET
  category = COALESCE(
    category,
    CASE
      WHEN COALESCE(keywords, '{}'::TEXT[]) && ARRAY['인테리어', '공간', '쇼룸', '로비', '매장', '팝업']::TEXT[] THEN '인테리어'
      WHEN COALESCE(keywords, '{}'::TEXT[]) && ARRAY['사인/디스플레이', '사인', '디스플레이', '진열', '전시']::TEXT[] THEN '사인/디스플레이'
      WHEN COALESCE(keywords, '{}'::TEXT[]) && ARRAY['디테일', '마감', '코너', '접착', '모서리']::TEXT[] THEN '디테일'
      WHEN COALESCE(keywords, '{}'::TEXT[]) && ARRAY['제작가공', '제작', '가공', '레이저', 'cnc', '절곡', '접합', '집기', '빅더미']::TEXT[] THEN '제작가공'
      ELSE '기타'
    END
  ),
  materials = COALESCE(materials, '{}'::TEXT[]),
  processes = COALESCE(processes, '{}'::TEXT[]),
  visibility = COALESCE(visibility, 'published')
WHERE category IS NULL
  OR materials IS NULL
  OR processes IS NULL
  OR visibility IS NULL;

CREATE INDEX IF NOT EXISTS idx_portfolio_posts_category
  ON public.portfolio_posts(category);

CREATE INDEX IF NOT EXISTS idx_portfolio_posts_visibility_archived
  ON public.portfolio_posts(visibility, archived_at);

CREATE INDEX IF NOT EXISTS idx_portfolio_posts_materials_gin
  ON public.portfolio_posts USING GIN (materials);

CREATE INDEX IF NOT EXISTS idx_portfolio_posts_processes_gin
  ON public.portfolio_posts USING GIN (processes);

DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_portfolio_images_caption_trgm ON public.portfolio_images USING GIN (caption gin_trgm_ops)';
EXCEPTION WHEN undefined_object THEN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_portfolio_images_caption_trgm ON public.portfolio_images USING GIN (caption extensions.gin_trgm_ops)';
END $$;

CREATE TABLE IF NOT EXISTS public.portfolio_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  collection_type TEXT NOT NULL DEFAULT 'consulting',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_collections TO authenticated;
GRANT ALL ON public.portfolio_collections TO service_role;

CREATE TABLE IF NOT EXISTS public.portfolio_collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.portfolio_collections(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.portfolio_posts(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(collection_id, post_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_collection_items TO authenticated;
GRANT ALL ON public.portfolio_collection_items TO service_role;

ALTER TABLE public.portfolio_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_collection_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view portfolio collections" ON public.portfolio_collections;
CREATE POLICY "Authenticated users can view portfolio collections"
  ON public.portfolio_collections FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage portfolio collections" ON public.portfolio_collections;
CREATE POLICY "Authenticated users can manage portfolio collections"
  ON public.portfolio_collections FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view portfolio collection items" ON public.portfolio_collection_items;
CREATE POLICY "Authenticated users can view portfolio collection items"
  ON public.portfolio_collection_items FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage portfolio collection items" ON public.portfolio_collection_items;
CREATE POLICY "Authenticated users can manage portfolio collection items"
  ON public.portfolio_collection_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS update_portfolio_collections_updated_at ON public.portfolio_collections;
CREATE TRIGGER update_portfolio_collections_updated_at
  BEFORE UPDATE ON public.portfolio_collections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP FUNCTION IF EXISTS public.search_portfolio_posts(TEXT, TEXT[], TEXT, INTEGER, INTEGER);

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
      COALESCE(p.visibility, 'published') = 'published'
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
    COUNT(*) OVER() AS total_count
  FROM matched
  ORDER BY matched.created_at DESC
  LIMIT (SELECT page_limit FROM normalized)
  OFFSET (SELECT page_offset FROM normalized);
$$;

GRANT EXECUTE ON FUNCTION public.search_portfolio_posts(TEXT, TEXT[], TEXT, INTEGER, INTEGER) TO authenticated;