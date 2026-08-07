-- Final check: Ensure the function get_quality_indicators_for_of is updated
-- Using qi.frequency_type instead of o.frequency_type if the latter is missing

CREATE OR REPLACE FUNCTION public.get_quality_indicators_for_of(p_of_id uuid)
 RETURNS TABLE(indicator_id uuid, code text, name text, description text, indicator_type text, category text, unit text, target_value numeric, min_value numeric, max_value numeric, tolerance_minus numeric, tolerance_plus numeric, select_options jsonb, effective_frequency_type text, effective_frequency_minutes integer, effective_is_required boolean, effective_is_blocking boolean, match_scope text, assignment_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH of_ctx AS (
    SELECT
      o.id AS of_id, o.product_id, o.recipe_id, o.line_id, p.family_id
    FROM public.ordres_fabrication o
    LEFT JOIN public.products p ON p.id = o.product_id
    WHERE o.id = p_of_id
  ),
  ov AS (
    SELECT * FROM public.quality_of_indicator_overrides WHERE of_id = p_of_id
  ),
  candidates AS (
    SELECT
      qi.id AS indicator_id,
      qi.code, qi.name, qi.description,
      qi.indicator_type::text, qi.category::text,
      qi.unit, qi.target_value, qi.min_value, qi.max_value,
      qi.tolerance_minus, qi.tolerance_plus,
      to_jsonb(qi.select_options) AS select_options,
      COALESCE(a.frequency_type::text, qi.frequency_type::text) AS effective_frequency_type,
      COALESCE(a.frequency_minutes, qi.frequency_minutes) AS effective_frequency_minutes,
      (a.is_required OR qi.is_required) AS effective_is_required,
      (a.is_blocking OR qi.is_blocking) AS effective_is_blocking,
      CASE
        WHEN a.recipe_id IS NOT NULL THEN 'recipe'
        WHEN a.product_id IS NOT NULL THEN 'product'
        WHEN a.product_family_id IS NOT NULL THEN 'family'
        WHEN a.production_line_id IS NOT NULL THEN 'line'
        ELSE 'global'
      END AS match_scope,
      CASE
        WHEN a.recipe_id IS NOT NULL THEN 5
        WHEN a.product_id IS NOT NULL THEN 4
        WHEN a.product_family_id IS NOT NULL THEN 3
        WHEN a.production_line_id IS NOT NULL THEN 2
        ELSE 1
      END AS scope_priority,
      a.id AS assignment_id
    FROM public.quality_indicator_assignments a
    JOIN public.quality_indicators qi ON qi.id = a.indicator_id
    CROSS JOIN of_ctx ctx
    WHERE qi.is_active = true
      AND (
        (a.product_id IS NOT NULL AND a.product_id = ctx.product_id)
        OR (a.product_family_id IS NOT NULL AND a.product_family_id = ctx.family_id)
        OR (a.production_line_id IS NOT NULL AND a.production_line_id = ctx.line_id)
        OR (a.recipe_id IS NOT NULL AND a.recipe_id = ctx.recipe_id)
        OR (a.product_id IS NULL AND a.product_family_id IS NULL AND a.production_line_id IS NULL AND a.recipe_id IS NULL)
      )

    UNION ALL

    SELECT
      qi.id, qi.code, qi.name, qi.description,
      qi.indicator_type::text, qi.category::text,
      qi.unit, qi.target_value, qi.min_value, qi.max_value,
      qi.tolerance_minus, qi.tolerance_plus,
      to_jsonb(qi.select_options),
      qi.frequency_type::text, qi.frequency_minutes,
      qi.is_required, qi.is_blocking,
      'global'::text, 1, NULL::uuid
    FROM public.quality_indicators qi
    WHERE qi.is_active = true
      AND NOT EXISTS (SELECT 1 FROM public.quality_indicator_assignments a WHERE a.indicator_id = qi.id)

    UNION ALL

    -- Dérogation locale : contrôle ajouté directement sur l'OF
    SELECT
      qi.id, qi.code, qi.name, qi.description,
      qi.indicator_type::text, qi.category::text,
      qi.unit, qi.target_value, qi.min_value, qi.max_value,
      qi.tolerance_minus, qi.tolerance_plus,
      to_jsonb(qi.select_options),
      qi.frequency_type::text,
      qi.frequency_minutes,
      qi.is_required,
      qi.is_blocking,
      'of'::text, 6, NULL::uuid
    FROM ov o
    JOIN public.quality_indicators qi ON qi.id = o.indicator_id
    WHERE o.mode = 'add' AND qi.is_active = true
  ),
  ranked AS (
    SELECT c.*,
      ROW_NUMBER() OVER (PARTITION BY c.indicator_id ORDER BY c.scope_priority DESC, c.assignment_id NULLS LAST) AS rn
    FROM candidates c
  )
  SELECT
    r.indicator_id, r.code, r.name, r.description,
    r.indicator_type, r.category, r.unit,
    r.target_value, r.min_value, r.max_value,
    r.tolerance_minus, r.tolerance_plus, r.select_options,
    r.effective_frequency_type,
    r.effective_frequency_minutes,
    r.effective_is_required,
    r.effective_is_blocking,
    r.match_scope,
    r.assignment_id
  FROM ranked r
  WHERE r.rn = 1
  ORDER BY r.category, r.code;
$function$;
