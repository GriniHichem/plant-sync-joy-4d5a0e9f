CREATE INDEX IF NOT EXISTS idx_reception_tickets_statut_created_at
  ON public.reception_tickets (statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reception_tickets_date_ticket
  ON public.reception_tickets (date_ticket DESC);
CREATE INDEX IF NOT EXISTS idx_reception_ticket_photos_ticket
  ON public.reception_ticket_photos (ticket_id);
CREATE INDEX IF NOT EXISTS idx_reception_weighings_ticket
  ON public.reception_weighings (ticket_id);

CREATE OR REPLACE FUNCTION public.purge_imported_reception_tickets(
  p_hours integer,
  p_dry_run boolean DEFAULT true
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff timestamptz;
  v_count integer := 0;
  v_allowed boolean;
BEGIN
  IF p_hours NOT IN (4, 8, 12) THEN
    RAISE EXCEPTION 'Plage horaire invalide (4, 8 ou 12 heures)';
  END IF;

  SELECT public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.role_permissions rp
        JOIN public.user_roles ur ON ur.role = rp.role
        WHERE ur.user_id = auth.uid()
          AND rp.module = 'reception_global'
          AND rp.can_delete
      )
    INTO v_allowed;

  IF NOT COALESCE(v_allowed, false) THEN
    RAISE EXCEPTION 'Accès refusé — droit de suppression requis';
  END IF;

  v_cutoff := now() - make_interval(hours => p_hours);

  SELECT count(*) INTO v_count
  FROM public.reception_tickets t
  WHERE t.statut = 'pese_importe'
    AND t.created_at >= v_cutoff;

  IF p_dry_run OR v_count = 0 THEN
    RETURN v_count;
  END IF;

  PERFORM set_config('prodintime.bypass_lock', 'on', true);

  DELETE FROM public.reception_weighings w
  USING public.reception_tickets t
  WHERE w.ticket_id = t.id
    AND t.statut = 'pese_importe'
    AND t.created_at >= v_cutoff;

  DELETE FROM public.reception_tickets t
  WHERE t.statut = 'pese_importe'
    AND t.created_at >= v_cutoff;

  INSERT INTO public.audit_logs (
    action, entity_type, entity_id, actor_id, reason, old_values
  ) VALUES (
    'bulk_delete_imported', 'reception_ticket', gen_random_uuid(), auth.uid(),
    format('Suppression forcée de %s ticket(s) importé(s) — %s dernières heures', v_count, p_hours),
    jsonb_build_object('hours', p_hours, 'deleted_count', v_count, 'cutoff', v_cutoff)
  );

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.purge_imported_reception_tickets(integer, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.purge_imported_reception_tickets(integer, boolean) TO authenticated;