/**
 * Enquête de lot — logique métier pure (testable, sans dépendance UI/DB).
 * Module d'investigation en LECTURE SEULE sur les autres modules.
 */

export type LotEventType =
  | "panne"
  | "intervention"
  | "controle"
  | "arret"
  | "changement_serie"
  | "alerte"
  | "reception";

export interface LotEvent {
  event_type: LotEventType | string;
  occurred_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  title: string | null;
  detail: string | null;
  ref_id: string | null;
}

export interface LotInvestigation {
  id: string;
  investigation_number: string | null;
  production_date: string;
  production_time: string;
  window_hours: number;
  lot_reference: string | null;
  product_id: string | null;
  anomaly_description: string | null;
  analysis: string | null;
  conclusion: string | null;
  status: "en_cours" | "cloturee" | string;
  nc_id: string | null;
  created_by: string | null;
  closed_by: string | null;
  closed_at: string | null;
  reopened_at: string | null;
  created_at: string;
  updated_at: string;
}

export const EVENT_TYPES: {
  value: LotEventType;
  label: string;
  /** classes de badge (tokens sémantiques) */
  className: string;
}[] = [
  { value: "panne", label: "Panne machine", className: "bg-destructive/15 text-destructive border-destructive/30" },
  { value: "intervention", label: "Intervention", className: "bg-primary/15 text-primary border-primary/30" },
  { value: "controle", label: "Contrôle qualité", className: "bg-accent text-accent-foreground border-border" },
  { value: "arret", label: "Arrêt production", className: "bg-muted text-muted-foreground border-border" },
  { value: "changement_serie", label: "Changement / nettoyage", className: "bg-secondary text-secondary-foreground border-border" },
  { value: "alerte", label: "Alerte", className: "bg-destructive/10 text-destructive border-destructive/20" },
  { value: "reception", label: "Réception matière", className: "bg-primary/10 text-primary border-primary/20" },
];

export const eventTypeLabel = (v: string) =>
  EVENT_TYPES.find((t) => t.value === v)?.label ?? v;

export const eventTypeClass = (v: string) =>
  EVENT_TYPES.find((t) => t.value === v)?.className ?? "bg-muted text-muted-foreground border-border";

export const INVESTIGATION_STATUSES = [
  { value: "en_cours", label: "En cours" },
  { value: "cloturee", label: "Clôturée" },
] as const;

export const statusLabel = (v: string) =>
  INVESTIGATION_STATUSES.find((s) => s.value === v)?.label ?? v;

/** Construit l'instant central de production à partir d'une date + heure locales. */
export function productionInstant(date: string, time: string): Date {
  const hhmm = (time || "00:00").slice(0, 5);
  return new Date(`${date}T${hhmm}:00`);
}

/** Périmètre temporel ± window_hours autour de l'heure de production. */
export function computeWindow(
  date: string,
  time: string,
  windowHours: number,
): { from: Date; to: Date; center: Date } {
  const center = productionInstant(date, time);
  const ms = Math.max(0, Number(windowHours) || 0) * 3600_000;
  return { from: new Date(center.getTime() - ms), to: new Date(center.getTime() + ms), center };
}

/** Décalage signé (minutes) d'un événement par rapport à l'heure de production. */
export function offsetMinutes(occurredAt: string, center: Date): number {
  return Math.round((new Date(occurredAt).getTime() - center.getTime()) / 60000);
}

export function formatOffset(min: number): string {
  if (min === 0) return "à l'heure du lot";
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const dur = h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
  return min < 0 ? `${dur} avant` : `${dur} après`;
}

/** Position 0→100 sur la ligne de temps (0 = début de fenêtre). */
export function timelinePosition(occurredAt: string, from: Date, to: Date): number {
  const span = to.getTime() - from.getTime();
  if (span <= 0) return 50;
  const p = ((new Date(occurredAt).getTime() - from.getTime()) / span) * 100;
  return Math.min(100, Math.max(0, p));
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function filterEvents(
  events: LotEvent[],
  opts: { types?: string[]; search?: string } = {},
): LotEvent[] {
  const types = opts.types && opts.types.length ? new Set(opts.types) : null;
  const q = norm((opts.search ?? "").trim());
  return events.filter((e) => {
    if (types && !types.has(String(e.event_type))) return false;
    if (!q) return true;
    return norm(`${e.title ?? ""} ${e.detail ?? ""}`).includes(q);
  });
}

export function sortEvents(events: LotEvent[]): LotEvent[] {
  return [...events].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
  );
}

