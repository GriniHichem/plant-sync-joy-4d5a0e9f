CREATE OR REPLACE FUNCTION public.get_quality_due_for_shift(
  p_quality_shift_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 60
)
RETURNS TABLE (
  of_id uuid,
  numero text,
  product_id uuid,
  line_id uuid,
  product_label text,
  line_label text,
  on_covered_line boolean,
  due integer,
  overdue integer,
  critical_overdue integer,
  total integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH covered AS (
    SELECT production_line_id AS lid
    FROM public.quality_shift_lines
    WHERE p_quality_shift_id IS NOT NULL AND quality_shift_id = p_quality_shift_id
  ),
  ofs AS (
    SELECT o.id, o.numero, o.product_id, o.line_id
    FROM public.ordres_fabrication o
    WHERE o.statut = 'en_cours'
    ORDER BY o.created_at DESC
    LIMIT GREATEST(COALESCE(p_limit, 60), 1)
  ),
  plan AS (
    SELECT
      o.id AS of_id,
      i.indicator_id,
      i.effective_frequency_minutes AS freq,
      i.effective_is_blocking AS blocking,
      (
        SELECT max(qc.control_time)
        FROM public.quality_checks qc
        WHERE qc.of_id = o.id AND qc.indicator_id = i.indicator_id
      ) AS last_at
    FROM ofs o
    CROSS JOIN LATERAL public.get_quality_indicators_for_of(o.id) i
    WHERE i.effective_is_required IS TRUE
  ),
  scored AS (
    SELECT
      p.of_id,
      p.blocking,
      CASE
        WHEN p.last_at IS NULL THEN 'todo'
        WHEN COALESCE(p.freq, 0) <= 0 THEN 'ok'
        WHEN EXTRACT(EPOCH FROM (now() - p.last_at)) / 60 >= p.freq THEN 'overdue'
        ELSE 'ok'
      END AS level,
      CASE
        WHEN p.last_at IS NOT NULL AND COALESCE(p.freq, 0) > 0
             AND EXTRACT(EPOCH FROM (now() - p.last_at)) / 60 >= (2 * p.freq)
        THEN true ELSE false
      END AS double_overdue
    FROM plan p
  )
  SELECT
    o.id,
    o.numero,
    o.product_id,
    o.line_id,
    COALESCE(pr.designation, pr.code, '—') AS product_label,
    COALESCE(pl.designation, pl.code, '—') AS line_label,
    (o.line_id IS NOT NULL AND EXISTS (SELECT 1 FROM covered c WHERE c.lid = o.line_id)) AS on_covered_line,
    COALESCE(count(*) FILTER (WHERE s.level IN ('todo', 'overdue')), 0)::int AS due,
    COALESCE(count(*) FILTER (WHERE s.level = 'overdue'), 0)::int AS overdue,
    COALESCE(count(*) FILTER (WHERE s.double_overdue AND s.blocking IS TRUE), 0)::int AS critical_overdue,
    COALESCE(count(s.of_id), 0)::int AS total
  FROM ofs o
  LEFT JOIN public.products pr ON pr.id = o.product_id
  LEFT JOIN public.production_lines pl ON pl.id = o.line_id
  LEFT JOIN scored s ON s.of_id = o.id
  GROUP BY o.id, o.numero, o.product_id, o.line_id, pr.designation, pr.code, pl.designation, pl.code;
$$;

GRANT EXECUTE ON FUNCTION public.get_quality_due_for_shift(uuid, integer) TO authenticated;