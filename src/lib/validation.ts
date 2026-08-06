import { supabase } from "@/integrations/supabase/client";
import { logAudit, sanitizeValues, computeChangedFields } from "@/lib/audit";
import { triggerNotification } from "@/lib/notifications";
import { evalOperator, resolveField, type CondOperator as SharedCondOperator } from "@/lib/conditionOps";


// =============================================
// Types
// =============================================
export type ValidationEnforcement = "post_hoc" | "blocking";
export type ValidationStatus =
  | "draft" | "submitted" | "pending_post_hoc"
  | "approved" | "rejected" | "cancelled" | "applied" | "archived";
export type ValidationPriority = "low" | "medium" | "high" | "critical";

export interface ValidationRule {
  id: string;
  name: string;
  description: string | null;
  module: string;
  entity_type: string | null;
  action_type: string;
  enforcement: ValidationEnforcement;
  is_active: boolean;
  is_required: boolean;
  priority: ValidationPriority;
  validator_roles: string[];
  validator_users: string[] | null;
  conditions: Record<string, unknown> | null;
  auto_approve_if_low_risk: boolean;
}

export interface ValidationRequest {
  id: string;
  rule_id: string | null;
  request_type: string;
  module: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_code: string | null;
  entity_label: string | null;
  target_record_id: string | null;
  requested_action: string;
  status: ValidationStatus;
  enforcement: ValidationEnforcement;
  priority: ValidationPriority;
  source: string;
  is_blocking: boolean;
  submitted_by_user_id: string | null;
  submitted_by_name: string | null;
  submitted_by_email: string | null;
  assigned_validator_role: string | null;
  assigned_validator_user_id: string | null;
  validated_by_user_id: string | null;
  rejected_by_user_id: string | null;
  title: string;
  description: string | null;
  justification: string | null;
  rejection_reason: string | null;
  validation_comment: string | null;
  old_values: Record<string, unknown> | null;
  proposed_values: Record<string, unknown> | null;
  changed_fields: string[] | null;
  metadata: Record<string, unknown> | null;
  action_url: string | null;
  submitted_at: string | null;
  validated_at: string | null;
  rejected_at: string | null;
  cancelled_at: string | null;
  applied_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckValidationParams {
  module: string;
  action_type: string;
  entity_type?: string | null;
  context?: Record<string, unknown>;
}

export interface CreateValidationRequestPayload {
  rule: ValidationRule | null;
  request_type: string;
  module: string;
  requested_action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  entity_code?: string | null;
  entity_label?: string | null;
  target_record_id?: string | null;
  title: string;
  description?: string;
  justification?: string;
  priority?: ValidationPriority;
  old_values?: Record<string, unknown> | null;
  proposed_values?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  action_url?: string | null;
}

// =============================================
// Conditions matcher
// Supports two formats:
//  1. Native builder format: { combinator: "all"|"any", rules: [{field, op, value}] }
//  2. Legacy format: { key: value }, arrays, { or: [...] }, numeric shortcuts
// Both are evaluated identically so the admin UI reflects exactly what runs.
// =============================================
export type { CondOperator } from "@/lib/conditionOps";
export interface CondLeaf {
  field: string;
  op: SharedCondOperator;
  value?: string | number | boolean | Array<string | number>;
}
export interface CondTreeNative {
  combinator: "all" | "any";
  rules: CondLeaf[];
}

function isNativeTree(c: Record<string, unknown>): boolean {
  return Array.isArray((c as { rules?: unknown }).rules)
    && typeof (c as { combinator?: unknown }).combinator === "string";
}

function evalLeaf(leaf: CondLeaf, context: Record<string, unknown>): boolean {
  return evalOperator(leaf.op, resolveField(context, leaf.field), leaf.value);
}


export function matchConditions(
  conditions: Record<string, unknown> | null,
  context: Record<string, unknown> = {}
): boolean {
  if (!conditions) return true;

  // --- Native builder format ---
  if (isNativeTree(conditions)) {
    const tree = conditions as unknown as CondTreeNative;
    if (!tree.rules || tree.rules.length === 0) return true;
    if (tree.combinator === "any") {
      return tree.rules.some((leaf) => evalLeaf(leaf, context));
    }
    return tree.rules.every((leaf) => evalLeaf(leaf, context));
  }

  // --- Legacy format ---
  // OR group
  const orGroup = conditions.or as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(orGroup)) {
    return orGroup.some((g) => matchConditions(g, context));
  }

