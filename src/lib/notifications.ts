import { supabase } from "@/integrations/supabase/client";
import { evalOperator, resolveField, type CondOperator } from "@/lib/conditionOps";


// =============================================
// Types
// =============================================
export type NotificationSeverity = "info" | "low" | "medium" | "high" | "critical";
export type NotificationStatus = "unread" | "read" | "archived";
export type NotificationFrequency = "immediate" | "grouped_hourly" | "grouped_daily";
export type NotificationChannel = "in_app" | "email" | "push";

export type NotificationModule =
  | "auth" | "users" | "roles" | "permissions"
  | "machines" | "equipements" | "organes" | "lignes"
  | "pdr" | "pdr_stock"
  | "tickets" | "interventions" | "preventif"
  | "gpao" | "of" | "produits" | "articles" | "recettes"
  | "consommations" | "arrets"
  | "documents" | "images"
  | "parametres" | "audit" | "system" | "notifications";

export type NotificationType =
  | "ticket_created" | "ticket_assigned" | "ticket_resolved" | "ticket_closed"
  | "machine_down" | "machine_status_changed"
  | "preventive_due" | "preventive_late" | "preventive_executed"
  | "pdr_stock_critical" | "pdr_stock_out" | "pdr_stock_entry" | "pdr_stock_exit" | "pdr_dead_age"
  | "of_created" | "of_started" | "of_completed"
  | "production_declaration_missing" | "production_correction" | "consumption_correction"
  | "production_stop_created"
  | "document_uploaded" | "document_deleted"
  | "user_role_changed" | "permission_changed"
  | "audit_critical_event" | "access_denied" | "system_error";

export interface TriggerNotificationParams {
  module: NotificationModule;
  event_type: NotificationType | string;
  entity_type?: string;
  entity_id?: string | null;
  entity_code?: string | null;
  entity_label?: string | null;
  title?: string;
  message?: string;
  severity?: NotificationSeverity;
  triggered_by_user_id?: string | null;
  source?: string;
  action_url?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Data exposed to rule conditions evaluation */
  conditionData?: Record<string, unknown>;
  /** Override deduplication key */
  deduplication_key?: string;
}

interface NotificationRule {
  id: string;
  name: string;
  is_active: boolean;
  module: string;
  event_type: string;
  severity: NotificationSeverity;
  target_roles: string[];
  target_users: string[] | null;
  excluded_users: string[] | null;
  conditions: ConditionGroup | null;
  channels: NotificationChannel[];
  frequency: NotificationFrequency;
  is_critical: boolean;
}

async function dispatchEmailIfNeeded(notificationId: string, ruleChannels: NotificationChannel[]) {
  if (!ruleChannels.includes("email")) return;
  try {
    await supabase.functions.invoke("send-notification-email", {
      body: { notification_id: notificationId },
    });
  } catch (e) {
    if (typeof console !== "undefined") console.warn("[notifications] email dispatch failed", e);
  }
}

// =============================================
// Conditions engine (no eval) — opérateurs partagés avec les validations
// =============================================
type ConditionOp = CondOperator;
interface ConditionLeaf { field: string; op: ConditionOp; value?: unknown }
interface ConditionGroup {
  all?: Array<ConditionLeaf | ConditionGroup>;
  any?: Array<ConditionLeaf | ConditionGroup>;
  not?: ConditionLeaf | ConditionGroup;
  /** Format natif du builder */
  combinator?: "all" | "any";
  rules?: Array<ConditionLeaf | ConditionGroup>;
}

function evalLeaf(data: Record<string, unknown>, leaf: ConditionLeaf): boolean {
  return evalOperator(leaf.op, resolveField(data, leaf.field), leaf.value);
}

export function evaluateConditions(
  data: Record<string, unknown> | undefined,
  conditions: ConditionGroup | null | undefined
): boolean {
  if (!conditions) return true;
  const d = data ?? {};
  const evalNode = (n: ConditionLeaf | ConditionGroup): boolean => {
    if ("field" in n && typeof (n as ConditionLeaf).field === "string") return evalLeaf(d, n as ConditionLeaf);
    const g = n as ConditionGroup;
    if (Array.isArray(g.rules)) {
      if (g.rules.length === 0) return true;
      return g.combinator === "any" ? g.rules.some(evalNode) : g.rules.every(evalNode);
    }
    if (g.all) return g.all.every(evalNode);
    if (g.any) return g.any.some(evalNode);
    if (g.not) return !evalNode(g.not);
    return true;
  };
  return evalNode(conditions);
}


// =============================================
// Action URL builder
// =============================================
export function buildEntityUrl(entity_type?: string, entity_id?: string | null): string | null {
  if (!entity_type || !entity_id) return null;
  switch (entity_type) {
    case "machine": return `/machines/${entity_id}`;
    case "equipement": return `/equipements/${entity_id}`;
    case "organe": return `/organes/${entity_id}`;
    case "ligne": return `/lignes/${entity_id}`;
    case "pdr": return `/pdr/${entity_id}`;
    case "ticket": return `/tickets/${entity_id}`;
    case "preventif": return `/preventif/${entity_id}`;
    case "of": return `/gpao/of/${entity_id}`;
    case "product": return `/gpao/produits/${entity_id}`;
    case "article": return `/gpao/articles/${entity_id}`;
    case "stop": return `/gpao/arrets`;
    case "consumption": return `/gpao/consommations`;
    case "user": return `/parametres/users`;
    default: return null;
  }
}

