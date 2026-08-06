
CREATE OR REPLACE FUNCTION public.reception_rename_ticket(p_ticket_id uuid, p_new_numero text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket record;
  v_new text := trim(coalesce(p_new_numero, ''));
  v_actor text;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'responsable_si')
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

  IF EXISTS (SELECT 1 FROM public.reception_weighings w WHERE w.ticket_id = p_ticket_id) THEN
    RAISE EXCEPTION 'Ticket déjà pesé — renumérotation interdite';
  END IF;

  SELECT coalesce(nullif(trim(coalesce(p.nom,'')),''), u.email, auth.uid()::text)
    INTO v_actor
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = auth.uid();

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
$$;

CREATE OR REPLACE FUNCTION public.reception_transfer_photos(
  p_source_id uuid, p_target_id uuid, p_delete_source boolean DEFAULT true)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src record;
  v_tgt record;
  v_actor text;
  v_moved integer := 0;
  v_slot smallint;
  r record;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Accès refusé — administrateur requis';
  END IF;
  IF p_source_id = p_target_id THEN RAISE EXCEPTION 'Tickets source et cible identiques'; END IF;

  SELECT * INTO v_src FROM public.reception_tickets WHERE id = p_source_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket source introuvable'; END IF;
  SELECT * INTO v_tgt FROM public.reception_tickets WHERE id = p_target_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket cible introuvable'; END IF;

  SELECT coalesce(nullif(trim(coalesce(p.nom,'')),''), u.email, auth.uid()::text)
    INTO v_actor
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = auth.uid();

  PERFORM set_config('prodintime.bypass_lock', 'on', true);

  FOR r IN SELECT * FROM public.reception_ticket_photos WHERE ticket_id = p_source_id ORDER BY slot LOOP
    SELECT s INTO v_slot FROM generate_series(1,3) AS g(s)
      WHERE NOT EXISTS (SELECT 1 FROM public.reception_ticket_photos t
                        WHERE t.ticket_id = p_target_id AND t.slot = g.s)
      ORDER BY s LIMIT 1;
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
    DELETE FROM public.reception_weighings WHERE ticket_id = p_source_id;
    DELETE FROM public.reception_tickets WHERE id = p_source_id;
    INSERT INTO public.audit_logs (action, entity_type, entity_id, actor_id, reason, old_values)
    VALUES ('admin_delete', 'reception_ticket', p_source_id, auth.uid(),
            format('Suppression après transfert des photos vers %s', v_tgt.numero),
            to_jsonb(v_src));
  END IF;

  RETURN v_moved;
END;
$$;

REVOKE ALL ON FUNCTION public.reception_rename_ticket(uuid, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.reception_transfer_photos(uuid, uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reception_rename_ticket(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reception_transfer_photos(uuid, uuid, boolean) TO authenticated;