  for (const [key, expected] of Object.entries(conditions)) {
    if (key === "or") continue;
    const actual = context[key];

    // numeric thresholds
    if (key === "min_duration_minutes" && typeof expected === "number") {
      const v = Number(context.duration_minutes ?? 0);
      if (!(v >= expected)) return false;
      continue;
    }
    if (key === "ecart_seuil_pct" && typeof expected === "number") {
      const v = Number(context.ecart_pct ?? 0);
      if (!(Math.abs(v) >= expected)) return false;
      continue;
    }
    if (key === "min_age_hours" && typeof expected === "number") {
      const v = Number(context.age_hours ?? 0);
      if (!(v >= expected)) return false;
      continue;
    }

    // array equality
    if (Array.isArray(expected)) {
      if (!expected.includes(actual as never)) return false;
      continue;
    }

    if (actual !== expected) return false;
  }
  return true;
}

/** Number of conditions in a rule — used to rank specificity. */
export function countConditions(conditions: Record<string, unknown> | null): number {
  if (!conditions) return 0;
  if (isNativeTree(conditions)) return (conditions as unknown as CondTreeNative).rules.length;
  const orGroup = conditions.or as unknown[] | undefined;
  if (Array.isArray(orGroup)) return orGroup.length;
  return Object.keys(conditions).filter((k) => k !== "or").length;
}

const PRIORITY_RANK: Record<ValidationPriority, number> = {
  critical: 4, high: 3, medium: 2, low: 1,
};

// =============================================
// Check if validation is required for an action
// =============================================
export interface CheckValidationResult {
  rule: ValidationRule | null;
  enforcement: ValidationEnforcement | "none";
}

export async function checkValidationRequired(
  params: CheckValidationParams
): Promise<CheckValidationResult> {
  try {
    let q = supabase
      .from("validation_rules")
      .select("*")
      .eq("is_active", true)
      .eq("module", params.module)
      .eq("action_type", params.action_type);

    if (params.entity_type) {
      q = q.or(`entity_type.eq.${params.entity_type},entity_type.is.null`);
    }

    const { data: rules } = await q;
    if (!rules || rules.length === 0) return { rule: null, enforcement: "none" };

    // Deterministic selection: among matching rules, prefer higher priority,
    // then a stricter entity_type match, then more specific (more conditions).
    const matching = (rules as unknown as ValidationRule[])
      .filter((rule) => matchConditions(rule.conditions, params.context ?? {}))
      .sort((a, b) => {
        const p = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
        if (p !== 0) return p;
        const ea = a.entity_type ? 1 : 0;
        const eb = b.entity_type ? 1 : 0;
        if (eb !== ea) return eb - ea;
        return countConditions(b.conditions) - countConditions(a.conditions);
      });

    const rule = matching[0];
    if (rule) return { rule, enforcement: rule.enforcement };
    return { rule: null, enforcement: "none" };
  } catch (e) {
    if (typeof console !== "undefined") console.warn("[validation] check failed", e);
    return { rule: null, enforcement: "none" };
  }
}

// =============================================
// Create a validation request
// =============================================
async function getCurrentUserInfo(): Promise<{ id: string; email: string | null; name: string | null } | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    let name: string | null = null;
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("first_name,last_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prof) name = `${prof.first_name ?? ""} ${prof.last_name ?? ""}`.trim() || null;
    } catch { /* ignore */ }
    return { id: user.id, email: user.email ?? null, name };
  } catch {
    return null;
  }
}

