DO $$
DECLARE
    v_user_id uuid;
    v_campaign_id uuid;
    v_supplier_id uuid;
    v_product_id uuid;
    v_base_date timestamp;
    v_ticket_id uuid;
    v_weighing_id uuid;
    v_numero_start int := 9000;
BEGIN
    -- Récupération de l'utilisateur
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    
    -- Récupération ou création d'une campagne par défaut
    SELECT id, product_id INTO v_campaign_id, v_product_id FROM public.reception_campaigns WHERE is_default = true LIMIT 1;
    IF v_campaign_id IS NULL THEN
        SELECT id, product_id INTO v_campaign_id, v_product_id FROM public.reception_campaigns LIMIT 1;
    END IF;
    
    -- Récupération d'un fournisseur agréé
    SELECT id INTO v_supplier_id FROM public.reception_suppliers WHERE agree = true LIMIT 1;
    
    -- Date de référence (aujourd'hui)
    v_base_date := date_trunc('day', now()) + interval '6 hours';

    -- Génération de 12 tickets
    FOR i IN 0..11 LOOP
        v_ticket_id := gen_random_uuid();
        
        INSERT INTO public.reception_tickets (
            id, numero, campaign_id, product_id, supplier_id, 
            statut, created_by, created_at, heure_debut, heure_fin, 
            taux_abattement, commentaire
        ) VALUES (
            v_ticket_id, 
            'TEST-' || (v_numero_start + i),
            v_campaign_id,
            v_product_id,
            v_supplier_id,
            'cloture',
            v_user_id,
            v_base_date + (i * interval '1 hour 30 minutes'),
            (v_base_date + (i * interval '1 hour 30 minutes'))::time,
            (v_base_date + (i * interval '1 hour 30 minutes') + interval '1 hour')::time,
            5.0 + (i * 0.5),
            'Validation KPIs'
        );

        v_weighing_id := gen_random_uuid();
        INSERT INTO public.reception_weighings (
            id, ticket_id, code_pesee, poids_brut_kg, taux_abattement_snapshot,
            weighed_at, created_at, weighed_by
        ) VALUES (
            v_weighing_id,
            v_ticket_id,
            'P-' || (v_numero_start + i),
            20000 + (i * 100), 
            5.0 + (i * 0.5),
            v_base_date + (i * interval '1 hour 30 minutes'),
            v_base_date + (i * interval '1 hour 30 minutes'),
            v_user_id
        );
    END LOOP;
END $$;