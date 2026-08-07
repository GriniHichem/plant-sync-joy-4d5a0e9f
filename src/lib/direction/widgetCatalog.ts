import { supabase } from "@/integrations/supabase/client";
import type { WidgetCtx } from "@/lib/direction/filters";

/**
 * Catalogue de widgets du Dashboard Direction.
 *
 * Module 100 % lecture seule : chaque widget se contente d'interroger les
 * données existantes (RLS appliquée côté base). Aucun workflow métier,
 * aucune écriture, aucune modification des modules existants.
 */

export type WidgetKind = "kpi" | "chart" | "table";
export type ChartKind = "bar" | "line" | "pie" | "area";

export interface KpiData {
  value: number | string;
  unit?: string;
  hint?: string;
  /** Valeur comparable sur la période précédente (pour le delta). */
  previous?: number | null;
  /** true si une hausse est une bonne nouvelle (couleur du delta). */
  higherIsBetter?: boolean;
}
export interface ChartPoint {
  label: string;
  value: number;
  previous?: number;
}
export interface TableData {
  columns: { key: string; label: string }[];
  rows: Record<string, any>[];
}
export type WidgetData = KpiData | ChartPoint[] | TableData;

export type WidgetCategory =
  | "Maintenance"
  | "Production"
  | "Qualité"
  | "Stock PDR"
  | "Inventaire"
  | "Réception"
  | "Alertes";

export interface WidgetDef {
  id: string;
  title: string;
  description: string;
  category: WidgetCategory;
  kind: WidgetKind;
  chart?: ChartKind;
  /** Module de permission requis pour voir le widget. */
  permissionModule: string;
  /** Le widget tient compte de la période sélectionnée. */
  supportsPeriod?: boolean;
  /** Le widget sait afficher une comparaison avec la période précédente. */
  supportsCompare?: boolean;
  /** Filtres contextuels pris en charge. */
  supportsFilters?: ("line" | "product" | "supplier" | "campaign")[];
  defaultSize: { w: number; h: number };
  fetch: (ctx: WidgetCtx) => Promise<WidgetData>;
}

export const CATEGORY_META: Record<WidgetCategory, { color: string; badge: string }> = {
  Maintenance: { color: "text-amber-600", badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  Production: { color: "text-blue-600", badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  Qualité: { color: "text-emerald-600", badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  "Stock PDR": { color: "text-violet-600", badge: "bg-violet-500/10 text-violet-700 dark:text-violet-400" },
  Inventaire: { color: "text-cyan-600", badge: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400" },
  Réception: { color: "text-orange-600", badge: "bg-orange-500/10 text-orange-700 dark:text-orange-400" },
  Alertes: { color: "text-rose-600", badge: "bg-rose-500/10 text-rose-700 dark:text-rose-400" },
};

// ------------------------------------------------------------------ helpers

const MAX_ROWS = 10000;

function bucketByDay(
  rows: { date: any; value: any }[],
  ctx: WidgetCtx,
): ChartPoint[] {
  const start = new Date(ctx.from);
  const buckets = new Map<string, number>();
  const days = Math.min(ctx.days, 120);
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400_000).toISOString().slice(0, 10);
    buckets.set(d, 0);
  }
  for (const r of rows) {
    const d = String(r.date ?? "").slice(0, 10);
    if (buckets.has(d)) buckets.set(d, (buckets.get(d) ?? 0) + Number(r.value || 0));
  }
  return [...buckets.entries()].map(([label, value]) => ({
    label: label.slice(5).split("-").reverse().join("/"),
    value: Math.round(value * 100) / 100,
  }));
}

function groupCount(rows: any[], key: string, top = 12): ChartPoint[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = String(r[key] ?? "—").replace(/_/g, " ");
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, top);
}

function groupSum(rows: any[], keyOf: (r: any) => string, valOf: (r: any) => number, top = 10): ChartPoint[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r) || "—";
    m.set(k, (m.get(k) ?? 0) + (Number(valOf(r)) || 0));
  }
  return [...m.entries()]
    .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, top);
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const pct = (a: number, b: number) => (b > 0 ? round((a / b) * 100, 1) : 0);

/** Exécute la même agrégation sur la période courante et la précédente. */
async function withCompare(
  ctx: WidgetCtx,
  run: (from: string, to: string) => Promise<number>,
): Promise<{ value: number; previous: number | null }> {
  const value = await run(ctx.from, ctx.to);
  if (!ctx.compare) return { value, previous: null };
  const previous = await run(ctx.prevFrom, ctx.prevTo);
  return { value, previous };
}

// ------------------------------------------------------------------ widgets

