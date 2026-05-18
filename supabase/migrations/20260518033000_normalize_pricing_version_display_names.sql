ALTER TABLE public.panel_pricing_versions
  ALTER COLUMN supplier_name SET DEFAULT '공통';

WITH matched AS (
  SELECT
    id,
    regexp_match(version_name, '((?:19|20)[0-9]{2})[-./년 ]*(1[0-2]|0?[1-9])') AS ym
  FROM public.panel_pricing_versions
  WHERE version_name IS NOT NULL
)
UPDATE public.panel_pricing_versions AS versions
SET version_name = matched.ym[1] || '-' || lpad(matched.ym[2], 2, '0') || ' 단가표'
FROM matched
WHERE versions.id = matched.id
  AND matched.ym IS NOT NULL
  AND versions.version_name <> matched.ym[1] || '-' || lpad(matched.ym[2], 2, '0') || ' 단가표';
