CREATE OR REPLACE FUNCTION public.import_reception_tickets(
  rows jsonb,
  on_conflict text DEFAULT 'ignore'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r jsonb;
  idx int := 0;
  imported int := 0;
  replaced int := 0;
  skipped int := 0;
  errors jsonb := '[]'::jsonb;
  v_numero text;
  v_date date;
  v_sup text;
  v_prod text;
  v_abat numeric;
  v_brut numeric;
  v_net numeric;
  v_hd time;
  v_hf time;
  v_comment text;
  s_date text;
  s_norm text;
  s_hd text;
  s_hf text;
  s_brut text;
  s_net text;
  s_abat text;
  v_code_saisi text;
  sup_id uuid;
  prod_id uuid;
  camp_id uuid;
  existing_id uuid;
  new_ticket_id uuid;
  weighed_ts timestamptz;
BEGIN
  IF NOT (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'responsable_si')
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF on_conflict NOT IN ('ignore', 'replace') THEN
    on_conflict := 'ignore';
  END IF;

  PERFORM set_config('prodintime.bypass_lock', 'on', true);

  FOR r IN
    SELECT * FROM jsonb_array_elements(COALESCE(rows, '[]'::jsonb))
  LOOP
    idx := idx + 1;

    v_date := NULL;
    v_brut := NULL;
    v_net := NULL;
    v_abat := NULL;
    v_hd := NULL;
    v_hf := NULL;
    s_norm := NULL;

    v_numero := NULLIF(btrim(r->>'numero'), '');
    v_sup := COALESCE(
      NULLIF(btrim(r->>'supplier_code'), ''),
      NULLIF(btrim(r->>'fournisseur'), '')
    );
    v_prod := COALESCE(
      NULLIF(btrim(r->>'product_code'), ''),
      NULLIF(btrim(r->>'produit'), '')
    );
    v_comment := NULLIF(btrim(r->>'commentaire'), '');
    v_code_saisi := NULLIF(btrim(r->>'numero_systeme'), '');
    s_date := COALESCE(
      NULLIF(btrim(r->>'date_ticket'), ''),
      NULLIF(btrim(r->>'date'), '')
    );

    -- Normalisation : espaces (y compris insécables) supprimés, points et
    -- antislash ramenés à '/', partie horaire ISO ignorée.
    IF s_date IS NOT NULL THEN
      s_norm := replace(regexp_replace(s_date, '[[:space:]]', '', 'g'), chr(160), '');
      s_norm := split_part(s_norm, 'T', 1);
      s_norm := replace(replace(s_norm, '.', '/'), '\', '/');
      s_norm := regexp_replace(s_norm, '[-/]', '-', 'g');
    END IF;

    IF s_norm ~ '^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}$' THEN
      BEGIN
        v_date := make_date(
          split_part(s_norm, '-', 1)::int,
          split_part(s_norm, '-', 2)::int,
          split_part(s_norm, '-', 3)::int
        );
      EXCEPTION WHEN OTHERS THEN
        v_date := NULL;
      END;
    ELSIF s_norm ~ '^[0-9]{1,2}-[0-9]{1,2}-[0-9]{4}$' THEN
      BEGIN
        v_date := make_date(
          split_part(s_norm, '-', 3)::int,
          split_part(s_norm, '-', 2)::int,
          split_part(s_norm, '-', 1)::int
        );
      EXCEPTION WHEN OTHERS THEN
        v_date := NULL;
      END;
    ELSIF s_norm ~ '^[0-9]{1,2}-[0-9]{1,2}-[0-9]{2}$' THEN
      BEGIN
        v_date := make_date(
          2000 + split_part(s_norm, '-', 3)::int,
          split_part(s_norm, '-', 2)::int,
          split_part(s_norm, '-', 1)::int
        );
      EXCEPTION WHEN OTHERS THEN
        v_date := NULL;
      END;
    ELSIF s_norm ~ '^[0-9]{8}$' THEN
      BEGIN
        v_date := make_date(
          substr(s_norm, 1, 4)::int,
          substr(s_norm, 5, 2)::int,
          substr(s_norm, 7, 2)::int
        );
      EXCEPTION WHEN OTHERS THEN
        v_date := NULL;
      END;
    END IF;

    IF v_date IS NULL THEN
      errors := errors || jsonb_build_object(
        'row', idx,
        'numero', v_numero,
        'motif', format('Date invalide (%s) — formats acceptés : JJ/MM/AAAA ou AAAA-MM-JJ', COALESCE(s_date, 'vide'))
      );
      CONTINUE;
    END IF;

    s_brut := COALESCE(
      NULLIF(btrim(r->>'poids_brut'), ''),
      NULLIF(btrim(r->>'poids_brut_kg'), '')
    );
    s_net := NULLIF(btrim(r->>'poids_net'), '');
    s_abat := COALESCE(NULLIF(btrim(r->>'taux_abattement'), ''), '0');

    BEGIN
      v_abat := replace(replace(s_abat, ' ', ''), ',', '.')::numeric;
    EXCEPTION WHEN OTHERS THEN
      v_abat := NULL;
    END;

    IF s_brut IS NOT NULL THEN
      BEGIN
        v_brut := replace(replace(s_brut, ' ', ''), ',', '.')::numeric;
      EXCEPTION WHEN OTHERS THEN
        v_brut := NULL;
      END;
    ELSIF s_net IS NOT NULL THEN
      BEGIN
        v_net := replace(replace(s_net, ' ', ''), ',', '.')::numeric;
      EXCEPTION WHEN OTHERS THEN
        v_net := NULL;
      END;
      v_brut := v_net;
      v_abat := 0;
    END IF;

    IF v_numero IS NULL OR v_sup IS NULL OR v_prod IS NULL THEN
      errors := errors || jsonb_build_object(
        'row', idx,
        'numero', v_numero,
        'motif', 'Champs obligatoires manquants (N°/Fournisseur/Produit)'
      );
      CONTINUE;
    END IF;

    IF v_brut IS NULL OR v_brut <= 0 THEN
      errors := errors || jsonb_build_object(
        'row', idx,
        'numero', v_numero,
        'motif', format('Poids invalide (%s)', COALESCE(s_brut, s_net, 'vide'))
      );
      CONTINUE;
    END IF;

    IF v_abat IS NULL OR v_abat < 0 OR v_abat > 100 THEN
      errors := errors || jsonb_build_object(
        'row', idx,
        'numero', v_numero,
        'motif', format('Taux abattement hors [0,100] (%s)', s_abat)
      );
      CONTINUE;
    END IF;

    s_hd := NULLIF(btrim(r->>'heure_debut'), '');
    s_hf := NULLIF(btrim(r->>'heure_fin'), '');

    IF s_hd IS NOT NULL THEN
      s_hd := regexp_replace(s_hd, '[^0-9:]', '', 'g');
      BEGIN
        v_hd := s_hd::time;
      EXCEPTION WHEN OTHERS THEN
        v_hd := NULL;
      END;
    END IF;

    IF s_hf IS NOT NULL THEN
      s_hf := regexp_replace(s_hf, '[^0-9:]', '', 'g');
      BEGIN
        v_hf := s_hf::time;
      EXCEPTION WHEN OTHERS THEN
        v_hf := NULL;
      END;
    END IF;

    SELECT id INTO sup_id
    FROM public.reception_suppliers
    WHERE lower(code) = lower(v_sup)
    LIMIT 1;

    IF sup_id IS NULL THEN
      SELECT id INTO sup_id
      FROM public.reception_suppliers
      WHERE lower(nom) = lower(v_sup)
      LIMIT 1;
    END IF;

    IF sup_id IS NULL THEN
      errors := errors || jsonb_build_object(
        'row', idx,
        'numero', v_numero,
        'motif', format('Fournisseur %s introuvable', v_sup)
      );
      CONTINUE;
    END IF;

    SELECT id INTO prod_id
    FROM public.reception_products
    WHERE lower(code) = lower(v_prod)
    LIMIT 1;

    IF prod_id IS NULL THEN
      SELECT id INTO prod_id
      FROM public.reception_products
      WHERE lower(designation) = lower(v_prod)
      LIMIT 1;
    END IF;

    IF prod_id IS NULL THEN
      errors := errors || jsonb_build_object(
        'row', idx,
        'numero', v_numero,
        'motif', format('Produit %s introuvable', v_prod)
      );
      CONTINUE;
    END IF;

    SELECT id INTO camp_id
    FROM public.reception_campaigns
    WHERE product_id = prod_id
      AND actif = true
      AND v_date BETWEEN date_debut AND date_fin
    ORDER BY is_default DESC, date_debut DESC
    LIMIT 1;

    IF camp_id IS NULL THEN
      SELECT id INTO camp_id
      FROM public.reception_campaigns
      WHERE product_id = prod_id
        AND is_default = true
      LIMIT 1;
    END IF;

    IF camp_id IS NULL THEN
      SELECT id INTO camp_id
      FROM public.reception_campaigns
      WHERE product_id = prod_id
      ORDER BY date_debut DESC
      LIMIT 1;
    END IF;

    IF camp_id IS NULL THEN
      errors := errors || jsonb_build_object(
        'row', idx,
        'numero', v_numero,
        'motif', 'Aucune campagne pour ce produit'
      );
      CONTINUE;
    END IF;

    weighed_ts := (v_date + COALESCE(v_hf, v_hd, '12:00'::time))::timestamptz;

    SELECT id INTO existing_id
    FROM public.reception_tickets
    WHERE numero = v_numero;

    IF existing_id IS NOT NULL THEN
      IF on_conflict = 'ignore' THEN
        skipped := skipped + 1;
        errors := errors || jsonb_build_object(
          'row', idx,
          'numero', v_numero,
          'motif', 'Doublon ignoré'
        );
        CONTINUE;
      END IF;

      UPDATE public.reception_tickets
      SET campaign_id = camp_id,
          product_id = prod_id,
          supplier_id = sup_id,
          date_ticket = v_date,
          heure_debut = v_hd,
          heure_fin = v_hf,
          taux_abattement = v_abat,
          commentaire = v_comment
      WHERE id = existing_id;

      IF EXISTS (
        SELECT 1
        FROM public.reception_weighings
        WHERE ticket_id = existing_id
      ) THEN
        UPDATE public.reception_weighings
        SET poids_brut_kg = v_brut,
            taux_abattement_snapshot = v_abat,
            weighed_at = weighed_ts,
            code_saisi = COALESCE(v_code_saisi, code_saisi)
        WHERE ticket_id = existing_id;
      ELSE
        INSERT INTO public.reception_weighings(
          ticket_id, poids_brut_kg, taux_abattement_snapshot, weighed_by, weighed_at, code_saisi
        )
        VALUES (existing_id, v_brut, v_abat, auth.uid(), weighed_ts, v_code_saisi);
      END IF;

      replaced := replaced + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.reception_tickets(
      numero, campaign_id, product_id, supplier_id, date_ticket,
      heure_debut, heure_fin, taux_abattement, commentaire, statut, created_by
    )
    VALUES (
      v_numero, camp_id, prod_id, sup_id, v_date,
      v_hd, v_hf, v_abat, v_comment, 'pese_importe', auth.uid()
    )
    RETURNING id INTO new_ticket_id;

    INSERT INTO public.reception_weighings(
      ticket_id, poids_brut_kg, taux_abattement_snapshot, weighed_by, weighed_at, code_saisi
    )
    VALUES (new_ticket_id, v_brut, v_abat, auth.uid(), weighed_ts, v_code_saisi);

    imported := imported + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'total', idx,
    'success', imported + replaced,
    'failed', jsonb_array_length(errors) - skipped,
    'created', imported,
    'replaced', replaced,
    'skipped', skipped,
    'extra', jsonb_build_object(
      'importés', imported,
      'mis à jour', replaced,
      'ignorés', skipped
    ),
    'errors', errors
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.import_reception_tickets(jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_reception_tickets(jsonb, text) TO authenticated;