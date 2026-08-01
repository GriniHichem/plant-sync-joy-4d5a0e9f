/**
 * Logique pure du contrôle qualité en shift.
 *
 * Centralise les règles partagées par :
 *  - QualiteSaisieLigne (saisie par OF)
 *  - QualiteShiftScreen (tableau de shift qualité)
 *  - QualityShiftCheck (kiosque shift)
 *
 * Aucune dépendance réseau : 100 % testable.
 */

export type IndicatorType = "numeric" | "boolean" | "text" | "select";

export interface ApplicableIndicator {
  indicator_id: string;
  code?: string;
  name?: string;
  indicator_type: IndicatorType;
  category?: string;
  unit?: string | null;
  target_value?: number | null;
  min_value?: number | null;
  max_value?: number | null;
  tolerance_minus?: number | null;
  tolerance_plus?: number | null;
  select_options?: string[] | null;
  effective_frequency_minutes?: number | null;
  effective_is_required?: boolean | null;
  effective_is_blocking?: boolean | null;
  match_scope?: string | null;
}

export type DueLevel = "ok" | "todo" | "overdue";

export interface DueInfo {
  level: DueLevel;
  label: string;
  minsLeft: number | null;
}

/** État d'échéance d'un contrôle selon sa fréquence et son dernier relevé. */
export function dueInfo(
  lastAt: string | null | undefined,
  minutes: number | null | undefined,
  now: number = Date.now(),
): DueInfo {
  if (!minutes || minutes <= 0) {
    return {
      level: lastAt ? "ok" : "todo",
      label: lastAt ? "À la demande" : "À saisir",
      minsLeft: null,
    };
  }
  if (!lastAt) return { level: "todo", label: "À saisir maintenant", minsLeft: 0 };
  const elapsed = (now - new Date(lastAt).getTime()) / 60000;
  const left = Math.round(minutes - elapsed);
  if (left <= 0) return { level: "overdue", label: `En retard de ${Math.abs(left)} min`, minsLeft: left };
  return { level: "ok", label: `Prochain dans ${left} min`, minsLeft: left };
}

/** Seuls les contrôles obligatoires sont exigés en shift. */
export function requiredIndicators<T extends ApplicableIndicator>(list: T[] | null | undefined): T[] {
  return (list ?? []).filter((i) => i.effective_is_required === true);
}

/** Dernier relevé par indicateur (les lignes doivent être triées desc, sinon on garde la plus récente). */
export function lastCheckByIndicator(
  checks: { indicator_id: string; control_time: string }[] | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  (checks ?? []).forEach((c) => {
    if (!c?.indicator_id || !c.control_time) return;
    const prev = out[c.indicator_id];
    if (!prev || new Date(c.control_time).getTime() > new Date(prev).getTime()) {
      out[c.indicator_id] = c.control_time;
    }
  });
  return out;
}

export interface DueCounts {
  due: number;
  overdue: number;
  total: number;
}

/** Compteurs d'échéance d'un OF : `due` inclut les jamais-saisis + les en-retard. */
export function computeOfDueCounts(
  indicators: ApplicableIndicator[] | null | undefined,
  lastByIndicator: Record<string, string>,
  now: number = Date.now(),
): DueCounts {
  const req = requiredIndicators(indicators);
  let due = 0;
  let overdue = 0;
  req.forEach((i) => {
    const d = dueInfo(lastByIndicator[i.indicator_id] ?? null, i.effective_frequency_minutes, now);
    if (d.level === "overdue") { overdue += 1; due += 1; }
    else if (d.level === "todo") { due += 1; }
  });
  return { due, overdue, total: req.length };
}

/**
 * Retard « critique » : indicateur bloquant dont le retard dépasse 2× sa fréquence.
 * Déclenche l'alerte sonore / visuelle du tableau de shift.
 */
export function isCriticalOverdue(
  indicator: Pick<ApplicableIndicator, "effective_frequency_minutes" | "effective_is_blocking">,
  lastAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (indicator.effective_is_blocking !== true) return false;
  const freq = indicator.effective_frequency_minutes;
  if (!freq || freq <= 0) return false;
  if (!lastAt) return false; // jamais saisi : signalé comme "à saisir", pas comme retard x2
  const elapsed = (now - new Date(lastAt).getTime()) / 60000;
  return elapsed >= 2 * freq;
}

/** Nombre d'indicateurs bloquants en retard > 2× la fréquence. */
export function countCriticalOverdue(
  indicators: ApplicableIndicator[] | null | undefined,
  lastByIndicator: Record<string, string>,
  now: number = Date.now(),
): number {
  return requiredIndicators(indicators).filter((i) =>
    isCriticalOverdue(i, lastByIndicator[i.indicator_id] ?? null, now),
  ).length;
}

