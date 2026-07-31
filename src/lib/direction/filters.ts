/**
 * Filtres du Dashboard Direction.
 *
 * Module 100 % lecture seule : ces helpers ne font que calculer des bornes de
 * dates et transporter des identifiants de filtres contextuels vers les
 * requêtes de widgets. Aucun workflow métier n'est impacté.
 */

export type PeriodKey =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "90d"
  | "week"
  | "month"
  | "quarter"
  | "year"
  | "custom";

export const PERIOD_OPTIONS: { key: PeriodKey; label: string; short: string }[] = [
  { key: "today", label: "Aujourd'hui", short: "Auj." },
  { key: "yesterday", label: "Hier", short: "Hier" },
  { key: "7d", label: "7 derniers jours", short: "7 j" },
  { key: "30d", label: "30 derniers jours", short: "30 j" },
  { key: "90d", label: "90 derniers jours", short: "90 j" },
  { key: "week", label: "Cette semaine", short: "Semaine" },
  { key: "month", label: "Ce mois", short: "Mois" },
  { key: "quarter", label: "Ce trimestre", short: "Trim." },
  { key: "year", label: "Cette année", short: "Année" },
  { key: "custom", label: "Période personnalisée", short: "Perso" },
];

/** Filtres partagés (globaux) ou surchargés localement par un widget. */
export interface DashboardFilters {
  period?: PeriodKey;
  /** Bornes ISO (yyyy-mm-dd) utilisées quand period = "custom". */
  from?: string;
  to?: string;
  /** Comparer avec la période précédente de même durée. */
  compare?: boolean;
  lineId?: string;
  productId?: string;
  supplierId?: string;
  campaignId?: string;
}

/** Filtres propres à un widget. */
export interface WidgetFilters extends DashboardFilters {
  /** Si false, le widget ignore les filtres globaux (filtre local). */
  useGlobal?: boolean;
  limit?: number;
  /** Rétro-compatibilité avec l'ancienne configuration (fenêtre en jours). */
  days?: number;
}

export interface WidgetCtx {
  /** Borne basse incluse (ISO complet). */
  from: string;
  /** Borne haute exclue (ISO complet). */
  to: string;
  /** Dates seules (yyyy-mm-dd) pour les colonnes `date`. */
  fromDate: string;
  toDate: string;
  prevFrom: string;
  prevTo: string;
  prevFromDate: string;
  prevToDate: string;
  days: number;
  label: string;
  compare: boolean;
  limit: number;
  lineId?: string;
  productId?: string;
  supplierId?: string;
  campaignId?: string;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400_000);
const dOnly = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function rangeFor(period: PeriodKey, from?: string, to?: string): { start: Date; end: Date } {
  const now = new Date();
  const today = startOfDay(now);
  switch (period) {
    case "today":
      return { start: today, end: addDays(today, 1) };
    case "yesterday":
      return { start: addDays(today, -1), end: today };
    case "7d":
      return { start: addDays(today, -6), end: addDays(today, 1) };
    case "30d":
      return { start: addDays(today, -29), end: addDays(today, 1) };
    case "90d":
      return { start: addDays(today, -89), end: addDays(today, 1) };
    case "week": {
      const dow = (today.getDay() + 6) % 7; // lundi = 0
      return { start: addDays(today, -dow), end: addDays(today, 1) };
    }
    case "month":
      return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: addDays(today, 1) };
    case "quarter": {
      const q = Math.floor(today.getMonth() / 3) * 3;
      return { start: new Date(today.getFullYear(), q, 1), end: addDays(today, 1) };
    }
    case "year":
      return { start: new Date(today.getFullYear(), 0, 1), end: addDays(today, 1) };
    case "custom": {
      const s = from ? new Date(`${from}T00:00:00`) : addDays(today, -6);
      const e = to ? addDays(new Date(`${to}T00:00:00`), 1) : addDays(today, 1);
      return { start: s, end: e > s ? e : addDays(s, 1) };
    }
    default:
      return { start: addDays(today, -6), end: addDays(today, 1) };
  }
}

/** Fusionne filtres globaux + filtres locaux d'un widget en contexte de requête. */
export function resolveCtx(global: DashboardFilters, local?: WidgetFilters): WidgetCtx {
  const useGlobal = local?.useGlobal !== false;
  const base: DashboardFilters = useGlobal ? { ...global, ...stripUndefined(local ?? {}) } : { ...(local ?? {}) };

  // Rétro-compatibilité : anciens widgets configurés en "days".
  let period = base.period;
  if (!period && local?.days) {
    period = local.days <= 1 ? "today" : local.days <= 7 ? "7d" : local.days <= 30 ? "30d" : local.days <= 90 ? "90d" : "year";
  }
  period = period ?? "7d";

  const { start, end } = rangeFor(period, base.from, base.to);
  const ms = end.getTime() - start.getTime();
  const days = Math.max(1, Math.round(ms / 86400_000));
  const prevStart = new Date(start.getTime() - ms);

  return {
    from: start.toISOString(),
    to: end.toISOString(),
    fromDate: dOnly(start),
    toDate: dOnly(addDays(end, -1)),
    prevFrom: prevStart.toISOString(),
    prevTo: start.toISOString(),
    prevFromDate: dOnly(prevStart),
    prevToDate: dOnly(addDays(start, -1)),
    days,
    label: PERIOD_OPTIONS.find((p) => p.key === period)?.label ?? "Période",
    compare: !!base.compare,
    limit: local?.limit ?? 10,
    lineId: base.lineId || undefined,
    productId: base.productId || undefined,
    supplierId: base.supplierId || undefined,
    campaignId: base.campaignId || undefined,
  };
}

function stripUndefined<T extends Record<string, any>>(o: T): Partial<T> {
  const out: any = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== "" && v !== null) out[k] = v;
  delete out.useGlobal;
  delete out.limit;
  delete out.days;
  return out;
}

/** Résumé lisible des filtres actifs (badges). */
export function describeFilters(f: DashboardFilters): string {
  const p = PERIOD_OPTIONS.find((o) => o.key === (f.period ?? "7d"));
  if (f.period === "custom" && f.from && f.to) return `${f.from} → ${f.to}`;
  return p?.label ?? "7 derniers jours";
}
