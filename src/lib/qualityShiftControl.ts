// Pure helpers shared by the quality control entry screens
// (OF control panel, saisie en ligne, kiosque shift qualité).
// Kept side-effect free so the shift <-> contrôle integration is fully testable.

export type IndicatorType = "numeric" | "boolean" | "text" | "select";

export interface ControlIndicator {
  indicator_id: string;
  code: string;
  name: string;
  indicator_type: IndicatorType;
  category: string;
  unit?: string | null;
  target_value?: number | null;
  min_value?: number | null;
  max_value?: number | null;
  tolerance_minus?: number | null;
  tolerance_plus?: number | null;
  select_options?: string[] | null;
  effective_frequency_minutes?: number | null;
  effective_is_required?: boolean;
  effective_is_blocking?: boolean;
}

export interface ControlDraft {
  value_text: string;
  value_boolean: string; // "" | "true" | "false"
  selected_value: string;
  comment: string;
}

export const emptyControlDraft = (): ControlDraft => ({
  value_text: "",
  value_boolean: "",
  selected_value: "",
  comment: "",
});

export type DueLevel = "ok" | "todo" | "overdue";

export interface DueInfo {
  level: DueLevel;
  label: string;
  minsLeft: number | null;
}

/**
 * Frequency state of a control for an OF.
 * - no frequency configured  -> "todo" until entered once, then "ok" (à la demande)
 * - frequency configured     -> "todo" if never entered, "overdue" past the period
 */
export function dueInfo(
  lastAt: string | null,
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

/** Number of controls waiting for an entry (todo or overdue). */
export function countDue(
  indicators: ControlIndicator[],
  lastByIndicator: Record<string, string>,
  now: number = Date.now(),
): number {
  return indicators.filter((i) => {
    const d = dueInfo(lastByIndicator[i.indicator_id] ?? null, i.effective_frequency_minutes, now);
    return d.level === "todo" || d.level === "overdue";
  }).length;
}

export interface DraftValidation {
  ok: boolean;
  error?: string;
}

/** Validates a draft against the indicator type (same rules as the UI guards). */
export function validateControlDraft(
  indicator: Pick<ControlIndicator, "indicator_type">,
  draft: ControlDraft,
  parseNumber: (s: string) => number | null,
): DraftValidation {
  switch (indicator.indicator_type) {
    case "numeric":
      return parseNumber(draft.value_text) === null
        ? { ok: false, error: "Valeur numérique requise" }
        : { ok: true };
    case "boolean":
      return draft.value_boolean === ""
        ? { ok: false, error: "Choisir Conforme / Non conforme" }
        : { ok: true };
    case "select":
      return !draft.selected_value ? { ok: false, error: "Choix requis" } : { ok: true };
    default:
      return !draft.value_text.trim() ? { ok: false, error: "Valeur requise" } : { ok: true };
  }
}

export interface ShiftContextForCheck {
  qualityShiftId: string | null;
  teamId: string | null;
  productionShiftId: string | null;
}

/**
 * Shift context bound to a quality check. The quality shift always wins; the
 * production shift is only attached when it belongs to the OF line.
 */
export function resolveShiftContext(
  qualityShift: { id: string; shift_team_id: string | null; production_shift_ids?: string[] } | null,
  productionShiftId: string | null = null,
): ShiftContextForCheck {
  if (!qualityShift) return { qualityShiftId: null, teamId: null, productionShiftId: null };
  return {
    qualityShiftId: qualityShift.id,
    teamId: qualityShift.shift_team_id ?? null,
    productionShiftId: productionShiftId ?? qualityShift.production_shift_ids?.[0] ?? null,
  };
}

export interface BuildCheckArgs {
  ofId: string;
  productId?: string | null;
  lineId?: string | null;
  indicator: ControlIndicator;
  draft: ControlDraft;
  userId?: string | null;
  controlTime: string;
  shift: ShiftContextForCheck;
  parseNumber: (s: string) => number | null;
}

/** Builds the quality_checks insert payload (shift context included). */
export function buildCheckPayload(a: BuildCheckArgs): Record<string, unknown> {
  const t = a.indicator.indicator_type;
  return {
    of_id: a.ofId,
    product_id: a.productId ?? null,
    production_line_id: a.lineId ?? null,
    indicator_id: a.indicator.indicator_id,
    measured_value_numeric: t === "numeric" ? a.parseNumber(a.draft.value_text) : null,
    measured_value_text: t === "text" ? a.draft.value_text.trim() : null,
    measured_value_boolean: t === "boolean" ? a.draft.value_boolean === "true" : null,
    selected_value: t === "select" ? a.draft.selected_value : null,
    unit: a.indicator.unit ?? null,
    target_value: a.indicator.target_value ?? null,
    min_value: a.indicator.min_value ?? null,
    max_value: a.indicator.max_value ?? null,
    comment: a.draft.comment.trim(),
    controlled_by: a.userId ?? null,
    control_time: a.controlTime,
    quality_shift_id: a.shift.qualityShiftId,
    shift_id: a.shift.productionShiftId,
    team_id: a.shift.teamId,
    status: "submitted",
    validation_status: "not_required",
  };
}

export interface ControlFilters {
  search: string;
  category: string; // "all" | category
  status: string; // "all" | "todo" | "overdue" | "ok"
}

export function filterIndicators(
  indicators: ControlIndicator[],
  filters: ControlFilters,
  lastByIndicator: Record<string, string>,
  now: number = Date.now(),
): ControlIndicator[] {
  const q = filters.search.trim().toLowerCase();
  return indicators.filter((i) => {
    if (filters.category !== "all" && i.category !== filters.category) return false;
    if (q && !`${i.code} ${i.name}`.toLowerCase().includes(q)) return false;
    if (filters.status !== "all") {
      const d = dueInfo(lastByIndicator[i.indicator_id] ?? null, i.effective_frequency_minutes, now);
      if (filters.status === "todo" && !(d.level === "todo" || d.level === "overdue")) return false;
      if (filters.status === "overdue" && d.level !== "overdue") return false;
      if (filters.status === "ok" && d.level !== "ok") return false;
    }
    return true;
  });
}

/** Pinned controls of the shift float to the top, original order preserved otherwise. */
export function sortWithPins(
  indicators: ControlIndicator[],
  isPinned: (indicatorId: string) => boolean,
): ControlIndicator[] {
  return [...indicators].sort(
    (a, b) => (isPinned(b.indicator_id) ? 1 : 0) - (isPinned(a.indicator_id) ? 1 : 0),
  );
}

/** Last control_time per indicator from checks ordered desc by control_time. */
export function lastCheckByIndicator(
  checks: { indicator_id: string; control_time: string }[],
): Record<string, string> {
  const last: Record<string, string> = {};
  for (const c of checks) {
    const prev = last[c.indicator_id];
    if (!prev || new Date(c.control_time) > new Date(prev)) last[c.indicator_id] = c.control_time;
  }
  return last;
}

/** Blocking non-conformities of an OF (blocking indicator + is_conform === false). */
export function blockingNonConformities(
  indicators: ControlIndicator[],
  checks: { indicator_id: string; is_conform: boolean | null }[],
): string[] {
  const blocking = new Set(
    indicators.filter((i) => i.effective_is_blocking).map((i) => i.indicator_id),
  );
  return Array.from(
    new Set(
      checks
        .filter((c) => c.is_conform === false && blocking.has(c.indicator_id))
        .map((c) => c.indicator_id),
    ),
  );
}
