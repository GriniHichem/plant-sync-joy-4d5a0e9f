import { supabase } from "@/integrations/supabase/client";

/**
 * Dashboard personnalisé — bibliothèque de widgets (LECTURE SEULE).
 * Chaque widget interroge les données existantes via le client Supabase :
 * les politiques RLS s'appliquent automatiquement et aucun module métier
 * n'est modifié.
 */

export type WidgetKind = "kpi" | "line" | "bar" | "pie" | "table";

export type WidgetModule =
  | "Maintenance"
  | "Production"
  | "Qualité"
  | "Stock PDR"
  | "Inventaire"
  | "Réception F&L"
  | "Alertes";

export type FilterKey = "line" | "product" | "supplier" | "campaign";

export interface KpiResult {
  value: string | number;
  subtitle?: string;
  /** valeur numérique brute utilisée pour la comparaison de périodes */
  raw?: number;
}
export interface SeriePoint {
  label: string;
  value: number;
  value2?: number;
}
export interface TableResult {
  columns: { key: string; label: string }[];
  rows: Record<string, string | number>[];
}

export type WidgetData = KpiResult | SeriePoint[] | TableResult;

export interface WidgetCtx {
  from: Date;
  to: Date;
  days: number;
  lineId?: string | null;
  productId?: string | null;
  supplierId?: string | null;
  campaignId?: string | null;
}

export interface WidgetDef {
  id: string;
  title: string;
  description: string;
  module: WidgetModule;
  kind: WidgetKind;
  /** module de permission requis pour afficher le widget */
  permission: string;
  /** filtres contextuels supportés par le widget */
  filters?: FilterKey[];
  fetch: (ctx: WidgetCtx) => Promise<WidgetData>;
}

/* ------------------------------------------------------------------ utils */

const iso = (d: Date) => d.toISOString();
const dayKey = (v: string | Date) => {
  const d = typeof v === "string" ? new Date(v) : v;
  return d.toISOString().slice(0, 10);
};
const monthKey = (v: string | Date) => dayKey(v).slice(0, 7);
const fmtDay = (k: string) => k.slice(8, 10) + "/" + k.slice(5, 7);
const fmtMonth = (k: string) => k.slice(5, 7) + "/" + k.slice(2, 4);

const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const pct = (a: number, b: number) => (b > 0 ? round((a / b) * 100) : 0);
const fmtNum = (v: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v);

/** Bucketisation adaptative : jour si période courte, mois sinon. */
function buckets(ctx: WidgetCtx) {
  const monthly = ctx.days > 70;
  const map = new Map<string, number>();
  const cur = new Date(ctx.from);
  cur.setHours(0, 0, 0, 0);
  let guard = 0;
  while (cur <= ctx.to && guard++ < 800) {
    map.set(monthly ? monthKey(cur) : dayKey(cur), 0);
    if (monthly) cur.setMonth(cur.getMonth() + 1);
    else cur.setDate(cur.getDate() + 1);
  }
  const key = (v: string | Date) => (monthly ? monthKey(v) : dayKey(v));
  const label = (k: string) => (monthly ? fmtMonth(k) : fmtDay(k));
  return { map, key, label, monthly };
}

function toSerie(b: ReturnType<typeof buckets>): SeriePoint[] {
  return Array.from(b.map.entries()).map(([k, v]) => ({ label: b.label(k), value: v }));
}

async function countOf(table: string, apply: (q: any) => any): Promise<number> {
  const { count } = await apply(
    (supabase as any).from(table).select("id", { count: "exact", head: true }),
  );
  return count ?? 0;
}

const inRange = (q: any, col: string, ctx: WidgetCtx) =>
  q.gte(col, iso(ctx.from)).lte(col, iso(ctx.to));

const maybeEq = (q: any, col: string, v?: string | null) => (v ? q.eq(col, v) : q);

const emptyKpi = (subtitle = "aucune donnée"): KpiResult => ({ value: "—", subtitle });

/* ------------------------------------------------------------- catalogue */