export async function createValidationRequest(
  payload: CreateValidationRequestPayload
): Promise<ValidationRequest | null> {
  const user = await getCurrentUserInfo();
  if (!user) return null;

  const rule = payload.rule;
  const enforcement: ValidationEnforcement = rule?.enforcement ?? "post_hoc";
  const priority = payload.priority ?? rule?.priority ?? "medium";
  // Auto-approve low-risk post-hoc requests when the rule allows it.
  const autoApprove = enforcement === "post_hoc"
    && (rule?.auto_approve_if_low_risk ?? false)
    && priority === "low";
  const status: ValidationStatus = autoApprove
    ? "approved"
    : enforcement === "blocking" ? "submitted" : "pending_post_hoc";

  const old_san = payload.old_values
    ? (sanitizeValues(payload.old_values) as Record<string, unknown>)
    : null;
  const new_san = payload.proposed_values
    ? (sanitizeValues(payload.proposed_values) as Record<string, unknown>)
    : null;
  const changed = computeChangedFields(old_san ?? undefined, new_san ?? undefined);

  const row = {
    rule_id: rule?.id ?? null,
    request_type: payload.request_type,
    module: payload.module,
    entity_type: payload.entity_type ?? null,
    entity_id: payload.entity_id ?? null,
    entity_code: payload.entity_code ?? null,
    entity_label: payload.entity_label ?? null,
    target_record_id: payload.target_record_id ?? null,
    requested_action: payload.requested_action,
    status,
    enforcement,
    priority,
    is_blocking: enforcement === "blocking",
    submitted_by_user_id: user.id,
    submitted_by_name: user.name,
    submitted_by_email: user.email,
    assigned_validator_role: rule?.validator_roles?.[0] ?? null,
    assigned_validator_user_id: rule?.validator_users?.[0] ?? null,
    title: payload.title,
    description: payload.description ?? "",
    justification: payload.justification ?? null,
    old_values: old_san,
    proposed_values: new_san,
    changed_fields: changed.length > 0 ? changed : null,
    metadata: payload.metadata ?? null,
    action_url: payload.action_url ?? null,
    submitted_at: new Date().toISOString(),
    applied_at: enforcement === "post_hoc" ? new Date().toISOString() : null,
    validated_at: autoApprove ? new Date().toISOString() : null,
    validation_comment: autoApprove ? "Auto-approuvée (risque faible)" : null,
  };


  const { data, error } = await supabase
    .from("validation_requests")
    .insert(row as never)
    .select("*")
    .single();

  if (error || !data) {
    if (typeof console !== "undefined") console.warn("[validation] create failed", error);
    return null;
  }

  const created = data as unknown as ValidationRequest;

  // Audit
  await logAudit({
    action_type: "create",
    module: "system",
    entity_type: "validation_request",
    entity_id: created.id,
    entity_label: created.title,
    action_label: enforcement === "blocking"
      ? "Demande de validation (bloquante)"
      : "Demande de validation (a posteriori)",
    description: `Demande créée pour ${payload.module}/${payload.requested_action}`,
    severity: priority === "critical" ? "critical" : priority === "high" ? "high" : "medium",
    metadata: { rule_id: rule?.id, request_id: created.id },
  });

  // Notify validators
  if (rule?.validator_roles && rule.validator_roles.length > 0) {
    await triggerNotification({
      module: "system" as never,
      event_type: "validation_request.created",
      entity_type: "validation_request",
      entity_id: created.id,
      entity_label: created.title,
      title: enforcement === "blocking"
        ? `Validation requise : ${created.title}`
        : `Vérification a posteriori : ${created.title}`,
      message: payload.description ?? "",
      severity: priority === "critical" ? "critical" : priority === "high" ? "high" : "medium",
      action_url: `/validations?id=${created.id}`,
      triggered_by_user_id: user.id,
    });
  }

  return created;
}

// =============================================
// Approve / Reject / Cancel
// =============================================
export async function approveValidationRequest(id: string, comment?: string): Promise<boolean> {
  const user = await getCurrentUserInfo();
  if (!user) return false;

  const { data: req } = await supabase
    .from("validation_requests")
    .select("*")
    .eq("id", id)
    .single();
  if (!req) return false;
  const r = req as unknown as ValidationRequest;

  const finalStatus: ValidationStatus = r.enforcement === "blocking" ? "applied" : "approved";
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = {
    status: finalStatus,
    validated_by_user_id: user.id,
    validated_at: now,
    validation_comment: comment ?? null,
  };
  if (r.enforcement === "blocking") updates.applied_at = now;

  const { error } = await supabase
    .from("validation_requests")
    .update(updates as never)
    .eq("id", id);
  if (error) return false;

  // Mark target record as approved if post_hoc
  if (r.enforcement === "post_hoc" && r.target_record_id && r.entity_type) {
    await markTargetValidationStatus(r.entity_type, r.target_record_id, "approved");
  }

  await logAudit({
    action_type: "status_change",
    module: "system",
    entity_type: "validation_request",
    entity_id: id,
    entity_label: r.title,
    action_label: "Demande approuvée",
    description: comment ?? "",
    severity: "medium",
  });

  if (r.submitted_by_user_id) {
    await triggerNotification({
      module: "system" as never,
      event_type: "validation_request.approved",
      entity_type: "validation_request",
      entity_id: id,
      entity_label: r.title,
      title: `Demande approuvée : ${r.title}`,
      message: comment ?? "",
      severity: "info",
      action_url: `/validations?id=${id}`,
      triggered_by_user_id: user.id,
    });
  }

  return true;
}