export interface OfPriorityItem {
  onCoveredLine: boolean;
  overdue: number;
  due: number;
}


/** Priorité d'affichage : lignes couvertes par le shift, puis retards, puis contrôles dus. */
export function sortOfsByPriority<T extends OfPriorityItem>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      (b.onCoveredLine ? 1 : 0) - (a.onCoveredLine ? 1 : 0) ||
      b.overdue - a.overdue ||
      b.due - a.due,
  );
}

export interface Draft {
  value_text?: string;
  value_boolean?: string; // "" | "true" | "false"
  selected_value?: string;
  comment?: string;
}

/** Conversion tolérante « 12,5 » / « 12.5 » → number. */
export function parseMeasure(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Validation d'une saisie selon le type d'indicateur. Retourne null si valide. */
export function validateDraft(type: IndicatorType, draft: Draft): string | null {
  if (type === "numeric") {
    return parseMeasure(draft.value_text) == null ? "Valeur numérique requise" : null;
  }
  if (type === "boolean") {
    return draft.value_boolean === "true" || draft.value_boolean === "false"
      ? null
      : "Choisir Conforme / Non conforme";
  }
  if (type === "select") return draft.selected_value ? null : "Choix requis";
  return draft.value_text && draft.value_text.trim() ? null : "Valeur requise";
}

export interface ShiftContext {
  qualityShiftId: string | null;
  teamId: string | null;
  productionShiftId: string | null;
  controllerId: string | null;
}

export interface OfContext {
  of_id: string;
  product_id?: string | null;
  line_id?: string | null;
}

/**
 * Construit la ligne `quality_checks` en rattachant systématiquement
 * le contexte du shift qualité actif (traçabilité shift / équipe / ligne / produit).
 */
export function buildQualityCheckPayload(args: {
  of: OfContext;
  indicator: ApplicableIndicator;
  draft: Draft;
  shift: ShiftContext;
  controlTime?: string;
}): Record<string, any> {
  const { of, indicator, draft, shift } = args;
  const t = indicator.indicator_type;
  return {
    of_id: of.of_id,
    product_id: of.product_id ?? null,
    production_line_id: of.line_id ?? null,
    indicator_id: indicator.indicator_id,
    measured_value_numeric: t === "numeric" ? parseMeasure(draft.value_text) : null,
    measured_value_text: t === "text" ? (draft.value_text ?? "").trim() : null,
    measured_value_boolean: t === "boolean" ? draft.value_boolean === "true" : null,
    selected_value: t === "select" ? draft.selected_value ?? null : null,
    unit: indicator.unit ?? null,
    target_value: indicator.target_value ?? null,
    min_value: indicator.min_value ?? null,
    max_value: indicator.max_value ?? null,
    comment: (draft.comment ?? "").trim(),
    controlled_by: shift.controllerId,
    control_time: args.controlTime ?? new Date().toISOString(),
    quality_shift_id: shift.qualityShiftId,
    shift_id: shift.productionShiftId,
    team_id: shift.teamId,
    status: "submitted",
    validation_status: "not_required",
  };
}

/** Un OF est « couvert » par le shift si sa ligne fait partie du périmètre. */
export function isOfCovered(ofLineId: string | null | undefined, coveredLineIds: string[]): boolean {
  if (!ofLineId) return false;
  return coveredLineIds.includes(ofLineId);
}

export interface ShiftKpis {
  checks: number;
  conforms: number;
  nonConforms: number;
  conformityRate: number | null;
  ofs: number;
  ncs: number;
}

/** KPI du bilan de shift à partir des contrôles rattachés au shift qualité. */
export function computeShiftKpis(
  checks: { is_conform: boolean | null; of_id: string | null }[] | null | undefined,
  ncCount: number = 0,
): ShiftKpis {
  const rows = checks ?? [];
  const conforms = rows.filter((c) => c.is_conform === true).length;
  const nonConforms = rows.filter((c) => c.is_conform === false).length;
  const decided = conforms + nonConforms;
  return {
    checks: rows.length,
    conforms,
    nonConforms,
    conformityRate: decided > 0 ? Math.round((conforms / decided) * 1000) / 10 : null,
    ofs: new Set(rows.map((c) => c.of_id).filter(Boolean)).size,
    ncs: ncCount,
  };
}

/** Un contrôle bloquant non conforme doit déclencher une NC / un blocage OF. */
export function requiresNonConformity(
  indicator: Pick<ApplicableIndicator, "effective_is_blocking">,
  isConform: boolean | null,
): boolean {
  return isConform === false && indicator.effective_is_blocking === true;
}