export const WIDGETS: WidgetDef[] = [
  /* ============================ Maintenance ============================ */
  {
    id: "mnt_tickets_ouverts",
    title: "Tickets ouverts",
    description: "Tickets non clôturés (tous statuts actifs)",
    module: "Maintenance",
    kind: "kpi",
    permission: "tickets",
    filters: ["line"],
    fetch: async (ctx) => {
      const value = await countOf("tickets", (q) =>
        maybeEq(q.in("statut", ["ouvert", "pris_en_charge", "en_cours"]), "ligne_id", ctx.lineId),
      );
      return { value, raw: value, subtitle: "en cours de traitement" };
    },
  },
  {
    id: "mnt_machines_arret",
    title: "Machines à l'arrêt",
    description: "Parc machines actuellement en arrêt ou maintenance",
    module: "Maintenance",
    kind: "kpi",
    permission: "machines",
    fetch: async () => {
      const value = await countOf("machines", (q) =>
        q.eq("is_active", true).in("statut", ["arret", "maintenance"]),
      );
      return { value, raw: value, subtitle: "arrêt / maintenance" };
    },
  },
  {
    id: "mnt_mttr",
    title: "MTTR",
    description: "Temps moyen de réparation (minutes) sur la période",
    module: "Maintenance",
    kind: "kpi",
    permission: "analytiques",
    filters: ["line"],
    fetch: async (ctx) => {
      const { data } = await maybeEq(
        inRange(supabase.from("tickets").select("temps_intervention_minutes"), "created_at", ctx),
        "ligne_id",
        ctx.lineId,
      ).not("temps_intervention_minutes", "is", null);
      const vals = (data ?? []).map((r: any) => num(r.temps_intervention_minutes)).filter((v) => v > 0);
      if (!vals.length) return emptyKpi();
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      return { value: `${round(avg)} min`, raw: avg, subtitle: `${vals.length} interventions` };
    },
  },
  {
    id: "mnt_mtbf",
    title: "MTBF",
    description: "Temps moyen entre pannes (heures) sur la période",
    module: "Maintenance",
    kind: "kpi",
    permission: "analytiques",
    filters: ["line"],
    fetch: async (ctx) => {
      const pannes = await countOf("tickets", (q) =>
        maybeEq(inRange(q, "created_at", ctx), "ligne_id", ctx.lineId),
      );
      if (!pannes) return emptyKpi("aucune panne");
      const hours = (ctx.to.getTime() - ctx.from.getTime()) / 3_600_000;
      const mtbf = hours / pannes;
      return { value: `${round(mtbf)} h`, raw: mtbf, subtitle: `${pannes} pannes déclarées` };
    },
  },
  {
    id: "mnt_disponibilite",
    title: "Taux de disponibilité équipements",
    description: "Part du temps d'ouverture sans arrêt machine",
    module: "Maintenance",
    kind: "kpi",
    permission: "analytiques",
    filters: ["line"],
    fetch: async (ctx) => {
      const machines = await countOf("machines", (q) => q.eq("is_active", true));
      if (!machines) return emptyKpi("aucune machine active");
      const { data } = await maybeEq(
        inRange(supabase.from("tickets").select("temps_arret_minutes"), "created_at", ctx),
        "ligne_id",
        ctx.lineId,
      );
      const arret = (data ?? []).reduce((a: number, r: any) => a + num(r.temps_arret_minutes), 0);
      const ouverture = ((ctx.to.getTime() - ctx.from.getTime()) / 60_000) * machines;
      const dispo = Math.max(0, 100 - (arret / ouverture) * 100);
      return { value: `${round(dispo)} %`, raw: dispo, subtitle: `${fmtNum(arret)} min d'arrêt` };
    },
  },
  {
    id: "mnt_tickets_jour",
    title: "Tickets déclarés",
    description: "Évolution du nombre de tickets créés",
    module: "Maintenance",
    kind: "line",
    permission: "tickets",
    filters: ["line"],
    fetch: async (ctx) => {
      const { data } = await maybeEq(
        inRange(supabase.from("tickets").select("created_at"), "created_at", ctx),
        "ligne_id",
        ctx.lineId,
      );
      const b = buckets(ctx);
      (data ?? []).forEach((r: any) => {
        const k = b.key(r.created_at);
        if (b.map.has(k)) b.map.set(k, (b.map.get(k) ?? 0) + 1);
      });
      return toSerie(b);
    },
  },
  {
    id: "mnt_arret_machine",
    title: "Temps d'arrêt par machine",
    description: "Cumul des minutes d'arrêt par machine (top 8)",
    module: "Maintenance",
    kind: "bar",
    permission: "analytiques",
    filters: ["line"],
    fetch: async (ctx) => {
      const { data } = await maybeEq(
        inRange(
          supabase.from("tickets").select("temps_arret_minutes, machines(code)"),
          "created_at",
          ctx,
        ),
        "ligne_id",
        ctx.lineId,
      ).not("machine_id", "is", null);
      const agg = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        const k = r.machines?.code ?? "—";
        agg.set(k, (agg.get(k) ?? 0) + num(r.temps_arret_minutes));
      });
      return Array.from(agg.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
    },
  },
  {
    id: "mnt_tickets_priorite",
    title: "Tickets par priorité",
    description: "Répartition des tickets sur la période",
    module: "Maintenance",
    kind: "pie",
    permission: "tickets",
    filters: ["line"],
    fetch: async (ctx) => {
      const { data } = await maybeEq(
        inRange(supabase.from("tickets").select("priorite"), "created_at", ctx),
        "ligne_id",
        ctx.lineId,
      );
      const agg = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        const k = r.priorite ?? "—";
        agg.set(k, (agg.get(k) ?? 0) + 1);
      });
      return Array.from(agg.entries()).map(([label, value]) => ({ label, value }));
    },
  },
  {
    id: "mnt_preventifs",
    title: "Préventifs réalisés",
    description: "Exécutions de plans préventifs sur la période",
    module: "Maintenance",
    kind: "kpi",
    permission: "preventif",
    fetch: async (ctx) => {
      const value = await countOf("preventive_executions", (q) =>
        inRange(q, "created_at", ctx),
      );
      return { value, raw: value, subtitle: "exécutions enregistrées" };
    },
  },
  {
    id: "mnt_derniers_tickets",
    title: "Derniers tickets",
    description: "Tableau des tickets les plus récents",
    module: "Maintenance",
    kind: "table",
    permission: "tickets",
    filters: ["line"],
    fetch: async (ctx) => {
      const { data } = await maybeEq(
        supabase
          .from("tickets")
          .select("numero, priorite, statut, heure_declaration, machines(code)"),
        "ligne_id",
        ctx.lineId,
      )
        .order("created_at", { ascending: false })
        .limit(10);
      return {
        columns: [
          { key: "numero", label: "N°" },
          { key: "machine", label: "Machine" },
          { key: "priorite", label: "Priorité" },
          { key: "statut", label: "Statut" },
        ],
        rows: (data ?? []).map((r: any) => ({
          numero: r.numero ?? "—",
          machine: r.machines?.code ?? "—",
          priorite: r.priorite ?? "—",
          statut: r.statut ?? "—",
        })),
      };
    },
  },

  /* ============================= Production ============================ */
  {
    id: "prd_production_periode",
    title: "Production sur la période",
    description: "Quantité produite déclarée",
    module: "Production",
    kind: "kpi",
    permission: "gpao_dashboard",
    filters: ["line", "product"],
    fetch: async (ctx) => {
      let q = inRange(
        supabase
          .from("production_declarations")
          .select("quantite_produite, quantite_rebut, ordres_fabrication!inner(line_id, product_id)"),
        "created_at",
        ctx,
      );
      if (ctx.lineId) q = q.eq("ordres_fabrication.line_id", ctx.lineId);
      if (ctx.productId) q = q.eq("ordres_fabrication.product_id", ctx.productId);
      const { data } = await q;
      const prod = (data ?? []).reduce((a: number, r: any) => a + num(r.quantite_produite), 0);
      const rebut = (data ?? []).reduce((a: number, r: any) => a + num(r.quantite_rebut), 0);
      return { value: fmtNum(prod), raw: prod, subtitle: `rebut : ${fmtNum(rebut)}` };
    },
  },
  {
    id: "prd_trg",
    title: "TRG (estimation)",
    description: "Disponibilité × Qualité à partir des arrêts et rebuts",
    module: "Production",
    kind: "kpi",
    permission: "gpao_dashboard",
    filters: ["line"],
    fetch: async (ctx) => {
      const lignes = await countOf("production_lines", (q) =>
        maybeEq(q.eq("is_active", true), "id", ctx.lineId),
      );
      if (!lignes) return emptyKpi("aucune ligne active");
      const { data: stops } = await maybeEq(
        inRange(supabase.from("production_stops").select("duree_minutes"), "created_at", ctx),
        "line_id",
        ctx.lineId,
      );
      let dq = inRange(
        supabase
          .from("production_declarations")
          .select("quantite_produite, quantite_rebut, ordres_fabrication!inner(line_id)"),
        "created_at",
        ctx,
      );
      if (ctx.lineId) dq = dq.eq("ordres_fabrication.line_id", ctx.lineId);
      const { data: decl } = await dq;
      const arret = (stops ?? []).reduce((a: number, r: any) => a + num(r.duree_minutes), 0);
      const ouverture = ((ctx.to.getTime() - ctx.from.getTime()) / 60_000) * lignes;
      const dispo = Math.max(0, Math.min(1, 1 - arret / (ouverture || 1)));
      const prod = (decl ?? []).reduce((a: number, r: any) => a + num(r.quantite_produite), 0);
      const rebut = (decl ?? []).reduce((a: number, r: any) => a + num(r.quantite_rebut), 0);
      if (!prod && !rebut) return emptyKpi("aucune déclaration");
      const qualite = prod / (prod + rebut || 1);
      const trg = dispo * qualite * 100;
      return {
        value: `${round(trg)} %`,
        raw: trg,
        subtitle: `dispo ${round(dispo * 100)} % · qualité ${round(qualite * 100)} %`,
      };
    },
  },
  {
    id: "prd_taux_rebut",
    title: "Taux de rebut",
    description: "Rebut / (produit + rebut) sur la période",
    module: "Production",
    kind: "kpi",
    permission: "gpao_dashboard",
    filters: ["line", "product"],
    fetch: async (ctx) => {
      let q = inRange(
        supabase
          .from("production_declarations")
          .select("quantite_produite, quantite_rebut, ordres_fabrication!inner(line_id, product_id)"),
        "created_at",
        ctx,
      );
      if (ctx.lineId) q = q.eq("ordres_fabrication.line_id", ctx.lineId);
      if (ctx.productId) q = q.eq("ordres_fabrication.product_id", ctx.productId);
      const { data } = await q;
      const prod = (data ?? []).reduce((a: number, r: any) => a + num(r.quantite_produite), 0);
      const rebut = (data ?? []).reduce((a: number, r: any) => a + num(r.quantite_rebut), 0);
      if (!prod && !rebut) return emptyKpi("aucune déclaration");
      const t = pct(rebut, prod + rebut);
      return { value: `${t} %`, raw: t, subtitle: `${fmtNum(rebut)} rebutés` };
    },
  },
  {
    id: "prd_cadence",
    title: "Cadence moyenne",
    description: "Quantité produite par heure déclarée",
    module: "Production",
    kind: "kpi",
    permission: "gpao_dashboard",
    filters: ["line", "product"],
    fetch: async (ctx) => {
      let q = inRange(
        supabase
          .from("production_declarations")
          .select("quantite_produite, ordres_fabrication!inner(line_id, product_id)"),
        "created_at",
        ctx,
      );
      if (ctx.lineId) q = q.eq("ordres_fabrication.line_id", ctx.lineId);
      if (ctx.productId) q = q.eq("ordres_fabrication.product_id", ctx.productId);
      const { data } = await q;
      const rows = data ?? [];
      if (!rows.length) return emptyKpi("aucune déclaration");
      const prod = rows.reduce((a: number, r: any) => a + num(r.quantite_produite), 0);
      const cad = prod / rows.length;
      return { value: `${fmtNum(round(cad))} /h`, raw: cad, subtitle: `${rows.length} heures déclarées` };
    },
  },
  {
    id: "prd_occupation_lignes",
    title: "Taux d'occupation des lignes",
    description: "Lignes avec un OF en cours / lignes actives",
    module: "Production",
    kind: "kpi",
    permission: "lignes",
    fetch: async () => {
      const total = await countOf("production_lines", (q) => q.eq("is_active", true));
      if (!total) return emptyKpi("aucune ligne active");
      const { data } = await supabase
        .from("ordres_fabrication")
        .select("line_id")
        .eq("statut", "en_cours");
      const used = new Set((data ?? []).map((r: any) => r.line_id).filter(Boolean)).size;
      const t = pct(used, total);
      return { value: `${t} %`, raw: t, subtitle: `${used}/${total} lignes occupées` };
    },
  },
  {
    id: "prd_of_en_cours",
    title: "OF en cours",
    description: "Ordres de fabrication actifs",
    module: "Production",
    kind: "kpi",
    permission: "of",
    filters: ["line", "product"],
    fetch: async (ctx) => {
      const value = await countOf("ordres_fabrication", (q) =>
        maybeEq(maybeEq(q.eq("statut", "en_cours"), "line_id", ctx.lineId), "product_id", ctx.productId),
      );
      return { value, raw: value, subtitle: "en production" };
    },
  },
  {
    id: "prd_production_jour",
    title: "Production par période",
    description: "Quantités déclarées par jour ou par mois",
    module: "Production",
    kind: "bar",
    permission: "gpao_dashboard",
    filters: ["line", "product"],
    fetch: async (ctx) => {
      let q = inRange(
        supabase
          .from("production_declarations")
          .select("created_at, quantite_produite, ordres_fabrication!inner(line_id, product_id)"),
        "created_at",
        ctx,
      );
      if (ctx.lineId) q = q.eq("ordres_fabrication.line_id", ctx.lineId);
      if (ctx.productId) q = q.eq("ordres_fabrication.product_id", ctx.productId);
      const { data } = await q;
      const b = buckets(ctx);
      (data ?? []).forEach((r: any) => {
        const k = b.key(r.created_at);
        if (b.map.has(k)) b.map.set(k, (b.map.get(k) ?? 0) + num(r.quantite_produite));
      });
      return toSerie(b);
    },
  },
  {
    id: "prd_arrets_type",
    title: "Arrêts par type",
    description: "Répartition des minutes d'arrêt production",
    module: "Production",
    kind: "pie",
    permission: "arrets",
    filters: ["line"],
    fetch: async (ctx) => {
      const { data } = await maybeEq(
        inRange(supabase.from("production_stops").select("type, duree_minutes"), "created_at", ctx),
        "line_id",
        ctx.lineId,
      );
      const agg = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        const k = r.type ?? "autre";
        agg.set(k, (agg.get(k) ?? 0) + num(r.duree_minutes));
      });
      return Array.from(agg.entries()).map(([label, value]) => ({ label, value }));
    },
  },
  {
    id: "prd_arrets_ligne",
    title: "Arrêts par ligne",
    description: "Minutes d'arrêt cumulées par ligne de production",
    module: "Production",
    kind: "bar",
    permission: "arrets",
    fetch: async (ctx) => {
      const { data } = await inRange(
        supabase.from("production_stops").select("duree_minutes, production_lines(code)"),
        "created_at",
        ctx,
      );
      const agg = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        const k = r.production_lines?.code ?? "—";
        agg.set(k, (agg.get(k) ?? 0) + num(r.duree_minutes));
      });
      return Array.from(agg.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    },
  },
  {
    id: "prd_of_statut",
    title: "OF par statut",
    description: "Répartition des ordres de fabrication",
    module: "Production",
    kind: "pie",
    permission: "of",
    filters: ["line"],
    fetch: async (ctx) => {
      const { data } = await maybeEq(
        inRange(supabase.from("ordres_fabrication").select("statut"), "created_at", ctx),
        "line_id",
        ctx.lineId,
      );
      const agg = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        const k = r.statut ?? "—";
        agg.set(k, (agg.get(k) ?? 0) + 1);
      });
      return Array.from(agg.entries()).map(([label, value]) => ({ label, value }));
    },
  },
  {
    id: "prd_of_recents",
    title: "OF récents",
    description: "Derniers ordres de fabrication",
    module: "Production",
    kind: "table",
    permission: "of",
    filters: ["line", "product"],
    fetch: async (ctx) => {
      const { data } = await maybeEq(
        maybeEq(
          supabase
            .from("ordres_fabrication")
            .select("numero, statut, quantite_prevue, quantite_produite, products(designation)"),
          "line_id",
          ctx.lineId,
        ),
        "product_id",
        ctx.productId,
      )
        .order("created_at", { ascending: false })
        .limit(10);
      return {
        columns: [
          { key: "numero", label: "OF" },
          { key: "produit", label: "Produit" },
          { key: "prevu", label: "Prévu" },
          { key: "produit_qte", label: "Produit" },
          { key: "statut", label: "Statut" },
        ],
        rows: (data ?? []).map((r: any) => ({
          numero: r.numero ?? "—",
          produit: r.products?.designation ?? "—",
          prevu: num(r.quantite_prevue),
          produit_qte: num(r.quantite_produite),
          statut: r.statut ?? "—",
        })),
      };
    },
  },

  /* ============================== Qualité ============================== */
  {
    id: "qlt_taux_conformite",
    title: "Taux de conformité",
    description: "Part des contrôles conformes sur la période",
    module: "Qualité",
    kind: "kpi",
    permission: "qualite_controles",
    filters: ["line", "product"],
    fetch: async (ctx) => {
      const { data } = await maybeEq(
        maybeEq(
          inRange(supabase.from("quality_checks").select("is_conform"), "control_time", ctx),
          "production_line_id",
          ctx.lineId,
        ),
        "product_id",
        ctx.productId,
      );
      const rows = data ?? [];
      if (!rows.length) return emptyKpi("aucun contrôle");
      const ok = rows.filter((r: any) => r.is_conform).length;
      const t = pct(ok, rows.length);
      return { value: `${t} %`, raw: t, subtitle: `${rows.length} contrôles` };
    },
  },
  {
    id: "qlt_nc_ouvertes",
    title: "Non-conformités ouvertes",
    description: "NC non clôturées / non annulées",
    module: "Qualité",
    kind: "kpi",
    permission: "qualite_nc",
    filters: ["line", "product"],
    fetch: async (ctx) => {
      const value = await countOf("quality_non_conformities", (q) =>
        maybeEq(
          maybeEq(q.not("status", "in", "(closed,cancelled)"), "production_line_id", ctx.lineId),
          "product_id",
          ctx.productId,
        ),
      );
      return { value, raw: value, subtitle: "à traiter" };
    },
  },
  {
    id: "qlt_nc_periode",
    title: "NC déclarées",
    description: "Nombre de non-conformités sur la période",
    module: "Qualité",
    kind: "kpi",
    permission: "qualite_nc",
    filters: ["line", "product"],
    fetch: async (ctx) => {
      const value = await countOf("quality_non_conformities", (q) =>
        maybeEq(
          maybeEq(inRange(q, "created_at", ctx), "production_line_id", ctx.lineId),
          "product_id",
          ctx.productId,
        ),
      );
      return { value, raw: value, subtitle: "sur la période" };
    },
  },
  {
    id: "qlt_reclamations",
    title: "Taux de réclamation produit fini",
    description: "NC produit fini majeures/critiques rapportées aux NC totales",
    module: "Qualité",
    kind: "kpi",
    permission: "qualite_nc",
    fetch: async (ctx) => {
      const total = await countOf("quality_non_conformities", (q) => inRange(q, "created_at", ctx));
      if (!total) return emptyKpi("aucune NC");
      const rec = await countOf("quality_non_conformities", (q) =>
        inRange(q, "created_at", ctx)
          .eq("nc_type", "produit_fini")
          .in("severity", ["major", "critical"]),
      );
      const t = pct(rec, total);
      return { value: `${t} %`, raw: t, subtitle: `${rec} / ${total} NC` };
    },
  },
  {
    id: "qlt_nc_severite",
    title: "NC par sévérité",
    description: "Répartition des non-conformités",
    module: "Qualité",
    kind: "pie",
    permission: "qualite_nc",
    fetch: async (ctx) => {
      const { data } = await inRange(
        supabase.from("quality_non_conformities").select("severity"),
        "created_at",
        ctx,
      );
      const agg = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        const k = r.severity ?? "—";
        agg.set(k, (agg.get(k) ?? 0) + 1);
      });
      return Array.from(agg.entries()).map(([label, value]) => ({ label, value }));
    },
  },
  {
    id: "qlt_nc_type",
    title: "NC par type",
    description: "Typologie des non-conformités (top 10)",
    module: "Qualité",
    kind: "bar",
    permission: "qualite_nc",
    fetch: async (ctx) => {
      const { data } = await inRange(
        supabase.from("quality_non_conformities").select("nc_type"),
        "created_at",
        ctx,
      );
      const agg = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        const k = r.nc_type ?? "—";
        agg.set(k, (agg.get(k) ?? 0) + 1);
      });
      return Array.from(agg.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    },
  },
  {
    id: "qlt_controles_jour",
    title: "Contrôles (conformes vs non conformes)",
    description: "Évolution des contrôles qualité",
    module: "Qualité",
    kind: "line",
    permission: "qualite_controles",
    filters: ["line", "product"],
    fetch: async (ctx) => {
      const { data } = await maybeEq(
        maybeEq(
          inRange(
            supabase.from("quality_checks").select("control_time, is_conform"),
            "control_time",
            ctx,
          ),
          "production_line_id",
          ctx.lineId,
        ),
        "product_id",
        ctx.productId,
      );
      const ok = buckets(ctx);
      const ko = buckets(ctx);
      (data ?? []).forEach((r: any) => {
        const k = ok.key(r.control_time);
        const target = r.is_conform ? ok.map : ko.map;
        if (target.has(k)) target.set(k, (target.get(k) ?? 0) + 1);
      });
      return Array.from(ok.map.entries()).map(([k, v]) => ({
        label: ok.label(k),
        value: v,
        value2: ko.map.get(k) ?? 0,
      }));
    },
  },
  {
    id: "qlt_actions_retard",
    title: "Actions qualité en retard",
    description: "Actions non clôturées dont l'échéance est dépassée",
    module: "Qualité",
    kind: "kpi",
    permission: "qualite_actions",
    fetch: async () => {
      const value = await countOf("quality_actions", (q) =>
        q
          .lt("due_date", new Date().toISOString())
          .not("status", "in", "(done,verified,closed,cancelled)"),
      );
      return { value, raw: value, subtitle: "échéance dépassée" };
    },
  },
  {
    id: "qlt_hors_limite",
    title: "Contrôles hors limite",
    description: "Dernières mesures non conformes",
    module: "Qualité",
    kind: "table",
    permission: "qualite_controles",
    fetch: async (ctx) => {
      const { data } = await inRange(
        supabase
          .from("quality_checks")
          .select("control_time, measured_value_numeric, unit, quality_indicators(name)"),
        "control_time",
        ctx,
      )
        .eq("is_conform", false)
        .order("control_time", { ascending: false })
        .limit(10);
      return {
        columns: [
          { key: "date", label: "Date" },
          { key: "indicateur", label: "Indicateur" },
          { key: "valeur", label: "Valeur" },
        ],
        rows: (data ?? []).map((r: any) => ({
          date: r.control_time ? new Date(r.control_time).toLocaleString("fr-FR") : "—",
          indicateur: r.quality_indicators?.name ?? "—",
          valeur:
            r.measured_value_numeric != null
              ? `${r.measured_value_numeric}${r.unit ? " " + r.unit : ""}`
              : "—",
        })),
      };
    },
  },
  {
    id: "qlt_derniers_controles",
    title: "Derniers contrôles",
    description: "Historique des mesures qualité récentes",
    module: "Qualité",
    kind: "table",
    permission: "qualite_controles",
    fetch: async () => {
      const { data } = await supabase
        .from("quality_checks")
        .select("control_time, is_conform, measured_value_numeric, unit, quality_indicators(name)")
        .order("control_time", { ascending: false })
        .limit(10);
      return {
        columns: [
          { key: "date", label: "Date" },
          { key: "indicateur", label: "Indicateur" },
          { key: "valeur", label: "Valeur" },
          { key: "statut", label: "Statut" },
        ],
        rows: (data ?? []).map((r: any) => ({
          date: r.control_time ? new Date(r.control_time).toLocaleString("fr-FR") : "—",
          indicateur: r.quality_indicators?.name ?? "—",
          valeur:
            r.measured_value_numeric != null
              ? `${r.measured_value_numeric}${r.unit ? " " + r.unit : ""}`
              : "—",
          statut: r.is_conform ? "OK" : "NOK",
        })),
      };
    },
  },

  /* ============================== Stock PDR ============================ */
  {
    id: "pdr_sous_mini",
    title: "PDR sous stock mini",
    description: "Références dont le stock est inférieur au minimum",
    module: "Stock PDR",
    kind: "kpi",
    permission: "pdr",
    fetch: async () => {
      const { data } = await supabase
        .from("pdr")
        .select("stock_actuel, stock_min")
        .eq("is_active", true);
      const value = (data ?? []).filter(
        (r: any) => num(r.stock_min) > 0 && num(r.stock_actuel) < num(r.stock_min),
      ).length;
      return { value, raw: value, subtitle: "à réapprovisionner" };
    },
  },
  {
    id: "pdr_valeur_stock",
    title: "Valeur du stock PDR",
    description: "Stock actuel valorisé (PMP ou prix unitaire)",
    module: "Stock PDR",
    kind: "kpi",
    permission: "pdr",
    fetch: async () => {
      const { data } = await supabase
        .from("pdr")
        .select("stock_actuel, pmp, prix_unitaire")
        .eq("is_active", true);
      const total = (data ?? []).reduce(
        (a: number, r: any) => a + num(r.stock_actuel) * (num(r.pmp) || num(r.prix_unitaire)),
        0,
      );
      return { value: fmtNum(round(total, 0)), raw: total, subtitle: "valorisation courante" };
    },
  },
  {
    id: "pdr_rotation",
    title: "Rotation des stocks",
    description: "Sorties de la période / stock moyen",
    module: "Stock PDR",
    kind: "kpi",
    permission: "pdr",
    fetch: async (ctx) => {
      const { data: stock } = await supabase
        .from("pdr")
        .select("stock_actuel")
        .eq("is_active", true);
      const total = (stock ?? []).reduce((a: number, r: any) => a + num(r.stock_actuel), 0);
      if (!total) return emptyKpi("stock nul");
      const { data: mv } = await inRange(
        supabase.from("pdr_stock_movements").select("quantite"),
        "created_at",
        ctx,
      ).eq("type", "sortie");
      const sorties = (mv ?? []).reduce((a: number, r: any) => a + Math.abs(num(r.quantite)), 0);
      const rot = sorties / total;
      return { value: round(rot, 2), raw: rot, subtitle: `${fmtNum(sorties)} sorties` };
    },
  },
  {
    id: "pdr_taux_rupture",
    title: "Taux de rupture",
    description: "Références actives à stock nul",
    module: "Stock PDR",
    kind: "kpi",
    permission: "pdr",
    fetch: async () => {
      const { data } = await supabase.from("pdr").select("stock_actuel").eq("is_active", true);
      const rows = data ?? [];
      if (!rows.length) return emptyKpi("aucune référence");
      const rupt = rows.filter((r: any) => num(r.stock_actuel) <= 0).length;
      const t = pct(rupt, rows.length);
      return { value: `${t} %`, raw: t, subtitle: `${rupt} références en rupture` };
    },
  },
  {
    id: "pdr_delai_reappro",
    title: "Délai moyen de réapprovisionnement",
    description: "Moyenne des délais d'approvisionnement renseignés",
    module: "Stock PDR",
    kind: "kpi",
    permission: "pdr",
    fetch: async () => {
      const { data } = await supabase
        .from("pdr")
        .select("delai_approvisionnement")
        .eq("is_active", true)
        .not("delai_approvisionnement", "is", null);
      const vals = (data ?? []).map((r: any) => num(r.delai_approvisionnement)).filter((v) => v > 0);
      if (!vals.length) return emptyKpi();
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      return { value: `${round(avg)} j`, raw: avg, subtitle: `${vals.length} références` };
    },
  },
  {
    id: "pdr_mouvements_jour",
    title: "Mouvements de stock",
    description: "Nombre de mouvements enregistrés",
    module: "Stock PDR",
    kind: "line",
    permission: "pdr",
    fetch: async (ctx) => {
      const { data } = await inRange(
        supabase.from("pdr_stock_movements").select("created_at"),
        "created_at",
        ctx,
      );
      const b = buckets(ctx);
      (data ?? []).forEach((r: any) => {
        const k = b.key(r.created_at);
        if (b.map.has(k)) b.map.set(k, (b.map.get(k) ?? 0) + 1);
      });
      return toSerie(b);
    },
  },
  {
    id: "pdr_demandes_attente",
    title: "Demandes PDR en attente",
    description: "Demandes non servies (demandée / prête)",
    module: "Stock PDR",
    kind: "kpi",
    permission: "pdr_demandes",
    fetch: async () => {
      const value = await countOf("pdr_requests", (q) => q.in("statut", ["demandee", "prete"]));
      return { value, raw: value, subtitle: "à traiter au magasin" };
    },
  },
  {
    id: "pdr_critiques",
    title: "Stock critique",
    description: "Liste des pièces sous le seuil minimum",
    module: "Stock PDR",
    kind: "table",
    permission: "pdr",
    fetch: async () => {
      const { data } = await supabase
        .from("pdr")
        .select("reference, designation, stock_actuel, stock_min")
        .eq("is_active", true)
        .limit(500);
      const rows = (data ?? [])
        .filter((r: any) => num(r.stock_min) > 0 && num(r.stock_actuel) < num(r.stock_min))
        .slice(0, 10)
        .map((r: any) => ({
          reference: r.reference ?? "—",
          designation: r.designation ?? "—",
          stock: num(r.stock_actuel),
          mini: num(r.stock_min),
        }));
      return {
        columns: [
          { key: "reference", label: "Réf." },
          { key: "designation", label: "Désignation" },
          { key: "stock", label: "Stock" },
          { key: "mini", label: "Mini" },
        ],
        rows,
      };
    },
  },

  /* ============================= Inventaire ============================ */
  {
    id: "inv_campagnes",
    title: "Campagnes d'inventaire en cours",
    description: "Campagnes ouvertes ou en arbitrage",
    module: "Inventaire",
    kind: "kpi",
    permission: "inventaire",
    fetch: async () => {
      const value = await countOf("inventory_campaigns", (q) =>
        q.in("status", ["en_cours", "arbitrage"]),
      );
      return { value, raw: value, subtitle: "en cours / arbitrage" };
    },
  },
  {
    id: "inv_avancement",
    title: "Avancement des comptages",
    description: "Cibles clôturées / cibles totales",
    module: "Inventaire",
    kind: "kpi",
    permission: "inventaire",
    filters: ["campaign"],
    fetch: async (ctx) => {
      const total = await countOf("inventory_targets", (q) =>
        maybeEq(q, "campaign_id", ctx.campaignId),
      );
      if (!total) return emptyKpi("aucune cible");
      const done = await countOf("inventory_targets", (q) =>
        maybeEq(q.in("status", ["conforme", "cloture"]), "campaign_id", ctx.campaignId),
      );
      const t = pct(done, total);
      return { value: `${t} %`, raw: t, subtitle: `${done}/${total} cibles` };
    },
  },
  {
    id: "inv_ecarts",
    title: "Écarts d'inventaire",
    description: "Résultats présentant un écart entre comptages",
    module: "Inventaire",
    kind: "kpi",
    permission: "inventaire",
    filters: ["campaign"],
    fetch: async (ctx) => {
      const { data } = await maybeEq(
        supabase.from("inventory_results").select("ecart_ab"),
        "campaign_id",
        ctx.campaignId,
      );
      const rows = data ?? [];
      const ecarts = rows.filter((r: any) => num(r.ecart_ab) !== 0).length;
      return { value: ecarts, raw: ecarts, subtitle: `${rows.length} résultats` };
    },
  },
  {
    id: "inv_campagnes_table",
    title: "Campagnes d'inventaire",
    description: "Dernières campagnes et leur statut",
    module: "Inventaire",
    kind: "table",
    permission: "inventaire_campagnes",
    fetch: async () => {
      const { data } = await supabase
        .from("inventory_campaigns")
        .select("code, label, status, campaign_type, date_debut")
        .order("created_at", { ascending: false })
        .limit(10);
      return {
        columns: [
          { key: "code", label: "Code" },
          { key: "label", label: "Libellé" },
          { key: "type", label: "Type" },
          { key: "statut", label: "Statut" },
        ],
        rows: (data ?? []).map((r: any) => ({
          code: r.code ?? "—",
          label: r.label ?? "—",
          type: r.campaign_type ?? "—",
          statut: r.status ?? "—",
        })),
      };
    },
  },

  /* =========================== Réception F&L =========================== */
  {
    id: "rcp_tickets",
    title: "Tickets réception traités",
    description: "Nombre de tickets créés sur la période",
    module: "Réception F&L",
    kind: "kpi",
    permission: "reception_global",
    filters: ["supplier", "product", "campaign"],
    fetch: async (ctx) => {
      const value = await countOf("reception_tickets", (q) =>
        maybeEq(
          maybeEq(maybeEq(inRange(q, "created_at", ctx), "supplier_id", ctx.supplierId), "product_id", ctx.productId),
          "campaign_id",
          ctx.campaignId,
        ),
      );
      return { value, raw: value, subtitle: "sur la période" };
    },
  },
  {
    id: "rcp_poids_total",
    title: "Poids total réceptionné",
    description: "Somme des poids nets pesés (kg)",
    module: "Réception F&L",
    kind: "kpi",
    permission: "reception_global",
    filters: ["supplier", "product"],
    fetch: async (ctx) => {
      let q = inRange(
        supabase
          .from("reception_weighings")
          .select("poids_net_kg, poids_brut_kg, reception_tickets!inner(supplier_id, product_id)"),
        "created_at",
        ctx,
      );
      if (ctx.supplierId) q = q.eq("reception_tickets.supplier_id", ctx.supplierId);
      if (ctx.productId) q = q.eq("reception_tickets.product_id", ctx.productId);
      const { data } = await q;
      const net = (data ?? []).reduce((a: number, r: any) => a + num(r.poids_net_kg), 0);
      const brut = (data ?? []).reduce((a: number, r: any) => a + num(r.poids_brut_kg), 0);
      if (!brut) return emptyKpi("aucune pesée");
      return { value: `${fmtNum(round(net, 0))} kg`, raw: net, subtitle: `brut ${fmtNum(round(brut, 0))} kg` };
    },
  },
  {
    id: "rcp_abattement",
    title: "Taux d'abattement moyen",
    description: "Moyenne des taux d'abattement appliqués",
    module: "Réception F&L",
    kind: "kpi",
    permission: "reception_global",
    filters: ["supplier", "product"],
    fetch: async (ctx) => {
      const { data } = await maybeEq(
        maybeEq(
          inRange(supabase.from("reception_tickets").select("taux_abattement"), "created_at", ctx),
          "supplier_id",
          ctx.supplierId,
        ),
        "product_id",
        ctx.productId,
      ).not("taux_abattement", "is", null);
      const vals = (data ?? []).map((r: any) => num(r.taux_abattement));
      if (!vals.length) return emptyKpi();
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      return { value: `${round(avg, 2)} %`, raw: avg, subtitle: `${vals.length} tickets` };
    },
  },
  {
    id: "rcp_taux_rejet",
    title: "Taux de rejet",
    description: "Tickets annulés rapportés au total de la période",
    module: "Réception F&L",
    kind: "kpi",
    permission: "reception_global",
    filters: ["supplier"],
    fetch: async (ctx) => {
      const total = await countOf("reception_tickets", (q) =>
        maybeEq(inRange(q, "created_at", ctx), "supplier_id", ctx.supplierId),
      );
      if (!total) return emptyKpi("aucun ticket");
      const rejet = await countOf("reception_tickets", (q) =>
        maybeEq(inRange(q, "created_at", ctx), "supplier_id", ctx.supplierId).eq("statut", "annule"),
      );
      const t = pct(rejet, total);
      return { value: `${t} %`, raw: t, subtitle: `${rejet} / ${total} tickets` };
    },
  },
  {
    id: "rcp_non_peses",
    title: "Tickets non pesés",
    description: "Tickets en attente de pesée au pont-bascule",
    module: "Réception F&L",
    kind: "kpi",
    permission: "reception_global",
    fetch: async () => {
      const value = await countOf("reception_tickets", (q) => q.eq("statut", "a_peser"));
      return { value, raw: value, subtitle: "en attente de pesée" };
    },
  },
  {
    id: "rcp_par_jour",
    title: "Réceptions par période",
    description: "Nombre de tickets réception",
    module: "Réception F&L",
    kind: "bar",
    permission: "reception_global",
    filters: ["supplier", "product"],
    fetch: async (ctx) => {
      const { data } = await maybeEq(
        maybeEq(
          inRange(supabase.from("reception_tickets").select("created_at"), "created_at", ctx),
          "supplier_id",
          ctx.supplierId,
        ),
        "product_id",
        ctx.productId,
      );
      const b = buckets(ctx);
      (data ?? []).forEach((r: any) => {
        const k = b.key(r.created_at);
        if (b.map.has(k)) b.map.set(k, (b.map.get(k) ?? 0) + 1);
      });
      return toSerie(b);
    },
  },
  {
    id: "rcp_poids_jour",
    title: "Poids net réceptionné",
    description: "Évolution du tonnage net pesé (kg)",
    module: "Réception F&L",
    kind: "line",
    permission: "reception_global",
    fetch: async (ctx) => {
      const { data } = await inRange(
        supabase.from("reception_weighings").select("created_at, poids_net_kg"),
        "created_at",
        ctx,
      );
      const b = buckets(ctx);
      (data ?? []).forEach((r: any) => {
        const k = b.key(r.created_at);
        if (b.map.has(k)) b.map.set(k, (b.map.get(k) ?? 0) + num(r.poids_net_kg));
      });
      return toSerie(b);
    },
  },
  {
    id: "rcp_top_fournisseurs",
    title: "Top fournisseurs",
    description: "Nombre de tickets par fournisseur (top 10)",
    module: "Réception F&L",
    kind: "bar",
    permission: "reception_global",
    fetch: async (ctx) => {
      const { data } = await inRange(
        supabase.from("reception_tickets").select("reception_suppliers(nom)"),
        "created_at",
        ctx,
      );
      const agg = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        const k = r.reception_suppliers?.nom ?? "—";
        agg.set(k, (agg.get(k) ?? 0) + 1);
      });
      return Array.from(agg.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    },
  },
  {
    id: "rcp_consultation",
    title: "Consultation réception",
    description: "Derniers tickets réception (fournisseur, produit)",
    module: "Réception F&L",
    kind: "table",
    permission: "reception_global",
    filters: ["supplier", "product"],
    fetch: async (ctx) => {
      const { data } = await maybeEq(
        maybeEq(
          supabase
            .from("reception_tickets")
            .select(
              "numero, date_ticket, taux_abattement, statut, reception_suppliers(nom), reception_products(designation)",
            ),
          "supplier_id",
          ctx.supplierId,
        ),
        "product_id",
        ctx.productId,
      )
        .order("numero", { ascending: false })
        .limit(10);
      return {
        columns: [
          { key: "numero", label: "N°" },
          { key: "date", label: "Date" },
          { key: "fournisseur", label: "Fournisseur" },
          { key: "produit", label: "Produit" },
          { key: "abattement", label: "Abatt. %" },
        ],
        rows: (data ?? []).map((r: any) => ({
          numero: r.numero ?? "—",
          date: r.date_ticket ?? "—",
          fournisseur: r.reception_suppliers?.nom ?? "—",
          produit: r.reception_products?.designation ?? "—",
          abattement: r.taux_abattement != null ? num(r.taux_abattement) : "—",
        })),
      };
    },
  },

  /* =============================== Alertes ============================= */
  {
    id: "alr_critiques",
    title: "Alertes critiques non lues",
    description: "Notifications critiques en attente de lecture",
    module: "Alertes",
    kind: "kpi",
    permission: "notifications",
    fetch: async () => {
      const value = await countOf("notifications", (q) =>
        q.eq("status", "unread").eq("is_critical", true),
      );
      return { value, raw: value, subtitle: "à traiter" };
    },
  },
  {
    id: "alr_par_module",
    title: "Alertes par module",
    description: "Répartition des notifications de la période",
    module: "Alertes",
    kind: "pie",
    permission: "notifications",
    fetch: async (ctx) => {
      const { data } = await inRange(
        supabase.from("notifications").select("module"),
        "created_at",
        ctx,
      );
      const agg = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        const k = r.module ?? "—";
        agg.set(k, (agg.get(k) ?? 0) + 1);
      });
      return Array.from(agg.entries()).map(([label, value]) => ({ label, value }));
    },
  },
  {
    id: "alr_dernieres",
    title: "Dernières anomalies",
    description: "Notifications les plus récentes",
    module: "Alertes",
    kind: "table",
    permission: "notifications",
    fetch: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("title, module, severity, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      return {
        columns: [
          { key: "date", label: "Date" },
          { key: "module", label: "Module" },
          { key: "titre", label: "Alerte" },
          { key: "severite", label: "Sévérité" },
        ],
        rows: (data ?? []).map((r: any) => ({
          date: r.created_at ? new Date(r.created_at).toLocaleDateString("fr-FR") : "—",
          module: r.module ?? "—",
          titre: r.title ?? "—",
          severite: r.severity ?? "—",
        })),
      };
    },
  },
];

