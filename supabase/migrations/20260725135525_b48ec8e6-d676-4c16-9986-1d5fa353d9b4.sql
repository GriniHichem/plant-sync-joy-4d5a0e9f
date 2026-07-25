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
  v_raw text;
  v_clean text;
  v_brut_kg numeric;
  v_ticket public.reception_tickets%ROWTYPE;
  v_taux numeric;
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

    v_raw := COALESCE(r->>'poids_brut','');
    -- retire tous les espaces (normaux, insécables), tabulations et apostrophes
    v_clean := regexp_replace(v_raw, '[[:space:]\u00A0\u202F'']', '', 'g');
    v_clean := replace(v_clean, ',', '.');
    v_clean := NULLIF(v_clean, '');

    BEGIN
      v_brut_kg := v_clean::numeric;
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
      errors := errors || jsonb_build_object('row', idx, 'numero', v_numero, 'valeur', v_raw, 'motif', 'Poids brut invalide');
      CONTINUE;
    END IF;

    SELECT * INTO v_ticket FROM public.reception_tickets WHERE numero = v_numero LIMIT 1;
    IF NOT FOUND THEN
      skipped := skipped + 1;
      errors := errors || jsonb_build_object('row', idx, 'numero', v_numero, 'motif', 'Ticket introuvable — ligne ignorée');
      CONTINUE;
    END IF;

    v_taux := COALESCE(v_ticket.taux_abattement, 0);

    IF EXISTS (SELECT 1 FROM public.reception_weighings WHERE ticket_id = v_ticket.id) THEN
      -- Ne met à jour QUE les colonnes non-générées.
      -- poids_net_kg et poids_abattement_kg sont recalculées automatiquement par la BDD.
      UPDATE public.reception_weighings
         SET poids_brut_kg = v_brut_kg,
             taux_abattement_snapshot = v_taux,
             weighed_at = COALESCE(weighed_at, now()),
             updated_at = now()
       WHERE ticket_id = v_ticket.id;
    ELSE
      INSERT INTO public.reception_weighings
        (ticket_id, code_pesee, code_saisi, poids_brut_kg, taux_abattement_snapshot, weighed_by, weighed_at)
      VALUES
        (v_ticket.id,
         'IMP-' || substr(replace(gen_random_uuid()::text,'-',''), 1, 10),
         NULL,
         v_brut_kg, v_taux, auth.uid(), now());
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