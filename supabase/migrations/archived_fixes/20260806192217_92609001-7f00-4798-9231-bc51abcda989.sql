DO $$
DECLARE
    v_user_id uuid;
    v_camp_id uuid;
    v_prod_id uuid;
    v_supp_id uuid;
    v_ticket_id uuid;
    v_hour int;
    v_minute int;
    v_cloture_at timestamptz;
BEGIN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    SELECT id INTO v_camp_id FROM public.reception_campaigns WHERE actif = true LIMIT 1;
    IF v_camp_id IS NULL THEN SELECT id INTO v_camp_id FROM public.reception_campaigns LIMIT 1; END IF;
    SELECT id INTO v_prod_id FROM public.reception_products LIMIT 1;
    SELECT id INTO v_supp_id FROM public.reception_suppliers LIMIT 1;

    IF v_user_id IS NULL OR v_camp_id IS NULL OR v_prod_id IS NULL OR v_supp_id IS NULL THEN
        RETURN;
    END IF;

    FOR i IN 1..20 LOOP
        v_hour := 14 + (i % 8);
        v_minute := (i * 7) % 60;
        v_cloture_at := (current_date + (v_hour || ' hours')::interval + (v_minute || ' minutes')::interval);

        -- 1. TICKET OUVERT
        INSERT INTO public.reception_tickets (
            numero, campaign_id, product_id, supplier_id,
            created_by, date_ticket, heure_debut, statut, taux_abattement
        ) VALUES (
            'T-V4-' || to_char(now(), 'HH24MISS') || '-' || i,
            v_camp_id, v_prod_id, v_supp_id,
            v_user_id, current_date, (v_hour || ':' || v_minute || ':00')::time,
            'ouvert', 5 + (i % 10)
        ) RETURNING id INTO v_ticket_id;

        -- 2. PHOTOS (Possibles car ticket ouvert)
        INSERT INTO public.reception_ticket_photos (
            ticket_id, storage_path, slot, uploaded_by
        ) VALUES (
            v_ticket_id, 'test/auto_' || i || '.jpg', 1, v_user_id
        );

        -- 3. CLOTURE (Requis pour la pesée)
        UPDATE public.reception_tickets SET 
            statut = 'cloture', 
            cloture_by = v_user_id, 
            cloture_at = v_cloture_at 
        WHERE id = v_ticket_id;

        -- 4. PESEE (Possible car ticket cloturé)
        INSERT INTO public.reception_weighings (
            ticket_id, poids_brut_kg, weighed_by, weighed_at, taux_abattement_snapshot
        ) VALUES (
            v_ticket_id, 20000 + (i * 100), v_user_id, v_cloture_at, 5 + (i % 10)
        );
    END LOOP;
END $$;
