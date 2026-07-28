-- Autoriser le contournement du verrou photos pour les opérations de maintenance
CREATE OR REPLACE FUNCTION public.reception_photos_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE s text;
BEGIN
  IF current_setting('prodintime.bypass_lock', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT statut INTO s FROM public.reception_tickets WHERE id = COALESCE(NEW.ticket_id, OLD.ticket_id);
  IF s = 'cloture' THEN RAISE EXCEPTION 'Ticket clôturé — photos verrouillées'; END IF;
  RETURN COALESCE(NEW, OLD);
END; $function$;

CREATE OR REPLACE FUNCTION public.rename_reception_ticket(
  p_ticket_id uuid,
  p_new_numero text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket record;
  v_new text := regexp_replace(COALESCE(p_new_numero, ''), '\s', '', 'g');
  v_actor text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin')
       OR public.has_role(auth.uid(), 'responsable_si')
       OR public.has_role(auth.uid(), 'agent_pont_bascule')) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF v_new = '' THEN RAISE EXCEPTION 'Nouveau numéro requis'; END IF;

  SELECT * INTO v_ticket FROM public.reception_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket introuvable'; END IF;
  IF v_ticket.numero = v_new THEN RAISE EXCEPTION 'Numéro identique à l''actuel'; END IF;

  IF EXISTS (SELECT 1 FROM public.reception_weighings WHERE ticket_id = p_ticket_id) THEN
    RAISE EXCEPTION 'Ticket déjà pesé — numéro non modifiable';
  END IF;

  IF EXISTS (SELECT 1 FROM public.reception_tickets WHERE numero = v_new) THEN
    RAISE EXCEPTION 'Le numéro % est déjà utilisé', v_new;
  END IF;

  SELECT COALESCE(NULLIF(trim(p.nom_complet), ''), 'utilisateur') INTO v_actor
  FROM public.profiles p WHERE p.id = auth.uid();

  UPDATE public.reception_tickets
  SET numero = v_new,
      commentaire = COALESCE(NULLIF(commentaire, '') || E'\n', '')
        || format('Numéro ticket modifié de %s à %s le %s par %s',
                  v_ticket.numero, v_new,
                  to_char(now() AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI'),
                  COALESCE(v_actor, 'utilisateur')),
      updated_at = now()
  WHERE id = p_ticket_id;

  INSERT INTO public.audit_logs (action, entity_type, entity_id, actor_id, reason, old_values, new_values)
  VALUES ('update', 'reception_ticket', p_ticket_id, auth.uid(),
          'Maintenance ticket — changement de numéro',
          jsonb_build_object('numero', v_ticket.numero),
          jsonb_build_object('numero', v_new));
END; $function$;

CREATE OR REPLACE FUNCTION public.transfer_reception_ticket_photos(
  p_source_ticket_id uuid,
  p_target_ticket_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_src record;
  v_tgt record;
  v_moved integer := 0;
  v_actor text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Accès refusé — administrateur requis';
  END IF;
  IF p_source_ticket_id = p_target_ticket_id THEN
    RAISE EXCEPTION 'Les tickets source et cible doivent être différents';
  END IF;

  SELECT * INTO v_src FROM public.reception_tickets WHERE id = p_source_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket source introuvable'; END IF;
  SELECT * INTO v_tgt FROM public.reception_tickets WHERE id = p_target_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket cible introuvable'; END IF;

  PERFORM set_config('prodintime.bypass_lock', 'on', true);

  -- Le ticket cible ne doit pas déjà avoir des photos sur les mêmes emplacements
  IF EXISTS (
    SELECT 1 FROM public.reception_ticket_photos s
    JOIN public.reception_ticket_photos t
      ON t.ticket_id = p_target_ticket_id AND t.slot = s.slot
    WHERE s.ticket_id = p_source_ticket_id
  ) THEN
    RAISE EXCEPTION 'Le ticket cible possède déjà des photos sur les mêmes emplacements';
  END IF;

  UPDATE public.reception_ticket_photos
  SET ticket_id = p_target_ticket_id
  WHERE ticket_id = p_source_ticket_id;
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  SELECT COALESCE(NULLIF(trim(p.nom_complet), ''), 'administrateur') INTO v_actor
  FROM public.profiles p WHERE p.id = auth.uid();

  UPDATE public.reception_tickets
  SET commentaire = COALESCE(NULLIF(commentaire, '') || E'\n', '')
        || format('%s photo(s) transférée(s) depuis le ticket %s (supprimé) le %s par %s',
                  v_moved, v_src.numero,
                  to_char(now() AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI'),
                  COALESCE(v_actor, 'administrateur')),
      updated_at = now()
  WHERE id = p_target_ticket_id;

  DELETE FROM public.reception_weighings WHERE ticket_id = p_source_ticket_id;
  DELETE FROM public.reception_tickets WHERE id = p_source_ticket_id;

  INSERT INTO public.audit_logs (action, entity_type, entity_id, actor_id, reason, old_values, new_values)
  VALUES ('admin_delete', 'reception_ticket', p_source_ticket_id, auth.uid(),
          COALESCE(NULLIF(trim(p_reason), ''), 'Transfert photos + suppression du ticket source'),
          to_jsonb(v_src),
          jsonb_build_object('target_ticket_id', p_target_ticket_id,
                             'target_numero', v_tgt.numero,
                             'photos_transferees', v_moved));

  RETURN v_moved;
END; $function$;

REVOKE ALL ON FUNCTION public.rename_reception_ticket(uuid, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.transfer_reception_ticket_photos(uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rename_reception_ticket(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_reception_ticket_photos(uuid, uuid, text) TO authenticated;