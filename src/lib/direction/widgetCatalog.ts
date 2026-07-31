import { supabase } from "@/integrations/supabase/client";

/**
 * Catalogue de widgets du Dashboard Direction.
 *
 * Module 100 % lecture seule : chaque widget se contente d'interroger les
 * données existantes (RLS appliquée côté base). Aucun workflow métier,
 * aucune écriture, aucune modification des modules existants.
 */

export type WidgetKind = "kpi" | "chart" | "table";
export type ChartKind = "bar" | "line" | "pie";

export interface WidgetFilters {
  /** Fenêtre glissante en jours (par défaut celle du widget). */
  days?: number;
  /** Nombre de lignes max pour les tableaux. */
  limit?: number;
}

export interface KpiData {
  value: number | string;
  unit?: string;
  hint?: string;
}
export interface ChartPoint {
  label: string;
  value: number;
}
export interface TableData {
  columns: { key: string; label: string }[];
  rows: Record<string, any>[];
}
export type WidgetData = KpiData | ChartPoint[] | TableData;

export interface WidgetDef {
  id: string;
  title: string;
  description: string;
  category: "Maintenance" | "Production" | "Qualité" | "Stock PDR" | "Inventaire" | "Réception";
  kind: WidgetKind;
  chart?: ChartKind;
  /** Module de permission requis pour voir le widget. */
  permissionModule: string;
  /** Le widget accepte-t-il un filtre de période ? */
  supportsPeriod?: boolean;
  defaultDays?: number;
  defaultSize: { w: number; h: number };
  fetch: (filters: WidgetFilters) => Promise<WidgetData>;
}

const sinceIso = (days: number) =>
  new Date(Date.now() - days * 86400_000).toISOString();
const todayIso = () => new Date().toISOString().slice(0, 10);

function countByDay(rows: { date: string; value: number }[], days: number): ChartPoint[] {
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
    buckets.set(d, 0);
  }
  for (const r of rows) {
    const d = String(r.date).slice(0, 10);
    if (buckets.has(d)) buckets.set(d, (buckets.get(d) ?? 0) + Number(r.value || 0));
  }
  return [...buckets.entries()].map(([label, value]) => ({
    label: label.slice(5).split("-").reverse().join("/"),
    value: Math.round(value * 100) / 100,
  }));
}

function groupBy(rows: any[], key: string): ChartPoint[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = String(r[key] ?? "—").replace(/_/g, " ");
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([label, value]) => ({ label, value }));
}