export async function rejectValidationRequest(id: string, reason: string): Promise<boolean> {
  const user = await getCurrentUserInfo();
  if (!user) return false;

  const { data: req } = await supabase
    .from("validation_requests")
    .select("*")
    .eq("id", id)
    .single();
  if (!req) return false;
  const r = req as unknown as ValidationRequest;

  const { error } = await supabase
    .from("validation_requests")
    .update({
      status: "rejected",
      rejected_by_user_id: user.id,
      rejected_at: new Date().toISOString(),
      rejection_reason: reason,
    } as never)
    .eq("id", id);
  if (error) return false;

  if (r.enforcement === "post_hoc" && r.target_record_id && r.entity_type) {
    await markTargetValidationStatus(r.entity_type, r.target_record_id, "rejected");
  }

  await logAudit({
    action_type: "status_change",
    module: "system",
    entity_type: "validation_request",
    entity_id: id,
    entity_label: r.title,
    action_label: "Demande rejetée",
    description: reason,
    severity: "high",
  });

  if (r.submitted_by_user_id) {
    await triggerNotification({
      module: "system" as never,
      event_type: "validation_request.rejected",
      entity_type: "validation_request",
      entity_id: id,
      entity_label: r.title,
      title: `Demande rejetée : ${r.title}`,
      message: reason,
      severity: "high",
      action_url: `/validations?id=${id}`,
      triggered_by_user_id: user.id,
    });
  }

  return true;
}

export async function cancelValidationRequest(id: string): Promise<boolean> {
  const user = await getCurrentUserInfo();
  if (!user) return false;

  const { error } = await supabase
    .from("validation_requests")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() } as never)
    .eq("id", id)
    .eq("submitted_by_user_id", user.id);
  if (error) return false;

  await logAudit({
    action_type: "status_change",
    module: "system",
    entity_type: "validation_request",
    entity_id: id,
    action_label: "Demande annulée",
    severity: "info",
  });
  return true;
}

// =============================================
// Mark target record validation_status
// =============================================
async function markTargetValidationStatus(
  entity_type: string,
  record_id: string,
  status: "approved" | "rejected" | "pending"
): Promise<void> {
  const tableMap: Record<string, string> = {
    ticket: "tickets",
    intervention: "interventions",
    pdr_movement: "pdr_stock_movements",
    consumption: "consumptions",
  };
  const table = tableMap[entity_type];
  if (!table) return;
  try {
    await supabase
      .from(table as never)
      .update({ validation_status: status } as never)
      .eq("id", record_id);
  } catch (e) {
    if (typeof console !== "undefined") console.warn("[validation] mark status failed", e);
  }
}

// =============================================
// Display helpers
// =============================================
export const STATUS_LABEL: Record<ValidationStatus, string> = {
  draft: "Brouillon",
  submitted: "En attente",
  pending_post_hoc: "À vérifier",
  approved: "Approuvée",
  rejected: "Rejetée",
  cancelled: "Annulée",
  applied: "Appliquée",
  archived: "Archivée",
};

export const STATUS_BADGE_CLASS: Record<ValidationStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  submitted: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  pending_post_hoc: "bg-primary/10 text-primary border-primary/20",
  approved: "bg-success/10 text-success border-success/20",
  applied: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  archived: "bg-muted text-muted-foreground border-border",
};

export const PRIORITY_LABEL: Record<ValidationPriority, string> = {
  low: "Faible",
  medium: "Moyenne",
  high: "Élevée",
  critical: "Critique",
};

export const PRIORITY_BADGE_CLASS: Record<ValidationPriority, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-warning/10 text-warning border-warning/20",
  high: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  critical: "bg-destructive/10 text-destructive border-destructive/30",
};

export const ENFORCEMENT_LABEL: Record<ValidationEnforcement, string> = {
  post_hoc: "A posteriori",
  blocking: "Bloquante",
};
