-- Index de performance sur les colonnes fréquemment filtrées
CREATE INDEX IF NOT EXISTS idx_reception_tickets_statut ON public.reception_tickets (statut);
CREATE INDEX IF NOT EXISTS idx_reception_tickets_created_at ON public.reception_tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reception_tickets_date_ticket ON public.reception_tickets (date_ticket DESC);
CREATE INDEX IF NOT EXISTS idx_reception_tickets_numero ON public.reception_tickets (numero);
CREATE INDEX IF NOT EXISTS idx_reception_ticket_photos_ticket ON public.reception_ticket_photos (ticket_id);

-- Comptage des tickets importés récents (aperçu avant suppression)
CREATE OR REPLACE FUNCTION public.reception_count_imported_tickets(p_hours integer)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::int
  FROM public.reception_tickets t
  WHERE t.statut = 'pese_importe'
    AND t.created_at >= now() - make_interval(hours => GREATEST(COALESCE(p_hours, 0), 0));
$$;

-- Suppression forcée des tickets importés (< p_hours), administrateurs uniquement
CREATE OR REPLACE FUNCTION public.reception_delete_imported_tickets(p_hours integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ids uuid[];
  v_count int := 0;
  v_hours int := GREATEST(COALESCE(p_hours, 0), 0);
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Accès refusé — administrateur requis';
  END IF;
  IF v_hours NOT IN (4, 8, 12) THEN
    RAISE EXCEPTION 'Plage horaire invalide (4, 8 ou 12 heures)';
  END IF;

  SELECT array_agg(id) INTO v_ids
  FROM public.reception_tickets
  WHERE statut = 'pese_importe'
    AND created_at >= now() - make_interval(hours => v_hours);

  IF v_ids IS NULL OR array_length(v_ids, 1) = 0 THEN
    RETURN 0;
  END IF;
  v_count := array_length(v_ids, 1);

  PERFORM set_config('prodintime.bypass_lock', 'on', true);

  DELETE FROM public.reception_weighings WHERE ticket_id = ANY(v_ids);
  DELETE FROM public.reception_tickets WHERE id = ANY(v_ids);

  INSERT INTO public.audit_logs (action, entity_type, entity_id, actor_id, reason, old_values)
  VALUES (
    'bulk_delete_imported', 'reception_ticket', NULL, auth.uid(),
    format('Suppression forcée de %s ticket(s) importé(s) — plage %s h', v_count, v_hours),
    jsonb_build_object('hours', v_hours, 'count', v_count, 'ticket_ids', to_jsonb(v_ids), 'executed_at', now())
  );

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reception_count_imported_tickets(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reception_delete_imported_tickets(integer) TO authenticated;