export const WIDGETS: WidgetDef[] = [
  // ===================== Maintenance =====================
  {
    id: "mnt_tickets_ouverts",
    title: "Tickets ouverts",
    description: "Tickets de maintenance non clôturés",
    category: "Maintenance",
    kind: "kpi",
    permissionModule: "tickets",
    supportsFilters: ["line"],
    defaultSize: { w: 3, h: 4 },
    fetch: async (ctx) => {
      let q = (supabase.from("tickets") as any).select("id", { count: "exact", head: true }).neq("statut", "cloture");
      if (ctx.lineId) q = q.eq("ligne_id", ctx.lineId as any);
      const { count } = await q;
      return { value: count ?? 0, hint: "en cours de traitement", higherIsBetter: false };
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
      const { count } = await (supabase
        .from("tickets")
        .select("id", { count: "exact", head: true } as any) as any)
        .eq("priorite", "critique" as any)
        .neq("statut", "cloture" as any);
      return { value: count ?? 0, hint: "priorité critique", higherIsBetter: false };
    },
  },
  {
    id: "mnt_tickets_periode",
    title: "Tickets déclarés",
    description: "Nombre de tickets déclarés sur la période",
    category: "Maintenance",
    kind: "kpi",
    permissionModule: "tickets",
    supportsPeriod: true,
    supportsCompare: true,
    supportsFilters: ["line"],
    defaultSize: { w: 3, h: 4 },
    fetch: async (ctx) => {
      const run = async (from: string, to: string) => {
        let q = (supabase
          .from("tickets")
          .select("id", { count: "exact", head: true } as any) as any)
          .gte("heure_declaration", from)
          .lt("heure_declaration", to);
        if (ctx.lineId) q = q.eq("ligne_id", ctx.lineId as any);
        const { count } = await q;
        return count ?? 0;
      };
      const { value, previous } = await withCompare(ctx, run);
      return { value, previous, hint: ctx.label, higherIsBetter: false };
    },
  },
  {
    id: "mnt_mtbf",
    title: "MTBF",
    description: "Temps moyen entre pannes (heures) sur la période",
    category: "Maintenance",
    kind: "kpi",
    permissionModule: "analytiques",
    supportsPeriod: true,
    supportsCompare: true,
    defaultSize: { w: 3, h: 4 },
    fetch: async (ctx) => {
      const run = async (from: string, to: string) => {
        const { data } = await (supabase
          .from("tickets")
          .select("temps_arret_minutes") as any)
          .gte("heure_declaration", from)
          .lt("heure_declaration", to)
          .limit(MAX_ROWS);
        const rows = (data ?? []) as any[];
        if (rows.length === 0) return 0;
        const spanH = (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000;
        const stopH = rows.reduce((s, r) => s + Number(r.temps_arret_minutes ?? 0), 0) / 60;
        return round(Math.max(spanH - stopH, 0) / rows.length, 1);
      };
      const { value, previous } = await withCompare(ctx, run);
      return value === 0
        ? { value: "—", hint: "aucune panne sur la période" }
        : { value, previous, unit: "h", hint: "entre deux pannes", higherIsBetter: true };
    },
  },
  {
    id: "mnt_mttr",
    title: "MTTR",
    description: "Temps moyen de réparation (minutes)",
    category: "Maintenance",
    kind: "kpi",
    permissionModule: "analytiques",
    supportsPeriod: true,
    supportsCompare: true,
    defaultSize: { w: 3, h: 4 },
    fetch: async (ctx) => {
      const run = async (from: string, to: string) => {
        const { data } = await (supabase
          .from("tickets")
          .select("temps_intervention_minutes") as any)
          .gte("heure_declaration", from)
          .lt("heure_declaration", to)
          .not("temps_intervention_minutes", "is", null as any)
          .limit(MAX_ROWS);
        const rows = (data ?? []) as any[];
        if (!rows.length) return 0;
        return round(rows.reduce((s, r) => s + Number(r.temps_intervention_minutes ?? 0), 0) / rows.length, 1);
      };
      const { value, previous } = await withCompare(ctx, run);
      return value === 0
        ? { value: "—", hint: "aucune intervention chiffrée" }
        : { value, previous, unit: "min", hint: "durée moyenne de réparation", higherIsBetter: false };
    },
  },
  {
    id: "mnt_taux_dispo",
    title: "Taux de disponibilité",
    description: "Part du temps sans arrêt machine déclaré",
    category: "Maintenance",
    kind: "kpi",
    permissionModule: "analytiques",
    supportsPeriod: true,
    supportsCompare: true,
    supportsFilters: ["line"],
    defaultSize: { w: 3, h: 4 },
    fetch: async (ctx) => {
      const run = async (from: string, to: string) => {
        let q = (supabase
          .from("production_stops")
          .select("duree_minutes") as any)
          .gte("heure_debut", from)
          .lt("heure_debut", to)
          .limit(MAX_ROWS);
        if (ctx.lineId) q = q.eq("line_id", ctx.lineId as any);
        const { data } = await q;
        const stop = ((data ?? []) as any[]).reduce((s, r) => s + Number(r.duree_minutes ?? 0), 0);
        const spanMin = (new Date(to).getTime() - new Date(from).getTime()) / 60_000;
        return round(Math.max(0, 100 - (stop / Math.max(spanMin, 1)) * 100), 1);
      };
      const { value, previous } = await withCompare(ctx, run);
      return { value, previous, unit: "%", hint: "hors arrêts déclarés", higherIsBetter: true };
    },
  },
  {
    id: "mnt_preventifs_retard",
    title: "Préventifs en retard",
    description: "Plans préventifs dont l'échéance est dépassée",
    category: "Maintenance",
    kind: "kpi",
    permissionModule: "preventif",
    defaultSize: { w: 3, h: 4 },
    fetch: async () => {
      const { count } = await (supabase
        .from("preventive_plans")
        .select("id", { count: "exact", head: true } as any) as any)
        .eq("is_active", true as any)
        .lt("prochaine_echeance", new Date().toISOString().slice(0, 10));
      return { value: count ?? 0, hint: "échéance dépassée", higherIsBetter: false };
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
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      const { data } = await (supabase
        .from("tickets")
        .select("statut") as any)
        .gte("heure_declaration", ctx.from)
        .lt("heure_declaration", ctx.to)
        .limit(MAX_ROWS);
      return groupCount(data ?? [], "statut");
    },
  },
  {
    id: "mnt_tickets_priorite",
    title: "Tickets par priorité",
    description: "Volume de tickets par niveau de priorité",
    category: "Maintenance",
    kind: "chart",
    chart: "bar",
    permissionModule: "tickets",
    supportsPeriod: true,
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      const { data } = await (supabase
        .from("tickets")
        .select("priorite") as any)
        .gte("heure_declaration", ctx.from)
        .lt("heure_declaration", ctx.to)
        .limit(MAX_ROWS);
      return groupCount(data ?? [], "priorite");
    },
  },
  {
    id: "mnt_tickets_jour",
    title: "Tickets par jour",
    description: "Évolution du nombre de tickets déclarés",
    category: "Maintenance",
    kind: "chart",
    chart: "line",
    permissionModule: "tickets",
    supportsPeriod: true,
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      const { data } = await (supabase
        .from("tickets")
        .select("heure_declaration") as any)
        .gte("heure_declaration", ctx.from)
        .lt("heure_declaration", ctx.to)
        .limit(MAX_ROWS);
      return bucketByDay(((data ?? []) as any[]).map((r) => ({ date: r.heure_declaration, value: 1 })), ctx);
    },
  },
  {
    id: "mnt_arrets_machine",
    title: "Temps d'arrêt par machine",
    description: "Minutes d'arrêt cumulées par machine (top 10)",
    category: "Maintenance",
    kind: "chart",
    chart: "bar",
    permissionModule: "analytiques",
    supportsPeriod: true,
    supportsFilters: ["line"],
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      let q = (supabase
        .from("production_stops")
        .select("duree_minutes, machines(nom:designation)") as any)
        .gte("heure_debut", ctx.from)
        .lt("heure_debut", ctx.to)
        .limit(MAX_ROWS);
      if (ctx.lineId) q = q.eq("line_id", ctx.lineId as any);
      const { data } = await q;
      return groupSum(
        (data ?? []) as any[],
        (r) => r.machines?.nom ?? "Non affecté",
        (r) => Number(r.duree_minutes ?? 0),
      );
    },
  },
  {
    id: "mnt_derniers_tickets",
    title: "Derniers tickets",
    description: "Tableau des tickets les plus récents",
    category: "Maintenance",
    kind: "table",
    permissionModule: "tickets",
    supportsPeriod: true,
    supportsFilters: ["line"],
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      let q = (supabase
        .from("tickets")
        .select("numero, priorite, statut, heure_declaration, machines(designation)") as any)
        .gte("heure_declaration", ctx.from)
        .lt("heure_declaration", ctx.to)
        .order("heure_declaration", { ascending: false })
        .limit(ctx.limit);
      if (ctx.lineId) q = q.eq("ligne_id", ctx.lineId as any);
      const { data } = await q;
      return {
        columns: [
          { key: "numero", label: "N°" },
          { key: "machine", label: "Machine" },
          { key: "priorite", label: "Priorité" },
          { key: "statut", label: "Statut" },
        ],
        rows: ((data ?? []) as any[]).map((r) => ({
          numero: r.numero,
          machine: r.machines?.designation ?? "—",
          priorite: String(r.priorite ?? "").replace(/_/g, " "),
          statut: String(r.statut ?? "").replace(/_/g, " "),
        })),
      };
    },
  },

  // ===================== Production =====================
  {
    id: "prd_production_periode",
    title: "Production réalisée",
    description: "Quantité produite déclarée sur la période",
    category: "Production",
    kind: "kpi",
    permissionModule: "gpao_dashboard",
    supportsPeriod: true,
    supportsCompare: true,
    supportsFilters: ["line", "product"],
    defaultSize: { w: 3, h: 4 },
    fetch: async (ctx) => {
      const run = async (from: string, to: string) => {
        const { data } = await (supabase
          .from("production_declarations")
          .select("quantite_produite, ordres_fabrication!inner(line_id, product_id)") as any)
          .gte("heure_production", from)
          .lt("heure_production", to)
          .limit(MAX_ROWS);
        let rows = (data ?? []) as any[];
        if (ctx.lineId) rows = rows.filter((r) => r.ordres_fabrication?.line_id === ctx.lineId);
        if (ctx.productId) rows = rows.filter((r) => r.ordres_fabrication?.product_id === ctx.productId);
        return round(rows.reduce((s, r) => s + Number(r.quantite_produite ?? 0), 0));
      };
      const { value, previous } = await withCompare(ctx, run);
      return { value, previous, hint: ctx.label, higherIsBetter: true };
    },
  },
  {
    id: "prd_of_en_cours",
    title: "OF en cours",
    description: "Ordres de fabrication au statut en cours",
    category: "Production",
    kind: "kpi",
    permissionModule: "of",
    supportsFilters: ["line", "product"],
    defaultSize: { w: 3, h: 4 },
    fetch: async (ctx) => {
      let q = (supabase.from("ordres_fabrication") as any).select("id", { count: "exact", head: true } as any).eq("statut", "en_cours" as any);
      if (ctx.lineId) q = q.eq("line_id", ctx.lineId as any);
      if (ctx.productId) q = q.eq("product_id", ctx.productId as any);
      const { count } = await q;
      return { value: count ?? 0, hint: "ordres actifs", higherIsBetter: true };
    },
  },
  {
    id: "prd_taux_rebut",
    title: "Taux de rebut",
    description: "Part de rebut sur le total produit",
    category: "Production",
    kind: "kpi",
    permissionModule: "gpao_dashboard",
    supportsPeriod: true,
    supportsCompare: true,
    supportsFilters: ["line"],
    defaultSize: { w: 3, h: 4 },
    fetch: async (ctx) => {
      const run = async (from: string, to: string) => {
        const { data } = await supabase
          .from("production_declarations")
          .select("quantite_produite, quantite_rebut, ordres_fabrication!inner(line_id)")
          .gte("heure_production", from)
          .lt("heure_production", to)
          .limit(MAX_ROWS);
        let rows = (data ?? []) as any[];
        if (ctx.lineId) rows = rows.filter((r) => r.ordres_fabrication?.line_id === ctx.lineId);
        const ok = rows.reduce((s, r) => s + Number(r.quantite_produite ?? 0), 0);
        const ko = rows.reduce((s, r) => s + Number(r.quantite_rebut ?? 0), 0);
        return pct(ko, ok + ko);
      };
      const { value, previous } = await withCompare(ctx, run);
      return { value, previous, unit: "%", hint: "rebut / production totale", higherIsBetter: false };
    },
  },
  {
    id: "prd_trg",
    title: "TRG (approché)",
    description: "Disponibilité × Performance × Qualité sur la période",
    category: "Production",
    kind: "kpi",
    permissionModule: "gpao_dashboard",
    supportsPeriod: true,
    supportsCompare: true,
    supportsFilters: ["line"],
    defaultSize: { w: 3, h: 4 },
    fetch: async (ctx) => {
      const run = async (from: string, to: string) => {
        let stopQ = supabase
          .from("production_stops")
          .select("duree_minutes")
          .gte("heure_debut", from)
          .lt("heure_debut", to)
          .limit(MAX_ROWS);
        if (ctx.lineId) stopQ = stopQ.eq("line_id", ctx.lineId);
        const [{ data: stops }, { data: decl }] = await Promise.all([
          stopQ,
          supabase
            .from("production_declarations")
            .select("quantite_produite, quantite_rebut, ordres_fabrication!inner(line_id, quantite_prevue)")
            .gte("heure_production", from)
            .lt("heure_production", to)
            .limit(MAX_ROWS),
        ]);
        let rows = (decl ?? []) as any[];
        if (ctx.lineId) rows = rows.filter((r) => r.ordres_fabrication?.line_id === ctx.lineId);
        const spanMin = (new Date(to).getTime() - new Date(from).getTime()) / 60_000;
        const stopMin = ((stops ?? []) as any[]).reduce((s, r) => s + Number(r.duree_minutes ?? 0), 0);
        const dispo = Math.max(0, Math.min(1, 1 - stopMin / Math.max(spanMin, 1)));
        const prod = rows.reduce((s, r) => s + Number(r.quantite_produite ?? 0), 0);
        const rebut = rows.reduce((s, r) => s + Number(r.quantite_rebut ?? 0), 0);
        const prevu = rows.reduce((s, r) => s + Number(r.ordres_fabrication?.quantite_prevue ?? 0), 0);
        const perf = prevu > 0 ? Math.min(1, (prod + rebut) / prevu) : prod > 0 ? 1 : 0;
        const qual = prod + rebut > 0 ? prod / (prod + rebut) : 0;
        return round(dispo * perf * qual * 100, 1);
      };
      const { value, previous } = await withCompare(ctx, run);
      return { value, previous, unit: "%", hint: "dispo × perf × qualité", higherIsBetter: true };
    },
  },
  {
    id: "prd_cadence",
    title: "Cadence moyenne",
    description: "Quantité produite par heure sur la période",
    category: "Production",
    kind: "kpi",
    permissionModule: "gpao_dashboard",
    supportsPeriod: true,
    supportsCompare: true,
    supportsFilters: ["line"],
    defaultSize: { w: 3, h: 4 },
    fetch: async (ctx) => {
      const run = async (from: string, to: string) => {
        const { data } = await supabase
          .from("production_declarations")
          .select("quantite_produite, ordres_fabrication!inner(line_id)")
          .gte("heure_production", from)
          .lt("heure_production", to)
          .limit(MAX_ROWS);
        let rows = (data ?? []) as any[];
        if (ctx.lineId) rows = rows.filter((r) => r.ordres_fabrication?.line_id === ctx.lineId);
        const total = rows.reduce((s, r) => s + Number(r.quantite_produite ?? 0), 0);
        const hours = (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000;
        return round(total / Math.max(hours, 1), 2);
      };
      const { value, previous } = await withCompare(ctx, run);
      return { value, previous, unit: "/h", hint: "quantité produite par heure", higherIsBetter: true };
    },
  },
  {
    id: "prd_occupation_lignes",
    title: "Taux d'occupation des lignes",
    description: "Lignes avec un OF en cours / lignes actives",
    category: "Production",
    kind: "kpi",
    permissionModule: "gpao_dashboard",
    defaultSize: { w: 3, h: 4 },
    fetch: async () => {
      const [{ data: lines }, { data: ofs }] = await Promise.all([
        supabase.from("production_lines").select("id").eq("is_active", true).limit(500),
        supabase.from("ordres_fabrication").select("line_id").eq("statut", "en_cours").limit(MAX_ROWS),
      ]);
      const total = (lines ?? []).length;
      const busy = new Set(((ofs ?? []) as any[]).map((r) => r.line_id).filter(Boolean)).size;
      if (!total) return { value: "—", hint: "aucune ligne active" };
      return { value: pct(busy, total), unit: "%", hint: `${busy}/${total} lignes occupées`, higherIsBetter: true };
    },
  },
  {
    id: "prd_production_evolution",
    title: "Évolution de la production",
    description: "Quantités produites par jour",
    category: "Production",
    kind: "chart",
    chart: "area",
    permissionModule: "gpao_dashboard",
    supportsPeriod: true,
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      const { data } = await supabase
        .from("production_declarations")
        .select("heure_production, quantite_produite")
        .gte("heure_production", ctx.from)
        .lt("heure_production", ctx.to)
        .limit(MAX_ROWS);
      return bucketByDay(((data ?? []) as any[]).map((r) => ({ date: r.heure_production, value: r.quantite_produite })), ctx);
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
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      const { data } = await supabase
        .from("production_declarations")
        .select("heure_production, quantite_rebut")
        .gte("heure_production", ctx.from)
        .lt("heure_production", ctx.to)
        .limit(MAX_ROWS);
      return bucketByDay(((data ?? []) as any[]).map((r) => ({ date: r.heure_production, value: r.quantite_rebut })), ctx);
    },
  },
  {
    id: "prd_arrets_type",
    title: "Arrêts par type",
    description: "Répartition des minutes d'arrêt par motif",
    category: "Production",
    kind: "chart",
    chart: "pie",
    permissionModule: "gpao_dashboard",
    supportsPeriod: true,
    supportsFilters: ["line"],
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      let q = supabase
        .from("production_stops")
        .select("type, duree_minutes")
        .gte("heure_debut", ctx.from)
        .lt("heure_debut", ctx.to)
        .limit(MAX_ROWS);
      if (ctx.lineId) q = q.eq("line_id", ctx.lineId);
      const { data } = await q;
      return groupSum((data ?? []) as any[], (r) => String(r.type ?? "autre").replace(/_/g, " "), (r) => Number(r.duree_minutes ?? 0), 12);
    },
  },
  {
    id: "prd_par_ligne",
    title: "Production par ligne",
    description: "Quantités produites par ligne de production",
    category: "Production",
    kind: "chart",
    chart: "bar",
    permissionModule: "gpao_dashboard",
    supportsPeriod: true,
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      const { data } = await supabase
        .from("production_declarations")
        .select("quantite_produite, ordres_fabrication!inner(production_lines(designation))")
        .gte("heure_production", ctx.from)
        .lt("heure_production", ctx.to)
        .limit(MAX_ROWS);
      return groupSum(
        (data ?? []) as any[],
        (r) => r.ordres_fabrication?.production_lines?.designation ?? "—",
        (r) => Number(r.quantite_produite ?? 0),
      );
    },
  },
  {
    id: "prd_par_produit",
    title: "Production par produit",
    description: "Top produits fabriqués sur la période",
    category: "Production",
    kind: "chart",
    chart: "bar",
    permissionModule: "gpao_dashboard",
    supportsPeriod: true,
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      const { data } = await supabase
        .from("production_declarations")
        .select("quantite_produite, ordres_fabrication!inner(products(designation))")
        .gte("heure_production", ctx.from)
        .lt("heure_production", ctx.to)
        .limit(MAX_ROWS);
      return groupSum(
        (data ?? []) as any[],
        (r) => r.ordres_fabrication?.products?.designation ?? "—",
        (r) => Number(r.quantite_produite ?? 0),
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
    supportsFilters: ["line", "product"],
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      let q = supabase
        .from("ordres_fabrication")
        .select("numero, statut, quantite_prevue, quantite_produite, products(designation)")
        .order("created_at", { ascending: false })
        .limit(ctx.limit);
      if (ctx.lineId) q = q.eq("line_id", ctx.lineId);
      if (ctx.productId) q = q.eq("product_id", ctx.productId);
      const { data } = await q;
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
      return { value: count ?? 0, hint: "à traiter", higherIsBetter: false };
    },
  },
  {
    id: "qua_nc_periode",
    title: "NC déclarées",
    description: "Non-conformités déclarées sur la période",
    category: "Qualité",
    kind: "kpi",
    permissionModule: "qualite_nc",
    supportsPeriod: true,
    supportsCompare: true,
    supportsFilters: ["line", "product"],
    defaultSize: { w: 3, h: 4 },
    fetch: async (ctx) => {
      const run = async (from: string, to: string) => {
        let q = supabase
          .from("quality_non_conformities")
          .select("id", { count: "exact", head: true })
          .gte("created_at", from)
          .lt("created_at", to);
        if (ctx.lineId) q = q.eq("production_line_id", ctx.lineId);
        if (ctx.productId) q = q.eq("product_id", ctx.productId);
        const { count } = await q;
        return count ?? 0;
      };
      const { value, previous } = await withCompare(ctx, run);
      return { value, previous, hint: ctx.label, higherIsBetter: false };
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
    supportsCompare: true,
    supportsFilters: ["line", "product"],
    defaultSize: { w: 3, h: 4 },
    fetch: async (ctx) => {
      const run = async (from: string, to: string) => {
        let q = supabase
          .from("quality_checks")
          .select("is_conform")
          .gte("control_time", from)
          .lt("control_time", to)
          .not("is_conform", "is", null)
          .limit(MAX_ROWS);
        if (ctx.lineId) q = q.eq("production_line_id", ctx.lineId);
        if (ctx.productId) q = q.eq("product_id", ctx.productId);
        const { data } = await q;
        const rows = (data ?? []) as any[];
        if (!rows.length) return -1;
        return pct(rows.filter((r) => r.is_conform).length, rows.length);
      };
      const { value, previous } = await withCompare(ctx, run);
      if (value < 0) return { value: "—", hint: "aucun contrôle sur la période" };
      return {
        value,
        previous: previous != null && previous >= 0 ? previous : null,
        unit: "%",
        hint: "contrôles conformes",
        higherIsBetter: true,
      };
    },
  },
  {
    id: "qua_hors_limite",
    title: "Contrôles hors limite",
    description: "Contrôles non conformes sur la période",
    category: "Qualité",
    kind: "kpi",
    permissionModule: "qualite_controles",
    supportsPeriod: true,
    supportsCompare: true,
    defaultSize: { w: 3, h: 4 },
    fetch: async (ctx) => {
      const run = async (from: string, to: string) => {
        const { count } = await supabase
          .from("quality_checks")
          .select("id", { count: "exact", head: true })
          .gte("control_time", from)
          .lt("control_time", to)
          .eq("is_conform", false);
        return count ?? 0;
      };
      const { value, previous } = await withCompare(ctx, run);
      return { value, previous, hint: "mesures hors tolérance", higherIsBetter: false };
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
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      const { data } = await supabase
        .from("quality_non_conformities")
        .select("severity")
        .gte("created_at", ctx.from)
        .lt("created_at", ctx.to)
        .limit(MAX_ROWS);
      return groupCount(data ?? [], "severity");
    },
  },
  {
    id: "qua_nc_type",
    title: "NC par type",
    description: "Typologie des non-conformités",
    category: "Qualité",
    kind: "chart",
    chart: "bar",
    permissionModule: "qualite_nc",
    supportsPeriod: true,
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      const { data } = await supabase
        .from("quality_non_conformities")
        .select("nc_type")
        .gte("created_at", ctx.from)
        .lt("created_at", ctx.to)
        .limit(MAX_ROWS);
      return groupCount(data ?? [], "nc_type");
    },
  },
  {
    id: "qua_nc_jour",
    title: "NC par jour",
    description: "Évolution des non-conformités déclarées",
    category: "Qualité",
    kind: "chart",
    chart: "line",
    permissionModule: "qualite_nc",
    supportsPeriod: true,
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      const { data } = await supabase
        .from("quality_non_conformities")
        .select("created_at")
        .gte("created_at", ctx.from)
        .lt("created_at", ctx.to)
        .limit(MAX_ROWS);
      return bucketByDay(((data ?? []) as any[]).map((r) => ({ date: r.created_at, value: 1 })), ctx);
    },
  },
  {
    id: "qua_derniers_controles",
    title: "Derniers contrôles qualité",
    description: "Contrôles récents avec statut OK/NOK",
    category: "Qualité",
    kind: "table",
    permissionModule: "qualite_controles",
    supportsPeriod: true,
    supportsFilters: ["line", "product"],
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      let q = supabase
        .from("quality_checks")
        .select("control_time, is_conform, measured_value_numeric, unit, quality_indicators(name)")
        .gte("control_time", ctx.from)
        .lt("control_time", ctx.to)
        .order("control_time", { ascending: false })
        .limit(ctx.limit);
      if (ctx.lineId) q = q.eq("production_line_id", ctx.lineId);
      if (ctx.productId) q = q.eq("product_id", ctx.productId);
      const { data } = await q;
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
          valeur: r.measured_value_numeric != null ? `${r.measured_value_numeric} ${r.unit ?? ""}`.trim() : "—",
          statut: r.is_conform === null ? "—" : r.is_conform ? "OK" : "NOK",
        })),
      };
    },
  },
  {
    id: "qua_nc_ouvertes_table",
    title: "NC ouvertes (détail)",
    description: "Liste des non-conformités en cours de traitement",
    category: "Qualité",
    kind: "table",
    permissionModule: "qualite_nc",
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      const { data } = await supabase
        .from("quality_non_conformities")
        .select("nc_number, title, severity, status, created_at")
        .not("status", "in", "(closed,cancelled)")
        .order("created_at", { ascending: false })
        .limit(ctx.limit);
      return {
        columns: [
          { key: "numero", label: "N° NC" },
          { key: "titre", label: "Objet" },
          { key: "severite", label: "Sévérité" },
          { key: "statut", label: "Statut" },
        ],
        rows: ((data ?? []) as any[]).map((r) => ({
          numero: r.nc_number,
          titre: r.title ?? "—",
          severite: String(r.severity ?? "").replace(/_/g, " "),
          statut: String(r.status ?? "").replace(/_/g, " "),
        })),
      };
    },
  },

  // ===================== Stock PDR =====================
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
        .limit(MAX_ROWS);
      const n = ((data ?? []) as any[]).filter(
        (r) => Number(r.stock_min ?? 0) > 0 && Number(r.stock_actuel ?? 0) < Number(r.stock_min),
      ).length;
      return { value: n, hint: "références à réapprovisionner", higherIsBetter: false };
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
        .limit(MAX_ROWS);
      const total = ((data ?? []) as any[]).reduce(
        (s, r) => s + Number(r.stock_actuel ?? 0) * Number(r.pmp ?? r.prix_unitaire ?? 0),
        0,
      );
      return { value: Math.round(total).toLocaleString("fr-FR"), unit: "DA" };
    },
  },
  {
    id: "pdr_taux_rupture",
    title: "Taux de rupture",
    description: "Références actives à stock nul",
    category: "Stock PDR",
    kind: "kpi",
    permissionModule: "pdr",
    defaultSize: { w: 3, h: 4 },
    fetch: async () => {
      const { data } = await supabase.from("pdr").select("stock_actuel").eq("is_active", true).limit(MAX_ROWS);
      const rows = (data ?? []) as any[];
      if (!rows.length) return { value: "—", hint: "aucune référence" };
      const zero = rows.filter((r) => Number(r.stock_actuel ?? 0) <= 0).length;
      return { value: pct(zero, rows.length), unit: "%", hint: `${zero}/${rows.length} références`, higherIsBetter: false };
    },
  },
  {
    id: "pdr_rotation",
    title: "Rotation du stock",
    description: "Sorties valorisées / valeur moyenne du stock (annualisé)",
    category: "Stock PDR",
    kind: "kpi",
    permissionModule: "pdr",
    supportsPeriod: true,
    defaultSize: { w: 3, h: 4 },
    fetch: async (ctx) => {
      const [{ data: mv }, { data: stock }] = await Promise.all([
        supabase
          .from("pdr_stock_movements")
          .select("quantite, prix_unitaire, type")
          .eq("type", "sortie")
          .gte("created_at", ctx.from)
          .lt("created_at", ctx.to)
          .limit(MAX_ROWS),
        supabase.from("pdr").select("stock_actuel, pmp, prix_unitaire").eq("is_active", true).limit(MAX_ROWS),
      ]);
      const sorties = ((mv ?? []) as any[]).reduce(
        (s, r) => s + Math.abs(Number(r.quantite ?? 0)) * Number(r.prix_unitaire ?? 0),
        0,
      );
      const valeur = ((stock ?? []) as any[]).reduce(
        (s, r) => s + Number(r.stock_actuel ?? 0) * Number(r.pmp ?? r.prix_unitaire ?? 0),
        0,
      );
      if (valeur <= 0) return { value: "—", hint: "stock non valorisé" };
      const annualise = (sorties / valeur) * (365 / Math.max(ctx.days, 1));
      return { value: round(annualise, 2), unit: "x/an", hint: "rotation annualisée", higherIsBetter: true };
    },
  },
  {
    id: "pdr_delai_reappro",
    title: "Délai moyen de réappro.",
    description: "Moyenne des délais d'approvisionnement paramétrés",
    category: "Stock PDR",
    kind: "kpi",
    permissionModule: "pdr",
    defaultSize: { w: 3, h: 4 },
    fetch: async () => {
      const { data } = await supabase
        .from("pdr")
        .select("delai_approvisionnement")
        .eq("is_active", true)
        .not("delai_approvisionnement", "is", null)
        .limit(MAX_ROWS);
      const rows = (data ?? []) as any[];
      if (!rows.length) return { value: "—", hint: "délais non renseignés" };
      return {
        value: round(rows.reduce((s, r) => s + Number(r.delai_approvisionnement ?? 0), 0) / rows.length, 1),
        unit: "j",
        hint: "délai fournisseur moyen",
        higherIsBetter: false,
      };
    },
  },
  {
    id: "pdr_mouvements_jour",
    title: "Mouvements de stock par jour",
    description: "Volume de mouvements PDR enregistrés",
    category: "Stock PDR",
    kind: "chart",
    chart: "bar",
    permissionModule: "pdr",
    supportsPeriod: true,
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      const { data } = await supabase
        .from("pdr_stock_movements")
        .select("created_at")
        .gte("created_at", ctx.from)
        .lt("created_at", ctx.to)
        .limit(MAX_ROWS);
      return bucketByDay(((data ?? []) as any[]).map((r) => ({ date: r.created_at, value: 1 })), ctx);
    },
  },
  {
    id: "pdr_top_consommations",
    title: "Top pièces consommées",
    description: "Références les plus sorties sur la période",
    category: "Stock PDR",
    kind: "chart",
    chart: "bar",
    permissionModule: "pdr",
    supportsPeriod: true,
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      const { data } = await supabase
        .from("pdr_stock_movements")
        .select("quantite, pdr(reference)")
        .eq("type", "sortie")
        .gte("created_at", ctx.from)
        .lt("created_at", ctx.to)
        .limit(MAX_ROWS);
      return groupSum((data ?? []) as any[], (r) => r.pdr?.reference ?? "—", (r) => Math.abs(Number(r.quantite ?? 0)));
    },
  },
  {
    id: "pdr_demandes_attente",
    title: "Demandes de pièces en attente",
    description: "Demandes maintenance non encore servies",
    category: "Stock PDR",
    kind: "kpi",
    permissionModule: "pdr_demandes",
    defaultSize: { w: 3, h: 4 },
    fetch: async () => {
      const { count } = await supabase
        .from("pdr_requests")
        .select("id", { count: "exact", head: true })
        .in("statut", ["demandee", "prete", "partielle"]);
      return { value: count ?? 0, hint: "à traiter par le magasin", higherIsBetter: false };
    },
  },

  // ===================== Inventaire =====================
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
  {
    id: "inv_ecarts",
    title: "Lignes en écart",
    description: "Cibles d'inventaire à recompter ou en arbitrage",
    category: "Inventaire",
    kind: "kpi",
    permissionModule: "inventaire",
    defaultSize: { w: 3, h: 4 },
    fetch: async () => {
      const { count } = await supabase
        .from("inventory_targets")
        .select("id", { count: "exact", head: true })
        .in("status", ["en_arbitrage", "a_recompter"]);
      return { value: count ?? 0, hint: "écarts à arbitrer", higherIsBetter: false };
    },
  },
  {
    id: "inv_avancement",
    title: "Avancement des comptages",
    description: "Part des cibles déjà comptées ou clôturées",
    category: "Inventaire",
    kind: "kpi",
    permissionModule: "inventaire",
    defaultSize: { w: 3, h: 4 },
    fetch: async () => {
      const { data } = await supabase.from("inventory_targets").select("status").limit(MAX_ROWS);
      const rows = (data ?? []) as any[];
      if (!rows.length) return { value: "—", hint: "aucune cible" };
      const done = rows.filter((r) => ["conforme", "cloture"].includes(String(r.status))).length;
      return { value: pct(done, rows.length), unit: "%", hint: `${done}/${rows.length} cibles`, higherIsBetter: true };
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
    supportsCompare: true,
    supportsFilters: ["supplier", "product", "campaign"],
    defaultSize: { w: 3, h: 4 },
    fetch: async (ctx) => {
      const run = async (fromD: string, toD: string) => {
        let q = supabase
          .from("v_reception_global" as any)
          .select("poids_net_kg")
          .gte("date_ticket", fromD)
          .lte("date_ticket", toD)
          .limit(MAX_ROWS);
        if (ctx.supplierId) q = q.eq("supplier_id", ctx.supplierId);
        if (ctx.productId) q = q.eq("product_id", ctx.productId);
        if (ctx.campaignId) q = q.eq("campaign_id", ctx.campaignId);
        const { data } = await q;
        const kg = ((data ?? []) as any[]).reduce((s, r) => s + Number(r.poids_net_kg ?? 0), 0);
        return round(kg / 1000);
      };
      const value = await run(ctx.fromDate, ctx.toDate);
      const previous = ctx.compare ? await run(ctx.prevFromDate, ctx.prevToDate) : null;
      return { value, previous, unit: "t", hint: ctx.label, higherIsBetter: true };
    },
  },
  {
    id: "rec_tickets_traites",
    title: "Tickets traités",
    description: "Nombre de tickets de réception sur la période",
    category: "Réception",
    kind: "kpi",
    permissionModule: "reception_global",
    supportsPeriod: true,
    supportsCompare: true,
    supportsFilters: ["supplier", "product", "campaign"],
    defaultSize: { w: 3, h: 4 },
    fetch: async (ctx) => {
      const run = async (fromD: string, toD: string) => {
        let q = supabase
          .from("v_reception_global" as any)
          .select("id", { count: "exact", head: true })
          .gte("date_ticket", fromD)
          .lte("date_ticket", toD);
        if (ctx.supplierId) q = q.eq("supplier_id", ctx.supplierId);
        if (ctx.productId) q = q.eq("product_id", ctx.productId);
        if (ctx.campaignId) q = q.eq("campaign_id", ctx.campaignId);
        const { count } = await q;
        return count ?? 0;
      };
      const value = await run(ctx.fromDate, ctx.toDate);
      const previous = ctx.compare ? await run(ctx.prevFromDate, ctx.prevToDate) : null;
      return { value, previous, hint: ctx.label, higherIsBetter: true };
    },
  },
  {
    id: "rec_abattement_moyen",
    title: "Taux d'abattement moyen",
    description: "Moyenne des taux d'abattement appliqués",
    category: "Réception",
    kind: "kpi",
    permissionModule: "reception_global",
    supportsPeriod: true,
    supportsCompare: true,
    supportsFilters: ["supplier", "product", "campaign"],
    defaultSize: { w: 3, h: 4 },
    fetch: async (ctx) => {
      const run = async (fromD: string, toD: string) => {
        let q = supabase
          .from("v_reception_global" as any)
          .select("taux_abattement")
          .gte("date_ticket", fromD)
          .lte("date_ticket", toD)
          .not("taux_abattement", "is", null)
          .limit(MAX_ROWS);
        if (ctx.supplierId) q = q.eq("supplier_id", ctx.supplierId);
        if (ctx.productId) q = q.eq("product_id", ctx.productId);
        if (ctx.campaignId) q = q.eq("campaign_id", ctx.campaignId);
        const { data } = await q;
        const rows = (data ?? []) as any[];
        if (!rows.length) return -1;
        return round(rows.reduce((s, r) => s + Number(r.taux_abattement ?? 0), 0) / rows.length, 2);
      };
      const value = await run(ctx.fromDate, ctx.toDate);
      if (value < 0) return { value: "—", hint: "aucun ticket sur la période" };
      const previous = ctx.compare ? await run(ctx.prevFromDate, ctx.prevToDate) : null;
      return { value, previous: previous != null && previous >= 0 ? previous : null, unit: "%", hint: "abattement moyen", higherIsBetter: false };
    },
  },
  {
    id: "rec_taux_rejet",
    title: "Taux de rejet",
    description: "Part des tickets annulés sur la période",
    category: "Réception",
    kind: "kpi",
    permissionModule: "reception_global",
    supportsPeriod: true,
    supportsFilters: ["supplier", "campaign"],
    defaultSize: { w: 3, h: 4 },
    fetch: async (ctx) => {
      let q = supabase
        .from("v_reception_global" as any)
        .select("statut")
        .gte("date_ticket", ctx.fromDate)
        .lte("date_ticket", ctx.toDate)
        .limit(MAX_ROWS);
      if (ctx.supplierId) q = q.eq("supplier_id", ctx.supplierId);
      if (ctx.campaignId) q = q.eq("campaign_id", ctx.campaignId);
      const { data } = await q;
      const rows = (data ?? []) as any[];
      if (!rows.length) return { value: "—", hint: "aucun ticket" };
      const rejets = rows.filter((r) => String(r.statut) === "annule").length;
      return { value: pct(rejets, rows.length), unit: "%", hint: `${rejets}/${rows.length} tickets`, higherIsBetter: false };
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
    supportsFilters: ["supplier", "campaign"],
    defaultSize: { w: 3, h: 4 },
    fetch: async (ctx) => {
      let q = supabase
        .from("v_reception_global" as any)
        .select("id", { count: "exact", head: true })
        .gte("date_ticket", ctx.fromDate)
        .lte("date_ticket", ctx.toDate)
        .gt("duree_minutes", 20);
      if (ctx.supplierId) q = q.eq("supplier_id", ctx.supplierId);
      if (ctx.campaignId) q = q.eq("campaign_id", ctx.campaignId);
      const { count } = await q;
      return { value: count ?? 0, hint: "> 20 min", higherIsBetter: false };
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
    supportsFilters: ["supplier", "product", "campaign"],
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      let q = supabase
        .from("v_reception_global" as any)
        .select("date_ticket, poids_net_kg")
        .gte("date_ticket", ctx.fromDate)
        .lte("date_ticket", ctx.toDate)
        .limit(MAX_ROWS);
      if (ctx.supplierId) q = q.eq("supplier_id", ctx.supplierId);
      if (ctx.productId) q = q.eq("product_id", ctx.productId);
      if (ctx.campaignId) q = q.eq("campaign_id", ctx.campaignId);
      const { data } = await q;
      return bucketByDay(
        ((data ?? []) as any[]).map((r) => ({ date: r.date_ticket, value: Number(r.poids_net_kg ?? 0) / 1000 })),
        ctx,
      );
    },
  },
  {
    id: "rec_top_fournisseurs",
    title: "Top fournisseurs",
    description: "Tonnage net par fournisseur",
    category: "Réception",
    kind: "chart",
    chart: "bar",
    permissionModule: "reception_global",
    supportsPeriod: true,
    supportsFilters: ["product", "campaign"],
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      let q = supabase
        .from("v_reception_global" as any)
        .select("fournisseur, poids_net_kg")
        .gte("date_ticket", ctx.fromDate)
        .lte("date_ticket", ctx.toDate)
        .limit(MAX_ROWS);
      if (ctx.productId) q = q.eq("product_id", ctx.productId);
      if (ctx.campaignId) q = q.eq("campaign_id", ctx.campaignId);
      const { data } = await q;
      return groupSum((data ?? []) as any[], (r) => r.fournisseur ?? "—", (r) => Number(r.poids_net_kg ?? 0) / 1000);
    },
  },
  {
    id: "rec_par_produit",
    title: "Réception par produit",
    description: "Tonnage net par produit sur la période",
    category: "Réception",
    kind: "chart",
    chart: "pie",
    permissionModule: "reception_global",
    supportsPeriod: true,
    supportsFilters: ["supplier", "campaign"],
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      let q = supabase
        .from("v_reception_global" as any)
        .select("produit, poids_net_kg")
        .gte("date_ticket", ctx.fromDate)
        .lte("date_ticket", ctx.toDate)
        .limit(MAX_ROWS);
      if (ctx.supplierId) q = q.eq("supplier_id", ctx.supplierId);
      if (ctx.campaignId) q = q.eq("campaign_id", ctx.campaignId);
      const { data } = await q;
      return groupSum((data ?? []) as any[], (r) => r.produit ?? "—", (r) => Number(r.poids_net_kg ?? 0) / 1000, 8);
    },
  },
  {
    id: "rec_consultation",
    title: "Consultation réception",
    description: "Derniers tickets de réception F&L",
    category: "Réception",
    kind: "table",
    permissionModule: "reception_global",
    supportsPeriod: true,
    supportsFilters: ["supplier", "product", "campaign"],
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      let q = supabase
        .from("v_reception_global" as any)
        .select("numero, date_ticket, fournisseur, produit, poids_net_kg, duree_minutes")
        .gte("date_ticket", ctx.fromDate)
        .lte("date_ticket", ctx.toDate)
        .order("date_ticket", { ascending: false })
        .limit(ctx.limit);
      if (ctx.supplierId) q = q.eq("supplier_id", ctx.supplierId);
      if (ctx.productId) q = q.eq("product_id", ctx.productId);
      if (ctx.campaignId) q = q.eq("campaign_id", ctx.campaignId);
      const { data } = await q;
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

  // ===================== Alertes & anomalies =====================
  {
    id: "alr_tickets_attente",
    title: "Tickets en attente de prise en charge",
    description: "Tickets ouverts sans intervenant affecté",
    category: "Alertes",
    kind: "kpi",
    permissionModule: "tickets",
    defaultSize: { w: 3, h: 4 },
    fetch: async () => {
      const { count } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("statut", "ouvert");
      return { value: count ?? 0, hint: "sans prise en charge", higherIsBetter: false };
    },
  },
  {
    id: "alr_tickets_risque_qualite",
    title: "Tickets à risque qualité",
    description: "Tickets maintenance déclarés à risque qualité et non clôturés",
    category: "Alertes",
    kind: "kpi",
    permissionModule: "tickets",
    defaultSize: { w: 3, h: 4 },
    fetch: async () => {
      const { count } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .eq("quality_risk", true)
        .neq("statut", "cloture");
      return { value: count ?? 0, hint: "risque produit", higherIsBetter: false };
    },
  },
  {
    id: "alr_nc_critiques",
    title: "NC critiques ouvertes",
    description: "Non-conformités critiques en cours",
    category: "Alertes",
    kind: "kpi",
    permissionModule: "qualite_nc",
    defaultSize: { w: 3, h: 4 },
    fetch: async () => {
      const { count } = await supabase
        .from("quality_non_conformities")
        .select("id", { count: "exact", head: true })
        .eq("severity", "critical")
        .not("status", "in", "(closed,cancelled)");
      return { value: count ?? 0, hint: "sévérité critique", higherIsBetter: false };
    },
  },
  {
    id: "alr_pdr_rupture_table",
    title: "Références en rupture",
    description: "Pièces actives à stock nul ou sous le minimum",
    category: "Alertes",
    kind: "table",
    permissionModule: "pdr",
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      const { data } = await supabase
        .from("pdr")
        .select("reference, designation, stock_actuel, stock_min")
        .eq("is_active", true)
        .order("stock_actuel", { ascending: true })
        .limit(500);
      const rows = ((data ?? []) as any[])
        .filter((r) => Number(r.stock_actuel ?? 0) <= Number(r.stock_min ?? 0))
        .slice(0, ctx.limit);
      return {
        columns: [
          { key: "reference", label: "Référence" },
          { key: "designation", label: "Désignation" },
          { key: "stock", label: "Stock" },
          { key: "min", label: "Mini" },
        ],
        rows: rows.map((r) => ({
          reference: r.reference,
          designation: r.designation ?? "—",
          stock: r.stock_actuel ?? 0,
          min: r.stock_min ?? 0,
        })),
      };
    },
  },
  {
    id: "alr_preventifs_table",
    title: "Préventifs en retard (détail)",
    description: "Plans dont l'échéance est dépassée",
    category: "Alertes",
    kind: "table",
    permissionModule: "preventif",
    defaultSize: { w: 6, h: 9 },
    fetch: async (ctx) => {
      const { data } = await supabase
        .from("preventive_plans")
        .select("numero, title, prochaine_echeance, frequence, machines(designation)")
        .eq("is_active", true)
        .lt("prochaine_echeance", new Date().toISOString().slice(0, 10))
        .order("prochaine_echeance", { ascending: true })
        .limit(ctx.limit);
      return {
        columns: [
          { key: "numero", label: "N°" },
          { key: "titre", label: "Action" },
          { key: "machine", label: "Machine" },
          { key: "echeance", label: "Échéance" },
        ],
        rows: ((data ?? []) as any[]).map((r) => ({
          numero: r.numero ?? "—",
          titre: r.title ?? "—",
          machine: r.machines?.designation ?? "—",
          echeance: r.prochaine_echeance ?? "—",
        })),
      };
    },
  },
];

export const WIDGET_MAP = new Map(WIDGETS.map((w) => [w.id, w]));

export const WIDGET_CATEGORIES: WidgetCategory[] = [
  "Maintenance",
  "Production",
  "Qualité",
  "Stock PDR",
  "Inventaire",
  "Réception",
  "Alertes",
];

export const kindLabel = (w: WidgetDef) =>
  w.kind === "kpi"
    ? "KPI"
    : w.kind === "table"
      ? "Tableau"
      : w.chart === "pie"
        ? "Camembert"
        : w.chart === "line"
          ? "Courbe"
          : w.chart === "area"
            ? "Aire"
            : "Barres";

/** Style personnalisable d'un widget. */
export interface WidgetStyle {
  /** Clé de palette d'accent. */
  accent?: "primary" | "blue" | "emerald" | "amber" | "violet" | "rose" | "cyan";
  /** Taille du texte principal des KPI. */
  fontScale?: "sm" | "md" | "lg";
  /** Densité d'affichage. */
  density?: "compact" | "normal";
}

/** Élément de layout persisté dans `direction_dashboards.layout`. */
export interface LayoutItem {
  i: string;
  widgetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  filters?: import("@/lib/direction/filters").WidgetFilters;
  style?: WidgetStyle;
}