export const WIDGETS_BY_ID = new Map(WIDGETS.map((w) => [w.id, w]));

export const WIDGET_MODULES: WidgetModule[] = [
  "Maintenance",
  "Production",
  "Qualité",
  "Stock PDR",
  "Inventaire",
  "Réception F&L",
  "Alertes",
];

/** couleur d'accent par module (tokens sémantiques) */
export const MODULE_ACCENT: Record<WidgetModule, string> = {
  Maintenance: "primary",
  Production: "chart2",
  Qualité: "chart3",
  "Stock PDR": "chart4",
  Inventaire: "chart5",
  "Réception F&L": "chart2",
  Alertes: "destructive",
};

/* --------------------------------------------------------------- périodes */

export type PeriodPresetId =
  | "today"
  | "week"
  | "month"
  | "quarter"
  | "year"
  | "d7"
  | "d30"
  | "d90"
  | "custom";

export interface ResolvedPeriod {
  from: Date;
  to: Date;
  days: number;
  label: string;
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

export const PERIOD_PRESETS: { id: PeriodPresetId; label: string }[] = [
  { id: "today", label: "Aujourd'hui" },
  { id: "week", label: "Cette semaine" },
  { id: "month", label: "Ce mois" },
  { id: "quarter", label: "Ce trimestre" },
  { id: "year", label: "Cette année" },
  { id: "d7", label: "7 derniers jours" },
  { id: "d30", label: "30 derniers jours" },
  { id: "d90", label: "90 derniers jours" },
  { id: "custom", label: "Période personnalisée" },
];

export function resolvePeriod(
  preset: PeriodPresetId,
  customFrom?: string | null,
  customTo?: string | null,
): ResolvedPeriod {
  const now = new Date();
  const to = endOfDay(now);
  let from = startOfDay(now);
  let label = "Aujourd'hui";

  switch (preset) {
    case "today":
      break;
    case "week": {
      const d = startOfDay(now);
      const dow = (d.getDay() + 6) % 7; // lundi = 0
      d.setDate(d.getDate() - dow);
      from = d;
      label = "Cette semaine";
      break;
    }
    case "month":
      from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      label = "Ce mois";
      break;
    case "quarter":
      from = startOfDay(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1));
      label = "Ce trimestre";
      break;
    case "year":
      from = startOfDay(new Date(now.getFullYear(), 0, 1));
      label = "Cette année";
      break;
    case "d7":
    case "d30":
    case "d90": {
      const n = preset === "d7" ? 7 : preset === "d30" ? 30 : 90;
      const d = startOfDay(now);
      d.setDate(d.getDate() - (n - 1));
      from = d;
      label = `${n} derniers jours`;
      break;
    }
    case "custom": {
      const f = customFrom ? startOfDay(new Date(customFrom)) : startOfDay(now);
      const t = customTo ? endOfDay(new Date(customTo)) : to;
      const days = Math.max(1, Math.round((t.getTime() - f.getTime()) / 86_400_000));
      return {
        from: f,
        to: t,
        days,
        label: `${f.toLocaleDateString("fr-FR")} → ${t.toLocaleDateString("fr-FR")}`,
      };
    }
  }

  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
  return { from, to, days, label };
}