export const WIDGETS: WidgetDef[] = [
  // ===================== Maintenance =====================
  {
    id: "mnt_tickets_ouverts",
    title: "Tickets ouverts",
    description: "Tickets non clôturés (toutes priorités)",
    category: "Maintenance",
    kind: "kpi",
    permissionModule: "tickets",
    defaultSize: { w: 3, h: 4 },
    fetch: async () => {
      const { count } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .neq("statut", "cloture");
      return { value: count ?? 0, hint: "en cours de traitement" };
    },
  },
  {
    id: "mnt_tickets_critiques",
    title: "Tickets critiques",
    description: "Tickets de priorité critique non clôturés",
    category: "Maintenance",
    kind: "kpi",
    permissionModule: "tickets",
    defaultSize: { w: 3, h: 4 },
    fetch: async () => {
      const { count } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("priorite", "critique")
        .neq("statut", "cloture");
      return { value: count ?? 0, hint: "priorité critique" };
    },
  },
  {
    id: "mnt_tickets_statut",
    title: "Répartition des tickets par statut",
    description: "Camembert des tickets sur la période",
    category: "Maintenance",
    kind: "chart",
    chart: "pie",
    permissionModule: "tickets",
    supportsPeriod: true,
    defaultDays: 30,
    defaultSize: { w: 6, h: 9 },
    fetch: async ({ days = 30 }) => {
      const { data } = await supabase
        .from("tickets")
        .select("statut")
        .gte("created_at", sinceIso(days))
        .limit(5000);
      return groupBy(data ?? [], "statut");
    },
  },
  {
    id: "mnt_arrets_machine",
    title: "Temps d'arrêt par machine",
    description: "Minutes d'arrêt cumulées par machine",
    category: "Maintenance",
    kind: "chart",
    chart: "bar",
    permissionModule: "analytiques",
    supportsPeriod: true,
    defaultDays: 30,
    defaultSize: { w: 6, h: 9 },
    fetch: async ({ days = 30 }) => {
      const { data } = await supabase
        .from("production_stops")
        .select("duree_minutes, machines(nom)")
        .gte("heure_debut", sinceIso(days))
        .limit(5000);
      const m = new Map<string, number>();
      for (const r of (data ?? []) as any[]) {
        const k = r.machines?.nom ?? "Non affecté";
        m.set(k, (m.get(k) ?? 0) + Number(r.duree_minutes ?? 0));
      }
      return [...m.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    },
  },
  {
    id: "mnt_derniers_tickets",
    title: "Derniers tickets",
    description: "Tableau des tickets les plus récents",
    category: "Maintenance",
    kind: "table",
    permissionModule: "tickets",
    defaultSize: { w: 6, h: 9 },
    fetch: async ({ limit = 10 }) => {
      const { data } = await supabase
        .from("tickets")
        .select("numero, priorite, statut, heure_declaration, machines(nom)")
        .order("created_at", { ascending: false })
        .limit(limit);
      return {
        columns: [
          { key: "numero", label: "N°" },
          { key: "machine", label: "Machine" },
          { key: "priorite", label: "Priorité" },
          { key: "statut", label: "Statut" },
        ],
        rows: ((data ?? []) as any[]).map((r) => ({
          numero: r.numero,
          machine: r.machines?.nom ?? "—",
          priorite: String(r.priorite ?? "").replace(/_/g, " "),
          statut: String(r.statut ?? "").replace(/_/g, " "),
        })),
      };
    },
  },

  // ===================== Production =====================
  {
    id: "prd_production_jour",
    title: "Production du jour",
    description: "Quantité produite déclarée aujourd'hui",
    category: "Production",
    kind: "kpi",
    permissionModule: "gpao_dashboard",
    defaultSize: { w: 3, h: 4 },
    fetch: async () => {
      const { data } = await supabase
        .from("production_declarations")
        .select("quantite_produite")
        .gte("heure_production", todayIso())
        .limit(5000);
      const total = (data ?? []).reduce((s, r: any) => s + Number(r.quantite_produite ?? 0), 0);
      return { value: Math.round(total * 100) / 100, hint: "déclarée aujourd'hui" };
    },
  },
  {
    id: "prd_of_en_cours",
    title: "OF en cours",
    description: "Ordres de fabrication au statut en cours",
    category: "Production",
    kind: "kpi",
    permissionModule: "of",
    defaultSize: { w: 3, h: 4 },
    fetch: async () => {
      const { count } = await supabase
        .from("ordres_fabrication")
        .select("id", { count: "exact", head: true })
        .eq("statut", "en_cours");
      return { value: count ?? 0, hint: "ordres actifs" };
    },
  },
  {
    id: "prd_production_evolution",
    title: "Évolution de la production",
    description: "Quantités produites par jour",
    category: "Production",
    kind: "chart",
    chart: "line",
    permissionModule: "gpao_dashboard",
    supportsPeriod: true,
    defaultDays: 7,
    defaultSize: { w: 6, h: 9 },
    fetch: async ({ days = 7 }) => {
      const { data } = await supabase
        .from("production_declarations")
        .select("heure_production, quantite_produite")
        .gte("heure_production", sinceIso(days))
        .limit(5000);
      return countByDay(
        ((data ?? []) as any[]).map((r) => ({ date: r.heure_production, value: r.quantite_produite })),
        days,
      );
    },
  },
  {
    id: "prd_rebut_evolution",
    title: "Rebuts par jour",
    description: "Quantités rebutées déclarées par jour",
    category: "Production",
    kind: "chart",
    chart: "bar",
    permissionModule: "gpao_dashboard",
    supportsPeriod: true,
    defaultDays: 7,
    defaultSize: { w: 6, h: 9 },
    fetch: async ({ days = 7 }) => {
      const { data } = await supabase
        .from("production_declarations")
        .select("heure_production, quantite_rebut")
        .gte("heure_production", sinceIso(days))
        .limit(5000);
      return countByDay(
        ((data ?? []) as any[]).map((r) => ({ date: r.heure_production, value: r.quantite_rebut })),
        days,
      );
    },
  },
  {
    id: "prd_derniers_of",
    title: "Derniers ordres de fabrication",
    description: "OF récents et avancement",
    category: "Production",
    kind: "table",
    permissionModule: "of",
    defaultSize: { w: 6, h: 9 },
    fetch: async ({ limit = 10 }) => {
      const { data } = await supabase
        .from("ordres_fabrication")
        .select("numero, statut, quantite_prevue, quantite_produite, products(designation)")
        .order("created_at", { ascending: false })
        .limit(limit);
      return {
        columns: [
          { key: "numero", label: "N° OF" },
          { key: "produit", label: "Produit" },
          { key: "avancement", label: "Avancement" },
          { key: "statut", label: "Statut" },
        ],
        rows: ((data ?? []) as any[]).map((r) => ({
          numero: r.numero,
          produit: r.products?.designation ?? "—",
          avancement: `${Number(r.quantite_produite ?? 0)} / ${Number(r.quantite_prevue ?? 0)}`,
          statut: String(r.statut ?? "").replace(/_/g, " "),
        })),
      };
    },
  },

  // ===================== Qualité =====================
  {
    id: "qua_nc_ouvertes",
    title: "Non-conformités ouvertes",
    description: "NC non clôturées ni annulées",
    category: "Qualité",
    kind: "kpi",
    permissionModule: "qualite_nc",
    defaultSize: { w: 3, h: 4 },
    fetch: async () => {
      const { count } = await supabase
        .from("quality_non_conformities")
        .select("id", { count: "exact", head: true })
        .not("status", "in", "(closed,cancelled)");
      return { value: count ?? 0, hint: "à traiter" };
    },
  },
  {
    id: "qua_taux_conformite",
    title: "Taux de conformité",
    description: "Part des contrôles conformes sur la période",
    category: "Qualité",
    kind: "kpi",
    permissionModule: "qualite_controles",
    supportsPeriod: true,
    defaultDays: 7,
    defaultSize: { w: 3, h: 4 },
    fetch: async ({ days = 7 }) => {
      const { data } = await supabase
        .from("quality_checks")
        .select("is_conform")
        .gte("control_time", sinceIso(days))
        .limit(5000);
      const rows = (data ?? []) as any[];
      const evaluated = rows.filter((r) => r.is_conform !== null);
      if (evaluated.length === 0) return { value: "—", hint: "aucun contrôle" };
      const ok = evaluated.filter((r) => r.is_conform).length;
      return {
        value: Math.round((ok / evaluated.length) * 1000) / 10,
        unit: "%",
        hint: `${ok}/${evaluated.length} contrôles conformes`,
      };
    },
  },
  {
    id: "qua_nc_severite",
    title: "NC par sévérité",
    description: "Répartition des non-conformités",
    category: "Qualité",
    kind: "chart",
    chart: "pie",
    permissionModule: "qualite_nc",
    supportsPeriod: true,
    defaultDays: 30,
    defaultSize: { w: 6, h: 9 },
    fetch: async ({ days = 30 }) => {
      const { data } = await supabase
        .from("quality_non_conformities")
        .select("severity")
        .gte("created_at", sinceIso(days))
        .limit(5000);
      return groupBy(data ?? [], "severity");
    },
  },
  {
    id: "qua_derniers_controles",
    title: "Derniers contrôles qualité",
    description: "Contrôles récents avec statut OK/NOK",
    category: "Qualité",
    kind: "table",
    permissionModule: "qualite_controles",
    defaultSize: { w: 6, h: 9 },
    fetch: async ({ limit = 10 }) => {
      const { data } = await supabase
        .from("quality_checks")
        .select("control_time, is_conform, measured_value_numeric, unit, quality_indicators(name)")
        .order("control_time", { ascending: false })
        .limit(limit);
      return {
        columns: [
          { key: "heure", label: "Heure" },
          { key: "indicateur", label: "Indicateur" },
          { key: "valeur", label: "Valeur" },
          { key: "statut", label: "Statut" },
        ],
        rows: ((data ?? []) as any[]).map((r) => ({
          heure: r.control_time ? new Date(r.control_time).toLocaleString("fr-FR") : "—",
          indicateur: r.quality_indicators?.name ?? "—",
          valeur:
            r.measured_value_numeric != null
              ? `${r.measured_value_numeric} ${r.unit ?? ""}`.trim()
              : "—",
          statut: r.is_conform === null ? "—" : r.is_conform ? "OK" : "NOK",
        })),
      };
    },
  },

  // ===================== Stock PDR / Inventaire =====================
  {
    id: "pdr_sous_mini",
    title: "PDR sous stock mini",
    description: "Références dont le stock est sous le minimum",
    category: "Stock PDR",
    kind: "kpi",
    permissionModule: "pdr",
    defaultSize: { w: 3, h: 4 },
    fetch: async () => {
      const { data } = await supabase
        .from("pdr")
        .select("stock_actuel, stock_min")
        .eq("is_active", true)
        .limit(5000);
      const n = ((data ?? []) as any[]).filter(
        (r) => Number(r.stock_min ?? 0) > 0 && Number(r.stock_actuel ?? 0) < Number(r.stock_min),
      ).length;
      return { value: n, hint: "références à réapprovisionner" };
    },
  },
  {
    id: "pdr_valeur_stock",
    title: "Valeur du stock PDR",
    description: "Valorisation au PMP (DA)",
    category: "Stock PDR",
    kind: "kpi",
    permissionModule: "pdr",
    defaultSize: { w: 3, h: 4 },
    fetch: async () => {
      const { data } = await supabase
        .from("pdr")
        .select("stock_actuel, pmp, prix_unitaire")
        .eq("is_active", true)
        .limit(5000);
      const total = ((data ?? []) as any[]).reduce(
        (s, r) => s + Number(r.stock_actuel ?? 0) * Number(r.pmp ?? r.prix_unitaire ?? 0),
        0,
      );
      return { value: Math.round(total).toLocaleString("fr-FR"), unit: "DA" };
    },
  },
  {
    id: "inv_campagnes_actives",
    title: "Campagnes d'inventaire actives",
    description: "Campagnes en cours ou en arbitrage",
    category: "Inventaire",
    kind: "kpi",
    permissionModule: "inventaire",
    defaultSize: { w: 3, h: 4 },
    fetch: async () => {
      const { count } = await supabase
        .from("inventory_campaigns")
        .select("id", { count: "exact", head: true })
        .in("status", ["en_cours", "arbitrage"]);
      return { value: count ?? 0, hint: "campagnes ouvertes" };
    },
  },

  // ===================== Réception F&L =====================
  {
    id: "rec_tonnage_periode",
    title: "Tonnage net réceptionné",
    description: "Poids net cumulé sur la période (tonnes)",
    category: "Réception",
    kind: "kpi",
    permissionModule: "reception_global",
    supportsPeriod: true,
    defaultDays: 7,
    defaultSize: { w: 3, h: 4 },
    fetch: async ({ days = 7 }) => {
      const { data } = await supabase
        .from("v_reception_global" as any)
        .select("poids_net_kg")
        .gte("date_ticket", sinceIso(days).slice(0, 10))
        .limit(5000);
      const kg = ((data ?? []) as any[]).reduce((s, r) => s + Number(r.poids_net_kg ?? 0), 0);
      return { value: Math.round((kg / 1000) * 100) / 100, unit: "t" };
    },
  },
  {
    id: "rec_hors_delai",
    title: "Réceptions hors délai",
    description: "Tickets dont le déchargement dépasse 20 min",
    category: "Réception",
    kind: "kpi",
    permissionModule: "reception_global",
    supportsPeriod: true,
    defaultDays: 7,
    defaultSize: { w: 3, h: 4 },
    fetch: async ({ days = 7 }) => {
      const { count } = await supabase
        .from("v_reception_global" as any)
        .select("id", { count: "exact", head: true })
        .gte("date_ticket", sinceIso(days).slice(0, 10))
        .gt("duree_minutes", 20);
      return { value: count ?? 0, hint: "> 20 min" };
    },
  },
  {
    id: "rec_consultation",
    title: "Consultation réception",
    description: "Derniers tickets de réception F&L",
    category: "Réception",
    kind: "table",
    permissionModule: "reception_global",
    defaultSize: { w: 6, h: 9 },
    fetch: async ({ limit = 10 }) => {
      const { data } = await supabase
        .from("v_reception_global" as any)
        .select("numero, date_ticket, fournisseur, produit, poids_net_kg, duree_minutes")
        .order("date_ticket", { ascending: false })
        .limit(limit);
      return {
        columns: [
          { key: "numero", label: "N°" },
          { key: "date", label: "Date" },
          { key: "fournisseur", label: "Fournisseur" },
          { key: "net", label: "Net (kg)" },
          { key: "duree", label: "Durée (min)" },
        ],
        rows: ((data ?? []) as any[]).map((r) => ({
          numero: r.numero,
          date: r.date_ticket,
          fournisseur: r.fournisseur ?? "—",
          net: r.poids_net_kg != null ? Number(r.poids_net_kg).toLocaleString("fr-FR") : "—",
          duree: r.duree_minutes ?? "—",
        })),
      };
    },
  },
  {
    id: "rec_tonnage_jour",
    title: "Tonnage réceptionné par jour",
    description: "Évolution du poids net réceptionné",
    category: "Réception",
    kind: "chart",
    chart: "bar",
    permissionModule: "reception_global",
    supportsPeriod: true,
    defaultDays: 14,
    defaultSize: { w: 6, h: 9 },
    fetch: async ({ days = 14 }) => {
      const { data } = await supabase
        .from("v_reception_global" as any)
        .select("date_ticket, poids_net_kg")
        .gte("date_ticket", sinceIso(days).slice(0, 10))
        .limit(5000);
      return countByDay(
        ((data ?? []) as any[]).map((r) => ({
          date: r.date_ticket,
          value: Number(r.poids_net_kg ?? 0) / 1000,
        })),
        days,
      );
    },
  },
];

export const WIDGET_MAP = new Map(WIDGETS.map((w) => [w.id, w]));

export const WIDGET_CATEGORIES = [
  "Maintenance",
  "Production",
  "Qualité",
  "Stock PDR",
  "Inventaire",
  "Réception",
] as const;

/** Élément de layout persisté dans `direction_dashboards.layout`. */
export interface LayoutItem {
  i: string;
  widgetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  filters?: WidgetFilters;
}
