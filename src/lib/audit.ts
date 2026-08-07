import { supabase } from "@/integrations/supabase/client";

// =============================================
// Types
// =============================================

export type AuditStatus = "success" | "failed" | "denied" | "warning";
export type AuditSeverity = "info" | "low" | "medium" | "high" | "critical";
export type AuditSource = "app" | "auth" | "database" | "edge_function" | "system";

export type AuditActionType =
  | "login" | "logout" | "login_failed" | "password_reset" | "password_change"
  | "create" | "update" | "delete" | "status_change"
  | "role_change" | "permission_change"
  | "stock_entry" | "stock_exit" | "stock_inventory" | "stock_correction" | "stock_movement_cancel"
  | "production_declaration" | "production_correction"
  | "consumption_declaration" | "consumption_correction"
  | "stop_create" | "stop_link_ticket"
  | "of_create" | "of_update" | "of_cancel" | "of_mode_change"
  | "ticket_create" | "ticket_update" | "ticket_close" | "ticket_resolve"
  | "intervention_create" | "intervention_update"
  | "preventive_create" | "preventive_validate" | "preventive_execute" | "preventive_suspend"
  | "document_upload" | "document_download" | "document_delete" | "document_metadata_update"
  | "image_upload" | "image_delete" | "image_set_primary"
  | "import_csv" | "import_csv_partial" | "import_csv_failed" | "export_csv"
  | "access_denied" | "error";

export type AuditModule =
  | "auth" | "users" | "roles" | "permissions"
  | "machines" | "equipements" | "organes" | "lignes"
  | "pdr" | "pdr_stock"
  | "tickets" | "interventions" | "preventif"
  | "gpao" | "of" | "produits" | "articles" | "recettes"
  | "consommations" | "arrets"
  | "documents" | "images"
  | "parametres" | "audit" | "system" | "notifications";

export interface LogAuditParams {
  action_type: AuditActionType;
  module: AuditModule;
  entity_type?: string;
  entity_id?: string | null;
  entity_code?: string | null;
  entity_label?: string | null;
  action_label?: string;
  description?: string;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  status?: AuditStatus;
  severity?: AuditSeverity;
  source?: AuditSource;
  metadata?: Record<string, unknown> | null;
  // legacy compat
  table_name?: string;
  record_id?: string | null;
  action?: string;
}

// =============================================
// Sensitive data masking
// =============================================

const SENSITIVE_KEY_REGEX = /(password|passwd|pwd|token|secret|api[_-]?key|authorization|service[_-]?role|access[_-]?key|private[_-]?key|client[_-]?secret)/i;
const MASKED = "***";

export function sanitizeValues(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map(sanitizeValues);
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_KEY_REGEX.test(k)) {
        out[k] = MASKED;
      } else {
        out[k] = sanitizeValues(v);
      }
    }
    return out;
  }
  return input;
}

// =============================================
// Diff helper
// =============================================

export function computeChangedFields(
  oldV?: Record<string, unknown> | null,
  newV?: Record<string, unknown> | null
): string[] {
  if (!oldV || !newV) return [];
  const keys = new Set([...Object.keys(oldV), ...Object.keys(newV)]);
  const changed: string[] = [];
  for (const k of keys) {
    const a = oldV[k];
    const b = newV[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) changed.push(k);
  }
  return changed;
}

// =============================================
// Description templates
// =============================================

const ACTION_LABELS: Partial<Record<AuditActionType, string>> = {
  login: "Connexion",
  logout: "Déconnexion",
  login_failed: "Tentative de connexion échouée",
  password_reset: "Réinitialisation mot de passe",
  password_change: "Changement mot de passe",
  create: "Création",
  update: "Modification",
  delete: "Suppression",
  status_change: "Changement de statut",
  role_change: "Changement de rôle",
  permission_change: "Modification des permissions",
  stock_entry: "Entrée de stock",
  stock_exit: "Sortie de stock",
  stock_inventory: "Inventaire stock",
  stock_correction: "Correction stock",
  stock_movement_cancel: "Annulation mouvement stock",
  production_declaration: "Déclaration production",
  production_correction: "Correction production",
  consumption_declaration: "Déclaration consommation",
  consumption_correction: "Correction consommation",
  of_create: "Création OF",
  of_update: "Modification OF",
  of_cancel: "Annulation OF",
  of_mode_change: "Changement mode shift",
  ticket_create: "Création ticket",
  ticket_update: "Modification ticket",
  ticket_close: "Clôture ticket",
  ticket_resolve: "Résolution ticket",
  intervention_create: "Création intervention",
  intervention_update: "Modification intervention",
  preventive_create: "Création plan préventif",
  preventive_validate: "Validation plan préventif",
  preventive_execute: "Exécution préventif",
  preventive_suspend: "Suspension plan préventif",
  document_upload: "Upload document",
  document_download: "Téléchargement document",
  document_delete: "Suppression document",
  document_metadata_update: "Modification métadonnées",
  image_upload: "Upload image",
  image_delete: "Suppression image",
  image_set_primary: "Image principale modifiée",
  import_csv: "Import CSV",
  export_csv: "Export CSV",
  access_denied: "Accès refusé",
  error: "Erreur",
  stop_create: "Création arrêt",
  stop_link_ticket: "Liaison arrêt ↔ ticket",
};

