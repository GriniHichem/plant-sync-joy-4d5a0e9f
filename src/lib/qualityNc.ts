/**
 * Création automatique d'une NC brouillon lorsqu'un contrôle BLOQUANT est non conforme.
 *
 * La partie « construction du payload » est pure (testable), la partie réseau
 * est isolée dans `createDraftNcForCheck`.
 */
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { requiresNonConformity, type ApplicableIndicator } from "@/lib/qualityShiftLogic";

/** Catégorie d'indicateur → type de non-conformité. */
export function ncTypeFromCategory(category?: string | null): string {
  switch (category) {
    case "produit_fini": return "produit_fini";
    case "emballage":
    case "conditionnement": return "emballage";
    case "process":
    case "physico_chimique": return "process";
    case "hygiene": return "hygiene";
    case "poids": return "poids";
    case "controle_visuel":
    case "organoleptique": return "aspect";
    default: return "autre";
  }
}

export interface DraftNcInput {
  check: {
    id: string;
    of_id?: string | null;
    product_id?: string | null;
    production_line_id?: string | null;
    shift_id?: string | null;
    team_id?: string | null;
    quality_shift_id?: string | null;
    measured_value_numeric?: number | null;
    measured_value_text?: string | null;
    measured_value_boolean?: boolean | null;
    selected_value?: string | null;
  };
  indicator: Pick<
    ApplicableIndicator,
    "code" | "name" | "unit" | "target_value" | "min_value" | "max_value" | "category" | "effective_is_blocking"
  >;
  ofNumero?: string | null;
  declaredBy?: string | null;
}

/** Valeur mesurée lisible, tous types confondus. */
export function readableMeasure(check: DraftNcInput["check"]): string {
  if (check.measured_value_numeric != null) return String(check.measured_value_numeric);
  if (check.measured_value_boolean != null) return check.measured_value_boolean ? "Conforme" : "Non conforme";
  if (check.selected_value) return check.selected_value;
  return check.measured_value_text ?? "—";
}

/** Payload de la NC brouillon rattachée au contrôle (100 % pur). */
export function buildDraftNcPayload(input: DraftNcInput): Record<string, any> {
  const { check, indicator, ofNumero } = input;
  const measure = readableMeasure(check);
  const norm = [
    indicator.target_value != null ? `cible ${indicator.target_value}` : null,
    indicator.min_value != null ? `min ${indicator.min_value}` : null,
    indicator.max_value != null ? `max ${indicator.max_value}` : null,
  ].filter(Boolean).join(" / ");

  return {
    title: `Contrôle bloquant non conforme — ${indicator.code ?? indicator.name ?? "indicateur"}${ofNumero ? ` (${ofNumero})` : ""}`,
    description:
      `NC générée automatiquement suite à un contrôle bloquant non conforme.\n` +
      `Indicateur : ${indicator.code ?? ""} ${indicator.name ?? ""}\n` +
      `Valeur mesurée : ${measure}${indicator.unit ? ` ${indicator.unit}` : ""}\n` +
      (norm ? `Norme : ${norm}\n` : ""),
    nc_type: ncTypeFromCategory(indicator.category),
    severity: "major",
    status: "draft",
    quality_check_id: check.id,
    of_id: check.of_id ?? null,
    product_id: check.product_id ?? null,
    production_line_id: check.production_line_id ?? null,
    shift_id: check.shift_id ?? null,
    team_id: check.team_id ?? null,
    quality_shift_id: check.quality_shift_id ?? null,
    unit: indicator.unit ?? null,
    declared_by: input.declaredBy ?? null,
    detected_at: new Date().toISOString(),
  };
}

/**
 * Crée la NC brouillon si (et seulement si) le contrôle est non conforme ET bloquant.
 * Ne lève jamais : un échec ne doit pas bloquer la saisie du contrôle.
 */
export async function createDraftNcForCheck(
  input: DraftNcInput & { isConform: boolean | null },
): Promise<{ id: string; nc_number: string | null } | null> {
  if (!requiresNonConformity({ effective_is_blocking: input.indicator.effective_is_blocking }, input.isConform)) {
    return null;
  }
  const payload = buildDraftNcPayload(input);
  const { data, error } = await (supabase as any)
    .from("quality_non_conformities")
    .insert(payload)
    .select("id, nc_number")
    .single();
  if (error || !data) return null;

  await logAudit({
    action_type: "create",
    module: "qualite" as any,
    entity_type: "quality_non_conformity",
    entity_id: data.id,
    entity_label: data.nc_number ?? undefined,
    action_label: "NC brouillon auto (contrôle bloquant non conforme)",
    new_values: payload,
    severity: "medium",
  }).catch(() => undefined);

  return data;
}
