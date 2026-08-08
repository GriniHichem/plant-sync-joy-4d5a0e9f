-- SUJET : Réception F&L – Correction des alias dans v_reception_global pour les KPIs
-- La vue v_reception_global doit exposer les colonnes attendues par get_reception_qualitative_kpis.
-- On s'assure que poids_abattement_kg est bien calculé ou mappé.

CREATE OR REPLACE VIEW public.v_reception_global AS
SELECT 
    t.id,
    t.numero,
    t.code_saisi,
    t.date_ticket,
    t.heure_debut,
    t.heure_fin,
    t.taux_abattement,
    t.commentaire,
    t.statut,
    t.created_at,
    t.cloture_at,
    t.created_by,
    t.cloture_by,
    t.campaign_id,
    c.libelle as campagne,
    t.supplier_id,
    s.nom as fournisseur,
    s.code as code_fournisseur,
    t.product_id,
    p.designation as produit,
    -- Poids et calculs
    w.poids_brut as poids_brut_kg,
    COALESCE(w.poids_brut * (t.taux_abattement / 100.0), 0) as poids_abattement_kg,
    COALESCE(w.poids_brut * (1 - t.taux_abattement / 100.0), 0) as poids_net_kg,
    -- Métadonnées
    (SELECT count(*) FROM public.reception_ticket_photos WHERE ticket_id = t.id) as nb_photos,
    CASE 
      WHEN w.poids_brut IS NOT NULL THEN 'pese'
      ELSE 'a_peser'
    END as etat_pesee,
    -- Durée
    EXTRACT(EPOCH FROM (
      CASE 
        WHEN t.heure_fin < t.heure_debut THEN (t.heure_fin::time + interval '24 hours') - t.heure_debut::time
        ELSE t.heure_fin::time - t.heure_debut::time
      END
    )) / 60.0 as duree_minutes
FROM public.reception_tickets t
LEFT JOIN public.reception_campaigns c ON t.campaign_id = c.id
LEFT JOIN public.reception_suppliers s ON t.supplier_id = s.id
LEFT JOIN public.reception_products p ON t.product_id = p.id
LEFT JOIN public.reception_weighings w ON t.id = w.ticket_id;

GRANT SELECT ON public.v_reception_global TO authenticated;