export function getActionLabel(t: AuditActionType): string {
  return ACTION_LABELS[t] ?? t;
}

function buildDescription(p: LogAuditParams, userName?: string): string {
  const who = userName || "Un utilisateur";
  const label = p.action_label || getActionLabel(p.action_type);
  const entity = [p.entity_type, p.entity_code || p.entity_label].filter(Boolean).join(" ");
  if (entity) return `${who} — ${label} sur ${entity}`;
  return `${who} — ${label} (${p.module})`;
}

// =============================================
// Severity defaults per action
// =============================================

function defaultSeverity(action: AuditActionType, status: AuditStatus): AuditSeverity {
  if (status === "denied" || status === "failed") return "high";
  switch (action) {
    case "delete":
    case "role_change":
    case "permission_change":
    case "stock_correction":
    case "production_correction":
    case "consumption_correction":
    case "stock_movement_cancel":
    case "of_cancel":
      return "high";
    case "stock_entry":
    case "stock_exit":
    case "stock_inventory":
    case "status_change":
    case "preventive_validate":
    case "preventive_suspend":
      return "medium";
    case "error":
      return "critical";
    case "access_denied":
      return "high";
    default:
      return "info";
  }
}

// =============================================
// Core insert
// =============================================

interface CurrentUser {
  id: string;
  email?: string | null;
  full_name?: string | null;
}

async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    // try profile lookup (best effort, single, fast)
    let full_name: string | null = null;
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prof) full_name = `${prof.first_name ?? ""} ${prof.last_name ?? ""}`.trim() || null;
    } catch { /* ignore */ }
    return { id: user.id, email: user.email ?? null, full_name };
  } catch {
    return null;
  }
}

/**
 * Insert an audit log entry. Never throws — failures are silently swallowed
 * so business actions are never blocked by audit logging issues.
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    const user = await getCurrentUser();
    const status = params.status ?? "success";
    const severity = params.severity ?? defaultSeverity(params.action_type, status);

    const oldSan = params.old_values ? (sanitizeValues(params.old_values) as Record<string, unknown>) : null;
    const newSan = params.new_values ? (sanitizeValues(params.new_values) as Record<string, unknown>) : null;
    const changed = computeChangedFields(oldSan ?? undefined, newSan ?? undefined);

    const description = params.description || buildDescription(params, user?.full_name ?? user?.email ?? undefined);
    const action_label = params.action_label || getActionLabel(params.action_type);

    const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;

    const row = {
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      user_full_name: user?.full_name ?? null,
      action: params.action ?? params.action_type,
      action_type: params.action_type,
      action_label,
      module: params.module,
      table_name: params.table_name ?? params.entity_type ?? params.module,
      record_id: params.record_id ?? params.entity_id ?? null,
      entity_type: params.entity_type ?? null,
      entity_id: params.entity_id ?? null,
      entity_code: params.entity_code ?? null,
      entity_label: params.entity_label ?? null,
      description,
      old_values: oldSan,
      new_values: newSan,
      changed_fields: changed.length > 0 ? changed : null,
      user_agent: ua,
      status,
      severity,
      source: params.source ?? "app",
      metadata: params.metadata ? (sanitizeValues(params.metadata) as Record<string, unknown>) : null,
    } as const;

    // user_id required by INSERT RLS policy
    if (!row.user_id) return;

    await supabase.from("audit_logs").insert(row as never);

    // Bridge: critical audit events → notification (avoid recursion: skip notifications module itself)
    if (severity === "critical" && params.module !== "notifications") {
      try {
        const { triggerNotification } = await import("./notifications");
        await triggerNotification({
          module: "audit",
          event_type: "audit_critical_event",
          entity_type: params.entity_type,
          entity_id: params.entity_id ?? null,
          entity_code: params.entity_code ?? null,
          entity_label: params.entity_label ?? null,
          title: action_label,
          message: description,
          severity: "critical",
          triggered_by_user_id: user?.id ?? null,
          source: "audit",
        });
      } catch { /* never block */ }
    }
  } catch (e) {
    // Never block business logic
    if (typeof console !== "undefined") console.warn("[audit] logAudit failed", e);
  }
}

// =============================================
// Convenience helpers
// =============================================

export async function logAuthEvent(
  action_type: "login" | "logout" | "login_failed" | "password_reset" | "password_change",
  details?: { email?: string; reason?: string }
): Promise<void> {
  await logAudit({
    action_type,
    module: "auth",
    source: "auth",
    entity_type: "user",
    entity_label: details?.email,
    description: details?.reason,
    status: action_type === "login_failed" ? "failed" : "success",
    severity: action_type === "login_failed" ? "high" : "info",
    metadata: details ? { ...details } : null,
  });
}

export async function logAccessDenied(
  module: AuditModule,
  route?: string,
  reason?: string
): Promise<void> {
  await logAudit({
    action_type: "access_denied",
    module,
    status: "denied",
    severity: "high",
    description: `Accès refusé${route ? ` à ${route}` : ""}${reason ? ` — ${reason}` : ""}`,
    metadata: { route, reason },
  });
}

export async function logError(
  module: AuditModule,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logAudit({
    action_type: "error",
    module,
    status: "failed",
    severity: "critical",
    description: message,
    metadata: metadata ?? null,
  });
}