/** période précédente de même durée (pour comparaison) */
export function previousPeriod(p: ResolvedPeriod): ResolvedPeriod {
  const span = p.to.getTime() - p.from.getTime();
  const to = new Date(p.from.getTime() - 1);
  const from = new Date(to.getTime() - span);
  return { from, to, days: p.days, label: "Période précédente" };
}

/* ------------------------------------------------------------- layouts */

export interface WidgetFilters {
  lineId?: string | null;
  productId?: string | null;
  supplierId?: string | null;
  campaignId?: string | null;
}

export interface DashboardWidget {
  /** identifiant unique de l'instance dans le layout */
  uid: string;
  widgetId: string;
  /** titre personnalisé */
  title?: string;
  /** largeur en colonnes (sur 4) */
  w: 1 | 2 | 3 | 4;
  /** hauteur relative */
  h: "sm" | "md" | "lg";
  /** période locale ; null/undefined = période globale du dashboard */
  period?: PeriodPresetId | null;
  customFrom?: string | null;
  customTo?: string | null;
  /** filtres locaux ; sinon filtres globaux */
  filters?: WidgetFilters;
  useGlobalFilters?: boolean;
  /** comparaison avec la période précédente (KPI) */
  compare?: boolean;
  /** personnalisation visuelle */
  accent?: string;
  align?: "left" | "center";
  emphasis?: "normal" | "large";
  /** ancien champ (compat) : période en jours */
  days?: number;
}

