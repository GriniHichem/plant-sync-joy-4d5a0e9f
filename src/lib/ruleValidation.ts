// =============================================
// Pré-flight checks pour règles Notification & Validation
// =============================================
import { MODULES, NOTIF_EVENTS_BY_MODULE, VALIDATION_ACTIONS_BY_MODULE, getNotifEvent } from "@/lib/ruleCatalog";

const SEVERITY_ORDER = ["info", "low", "medium", "high", "critical"];


export interface PreflightResult {
  errors: string[];
  warnings: string[];
}

export interface NotifRulePreflightInput {
  name: string;
  module: string;
  event_type: string;
  target_roles: string[];
  target_users?: string[];
  channels: string[];
  severity: string;
  is_critical: boolean;
  conditions: unknown;
  quiet_hours_enabled?: boolean;
  frequency?: "immediate" | "grouped_hourly" | "grouped_daily" | string;

  allowCustom?: boolean;
}

export interface ValidationRulePreflightInput {
  name: string;
  module: string;
  action_type: string;
  enforcement: "post_hoc" | "blocking";
  validator_roles: string[];
  validator_users?: string[];
  conditions: unknown;
  allowCustom?: boolean;
}

const FIELD_TERRAIN_MODULES = new Set(["tickets", "interventions", "pdr_stock"]);

export function preflightNotifRule(input: NotifRulePreflightInput): PreflightResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input.name?.trim()) errors.push("Le nom de la règle est obligatoire.");
  if (!input.module) errors.push("Le module est obligatoire.");
  if (!input.event_type?.trim()) errors.push("Le type d'événement est obligatoire.");

  if (!input.allowCustom) {
    if (input.module && !MODULES.find((m) => m.value === input.module)) {
      errors.push(`Module "${input.module}" inconnu. Activez le mode expert pour forcer.`);
    }
    const events = NOTIF_EVENTS_BY_MODULE[input.module] ?? [];
    if (input.event_type && events.length > 0 && !events.find((e) => e.value === input.event_type)) {
      warnings.push(`L'événement "${input.event_type}" n'est pas standard pour ce module.`);
    }
  }

  const hasRoles = (input.target_roles ?? []).length > 0;
  const hasUsers = (input.target_users ?? []).length > 0;
  if (!hasRoles && !hasUsers) {
    warnings.push("Aucun destinataire : cette règle créera des notifications mais personne ne les recevra.");
  }

  if (!input.channels || input.channels.length === 0) {
    errors.push("Au moins un canal de diffusion est requis.");
  }

  if ((input.severity === "critical" || input.is_critical) && !input.channels?.includes("email")) {
    warnings.push("Sévérité critique sans canal email : les destinataires hors-ligne ne seront pas alertés.");
  }

  if (input.is_critical && input.quiet_hours_enabled) {
    warnings.push("Heures silencieuses activées sur une règle critique : les alertes urgentes pourraient être différées.");
  }

  // Cohérence sévérité / événement catalogué
  const ev = getNotifEvent(input.module, input.event_type);
  if (ev?.defaultSeverity && input.severity) {
    const delta = SEVERITY_ORDER.indexOf(ev.defaultSeverity) - SEVERITY_ORDER.indexOf(input.severity);
    if (delta >= 2) {
      warnings.push(`Sévérité "${input.severity}" faible pour l'événement "${ev.label}" (conseillée : ${ev.defaultSeverity}).`);
    }
  }

  // Volume : événements fréquents sans condition ni regroupement
  const HIGH_VOLUME = new Set([
    "quality_check_recorded", "pdr_stock_entry", "pdr_stock_exit",
    "reception_ticket_created", "document_uploaded", "ticket_created",
  ]);
  const hasConditions = !!input.conditions && (typeof input.conditions !== "string" || input.conditions.trim().length > 2);
  if (HIGH_VOLUME.has(input.event_type) && !hasConditions && input.frequency === "immediate") {
    warnings.push("Événement à fort volume sans condition ni regroupement : risque de spam de notifications.");
  }

  if (input.channels?.includes("email") && input.frequency === "immediate" && input.severity === "info") {
    warnings.push("Email immédiat pour une notification informative : préférez un regroupement horaire/journalier.");
  }

  // Conditions JSON valide
  if (typeof input.conditions === "string" && input.conditions.trim()) {
    try { JSON.parse(input.conditions); }
    catch { errors.push("Les conditions JSON sont invalides."); }
  }


  return { errors, warnings };
}

export function preflightValidationRule(input: ValidationRulePreflightInput): PreflightResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input.name?.trim()) errors.push("Le nom est obligatoire.");
  if (!input.module) errors.push("Le module est obligatoire.");
  if (!input.action_type?.trim()) errors.push("L'action est obligatoire.");

  if (!input.allowCustom) {
    if (input.module && !MODULES.find((m) => m.value === input.module)) {
      errors.push(`Module "${input.module}" inconnu.`);
    }
    const actions = VALIDATION_ACTIONS_BY_MODULE[input.module] ?? [];
    if (input.action_type && actions.length > 0 && !actions.find((a) => a.value === input.action_type)) {
      warnings.push(`L'action "${input.action_type}" n'est pas standard pour ce module.`);
    }
  }

  const hasValidators = (input.validator_roles ?? []).length > 0 || (input.validator_users ?? []).length > 0;
  if (input.enforcement === "blocking" && !hasValidators) {
    errors.push("Mode bloquant sans validateur : l'action serait bloquée sans personne pour l'approuver.");
  }
  if (!hasValidators) {
    warnings.push("Aucun validateur défini : seuls les administrateurs pourront traiter ces demandes.");
  }

  if (input.enforcement === "blocking" && FIELD_TERRAIN_MODULES.has(input.module)) {
    warnings.push("Mode bloquant sur un module terrain : risque de blocage opérationnel pendant les shifts.");
  }

  if (typeof input.conditions === "string" && input.conditions.trim()) {
    try { JSON.parse(input.conditions); }
    catch { errors.push("Les conditions JSON sont invalides."); }
  }

  return { errors, warnings };
}

// =============================================
// Détection de doublons (signature module+event/action+conditions)
// =============================================
export function ruleSignature(parts: { module: string; key: string; conditions: unknown }): string {
  let condStr = "";
  try { condStr = JSON.stringify(parts.conditions ?? null); } catch { condStr = ""; }
  return `${parts.module}::${parts.key}::${condStr}`;
}

export function findDuplicates<T extends { id: string; module: string; conditions: unknown; is_active: boolean }>(
  rules: T[],
  keyOf: (r: T) => string
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const r of rules) {
    if (!r.is_active) continue;
    const sig = ruleSignature({ module: r.module, key: keyOf(r), conditions: r.conditions });
    const arr = groups.get(sig) ?? [];
    arr.push(r.id);
    groups.set(sig, arr);
  }
  // Garder seulement les groupes avec >1 élément
  for (const [k, v] of groups) {
    if (v.length < 2) groups.delete(k);
  }
  return groups;
}
