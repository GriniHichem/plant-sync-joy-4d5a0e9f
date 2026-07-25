CREATE OR REPLACE FUNCTION public.import_reception_poids_bruts(rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r jsonb;
  idx int := 0;
  total int := 0;
  updated int := 0;
  skipped int := 0;
  failed int := 0;
  errors jsonb := '[]'::jsonb;
  v_numero text;
  v_brut_kg numeric;
  v_ticket public.reception_tickets%ROWTYPE;
  v_taux numeric;
  v_net numeric;
  v_abat_kg numeric;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role)
       OR public.has_role(auth.uid(),'responsable_controle_qualite'::app_role)
       OR public.has_role(auth.uid(),'directeur_qualite'::app_role)
       OR public.has_role(auth.uid(),'controleur_qualite'::app_role)
       OR public.has_role(auth.uid(),'agreeur'::app_role)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  PERFORM set_config('prodintime.bypass_lock','on', true);

  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(rows,'[]'::jsonb))
  LOOP
    idx := idx + 1;
    total := total + 1;
    v_numero := NULLIF(trim(COALESCE(r->>'numero','')), '');
    BEGIN
      v_brut_kg := NULLIF(replace(trim(COALESCE(r->>'poids_brut','')), ',', '.'), '')::numeric;
    EXCEPTION WHEN OTHERS THEN
      v_brut_kg := NULL;
    END;

    IF v_numero IS NULL THEN
      failed := failed + 1;
      errors := errors || jsonb_build_object('row', idx, 'motif', 'N° ticket manquant');
      CONTINUE;
    END IF;
    IF v_brut_kg IS NULL OR v_brut_kg < 0 THEN
      failed := failed + 1;
      errors := errors || jsonb_build_object('row', idx, 'numero', v_numero, 'motif', 'Poids brut invalide');
      CONTINUE;
    END IF;

    SELECT * INTO v_ticket FROM public.reception_tickets WHERE numero = v_numero LIMIT 1;
    IF NOT FOUND THEN
      skipped := skipped + 1;
      errors := errors || jsonb_build_object('row', idx, 'numero', v_numero, 'motif', 'Ticket introuvable, ligne ignorée');
      CONTINUE;
    END IF;

    v_taux := COALESCE(v_ticket.taux_abattement, 0);
    v_abat_kg := v_brut_kg * v_taux / 100.0;
    v_net := v_brut_kg - v_abat_kg;

    IF EXISTS (SELECT 1 FROM public.reception_weighings WHERE ticket_id = v_ticket.id) THEN
      UPDATE public.reception_weighings
         SET poids_brut_kg = v_brut_kg,
             taux_abattement_snapshot = v_taux,
             poids_abattement_kg = v_abat_kg,
             poids_net_kg = v_net,
             weighed_at = COALESCE(weighed_at, now()),
             updated_at = now()
       WHERE ticket_id = v_ticket.id;
    ELSE
      INSERT INTO public.reception_weighings
        (ticket_id, poids_brut_kg, taux_abattement_snapshot, poids_abattement_kg, poids_net_kg, weighed_by, weighed_at)
      VALUES
        (v_ticket.id, v_brut_kg, v_taux, v_abat_kg, v_net, auth.uid(), now());
    END IF;

    updated := updated + 1;
  END LOOP;

  PERFORM set_config('prodintime.bypass_lock','off', true);

  RETURN jsonb_build_object(
    'total', total,
    'success', updated,
    'failed', failed + skipped,
    'updated', updated,
    'skipped', skipped,
    'errors', errors
  );
END;
$function$;