export function countByType(events: LotEvent[]): Record<string, number> {
  return events.reduce<Record<string, number>>((acc, e) => {
    const k = String(e.event_type);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

/**
 * Source probable de l'anomalie : événement "impactant" (panne / arrêt / alerte /
 * contrôle NOK) le plus proche AVANT l'heure de production, sinon le plus proche après.
 */
export function probableSource(events: LotEvent[], center: Date): LotEvent | null {
  const impacting = events.filter((e) =>
    ["panne", "arret", "alerte"].includes(String(e.event_type)) ||
    (String(e.event_type) === "controle" && /NOK/i.test(e.title ?? "")),
  );
  if (!impacting.length) return null;
  const before = impacting
    .filter((e) => new Date(e.occurred_at).getTime() <= center.getTime())
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
  if (before.length) return before[0];
  return impacting.sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
  )[0];
}

export function canEditInvestigation(inv: Pick<LotInvestigation, "status">): boolean {
  return inv.status !== "cloturee";
}

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const fmtDT = (v: string) => {
  const d = new Date(v);
  return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
};

/** Rapport d'enquête imprimable (impression navigateur → PDF). */
export function buildReportHtml(input: {
  inv: LotInvestigation;
  productLabel: string;
  ncLabel: string | null;
  events: LotEvent[];
  logs: { action: string; created_at: string; user_label: string }[];
  signature?: { name: string; role?: string | null };
}): string {
  const { inv, productLabel, ncLabel, events, logs, signature } = input;
  const { center } = computeWindow(inv.production_date, inv.production_time, inv.window_hours);
  const src = probableSource(sortEvents(events), center);

  const rows = sortEvents(events)
    .map(
      (e) => `<tr>
        <td>${esc(fmtDT(e.occurred_at))}</td>
        <td>${esc(eventTypeLabel(String(e.event_type)))}</td>
        <td>${esc(e.title)}</td>
        <td>${esc(e.detail)}</td>
        <td>${e.duration_minutes != null ? esc(Math.round(e.duration_minutes)) + " min" : "—"}</td>
        <td>${esc(formatOffset(offsetMinutes(e.occurred_at, center)))}</td>
      </tr>`,
    )
    .join("");

  const logRows = logs
    .map((l) => `<tr><td>${esc(fmtDT(l.created_at))}</td><td>${esc(l.action)}</td><td>${esc(l.user_label)}</td></tr>`)
    .join("");

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Rapport d'enquête ${esc(inv.investigation_number ?? "")}</title>
<style>
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;margin:28px;font-size:12px}
  h1{font-size:19px;margin:0 0 2px}h2{font-size:14px;margin:22px 0 6px;border-bottom:1px solid #ddd;padding-bottom:3px}
  .muted{color:#666;font-size:11px}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th,td{border:1px solid #ddd;padding:5px 6px;text-align:left;vertical-align:top}
  th{background:#f4f4f5;font-size:11px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px;margin-top:8px}
  .k{color:#666}
  .box{border:1px solid #ddd;padding:8px;margin-top:6px;white-space:pre-wrap}
  .sign{margin-top:34px;display:grid;grid-template-columns:1fr 1fr;gap:24px}
  .sign div{border-top:1px solid #999;padding-top:5px;font-size:11px}
  @media print{@page{margin:14mm}}
</style></head><body>
<h1>Rapport d'enquête de lot ${esc(inv.investigation_number ?? "")}</h1>
<div class="muted">Édité le ${esc(fmtDT(new Date().toISOString()))} — statut : ${esc(statusLabel(inv.status))}</div>

<h2>Informations du lot</h2>
<div class="grid">
  <div><span class="k">Date de production :</span> ${esc(new Date(inv.production_date).toLocaleDateString("fr-FR"))}</div>
  <div><span class="k">Heure de production :</span> ${esc(inv.production_time.slice(0, 5))}</div>
  <div><span class="k">Référence du lot :</span> ${esc(inv.lot_reference ?? "—")}</div>
  <div><span class="k">Produit :</span> ${esc(productLabel)}</div>
  <div><span class="k">Périmètre temporel :</span> ± ${esc(inv.window_hours)} h</div>
  <div><span class="k">Non-conformité liée :</span> ${esc(ncLabel ?? "—")}</div>
</div>
<div class="box"><strong>Anomalie constatée</strong>\n${esc(inv.anomaly_description ?? "—")}</div>

<h2>Chronologie des événements (${events.length})</h2>
${
  events.length
    ? `<table><thead><tr><th>Horodatage</th><th>Type</th><th>Événement</th><th>Détail</th><th>Durée</th><th>Écart</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<div class="muted">Aucun événement enregistré sur la période.</div>`
}

<h2>Analyse et conclusion</h2>
<div class="box"><strong>Source probable identifiée</strong>\n${
    src
      ? esc(`${fmtDT(src.occurred_at)} · ${eventTypeLabel(String(src.event_type))} · ${src.title ?? ""} (${formatOffset(offsetMinutes(src.occurred_at, center))})`)
      : "Non déterminée"
  }</div>
<div class="box"><strong>Analyse</strong>\n${esc(inv.analysis ?? "—")}</div>
<div class="box"><strong>Conclusion</strong>\n${esc(inv.conclusion ?? "—")}</div>

<h2>Historique des modifications</h2>
${
  logs.length
    ? `<table><thead><tr><th>Date</th><th>Action</th><th>Utilisateur</th></tr></thead><tbody>${logRows}</tbody></table>`
    : `<div class="muted">Aucun historique.</div>`
}

<div class="sign">
  <div>Responsable qualité${signature ? ` — ${esc(signature.name)}` : ""}<br/><span class="muted">Date / signature</span></div>
  <div>Visa maintenance / production<br/><span class="muted">Date / signature</span></div>
</div>
</body></html>`;
}

/** Ouvre le rapport dans un onglet et déclenche l'impression (→ PDF). */
export function printReport(html: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
  return true;
}

/**
 * Jour de l'année (1 → 366) pour une date au format AAAA-MM-JJ.
 * 01/01 = 1, 03/02 = 34.
 */
export function dayOfYear(date: string): number {
  const [y, m, d] = (date || "").split("-").map(Number);
  if (!y || !m || !d) return 0;
  const start = Date.UTC(y, 0, 1);
  const cur = Date.UTC(y, m - 1, d);
  return Math.floor((cur - start) / 86400000) + 1;
}

/** N° de lot par défaut = jour de l'année de la date de production. */
export function defaultLotReference(date: string): string {
  const n = dayOfYear(date);
  return n > 0 ? String(n) : "";
}
