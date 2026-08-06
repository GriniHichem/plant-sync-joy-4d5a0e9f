-- 1) Stats : durée moyenne uniquement sur tickets avec heure début ET fin, + moyennes
CREATE OR REPLACE FUNCTION public.reception_global_stats(
  p_from date DEFAULT NULL, p_to date DEFAULT NULL,
  p_campaign uuid DEFAULT NULL, p_supplier uuid DEFAULT NULL, p_product uuid DEFAULT NULL,
  p_etat text DEFAULT NULL, p_conformite text DEFAULT NULL, p_q text DEFAULT NULL,
  p_from_ts timestamp without time zone DEFAULT NULL, p_to_ts timestamp without time zone DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH s AS (
    SELECT v.*
    FROM public.v_reception_global v
    WHERE (p_from IS NULL OR v.date_ticket >= p_from)
      AND (p_to IS NULL OR v.date_ticket <= p_to)
      AND (p_from_ts IS NULL OR (v.date_ticket + COALESCE(v.heure_debut, '00:00'::time)) >= p_from_ts)
      AND (p_to_ts IS NULL OR (v.date_ticket + COALESCE(v.heure_debut, '00:00'::time)) <= p_to_ts)
      AND (p_campaign IS NULL OR v.campaign_id = p_campaign)
      AND (p_supplier IS NULL OR v.supplier_id = p_supplier)
      AND (p_product IS NULL OR v.product_id = p_product)
      AND (p_etat IS NULL OR v.etat_pesee = p_etat)
      AND (
        p_conformite IS NULL
        OR (p_conformite = 'conforme' AND COALESCE(v.duree_minutes, 0) <= 20)
        OR (p_conformite = 'hors_delai' AND v.duree_minutes > 20)
      )
      AND (
        p_q IS NULL OR p_q = ''
        OR v.numero ILIKE '%' || p_q || '%'
        OR COALESCE(v.fournisseur, '') ILIKE '%' || p_q || '%'
        OR COALESCE(v.produit, '') ILIKE '%' || p_q || '%'
        OR COALESCE(v.wilaya, '') ILIKE '%' || p_q || '%'
        OR COALESCE(v.region, '') ILIKE '%' || p_q || '%'
      )
  )
  SELECT json_build_object(
    'total', COUNT(*),
    'pese', COUNT(*) FILTER (WHERE s.etat_pesee = 'pese'),
    'aPeser', COUNT(*) FILTER (WHERE s.etat_pesee <> 'pese'),
    'hd', COUNT(*) FILTER (WHERE s.duree_minutes > 20),
    'brut', COALESCE(SUM(s.poids_brut_kg), 0),
    'abat', COALESCE(SUM(s.poids_abattement_kg), 0),
    'net', COALESCE(SUM(s.poids_net_kg), 0),
    -- durée moyenne : uniquement les tickets avec heure_debut ET heure_fin renseignées
    'moyDuree', AVG(s.duree_minutes) FILTER (
        WHERE s.heure_debut IS NOT NULL AND s.heure_fin IS NOT NULL AND s.duree_minutes IS NOT NULL),
    'nbDuree', COUNT(*) FILTER (
        WHERE s.heure_debut IS NOT NULL AND s.heure_fin IS NOT NULL AND s.duree_minutes IS NOT NULL),
    -- taux d'abattement moyen pondéré = abattement total / brut total * 100
    'tauxAbatMoyen', CASE WHEN COALESCE(SUM(s.poids_brut_kg),0) > 0
        THEN SUM(s.poids_abattement_kg) / SUM(s.poids_brut_kg) * 100 END,
    -- nombre de jours distincts (campagne / période en cours)
    'jours', COUNT(DISTINCT s.date_ticket),
    'moyNetJour', CASE WHEN COUNT(DISTINCT s.date_ticket) > 0
        THEN COALESCE(SUM(s.poids_net_kg),0) / COUNT(DISTINCT s.date_ticket) END
  )
  FROM s;
$function$;

GRANT EXECUTE ON FUNCTION public.reception_global_stats(date,date,uuid,uuid,uuid,text,text,text,timestamp,timestamp) TO authenticated, anon, service_role;

-- 2) Le verrou photos doit respecter le bypass utilisé par les fonctions de maintenance
CREATE OR REPLACE FUNCTION public.reception_photos_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE s text; bypass text;
BEGIN
  bypass := current_setting('prodintime.bypass_lock', true);
  IF bypass = 'on' THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT statut INTO s FROM public.reception_tickets WHERE id = COALESCE(NEW.ticket_id, OLD.ticket_id);
  IF s = 'cloture' THEN RAISE EXCEPTION 'Ticket clôturé — photos verrouillées'; END IF;
  RETURN COALESCE(NEW, OLD);
END; $function$;

