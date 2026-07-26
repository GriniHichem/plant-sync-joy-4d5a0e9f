-- Réception F&L :
-- 1) applique les filtres sur l'intégralité des tickets avant pagination ;
-- 2) calcule les KPI sur ce même périmètre complet ;
-- 3) sécurise la saisie manuelle du poids brut aux seuls tickets non pesés.

CREATE OR REPLACE FUNCTION public.filter_reception_tickets(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_etat text DEFAULT NULL,
  p_conformite text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS SETOF public.v_reception_global
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT v.*
  FROM public.v_reception_global AS v
  WHERE (p_date_from IS NULL OR v.date_ticket >= p_date_from)
    AND (p_date_to IS NULL OR v.date_ticket <= p_date_to)
    AND (p_campaign_id IS NULL OR v.campaign_id = p_campaign_id)
    AND (p_supplier_id IS NULL OR v.supplier_id = p_supplier_id)
    AND (p_product_id IS NULL OR v.product_id = p_product_id)
    AND (
      p_etat IS NULL
      OR (p_etat = 'sans_brut' AND v.poids_brut_kg IS NULL)
      OR (p_etat = 'a_peser' AND v.etat_pesee = 'a_peser')
      OR (p_etat = 'pese' AND v.etat_pesee = 'pese')
    )
    AND (
      p_conformite IS NULL
      OR (
        p_conformite = 'conforme'
        AND (v.duree_minutes IS NULL OR v.duree_minutes <= 20)
      )
      OR (
        p_conformite = 'hors_delai'
        AND v.duree_minutes > 20
      )
    )
    AND (
      NULLIF(btrim(p_search), '') IS NULL
      OR lower(COALESCE(v.numero, '')) LIKE '%' || lower(btrim(p_search)) || '%'
      OR lower(COALESCE(v.fournisseur, '')) LIKE '%' || lower(btrim(p_search)) || '%'
      OR lower(COALESCE(v.produit, '')) LIKE '%' || lower(btrim(p_search)) || '%'
      OR lower(COALESCE(v.wilaya, '')) LIKE '%' || lower(btrim(p_search)) || '%'
      OR lower(COALESCE(v.region, '')) LIKE '%' || lower(btrim(p_search)) || '%'
    );
$function$;

REVOKE ALL ON FUNCTION public.filter_reception_tickets(
  date, date, uuid, uuid, uuid, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.filter_reception_tickets(
  date, date, uuid, uuid, uuid, text, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_reception_kpis(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_etat text DEFAULT NULL,
  p_conformite text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  WITH filtered AS (
    SELECT *
    FROM public.filter_reception_tickets(
      p_date_from,
      p_date_to,
      p_campaign_id,
      p_supplier_id,
      p_product_id,
      p_etat,
      p_conformite,
      p_search
    )
  )
  SELECT jsonb_build_object(
    'total', count(*)::integer,
    'brut', COALESCE(sum(poids_brut_kg), 0),
    'net', COALESCE(sum(poids_net_kg), 0),
    'abat', COALESCE(sum(poids_abattement_kg), 0),
    'moy_duree', avg(duree_minutes),
    'hd', count(*) FILTER (WHERE duree_minutes > 20)::integer,
    'pese', count(*) FILTER (WHERE etat_pesee = 'pese')::integer,
    'a_peser', count(*) FILTER (WHERE etat_pesee = 'a_peser')::integer
  )
  FROM filtered;
$function$;

REVOKE ALL ON FUNCTION public.get_reception_kpis(
  date, date, uuid, uuid, uuid, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_reception_kpis(
  date, date, uuid, uuid, uuid, text, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_reception_ticket_poids_brut(
  p_ticket_id uuid,
  p_poids_brut_kg numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket public.reception_tickets%ROWTYPE;
  v_weighing_id uuid;
  v_abat_kg numeric;
  v_net_kg numeric;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'responsable_si'::public.app_role)
    OR public.check_permission(auth.uid(), 'reception_global', 'edit')
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF p_poids_brut_kg IS NULL OR p_poids_brut_kg <= 0 THEN
    RAISE EXCEPTION 'Poids brut invalide';
  END IF;

  SELECT *
  INTO v_ticket
  FROM public.reception_tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket introuvable';
  END IF;

  IF v_ticket.statut NOT IN ('cloture', 'pese_importe') THEN
    RAISE EXCEPTION 'Le ticket doit être clôturé avant la pesée';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.reception_weighings
    WHERE ticket_id = p_ticket_id
  ) THEN
    RAISE EXCEPTION 'Ticket déjà pesé — modification interdite';
  END IF;

  INSERT INTO public.reception_weighings(
    ticket_id,
    poids_brut_kg,
    taux_abattement_snapshot,
    weighed_by,
    weighed_at
  )
  VALUES (
    p_ticket_id,
    p_poids_brut_kg,
    COALESCE(v_ticket.taux_abattement, 0),
    auth.uid(),
    now()
  )
  RETURNING id, poids_abattement_kg, poids_net_kg
  INTO v_weighing_id, v_abat_kg, v_net_kg;

  RETURN jsonb_build_object(
    'weighing_id', v_weighing_id,
    'poids_brut_kg', p_poids_brut_kg,
    'poids_abattement_kg', v_abat_kg,
    'poids_net_kg', v_net_kg
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.set_reception_ticket_poids_brut(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_reception_ticket_poids_brut(uuid, numeric) TO authenticated;
