CREATE OR REPLACE FUNCTION public.get_reception_kpis(p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_campaign_id uuid DEFAULT NULL::uuid, p_supplier_id uuid DEFAULT NULL::uuid, p_product_id uuid DEFAULT NULL::uuid, p_etat text DEFAULT NULL::text, p_conformite text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_dt_from timestamp without time zone DEFAULT NULL::timestamp without time zone, p_dt_to timestamp without time zone DEFAULT NULL::timestamp without time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH filtered AS (
    SELECT *
    FROM public.filter_reception_tickets(
      p_date_from, p_date_to, p_campaign_id, p_supplier_id, p_product_id,
      p_etat, p_conformite, p_search, p_dt_from, p_dt_to
    )
  )
  SELECT jsonb_build_object(
    'total', count(*)::integer,
    'brut', COALESCE(sum(poids_brut_kg), 0),
    'net', COALESCE(sum(poids_net_kg), 0),
    'abat', COALESCE(sum(poids_abattement_kg), 0),
    'moy_duree', avg(duree_minutes) FILTER (
      WHERE heure_debut IS NOT NULL AND heure_fin IS NOT NULL AND duree_minutes IS NOT NULL
    ),
    'nb_duree', count(*) FILTER (
      WHERE heure_debut IS NOT NULL AND heure_fin IS NOT NULL AND duree_minutes IS NOT NULL
    )::integer,
    'jours', count(DISTINCT date_ticket)::integer,
    'hd', count(*) FILTER (WHERE duree_minutes > 20)::integer,
    'pese', count(*) FILTER (WHERE etat_pesee = 'pese')::integer,
    'a_peser', count(*) FILTER (WHERE etat_pesee = 'a_peser')::integer
  )
  FROM filtered;
$function$;

CREATE OR REPLACE FUNCTION public.rename_reception_ticket(p_ticket_id uuid, p_new_numero text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket record;
  v_new text := regexp_replace(COALESCE(p_new_numero, ''), '\s', '', 'g');
  v_actor text;
  v_is_admin boolean;
  v_weighed boolean;
BEGIN
  v_is_admin := public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'responsable_si');

  IF NOT (v_is_admin
       OR public.has_role(auth.uid(), 'agent_pont_bascule')
       OR public.has_role(auth.uid(), 'agreeur')
       OR public.has_role(auth.uid(), 'controleur_qualite')
       OR public.has_role(auth.uid(), 'responsable_controle_qualite')
       OR public.has_role(auth.uid(), 'directeur_qualite')) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF v_new = '' THEN RAISE EXCEPTION 'Nouveau numéro requis'; END IF;

  SELECT * INTO v_ticket FROM public.reception_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket introuvable'; END IF;
  IF v_ticket.numero = v_new THEN RAISE EXCEPTION 'Numéro identique à l''actuel'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.reception_weighings w
    WHERE w.ticket_id = p_ticket_id AND w.poids_brut_kg IS NOT NULL
  ) INTO v_weighed;

  -- L'administrateur garde un accès total ; les autres rôles ne peuvent
  -- renommer qu'un ticket non encore pesé (poids brut absent).
  IF v_weighed AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Ticket déjà pesé — numéro non modifiable';
  END IF;

  IF EXISTS (SELECT 1 FROM public.reception_tickets WHERE numero = v_new) THEN
    RAISE EXCEPTION 'Le numéro % est déjà utilisé', v_new;
  END IF;

  SELECT COALESCE(NULLIF(trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''), 'utilisateur')
    INTO v_actor
  FROM public.profiles p WHERE p.user_id = auth.uid();

  PERFORM set_config('prodintime.bypass_lock', 'on', true);

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

CREATE OR REPLACE FUNCTION public.transfer_reception_ticket_photos(p_source_ticket_id uuid, p_target_ticket_id uuid, p_reason text DEFAULT NULL::text)
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
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'responsable_si')) THEN
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

  IF EXISTS (
    SELECT 1
    FROM public.reception_ticket_photos s
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

  SELECT COALESCE(NULLIF(trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''), 'administrateur')
    INTO v_actor
  FROM public.profiles p WHERE p.user_id = auth.uid();

  UPDATE public.reception_tickets
  SET commentaire = COALESCE(NULLIF(commentaire, '') || E'\n', '')
        || format('%s photo(s) transférée(s) depuis le ticket %s (supprimé) le %s par %s',
                  v_moved, v_src.numero,
                  to_char(now() AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI'),
                  COALESCE(v_actor, 'administrateur')),
      updated_at = now()
  WHERE id = p_target_ticket_id;

  DELETE FROM public.reception_ticket_orientations WHERE ticket_id = p_source_ticket_id;
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