-- 3) Renumérotation : admin = accès total (même ticket pesé), autres rôles = ticket non pesé
CREATE OR REPLACE FUNCTION public.reception_rename_ticket(p_ticket_id uuid, p_new_numero text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket record;
  v_new text := trim(coalesce(p_new_numero, ''));
  v_actor text;
  v_admin boolean;
BEGIN
  v_admin := has_role(auth.uid(),'admin') OR has_role(auth.uid(),'responsable_si');
  IF NOT (v_admin
       OR has_role(auth.uid(),'directeur_qualite') OR has_role(auth.uid(),'responsable_controle_qualite')
       OR has_role(auth.uid(),'controleur_qualite') OR has_role(auth.uid(),'agent_pont_bascule')
       OR has_role(auth.uid(),'agreeur')) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF v_new = '' THEN RAISE EXCEPTION 'Numéro de ticket requis'; END IF;

  SELECT * INTO v_ticket FROM public.reception_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket introuvable'; END IF;
  IF v_new = v_ticket.numero THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM public.reception_tickets WHERE numero = v_new) THEN
    RAISE EXCEPTION 'Le numéro % est déjà utilisé', v_new;
  END IF;

  IF NOT v_admin AND EXISTS (SELECT 1 FROM public.reception_weighings w WHERE w.ticket_id = p_ticket_id) THEN
    RAISE EXCEPTION 'Ticket déjà pesé — renumérotation interdite';
  END IF;

  v_actor := public.reception_actor_label();
  PERFORM set_config('prodintime.bypass_lock', 'on', true);

  UPDATE public.reception_tickets
     SET numero = v_new,
         commentaire = concat_ws(E'\n', nullif(commentaire,''),
           format('Numéro ticket modifié de %s à %s le %s par %s',
                  v_ticket.numero, v_new,
                  to_char(now(),'DD/MM/YYYY HH24:MI'), coalesce(v_actor,'?')))
   WHERE id = p_ticket_id;

  INSERT INTO public.audit_logs (action, entity_type, entity_id, actor_id, reason, old_values, new_values)
  VALUES ('renumber', 'reception_ticket', p_ticket_id, auth.uid(),
          'Renumérotation ticket',
          jsonb_build_object('numero', v_ticket.numero),
          jsonb_build_object('numero', v_new));
END;
$function$;

-- 4) Transfert photos : trace aussi côté ticket source si conservé
CREATE OR REPLACE FUNCTION public.reception_transfer_photos(p_source_id uuid, p_target_id uuid, p_delete_source boolean DEFAULT true)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_src record;
  v_tgt record;
  v_actor text;
  v_moved integer := 0;
  v_slot smallint;
  r record;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(),'responsable_si')) THEN
    RAISE EXCEPTION 'Accès refusé — administrateur requis';
  END IF;
  IF p_source_id = p_target_id THEN RAISE EXCEPTION 'Tickets source et cible identiques'; END IF;

  SELECT * INTO v_src FROM public.reception_tickets WHERE id = p_source_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket source introuvable'; END IF;
  SELECT * INTO v_tgt FROM public.reception_tickets WHERE id = p_target_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket cible introuvable'; END IF;

  v_actor := public.reception_actor_label();
  PERFORM set_config('prodintime.bypass_lock', 'on', true);

  FOR r IN SELECT * FROM public.reception_ticket_photos WHERE ticket_id = p_source_id ORDER BY slot LOOP
    SELECT g.s INTO v_slot FROM generate_series(1,3) AS g(s)
      WHERE NOT EXISTS (SELECT 1 FROM public.reception_ticket_photos t
                        WHERE t.ticket_id = p_target_id AND t.slot = g.s)
      ORDER BY g.s LIMIT 1;
    IF v_slot IS NULL THEN
      RAISE EXCEPTION 'Le ticket cible a déjà 3 photos — transfert impossible';
    END IF;
    UPDATE public.reception_ticket_photos
       SET ticket_id = p_target_id, slot = v_slot
     WHERE id = r.id;
    v_moved := v_moved + 1;
  END LOOP;

  UPDATE public.reception_tickets
     SET commentaire = concat_ws(E'\n', nullif(commentaire,''),
       format('%s photo(s) transférée(s) depuis le ticket %s le %s par %s',
              v_moved, v_src.numero, to_char(now(),'DD/MM/YYYY HH24:MI'), coalesce(v_actor,'?')))
   WHERE id = p_target_id;

  INSERT INTO public.audit_logs (action, entity_type, entity_id, actor_id, reason, old_values, new_values)
  VALUES ('photo_transfer', 'reception_ticket', p_target_id, auth.uid(),
          format('Transfert de %s photo(s) depuis %s', v_moved, v_src.numero),
          jsonb_build_object('source_ticket', v_src.numero),
          jsonb_build_object('target_ticket', v_tgt.numero, 'photos', v_moved));

  IF p_delete_source THEN
    DELETE FROM public.reception_ticket_photos WHERE ticket_id = p_source_id;
    DELETE FROM public.reception_weighings WHERE ticket_id = p_source_id;
    DELETE FROM public.reception_tickets WHERE id = p_source_id;
    INSERT INTO public.audit_logs (action, entity_type, entity_id, actor_id, reason, old_values)
    VALUES ('admin_delete', 'reception_ticket', p_source_id, auth.uid(),
            format('Suppression après transfert des photos vers %s', v_tgt.numero),
            to_jsonb(v_src));
  ELSE
    UPDATE public.reception_tickets
       SET commentaire = concat_ws(E'\n', nullif(commentaire,''),
         format('%s photo(s) transférée(s) vers le ticket %s le %s par %s',
                v_moved, v_tgt.numero, to_char(now(),'DD/MM/YYYY HH24:MI'), coalesce(v_actor,'?')))
     WHERE id = p_source_id;
  END IF;

  RETURN v_moved;
END;
$function$;