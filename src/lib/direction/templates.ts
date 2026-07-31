import type { LayoutItem } from "@/lib/direction/widgetCatalog";
import type { DashboardFilters } from "@/lib/direction/filters";

/**
 * Modèles prédéfinis de tableaux de bord Direction.
 * Purement descriptifs : ils ne font qu'assembler des widgets du catalogue.
 */
export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  filters: DashboardFilters;
  widgets: { widgetId: string; w?: number; h?: number }[];
}

/** Place les widgets en grille 12 colonnes en respectant leur taille. */
export function buildLayout(
  widgets: { widgetId: string; w?: number; h?: number }[],
  sizeOf: (id: string) => { w: number; h: number },
): LayoutItem[] {
  let x = 0;
  let y = 0;
  let rowH = 0;
  const out: LayoutItem[] = [];
  widgets.forEach((entry, idx) => {
    const base = sizeOf(entry.widgetId);
    const w = Math.min(12, entry.w ?? base.w);
    const h = entry.h ?? base.h;
    if (x + w > 12) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    out.push({ i: `${entry.widgetId}-${idx}-${Math.random().toString(36).slice(2, 7)}`, widgetId: entry.widgetId, x, y, w, h });
    x += w;
    rowH = Math.max(rowH, h);
  });
  return out;
}

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    id: "vierge",
    name: "Vierge",
    description: "Partir d'une page blanche et composer librement.",
    filters: { period: "7d" },
    widgets: [],
  },
  {
    id: "direction",
    name: "Direction générale",
    description: "Vue transverse : production, qualité, maintenance, stock et réception.",
    filters: { period: "month", compare: true },
    widgets: [
      { widgetId: "prd_production_periode" },
      { widgetId: "prd_trg" },
      { widgetId: "qua_taux_conformite" },
      { widgetId: "mnt_taux_dispo" },
      { widgetId: "prd_production_evolution" },
      { widgetId: "mnt_arrets_machine" },
      { widgetId: "qua_nc_severite" },
      { widgetId: "rec_tonnage_jour" },
    ],
  },
  {
    id: "production",
    name: "Production",
    description: "Suivi de la performance des lignes et des ordres de fabrication.",
    filters: { period: "week", compare: true },
    widgets: [
      { widgetId: "prd_production_periode" },
      { widgetId: "prd_cadence" },
      { widgetId: "prd_taux_rebut" },
      { widgetId: "prd_occupation_lignes" },
      { widgetId: "prd_production_evolution" },
      { widgetId: "prd_arrets_type" },
      { widgetId: "prd_par_ligne" },
      { widgetId: "prd_derniers_of" },
    ],
  },
  {
    id: "qualite",
    name: "Qualité",
    description: "Conformité, non-conformités et contrôles hors limite.",
    filters: { period: "month", compare: true },
    widgets: [
      { widgetId: "qua_taux_conformite" },
      { widgetId: "qua_nc_ouvertes" },
      { widgetId: "qua_hors_limite" },
      { widgetId: "alr_nc_critiques" },
      { widgetId: "qua_nc_jour" },
      { widgetId: "qua_nc_severite" },
      { widgetId: "qua_derniers_controles" },
      { widgetId: "qua_nc_ouvertes_table" },
    ],
  },
  {
    id: "maintenance",
    name: "Maintenance",
    description: "MTBF, MTTR, disponibilité et charge de tickets.",
    filters: { period: "month", compare: true },
    widgets: [
      { widgetId: "mnt_mtbf" },
      { widgetId: "mnt_mttr" },
      { widgetId: "mnt_taux_dispo" },
      { widgetId: "mnt_preventifs_retard" },
      { widgetId: "mnt_tickets_jour" },
      { widgetId: "mnt_arrets_machine" },
      { widgetId: "mnt_derniers_tickets" },
      { widgetId: "alr_preventifs_table" },
    ],
  },
  {
    id: "stock",
    name: "Stock & Inventaire",
    description: "Valeur du stock, ruptures, rotation et avancement d'inventaire.",
    filters: { period: "90d" },
    widgets: [
      { widgetId: "pdr_valeur_stock" },
      { widgetId: "pdr_sous_mini" },
      { widgetId: "pdr_taux_rupture" },
      { widgetId: "pdr_rotation" },
      { widgetId: "pdr_mouvements_jour" },
      { widgetId: "pdr_top_consommations" },
      { widgetId: "alr_pdr_rupture_table" },
      { widgetId: "inv_avancement" },
    ],
  },
  {
    id: "reception",
    name: "Réception F&L",
    description: "Tonnage, abattement, délais et fournisseurs.",
    filters: { period: "month", compare: true },
    widgets: [
      { widgetId: "rec_tonnage_periode" },
      { widgetId: "rec_tickets_traites" },
      { widgetId: "rec_abattement_moyen" },
      { widgetId: "rec_hors_delai" },
      { widgetId: "rec_tonnage_jour" },
      { widgetId: "rec_top_fournisseurs" },
      { widgetId: "rec_par_produit" },
      { widgetId: "rec_consultation" },
    ],
  },
];
