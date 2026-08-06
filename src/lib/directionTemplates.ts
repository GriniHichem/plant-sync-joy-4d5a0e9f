import { DashboardWidget, PeriodPresetId } from "@/lib/directionWidgets";

/** Modèles prédéfinis de dashboards (couche visualisation uniquement). */

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  period: PeriodPresetId;
  columns: 1 | 2 | 3 | 4;
  widgets: Omit<DashboardWidget, "uid">[];
}

const kpi = (widgetId: string): Omit<DashboardWidget, "uid"> => ({
  widgetId,
  w: 1,
  h: "sm",
  compare: true,
  useGlobalFilters: true,
  align: "left",
  emphasis: "normal",
});
const chart = (widgetId: string, w: DashboardWidget["w"] = 2): Omit<DashboardWidget, "uid"> => ({
  widgetId,
  w,
  h: "md",
  useGlobalFilters: true,
  align: "left",
  emphasis: "normal",
});
const table = (widgetId: string, w: DashboardWidget["w"] = 2): Omit<DashboardWidget, "uid"> => ({
  widgetId,
  w,
  h: "lg",
  useGlobalFilters: true,
  align: "left",
  emphasis: "normal",
});

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    id: "blank",
    name: "Vierge",
    description: "Partir d'une page blanche et composer librement.",
    period: "month",
    columns: 4,
    widgets: [],
  },
  {
    id: "production",
    name: "Dashboard Production",
    description: "TRG, cadence, rebut, arrêts et suivi des OF.",
    period: "month",
    columns: 4,
    widgets: [
      kpi("prd_trg"),
      kpi("prd_taux_rebut"),
      kpi("prd_cadence"),
      kpi("prd_occupation_lignes"),
      chart("prd_production_jour", 2),
      chart("prd_arrets_type", 2),
      chart("prd_arrets_ligne", 2),
      table("prd_of_recents", 2),
    ],
  },
  {
    id: "qualite",
    name: "Dashboard Qualité",
    description: "Conformité, non-conformités, actions et contrôles hors limite.",
    period: "month",
    columns: 4,
    widgets: [
      kpi("qlt_taux_conformite"),
      kpi("qlt_nc_ouvertes"),
      kpi("qlt_reclamations"),
      kpi("qlt_actions_retard"),
      chart("qlt_controles_jour", 2),
      chart("qlt_nc_severite", 2),
      chart("qlt_nc_type", 2),
      table("qlt_hors_limite", 2),
    ],
  },
  {
    id: "maintenance",
    name: "Dashboard Maintenance",
    description: "MTBF, MTTR, disponibilité et charge d'intervention.",
    period: "month",
    columns: 4,
    widgets: [
      kpi("mnt_mtbf"),
      kpi("mnt_mttr"),
      kpi("mnt_disponibilite"),
      kpi("mnt_tickets_ouverts"),
      chart("mnt_tickets_jour", 2),
      chart("mnt_arret_machine", 2),
      chart("mnt_tickets_priorite", 2),
      table("mnt_derniers_tickets", 2),
    ],
  },
  {
    id: "direction",
    name: "Dashboard Direction Générale",
    description: "Vue transverse : production, qualité, maintenance, stock et réception.",
    period: "month",
    columns: 4,
    widgets: [
      kpi("prd_trg"),
      kpi("qlt_taux_conformite"),
      kpi("mnt_disponibilite"),
      kpi("pdr_valeur_stock"),
      kpi("prd_production_periode"),
      kpi("qlt_nc_ouvertes"),
      kpi("rcp_poids_total"),
      kpi("alr_critiques"),
      chart("prd_production_jour", 2),
      chart("qlt_controles_jour", 2),
      chart("rcp_poids_jour", 2),
      chart("alr_par_module", 2),
    ],
  },
  {
    id: "reception",
    name: "Dashboard Réception F&L",
    description: "Tonnage, abattement, rejets et suivi des tickets.",
    period: "month",
    columns: 4,
    widgets: [
      kpi("rcp_tickets"),
      kpi("rcp_poids_total"),
      kpi("rcp_abattement"),
      kpi("rcp_taux_rejet"),
      chart("rcp_poids_jour", 2),
      chart("rcp_par_jour", 2),
      chart("rcp_top_fournisseurs", 2),
      table("rcp_consultation", 2),
    ],
  },
  {
    id: "stock",
    name: "Dashboard Stock & Inventaire",
    description: "Valeur, rotation, ruptures et avancement des inventaires.",
    period: "quarter",
    columns: 4,
    widgets: [
      kpi("pdr_valeur_stock"),
      kpi("pdr_rotation"),
      kpi("pdr_taux_rupture"),
      kpi("pdr_delai_reappro"),
      chart("pdr_mouvements_jour", 2),
      table("pdr_critiques", 2),
      kpi("inv_avancement"),
      kpi("inv_ecarts"),
      table("inv_campagnes_table", 2),
    ],
  },
];
