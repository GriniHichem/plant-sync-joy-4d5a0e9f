-- Update v_reception_global to ensure all needed fields for KPIs are present and correctly typed
-- This view is central to the KPI functions.

CREATE OR REPLACE VIEW public.v_reception_global AS
SELECT 
    rt.id,
    rt.numero_ticket,
    rt.numero_systeme,
    rt.created_at,
    rt.cloture_at,
    rt.status,
    rt.created_by,
    rt.cloture_by,
    rt.supplier_id,
    rs.nom AS fournisseur,
    rt.campaign_id,
    rc.nom AS campagne,
    rt.product_id,
    rp.nom AS produit,
    rt.wilaya,
    rt.region,
    rt.etat_pesee,
    COALESCE(rt.poids_brut_kg, 0) as poids_brut_kg,
    COALESCE(rt.poids_net_kg, 0) as poids_net_kg,
    COALESCE(rt.poids_abattement_kg, 0) as poids_abattement_kg,
    rt.photo_url,
    rt.observations
FROM 
    public.reception_tickets rt
LEFT JOIN public.reception_suppliers rs ON rt.supplier_id = rs.id
LEFT JOIN public.reception_campaigns rc ON rt.campaign_id = rc.id
LEFT JOIN public.reception_products rp ON rt.product_id = rp.id;

GRANT SELECT ON public.v_reception_global TO authenticated, service_role;
