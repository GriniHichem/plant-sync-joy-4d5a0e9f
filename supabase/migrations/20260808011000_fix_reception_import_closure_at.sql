-- Ensure imported tickets have a valid cloture_at for KPI calculations
-- The cloture_at is derived from date_ticket + heure_fin (or heure_debut, or 12:00)
-- It must be cast to timestamptz (UTC) for consistent period filtering

CREATE OR REPLACE FUNCTION public.import_reception_tickets(rows jsonb, on_conflict text DEFAULT 'ignore'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r jsonb;
  idx int := 0;
  imported int := 0; replaced int := 0; skipped int := 0;
  errors jsonb := '[]'::jsonb;
  v_numero text; v_date date; v_sup text; v_prod text;
  v_abat numeric; v_brut numeric; v_net numeric;
  v_hd time; v_hf time; v_comment text;
  s_date text; s_hd text; s_hf text; s_brut text; s_net text; s_abat text;
  v_code_saisi text;
  sup_id uuid; prod_id uuid; camp_id uuid;
  existing_id uuid;
  new_ticket_id uuid;
  weighed_ts timestamptz;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'responsable_si')) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF on_conflict NOT IN ('ignore','replace') THEN
    on_conflict := 'ignore';
  END IF;

  PERFORM set_config('prodintime.bypass_lock','on', true);

  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(rows,'[]'::jsonb)) LOOP
    idx := idx + 1;
    v_numero := NULLIF(btrim(r->>'numero'),'');
    v_sup    := NULLIF(btrim(r->>'supplier_code'),'');
    v_prod   := NULLIF(btrim(r->>'product_code'),'');
    v_comment:= NULLIF(btrim(r->>'commentaire'),'');
    v_code_saisi := NULLIF(btrim(r->>'numero_systeme'),'');
    s_date   := NULLIF(btrim(r->>'date_ticket'),'');
    
    v_date := NULL;
    IF s_date IS NOT NULL THEN
      -- Prioritize French format DD/MM/YYYY
      BEGIN 
        v_date := to_date(s_date, 'DD/MM/YYYY'); 
      EXCEPTION WHEN OTHERS THEN 
        -- Fallback to standard ISO or other formats if failing
        BEGIN v_date := s_date::date; EXCEPTION WHEN OTHERS THEN NULL; END;
      END;
      
      IF v_date IS NULL THEN
        BEGIN v_date := to_date(s_date, 'DD-MM-YYYY'); EXCEPTION WHEN OTHERS THEN NULL; END;
      END IF;
    END IF;

    IF v_date IS NULL THEN
      errors := errors || jsonb_build_object('row', idx, 'numero', v_numero, 'motif', format('Date invalide (%s). Format attendu: JJ/MM/AAAA', s_date));
      CONTINUE;
    END IF;

    s_brut := COALESCE(NULLIF(btrim(r->>'poids_brut'),''), NULLIF(btrim(r->>'poids_brut_kg'),''));
    s_net  := NULLIF(btrim(r->>'poids_net'),'');
    s_abat := COALESCE(NULLIF(btrim(r->>'taux_abattement'),''), '0');

    BEGIN v_abat := replace(replace(s_abat, ' ', ''), ',', '.')::numeric; EXCEPTION WHEN OTHERS THEN v_abat := NULL; END;

    IF s_brut IS NOT NULL THEN
      BEGIN v_brut := replace(replace(s_brut, ' ', ''), ',', '.')::numeric; EXCEPTION WHEN OTHERS THEN v_brut := NULL; END;
    ELSIF s_net IS NOT NULL THEN
      BEGIN v_net := replace(replace(s_net, ' ', ''), ',', '.')::numeric; EXCEPTION WHEN OTHERS THEN v_net := NULL; END;
      v_brut := v_net;
      v_abat := 0;
    END IF;

    IF v_numero IS NULL OR v_sup IS NULL OR v_prod IS NULL THEN
      errors := errors || jsonb_build_object('row', idx, 'numero', v_numero, 'motif', 'Champs obligatoires manquants (N°/Fournisseur/Produit)');
      CONTINUE;
    END IF;

    IF v_brut IS NULL OR v_brut <= 0 THEN
      errors := errors || jsonb_build_object('row', idx, 'numero', v_numero, 'motif', format('Poids invalide (%s)', COALESCE(s_brut, s_net)));
      CONTINUE;
    END IF;

    IF v_abat IS NULL OR v_abat < 0 OR v_abat > 100 THEN
      errors := errors || jsonb_build_object('row', idx, 'numero', v_numero, 'motif', format('Taux abattement hors [0,100] (%s)', s_abat));
      CONTINUE;
    END IF;

    s_hd := NULLIF(btrim(r->>'heure_debut'),'');
    s_hf := NULLIF(btrim(r->>'heure_fin'),'');
    IF s_hd IS NOT NULL THEN
      s_hd := regexp_replace(s_hd, '[^0-9:]', '', 'g');
      BEGIN v_hd := s_hd::time; EXCEPTION WHEN OTHERS THEN v_hd := NULL; END;
    END IF;
    IF s_hf IS NOT NULL THEN
      s_hf := regexp_replace(s_hf, '[^0-9:]', '', 'g');
      BEGIN v_hf := s_hf::time; EXCEPTION WHEN OTHERS THEN v_hf := NULL; END;
    END IF;

    SELECT id INTO sup_id FROM public.reception_suppliers WHERE lower(code) = lower(v_sup) LIMIT 1;
    IF sup_id IS NULL THEN
      errors := errors || jsonb_build_object('row', idx, 'numero', v_numero, 'motif', format('Fournisseur %s introuvable', v_sup));
      CONTINUE;
    END IF;

    SELECT id INTO prod_id FROM public.reception_products WHERE lower(code) = lower(v_prod) LIMIT 1;
    IF prod_id IS NULL THEN
      errors := errors || jsonb_build_object('row', idx, 'numero', v_numero, 'motif', format('Produit %s introuvable', v_prod));
      CONTINUE;
    END IF;

    SELECT id INTO camp_id FROM public.reception_campaigns
      WHERE product_id = prod_id AND actif = true
        AND v_date BETWEEN date_debut AND date_fin
      ORDER BY is_default DESC, date_debut DESC LIMIT 1;
    IF camp_id IS NULL THEN
      SELECT id INTO camp_id FROM public.reception_campaigns
        WHERE product_id = prod_id AND is_default = true LIMIT 1;
    END IF;
    IF camp_id IS NULL THEN
      SELECT id INTO camp_id FROM public.reception_campaigns
        WHERE product_id = prod_id ORDER BY date_debut DESC LIMIT 1;
    END IF;
    IF camp_id IS NULL THEN
      errors := errors || jsonb_build_object('row', idx, 'numero', v_numero, 'motif', 'Aucune campagne pour ce produit');
      CONTINUE;
    END IF;

    -- Standardize timestamp for both weighing and ticket closure
    weighed_ts := (v_date + COALESCE(v_hf, v_hd, '12:00'::time))::timestamp AT TIME ZONE 'UTC';

    SELECT id INTO existing_id FROM public.reception_tickets WHERE numero = v_numero;
    IF existing_id IS NOT NULL THEN
      IF on_conflict = 'ignore' THEN
        skipped := skipped + 1;
        errors := errors || jsonb_build_object('row', idx, 'numero', v_numero, 'motif', 'Doublon ignoré');
        CONTINUE;
      ELSE
        UPDATE public.reception_tickets SET
          campaign_id      = camp_id,
          product_id       = prod_id,
          supplier_id      = sup_id,
          date_ticket      = v_date,
          heure_debut      = v_hd,
          heure_fin        = v_hf,
          taux_abattement  = v_abat,
          commentaire      = v_comment,
          cloture_at       = weighed_ts -- Ensure cloture_at is updated for KPIs
        WHERE id = existing_id;

        IF EXISTS (SELECT 1 FROM public.reception_weighings WHERE ticket_id = existing_id) THEN
          UPDATE public.reception_weighings SET
            poids_brut_kg            = v_brut,
            taux_abattement_snapshot = v_abat,
            weighed_at               = weighed_ts,
            code_saisi               = COALESCE(v_code_saisi, code_saisi)
          WHERE ticket_id = existing_id;
        ELSE
          INSERT INTO public.reception_weighings(
            ticket_id, poids_brut_kg, taux_abattement_snapshot, weighed_by, weighed_at, code_saisi
          ) VALUES (existing_id, v_brut, v_abat, auth.uid(), weighed_ts, v_code_saisi);
        END IF;

        replaced := replaced + 1;
        CONTINUE;
      END IF;
    END IF;

    INSERT INTO public.reception_tickets(
      numero, campaign_id, product_id, supplier_id, date_ticket,
      heure_debut, heure_fin, taux_abattement, commentaire, statut, created_by, cloture_at
    ) VALUES (
      v_numero, camp_id, prod_id, sup_id, v_date,
      v_hd, v_hf, v_abat, v_comment, 'pese_importe', auth.uid(), weighed_ts
    ) RETURNING id INTO new_ticket_id;

    INSERT INTO public.reception_weighings(
      ticket_id, poids_brut_kg, taux_abattement_snapshot, weighed_by, weighed_at, code_saisi
    ) VALUES (
      new_ticket_id, v_brut, v_abat, auth.uid(), weighed_ts, v_code_saisi
    );

    imported := imported + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'total',   idx,
    'success', imported + replaced,
    'failed',  jsonb_array_length(errors) - skipped,
    'extra',   jsonb_build_object('importés', imported, 'mis à jour', replaced, 'ignorés', skipped),
    'errors',  errors
  );
END; $function$;

-- One-time fix for existing imported tickets missing cloture_at
-- This logic assumes UTC as confirmed previously
UPDATE public.reception_tickets t
SET cloture_at = (t.date_ticket + COALESCE(t.heure_fin, t.heure_debut, '12:00'::time))::timestamp AT TIME ZONE 'UTC'
WHERE t.statut = 'pese_importe' AND t.cloture_at IS NULL;