function defaultDedupKey(p: TriggerNotificationParams): string {
  const id = p.entity_id || p.entity_code || "global";
  return `${p.event_type}:${id}`;
}

export function dedupWindowSince(freq: NotificationFrequency): string {
  const now = Date.now();
  let ms = 5 * 60 * 1000;
  if (freq === "grouped_hourly") ms = 60 * 60 * 1000;
  else if (freq === "grouped_daily") ms = 24 * 60 * 60 * 1000;
  return new Date(now - ms).toISOString();
}

// =============================================
// Trigger
// =============================================
export async function triggerNotification(params: TriggerNotificationParams): Promise<void> {
  try {
    const { data: rules } = await supabase
      .from("notification_rules")
      .select("*")
      .eq("is_active", true)
      .eq("module", params.module)
      .eq("event_type", params.event_type);

    if (!rules || rules.length === 0) return;

    const dedupKey = params.deduplication_key || defaultDedupKey(params);
    const actionUrl = params.action_url ?? buildEntityUrl(params.entity_type, params.entity_id);
    const title = params.title || `${params.event_type}`;
    const message = params.message || "";

    const inserts: Array<Record<string, unknown>> = [];
    const ruleChannelsByRow: NotificationChannel[][] = [];

    for (const rRaw of rules) {
      const r = rRaw as unknown as NotificationRule;
      // Conditions
      if (!evaluateConditions(params.conditionData, r.conditions)) continue;

      // Anti-doublon: check existing notifications with same dedup key in window
      const since = dedupWindowSince(r.frequency);
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("deduplication_key", dedupKey)
        .eq("rule_id", r.id)
        .gte("created_at", since)
        .limit(1);
      if (existing && existing.length > 0) continue;

      const targetRoles = Array.isArray(r.target_roles) ? r.target_roles : [];
      const targetUsers = Array.isArray(r.target_users) ? r.target_users : [];
      const excluded = new Set(Array.isArray(r.excluded_users) ? r.excluded_users : []);
      const severity = params.severity ?? r.severity;
      const isCritical = r.is_critical || severity === "critical";
      const channels = Array.isArray(r.channels) ? r.channels : ["in_app" as NotificationChannel];

      const baseRow = {
        title,
        message,
        notification_type: params.event_type,
        module: params.module,
        entity_type: params.entity_type ?? null,
        entity_id: params.entity_id ?? null,
        entity_code: params.entity_code ?? null,
        entity_label: params.entity_label ?? null,
        severity,
        triggered_by_user_id: params.triggered_by_user_id ?? null,
        source: params.source ?? "app",
        action_url: actionUrl,
        metadata: params.metadata ?? null,
        deduplication_key: dedupKey,
        rule_id: r.id,
        is_critical: isCritical,
      };

      for (const role of targetRoles) {
        inserts.push({ ...baseRow, recipient_role: role });
        ruleChannelsByRow.push(channels);
      }
      for (const uid of targetUsers) {
        if (excluded.has(uid)) continue;
        inserts.push({ ...baseRow, recipient_user_id: uid });
        ruleChannelsByRow.push(channels);
      }
    }

    if (inserts.length === 0) return;
    const { data: inserted } = await supabase
      .from("notifications")
      .insert(inserts as never)
      .select("id");

    // Fire-and-forget email dispatch for rules with email channel
    if (inserted && inserted.length === ruleChannelsByRow.length) {
      inserted.forEach((row, i) => {
        const ch = ruleChannelsByRow[i];
        if (ch && (row as { id: string }).id) {
          void dispatchEmailIfNeeded((row as { id: string }).id, ch);
        }
      });
    }
  } catch (e) {
    if (typeof console !== "undefined") console.warn("[notifications] triggerNotification failed", e);
  }
}

// =============================================
// User actions
// =============================================
export async function markNotificationRead(id: string): Promise<void> {
  await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("id", id);
}

export async function markAllNotificationsRead(userId: string, roles: string[]): Promise<void> {
  // Mark as read all unread notifications visible to this user
  await supabase
    .from("notifications")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("status", "unread")
    .or(
      [
        `recipient_user_id.eq.${userId}`,
        ...roles.map((r) => `recipient_role.eq.${r}`),
      ].join(",")
    );
}

export async function archiveNotification(id: string): Promise<void> {
  await supabase
    .from("notifications")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", id);
}

export const SEVERITY_LABEL: Record<NotificationSeverity, string> = {
  info: "Info",
  low: "Faible",
  medium: "Moyen",
  high: "Élevé",
  critical: "Critique",
};

export const SEVERITY_BADGE_CLASS: Record<NotificationSeverity, string> = {
  info: "bg-primary/10 text-primary border-primary/20",
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-warning/10 text-warning border-warning/20",
  high: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  critical: "bg-destructive/10 text-destructive border-destructive/30",
};