export interface DashboardVersion {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  updatedAt: string;
}

export interface SavedFilter {
  id: string;
  name: string;
  period: PeriodPresetId;
  customFrom?: string | null;
  customTo?: string | null;
  filters: WidgetFilters;
}

export interface DashboardConfig {
  widgets: DashboardWidget[];
  period: PeriodPresetId;
  customFrom?: string | null;
  customTo?: string | null;
  filters: WidgetFilters;
  compare: boolean;
  refreshSeconds: number;
  columns: 1 | 2 | 3 | 4;
  versions: DashboardVersion[];
  savedFilters: SavedFilter[];
  /** compat ancien format */
  defaultDays?: number;
}

export const EMPTY_CONFIG: DashboardConfig = {
  widgets: [],
  period: "month",
  customFrom: null,
  customTo: null,
  filters: {},
  compare: false,
  refreshSeconds: 60,
  columns: 4,
  versions: [],
  savedFilters: [],
};

function daysToPreset(d?: number): PeriodPresetId {
  if (d === 7) return "d7";
  if (d === 90) return "d90";
  if (d === 365) return "year";
  return "d30";
}

export function parseConfig(raw: unknown): DashboardConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...EMPTY_CONFIG };
  const o = raw as Partial<DashboardConfig> & { defaultDays?: number };
  const widgets = (Array.isArray(o.widgets) ? o.widgets : []).map((w: any) => ({
    uid: String(w.uid ?? `${w.widgetId}-${Math.random().toString(36).slice(2, 8)}`),
    widgetId: String(w.widgetId),
    title: w.title,
    w: ([1, 2, 3, 4].includes(w.w) ? w.w : 2) as DashboardWidget["w"],
    h: (["sm", "md", "lg"].includes(w.h) ? w.h : "md") as DashboardWidget["h"],
    period: w.period ?? (typeof w.days === "number" && w.days > 0 ? daysToPreset(w.days) : null),
    customFrom: w.customFrom ?? null,
    customTo: w.customTo ?? null,
    filters: w.filters ?? {},
    useGlobalFilters: w.useGlobalFilters !== false,
    compare: !!w.compare,
    accent: w.accent ?? undefined,
    align: w.align ?? "left",
    emphasis: w.emphasis ?? "normal",
  }));

  return {
    widgets,
    period: (o.period ?? daysToPreset(o.defaultDays)) as PeriodPresetId,
    customFrom: o.customFrom ?? null,
    customTo: o.customTo ?? null,
    filters: o.filters ?? {},
    compare: !!o.compare,
    refreshSeconds: typeof o.refreshSeconds === "number" ? o.refreshSeconds : 60,
    columns: ([1, 2, 3, 4].includes(o.columns as number) ? o.columns : 4) as DashboardConfig["columns"],
    versions: Array.isArray(o.versions) ? (o.versions as DashboardVersion[]) : [],
    savedFilters: Array.isArray(o.savedFilters) ? (o.savedFilters as SavedFilter[]) : [],
  };
}

export const REFRESH_OPTIONS = [
  { value: 0, label: "Manuel" },
  { value: 30, label: "30 s" },
  { value: 60, label: "1 min" },
  { value: 300, label: "5 min" },
];
