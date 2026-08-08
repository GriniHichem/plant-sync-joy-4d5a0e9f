-- SUJET : Réception F&L – Réintégration Abattement total (kg) dans les indicateurs Qualité
-- On ajoute total_abattement_kg à la fonction get_reception_qualitative_kpis.

CREATE OR REPLACE FUNCTION public.get_reception_qualitative_kpis(p_target_date date)
RETURNS TABLE(
  period_name text,
  avg_abattement_pct numeric,
  total_net_kg numeric,
  total_abattement_kg numeric,
  ticket_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH periods AS (
    SELECT 'Matin (6h-14h)' as p_name, (p_target_date + interval '6 hours') as start_ts, (p_target_date + interval '14 hours') as end_ts
    UNION ALL
    SELECT 'Après-midi (14h-22h)', (p_target_date + interval '14 hours'), (p_target_date + interval '22 hours')
    UNION ALL
    SELECT 'Nuit (22h-6h)', (p_target_date + interval '22 hours'), (p_target_date + interval '30 hours')
  ),
  period_data AS (
    SELECT 
      p.p_name,
      t.taux_abattement,
      t.poids_net_kg,
      t.poids_abattement_kg,
      t.id
    FROM periods p
    LEFT JOIN v_reception_global t ON 
      t.cloture_at >= p.start_ts AND t.cloture_at < p.end_ts
      AND t.statut IN ('cloture', 'pese_importe')
  )
  SELECT 
    pd.p_name,
    COALESCE(avg(pd.taux_abattement), 0)::numeric,
    COALESCE(sum(pd.poids_net_kg), 0)::numeric,
    COALESCE(sum(pd.poids_abattement_kg), 0)::numeric,
    count(pd.id)::integer
  FROM periods p
  LEFT JOIN period_data pd ON pd.p_name = p.p_name
  GROUP BY p.p_name, p.start_ts
  ORDER BY p.start_ts;
END;
$function$;
