// =============================================
// Catalogue centralisé pour la création de règles
// (Notifications & Validations)
// =============================================
import { opsForKind, type CondOperator, type FieldKind } from "@/lib/conditionOps";

export interface ModuleEntry { value: string; label: string; group: string }

export const MODULES: ModuleEntry[] = [
  // GMAO / Maintenance
  { value: "tickets", label: "Tickets / GMAO", group: "Maintenance" },
  { value: "interventions", label: "Interventions", group: "Maintenance" },
  { value: "preventif", label: "Préventif", group: "Maintenance" },
  { value: "machines", label: "Machines", group: "Maintenance" },
  { value: "equipements", label: "Équipements", group: "Maintenance" },
  { value: "organes", label: "Organes", group: "Maintenance" },
  { value: "lignes", label: "Lignes", group: "Maintenance" },
  { value: "pdr", label: "PDR (catalogue)", group: "Maintenance" },
  { value: "pdr_stock", label: "PDR — Stock", group: "Maintenance" },
  { value: "pdr_requests", label: "PDR — Demandes / Magasin", group: "Maintenance" },
  // GPAO / Production
  { value: "gpao", label: "GPAO (général)", group: "Production" },
  { value: "of", label: "Ordres de fabrication", group: "Production" },
  { value: "produits", label: "Produits", group: "Production" },
  { value: "articles", label: "Articles", group: "Production" },
  { value: "recettes", label: "Recettes", group: "Production" },
  { value: "consommations", label: "Consommations", group: "Production" },
  { value: "arrets", label: "Arrêts", group: "Production" },
  { value: "shifts", label: "Shifts / Rotations", group: "Production" },
  // Qualité
  { value: "qualite", label: "Qualité (général)", group: "Qualité" },
  { value: "qualite_controles", label: "Contrôles qualité", group: "Qualité" },
  { value: "qualite_indicateurs", label: "Indicateurs & affectations", group: "Qualité" },
  { value: "qualite_nc", label: "Non-conformités", group: "Qualité" },
  { value: "qualite_actions", label: "Actions qualité", group: "Qualité" },
  { value: "qualite_enquetes", label: "Enquêtes de lot", group: "Qualité" },
  { value: "qualite_tracabilite", label: "Traçabilité OF", group: "Qualité" },
  { value: "reception", label: "Réception F&L", group: "Qualité" },
  // Stock / Inventaire
  { value: "inventaire", label: "Inventaire", group: "Stock" },
  // Transverse
  { value: "documents", label: "Documents", group: "Transverse" },
  { value: "images", label: "Images", group: "Transverse" },
  { value: "direction", label: "Dashboard Design", group: "Transverse" },
  { value: "validations", label: "Validations", group: "Transverse" },
  { value: "notifications", label: "Notifications", group: "Transverse" },
  { value: "auth", label: "Authentification", group: "Système" },
  { value: "users", label: "Utilisateurs", group: "Système" },
  { value: "roles", label: "Rôles", group: "Système" },
  { value: "permissions", label: "Permissions", group: "Système" },
  { value: "audit", label: "Audit", group: "Système" },
  { value: "system", label: "Système", group: "Système" },
];

export const MODULE_LABEL: Record<string, string> = MODULES.reduce(
  (acc, m) => { acc[m.value] = m.label; return acc; },
  {} as Record<string, string>
);

export const MODULE_GROUPS: string[] = Array.from(new Set(MODULES.map((m) => m.group)));

// =============================================
// Événements de notification par module
// =============================================
export interface NotifEventEntry {
  value: string;
  label: string;
  /** Sévérité conseillée par défaut */
  defaultSeverity?: "info" | "low" | "medium" | "high" | "critical";
  /** Exemple de données pour le dry-run */
  sampleContext: Record<string, unknown>;
}

export const NOTIF_EVENTS_BY_MODULE: Record<string, NotifEventEntry[]> = {
  tickets: [
    { value: "ticket_created", label: "Ticket créé", defaultSeverity: "medium", sampleContext: { priority: "high", machine_criticality: "A", impact_ligne: "arret_complet" } },
    { value: "ticket_assigned", label: "Ticket assigné", defaultSeverity: "low", sampleContext: { priority: "medium" } },
    { value: "ticket_transferred", label: "Ticket transféré", defaultSeverity: "low", sampleContext: { priority: "medium" } },
    { value: "ticket_resolved", label: "Ticket résolu", defaultSeverity: "low", sampleContext: { duration_minutes: 90, priority: "high" } },
    { value: "ticket_closed", label: "Ticket clôturé", defaultSeverity: "info", sampleContext: { duration_minutes: 120 } },
    { value: "ticket_due_soon", label: "Ticket à échéance", defaultSeverity: "medium", sampleContext: { days_until: 1, priority: "high" } },
    { value: "ticket_overdue", label: "Ticket en retard", defaultSeverity: "high", sampleContext: { days_late: 3, priority: "critical" } },
  ],
  interventions: [
    { value: "intervention_started", label: "Intervention démarrée", defaultSeverity: "info", sampleContext: { duration_minutes: 0 } },
    { value: "intervention_finished", label: "Intervention terminée", defaultSeverity: "low", sampleContext: { duration_minutes: 45, has_pdr_exit: true } },
    { value: "intervention_released", label: "Intervention libérée", defaultSeverity: "medium", sampleContext: { duration_minutes: 15 } },
  ],
  preventif: [
    { value: "preventive_due", label: "Préventif dû", defaultSeverity: "medium", sampleContext: { days_until: 0 } },
    { value: "preventive_late", label: "Préventif en retard", defaultSeverity: "high", sampleContext: { days_late: 5 } },
    { value: "preventive_executed", label: "Préventif exécuté", defaultSeverity: "info", sampleContext: { duration_minutes: 60 } },
  ],
  machines: [
    { value: "machine_down", label: "Machine en panne", defaultSeverity: "critical", sampleContext: { criticality: "A", machine_criticality: "A" } },
    { value: "machine_status_changed", label: "Statut changé", defaultSeverity: "low", sampleContext: { new_status: "en_panne" } },
  ],
  pdr_stock: [
    { value: "pdr_stock_critical", label: "Stock critique", defaultSeverity: "high", sampleContext: { stock_actuel: 2, stock_min: 5 } },
    { value: "pdr_stock_out", label: "Rupture", defaultSeverity: "critical", sampleContext: { stock_actuel: 0 } },
    { value: "pdr_stock_entry", label: "Entrée stock", defaultSeverity: "info", sampleContext: { quantite: 10 } },
    { value: "pdr_stock_exit", label: "Sortie stock", defaultSeverity: "info", sampleContext: { quantite: 3 } },
    { value: "pdr_stock_correction", label: "Correction de stock", defaultSeverity: "medium", sampleContext: { ecart_pct: 18 } },
    { value: "pdr_dead_age", label: "Âge mort atteint", defaultSeverity: "low", sampleContext: { age_jours: 400 } },
  ],
  pdr_requests: [
    { value: "pdr_request_created", label: "Demande PDR créée", defaultSeverity: "medium", sampleContext: { request_type: "curative", items_count: 3 } },
    { value: "pdr_request_ready", label: "Demande prête", defaultSeverity: "low", sampleContext: { items_count: 3 } },
    { value: "pdr_request_refused", label: "Demande refusée", defaultSeverity: "medium", sampleContext: {} },
    { value: "pdr_holding_transfer", label: "Transfert de ministock", defaultSeverity: "low", sampleContext: { quantite: 2 } },
  ],
  of: [
    { value: "of_created", label: "OF créé", defaultSeverity: "info", sampleContext: { statut: "planifie" } },
    { value: "of_started", label: "OF démarré", defaultSeverity: "info", sampleContext: { statut: "en_cours" } },
    { value: "of_completed", label: "OF terminé", defaultSeverity: "low", sampleContext: { quantite_produite: 1000, statut: "termine" } },
    { value: "of_due_soon", label: "OF à échéance", defaultSeverity: "medium", sampleContext: { days_until: 1 } },
    { value: "of_overdue", label: "OF en retard", defaultSeverity: "high", sampleContext: { days_late: 2 } },
    { value: "of_cancelled", label: "OF annulé", defaultSeverity: "medium", sampleContext: { statut: "annule" } },
  ],
  consommations: [
    { value: "production_declaration_missing", label: "Déclaration manquante", defaultSeverity: "high", sampleContext: { hours_late: 2, age_hours: 2 } },
    { value: "consumption_correction", label: "Correction conso", defaultSeverity: "medium", sampleContext: { ecart_pct: 12 } },
  ],
  arrets: [
    { value: "production_stop_created", label: "Arrêt créé", defaultSeverity: "medium", sampleContext: { duration_minutes: 30, type_arret: "panne" } },
    { value: "production_stop_long", label: "Arrêt prolongé", defaultSeverity: "high", sampleContext: { duration_minutes: 120, type_arret: "panne" } },
  ],
  shifts: [
    { value: "shift_opened", label: "Shift ouvert", defaultSeverity: "info", sampleContext: { shift_type: "matin" } },
    { value: "shift_closed", label: "Shift clôturé", defaultSeverity: "info", sampleContext: { shift_type: "nuit" } },
    { value: "shift_auto_closed", label: "Shift clôturé automatiquement", defaultSeverity: "medium", sampleContext: { age_hours: 14 } },
    { value: "shift_no_activity", label: "Aucune activité sur le shift", defaultSeverity: "medium", sampleContext: { age_hours: 4 } },
  ],
  qualite_controles: [
    { value: "quality_check_nok", label: "Contrôle non conforme", defaultSeverity: "high", sampleContext: { is_conforme: false, category: "produit_fini", indicator_type: "numeric" } },
    { value: "quality_check_blocking_nok", label: "Contrôle bloquant non conforme", defaultSeverity: "critical", sampleContext: { is_conforme: false, is_blocking: true } },
    { value: "quality_check_overdue", label: "Contrôle en retard", defaultSeverity: "high", sampleContext: { minutes_late: 45, frequency_type: "hourly" } },
    { value: "quality_check_missing", label: "Contrôle non réalisé sur le shift", defaultSeverity: "medium", sampleContext: { minutes_late: 90 } },
    { value: "quality_check_recorded", label: "Contrôle saisi", defaultSeverity: "info", sampleContext: { is_conforme: true } },
  ],
  qualite_indicateurs: [
    { value: "quality_indicator_assigned", label: "Indicateur affecté", defaultSeverity: "info", sampleContext: { scope: "product" } },
    { value: "quality_indicator_removed", label: "Indicateur retiré", defaultSeverity: "medium", sampleContext: { scope: "of" } },
    { value: "quality_indicator_updated", label: "Indicateur modifié", defaultSeverity: "low", sampleContext: { scope: "product" } },
  ],
  qualite_nc: [
    { value: "nc_declared", label: "NC déclarée", defaultSeverity: "high", sampleContext: { nc_severity: "major", nc_type: "produit_fini", status: "declared" } },
    { value: "nc_critical_declared", label: "NC critique déclarée", defaultSeverity: "critical", sampleContext: { nc_severity: "critical" } },
    { value: "nc_decision_pending", label: "Décision NC en attente", defaultSeverity: "high", sampleContext: { status: "decision_pending", age_hours: 6 } },
    { value: "nc_lot_blocked", label: "Lot bloqué", defaultSeverity: "critical", sampleContext: { decision: "bloquer_lot" } },
    { value: "nc_released", label: "Lot libéré", defaultSeverity: "medium", sampleContext: { decision: "liberer" } },
    { value: "nc_closed", label: "NC clôturée", defaultSeverity: "info", sampleContext: { status: "closed" } },
  ],
  qualite_actions: [
    { value: "quality_action_created", label: "Action qualité créée", defaultSeverity: "medium", sampleContext: { action_type: "corrective", priority: "high" } },
    { value: "quality_action_due_soon", label: "Action à échéance", defaultSeverity: "medium", sampleContext: { days_until: 1, priority: "high" } },
    { value: "quality_action_overdue", label: "Action en retard", defaultSeverity: "high", sampleContext: { days_late: 4, priority: "critical" } },
    { value: "quality_action_closed", label: "Action clôturée", defaultSeverity: "info", sampleContext: { status: "closed" } },
  ],
  qualite_enquetes: [
    { value: "lot_investigation_opened", label: "Enquête de lot ouverte", defaultSeverity: "medium", sampleContext: { events_count: 12 } },
    { value: "lot_investigation_linked_nc", label: "Enquête liée à une NC", defaultSeverity: "high", sampleContext: { nc_severity: "major" } },
    { value: "lot_investigation_closed", label: "Enquête clôturée", defaultSeverity: "info", sampleContext: { status: "closed" } },
  ],
  qualite_tracabilite: [
    { value: "of_quality_blocked", label: "OF bloqué qualité", defaultSeverity: "critical", sampleContext: { quality_status: "bloque" } },
    { value: "of_quality_released", label: "OF libéré", defaultSeverity: "low", sampleContext: { quality_status: "libere" } },
    { value: "of_quality_rejected", label: "OF rebuté", defaultSeverity: "high", sampleContext: { quality_status: "rebute" } },
  ],
  reception: [
    { value: "reception_ticket_created", label: "Ticket réception créé", defaultSeverity: "info", sampleContext: { etat_pesee: "a_peser" } },
    { value: "reception_ticket_gap", label: "Écart de numérotation ticket", defaultSeverity: "medium", sampleContext: { numero_gap: 4 } },
    { value: "reception_not_weighed", label: "Ticket non pesé", defaultSeverity: "medium", sampleContext: { etat_pesee: "a_peser", age_hours: 5 } },
    { value: "reception_abattement_high", label: "Abattement élevé", defaultSeverity: "high", sampleContext: { abattement_pct: 12 } },
    { value: "reception_duration_exceeded", label: "Durée de contrôle dépassée", defaultSeverity: "medium", sampleContext: { duration_minutes: 35 } },
    { value: "reception_ticket_renamed", label: "N° de ticket modifié", defaultSeverity: "medium", sampleContext: {} },
    { value: "reception_photos_transferred", label: "Photos transférées", defaultSeverity: "medium", sampleContext: { photos_count: 4 } },
  ],
  inventaire: [
    { value: "inventory_campaign_opened", label: "Campagne ouverte", defaultSeverity: "info", sampleContext: { campaign_type: "pdr" } },
    { value: "inventory_gap_detected", label: "Écart détecté", defaultSeverity: "high", sampleContext: { ecart_pct: 15 } },
    { value: "inventory_recount_required", label: "Recomptage requis", defaultSeverity: "medium", sampleContext: { decision: "recompte_ab" } },
    { value: "inventory_campaign_closed", label: "Campagne clôturée", defaultSeverity: "info", sampleContext: { campaign_type: "pdr" } },
  ],
  documents: [
    { value: "document_uploaded", label: "Document ajouté", defaultSeverity: "info", sampleContext: {} },
    { value: "document_deleted", label: "Document supprimé", defaultSeverity: "medium", sampleContext: {} },
    { value: "document_expiring", label: "Document expirant", defaultSeverity: "medium", sampleContext: { days_until: 15 } },
  ],
  direction: [
    { value: "dashboard_shared", label: "Dashboard partagé", defaultSeverity: "info", sampleContext: {} },
    { value: "dashboard_share_revoked", label: "Partage révoqué", defaultSeverity: "low", sampleContext: {} },
  ],
  validations: [
    { value: "validation_requested", label: "Validation demandée", defaultSeverity: "high", sampleContext: { priority: "high", enforcement: "blocking" } },
    { value: "validation_approved", label: "Validation approuvée", defaultSeverity: "low", sampleContext: { priority: "medium" } },
    { value: "validation_rejected", label: "Validation refusée", defaultSeverity: "medium", sampleContext: { priority: "high" } },
    { value: "validation_pending_too_long", label: "Validation en attente trop longue", defaultSeverity: "high", sampleContext: { age_hours: 48 } },
  ],
  users: [
    { value: "user_created", label: "Utilisateur créé", defaultSeverity: "low", sampleContext: {} },
    { value: "user_role_changed", label: "Rôle modifié", defaultSeverity: "medium", sampleContext: {} },
    { value: "user_disabled", label: "Utilisateur désactivé", defaultSeverity: "medium", sampleContext: {} },
  ],
  permissions: [
    { value: "permission_changed", label: "Permission modifiée", defaultSeverity: "medium", sampleContext: {} },
  ],
  auth: [
    { value: "login_failed_repeated", label: "Échecs de connexion répétés", defaultSeverity: "high", sampleContext: { attempts: 5 } },
    { value: "impersonation_started", label: "Impersonation démarrée", defaultSeverity: "high", sampleContext: {} },
  ],
  audit: [
    { value: "audit_critical_event", label: "Événement critique", defaultSeverity: "critical", sampleContext: { severity: "critical" } },
    { value: "access_denied", label: "Accès refusé", defaultSeverity: "medium", sampleContext: {} },
  ],
  system: [
    { value: "system_error", label: "Erreur système", defaultSeverity: "critical", sampleContext: {} },
    { value: "email_delivery_failed", label: "Échec d'envoi email", defaultSeverity: "high", sampleContext: {} },
    { value: "cron_job_failed", label: "Tâche planifiée en échec", defaultSeverity: "high", sampleContext: {} },
  ],
};

export function getNotifEvents(module: string): NotifEventEntry[] {
  return NOTIF_EVENTS_BY_MODULE[module] ?? [];
}

export function getNotifEvent(module: string, event: string): NotifEventEntry | undefined {
  return getNotifEvents(module).find((e) => e.value === event);
}

export const NOTIF_EVENT_LABEL: Record<string, string> = Object.values(NOTIF_EVENTS_BY_MODULE)
  .flat()
  .reduce((acc, e) => { acc[e.value] = e.label; return acc; }, {} as Record<string, string>);

// =============================================
// Actions de validation par module
// =============================================
export interface ValidationActionEntry {
  value: string;
  label: string;
  entity: string;
  defaultEnforcement: "post_hoc" | "blocking";
  sampleContext: Record<string, unknown>;
}

export const VALIDATION_ACTIONS_BY_MODULE: Record<string, ValidationActionEntry[]> = {
  pdr_stock: [
    { value: "correction", label: "Correction de stock", entity: "pdr_movement", defaultEnforcement: "blocking", sampleContext: { ecart_pct: 15 } },
    { value: "inventaire", label: "Ajustement inventaire", entity: "pdr_movement", defaultEnforcement: "blocking", sampleContext: { ecart_pct: 8 } },
    { value: "exit", label: "Sortie manuelle", entity: "pdr_movement", defaultEnforcement: "post_hoc", sampleContext: { quantite: 5 } },
    { value: "entry", label: "Entrée manuelle", entity: "pdr_movement", defaultEnforcement: "post_hoc", sampleContext: { quantite: 20 } },
    { value: "cancel_movement", label: "Annulation mouvement", entity: "pdr_movement", defaultEnforcement: "blocking", sampleContext: {} },
  ],
  tickets: [
    { value: "resolve_critical", label: "Résolution ticket critique", entity: "ticket", defaultEnforcement: "post_hoc", sampleContext: { priority: "critical", machine_criticality: "A" } },
    { value: "close", label: "Clôture ticket", entity: "ticket", defaultEnforcement: "post_hoc", sampleContext: { duration_minutes: 90 } },
    { value: "reopen", label: "Réouverture", entity: "ticket", defaultEnforcement: "blocking", sampleContext: {} },
  ],
  interventions: [
    { value: "exit_pdr", label: "Sortie PDR (intervention)", entity: "intervention", defaultEnforcement: "post_hoc", sampleContext: {} },
  ],
  consommations: [
    { value: "correction", label: "Correction de consommation", entity: "consumption", defaultEnforcement: "blocking", sampleContext: { ecart_pct: 20 } },
    { value: "out_of_day", label: "Conso hors journée", entity: "consumption", defaultEnforcement: "blocking", sampleContext: { age_hours: 30 } },
  ],
  of: [
    { value: "retroactive_edit", label: "Modification rétroactive", entity: "of", defaultEnforcement: "blocking", sampleContext: { age_hours: 48 } },
    { value: "cancel", label: "Annulation OF", entity: "of", defaultEnforcement: "blocking", sampleContext: {} },
  ],
  qualite_nc: [
    { value: "release_lot", label: "Libération de lot", entity: "quality_nc", defaultEnforcement: "blocking", sampleContext: { nc_severity: "major", decision: "liberer" } },
    { value: "derogation", label: "Libération sous dérogation", entity: "quality_nc", defaultEnforcement: "blocking", sampleContext: { decision: "liberer_sous_derogation" } },
    { value: "scrap", label: "Mise au rebut", entity: "quality_nc", defaultEnforcement: "blocking", sampleContext: { decision: "rebuter" } },
    { value: "close_nc", label: "Clôture NC", entity: "quality_nc", defaultEnforcement: "post_hoc", sampleContext: { status: "verified" } },
  ],
  qualite_controles: [
    { value: "edit_check", label: "Modification d'un contrôle saisi", entity: "quality_check", defaultEnforcement: "post_hoc", sampleContext: { age_hours: 12 } },
    { value: "delete_check", label: "Suppression d'un contrôle", entity: "quality_check", defaultEnforcement: "blocking", sampleContext: {} },
    { value: "override_nok", label: "Forçage d'un contrôle NOK", entity: "quality_check", defaultEnforcement: "blocking", sampleContext: { is_conforme: false } },
  ],
  qualite_tracabilite: [
    { value: "quality_decision", label: "Décision qualité OF", entity: "of", defaultEnforcement: "blocking", sampleContext: { quality_status: "libere" } },
  ],
  reception: [
    { value: "rename_ticket", label: "Renumérotation de ticket", entity: "reception_ticket", defaultEnforcement: "post_hoc", sampleContext: {} },
    { value: "transfer_photos", label: "Transfert de photos + suppression source", entity: "reception_ticket", defaultEnforcement: "blocking", sampleContext: { photos_count: 4 } },
    { value: "edit_weight", label: "Modification du poids brut", entity: "reception_ticket", defaultEnforcement: "post_hoc", sampleContext: { abattement_pct: 10 } },
    { value: "delete_ticket", label: "Suppression de ticket", entity: "reception_ticket", defaultEnforcement: "blocking", sampleContext: {} },
  ],
  inventaire: [
    { value: "arbitrage", label: "Arbitrage d'écart", entity: "inventory_target", defaultEnforcement: "blocking", sampleContext: { ecart_pct: 20 } },
    { value: "close_campaign", label: "Clôture de campagne", entity: "inventory_campaign", defaultEnforcement: "blocking", sampleContext: {} },
  ],
  users: [
    { value: "role_change", label: "Changement de rôle", entity: "user", defaultEnforcement: "blocking", sampleContext: {} },
  ],
  permissions: [
    { value: "permission_change", label: "Changement de permission", entity: "user", defaultEnforcement: "blocking", sampleContext: {} },
  ],
};

export function getValidationActions(module: string): ValidationActionEntry[] {
  return VALIDATION_ACTIONS_BY_MODULE[module] ?? [];
}

// =============================================
// Champs disponibles pour les conditions (par module)
// =============================================
export type ConditionFieldType = FieldKind;
export interface ConditionFieldDef {
  key: string;
  label: string;
  type: ConditionFieldType;
  values?: string[];
  unit?: string;
}

const F = {
  priority: { key: "priority", label: "Priorité", type: "enum", values: ["low", "medium", "high", "critical"] } as ConditionFieldDef,
  machineCriticality: { key: "machine_criticality", label: "Criticité machine", type: "enum", values: ["A", "B", "C", "D"] } as ConditionFieldDef,
  duration: { key: "duration_minutes", label: "Durée", type: "number", unit: "min" } as ConditionFieldDef,
  ageHours: { key: "age_hours", label: "Âge", type: "number", unit: "h" } as ConditionFieldDef,
  ecart: { key: "ecart_pct", label: "Écart", type: "number", unit: "%" } as ConditionFieldDef,
  daysUntil: { key: "days_until", label: "Jours restants", type: "number", unit: "j" } as ConditionFieldDef,
  daysLate: { key: "days_late", label: "Jours de retard", type: "number", unit: "j" } as ConditionFieldDef,
  ligne: { key: "ligne_code", label: "Ligne", type: "string" } as ConditionFieldDef,
  shiftType: { key: "shift_type", label: "Type de shift", type: "enum", values: ["matin", "apres_midi", "nuit"] } as ConditionFieldDef,
  quantite: { key: "quantite", label: "Quantité", type: "number" } as ConditionFieldDef,
};

const COMMON_FIELDS: ConditionFieldDef[] = [
  F.priority, F.machineCriticality, F.duration, F.ageHours, F.ecart,
];

export const CONDITION_FIELDS: Record<string, ConditionFieldDef[]> = {
  tickets: [
    F.priority,
    F.machineCriticality,
    { key: "impact_ligne", label: "Impact ligne", type: "enum", values: ["arret_complet", "arret_partiel", "degradation", "aucun"] },
    { key: "statut", label: "Statut", type: "enum", values: ["ouvert", "pris_en_charge", "en_cours", "resolu", "cloture"] },
    { key: "duration_minutes", label: "Durée d'arrêt", type: "number", unit: "min" },
    F.daysUntil, F.daysLate, F.ligne,
  ],
  interventions: [
    { key: "duration_minutes", label: "Durée intervention", type: "number", unit: "min" },
    { key: "has_pdr_exit", label: "Avec sortie PDR", type: "boolean" },
    { key: "role", label: "Rôle intervenant", type: "enum", values: ["lead", "aide", "co_intervenant"] },
    F.machineCriticality, F.ligne,
  ],
  pdr_stock: [
    { key: "ecart_pct", label: "Écart vs théorique", type: "number", unit: "%" },
    F.quantite,
    { key: "stock_actuel", label: "Stock actuel", type: "number" },
    { key: "stock_min", label: "Stock min", type: "number" },
    { key: "valeur", label: "Valeur (DA)", type: "number", unit: "DA" },
    { key: "statut_pdr", label: "Statut PDR", type: "enum", values: ["strategique", "commune"] },
    { key: "age_jours", label: "Âge du stock", type: "number", unit: "j" },
  ],
  pdr_requests: [
    { key: "request_type", label: "Type de demande", type: "enum", values: ["curative", "preventive"] },
    { key: "items_count", label: "Nombre de lignes", type: "number" },
    F.priority, F.ageHours, F.quantite,
  ],
  consommations: [
    { key: "ecart_pct", label: "Écart vs prévu", type: "number", unit: "%" },
    { key: "age_hours", label: "Âge déclaration", type: "number", unit: "h" },
    { key: "hours_late", label: "Heures de retard", type: "number", unit: "h" },
    F.quantite, F.ligne, F.shiftType,
  ],
  of: [
    { key: "age_hours", label: "Âge OF", type: "number", unit: "h" },
    { key: "statut", label: "Statut", type: "enum", values: ["planifie", "en_cours", "termine", "annule"] },
    { key: "quantite_produite", label: "Quantité produite", type: "number" },
    F.daysUntil, F.daysLate, F.ligne,
    { key: "produit_code", label: "Produit", type: "string" },
  ],
  preventif: [
    F.daysLate, F.daysUntil,
    { key: "frequence", label: "Fréquence", type: "enum", values: ["quotidien", "hebdomadaire", "mensuel", "trimestriel", "semestriel", "annuel"] },
    F.machineCriticality,
  ],
  machines: [
    F.machineCriticality,
    { key: "statut", label: "Statut", type: "enum", values: ["en_marche", "arret", "maintenance"] },
    F.ligne, F.duration,
  ],
  arrets: [
    { key: "duration_minutes", label: "Durée arrêt", type: "number", unit: "min" },
    { key: "type_arret", label: "Type", type: "enum", values: ["panne", "changement_serie", "pause", "nettoyage", "attente_matiere", "qualite", "autre"] },
    F.ligne, F.shiftType,
  ],
  shifts: [
    F.shiftType, F.ageHours, F.ligne,
    { key: "members_count", label: "Nb intervenants", type: "number" },
  ],
  qualite_controles: [
    { key: "is_conforme", label: "Conforme", type: "boolean" },
    { key: "is_blocking", label: "Contrôle bloquant", type: "boolean" },
    { key: "category", label: "Catégorie", type: "enum", values: ["produit_fini", "emballage", "process", "hygiene", "poids", "controle_visuel", "physico_chimique", "conditionnement", "organoleptique", "autre"] },
    { key: "indicator_type", label: "Type d'indicateur", type: "enum", values: ["numeric", "boolean", "text", "select"] },
    { key: "frequency_type", label: "Fréquence", type: "enum", values: ["hourly", "shift", "daily", "per_of", "per_lot", "manual"] },
    { key: "minutes_late", label: "Retard", type: "number", unit: "min" },
    { key: "valeur", label: "Valeur mesurée", type: "number" },
    { key: "indicator_code", label: "Code indicateur", type: "string" },
    F.ligne, F.shiftType,
  ],
  qualite_indicateurs: [
    { key: "scope", label: "Portée", type: "enum", values: ["product", "of", "line"] },
    { key: "category", label: "Catégorie", type: "enum", values: ["produit_fini", "emballage", "process", "hygiene", "poids", "controle_visuel", "physico_chimique", "conditionnement", "organoleptique", "autre"] },
    { key: "is_blocking", label: "Bloquant", type: "boolean" },
  ],
  qualite_nc: [
    { key: "nc_severity", label: "Gravité", type: "enum", values: ["minor", "major", "critical"] },
    { key: "nc_type", label: "Type de NC", type: "enum", values: ["produit_fini", "emballage", "matiere_premiere", "process", "hygiene", "etiquetage", "poids", "aspect", "securite_alimentaire", "autre"] },
    { key: "status", label: "Statut", type: "enum", values: ["draft", "declared", "under_review", "blocked", "decision_pending", "action_in_progress", "verified", "closed", "cancelled"] },
    { key: "decision", label: "Décision", type: "enum", values: ["bloquer_lot", "liberer", "liberer_sous_derogation", "retraiter", "trier", "rebuter", "retour_fournisseur", "quarantaine", "autre"] },
    { key: "quantite_impactee", label: "Quantité impactée", type: "number" },
    F.ageHours, F.ligne,
  ],
  qualite_actions: [
    { key: "action_type", label: "Type d'action", type: "enum", values: ["curative", "corrective", "preventive"] },
    { key: "status", label: "Statut", type: "enum", values: ["open", "in_progress", "done", "verified", "closed", "cancelled"] },
    F.priority, F.daysUntil, F.daysLate,
  ],
  qualite_enquetes: [
    { key: "events_count", label: "Nb d'événements", type: "number" },
    { key: "status", label: "Statut", type: "enum", values: ["open", "in_progress", "closed"] },
    { key: "lot_reference", label: "N° de lot", type: "string" },
    F.ligne, F.ageHours,
  ],
  qualite_tracabilite: [
    { key: "quality_status", label: "Statut qualité OF", type: "enum", values: ["non_demarre", "en_controle", "conforme", "conforme_sous_reserve", "non_conforme", "bloque", "libere", "rebute", "a_retraiter"] },
    F.ligne, F.ageHours,
  ],
  reception: [
    { key: "etat_pesee", label: "État pesée", type: "enum", values: ["a_peser", "pese"] },
    { key: "abattement_pct", label: "Abattement", type: "number", unit: "%" },
    { key: "poids_brut_kg", label: "Poids brut", type: "number", unit: "kg" },
    { key: "poids_net_kg", label: "Poids net", type: "number", unit: "kg" },
    { key: "duration_minutes", label: "Durée de contrôle", type: "number", unit: "min" },
    { key: "numero_gap", label: "Écart de numérotation", type: "number" },
    { key: "fournisseur", label: "Fournisseur", type: "string" },
    { key: "produit", label: "Produit", type: "string" },
    { key: "photos_count", label: "Nb de photos", type: "number" },
  ],
  inventaire: [
    { key: "campaign_type", label: "Type de campagne", type: "enum", values: ["pdr", "investissement"] },
    { key: "ecart_pct", label: "Écart", type: "number", unit: "%" },
    { key: "decision", label: "Décision", type: "enum", values: ["en_attente", "conforme_ab", "conforme_c_eq_a", "conforme_c_eq_b", "recompte_ab"] },
    { key: "targets_count", label: "Nb d'articles", type: "number" },
  ],
  validations: [
    F.priority,
    { key: "enforcement", label: "Application", type: "enum", values: ["post_hoc", "blocking"] },
    { key: "status", label: "Statut", type: "enum", values: ["draft", "submitted", "pending_post_hoc", "approved", "rejected", "cancelled", "applied", "archived"] },
    F.ageHours,
  ],
  documents: [
    { key: "days_until", label: "Jours avant expiration", type: "number", unit: "j" },
    { key: "category", label: "Catégorie", type: "string" },
    { key: "entity_type", label: "Type d'entité", type: "string" },
  ],
  auth: [
    { key: "attempts", label: "Tentatives", type: "number" },
    { key: "email", label: "Email", type: "string" },
  ],
  audit: [
    { key: "severity", label: "Sévérité", type: "enum", values: ["info", "low", "medium", "high", "critical"] },
    { key: "action_type", label: "Action", type: "string" },
    { key: "module", label: "Module", type: "string" },
  ],
  system: [
    { key: "severity", label: "Sévérité", type: "enum", values: ["info", "low", "medium", "high", "critical"] },
    { key: "job", label: "Tâche", type: "string" },
  ],
};

export function getConditionFields(module: string): ConditionFieldDef[] {
  return CONDITION_FIELDS[module] ?? COMMON_FIELDS;
}

export function getFieldDef(module: string, key: string): ConditionFieldDef | undefined {
  return getConditionFields(module).find((f) => f.key === key);
}

/** Opérateurs autorisés pour un champ d'un module donné. */
export function operatorsForField(module: string, key: string): CondOperator[] {
  const def = getFieldDef(module, key);
  return opsForKind(def?.type ?? "string");
}

// =============================================
// Rôles
// =============================================
export const ROLES = [
  "admin",
  "responsable_si",
  "resp_maintenance",
  "maintenancier",
  "resp_production",
  "chef_ligne",
  "operateur",
  "gestionnaire_magasin",
  "responsable_magasin",
  "bureau_methode",
  "auditeur",
  "controleur_qualite",
  "responsable_controle_qualite",
  "directeur_qualite",
  "agreeur",
  "agent_pont_bascule",
  "responsable_inventaire",
  "agent_inventaire",
] as const;

/** Rôles conseillés par groupe de module (pré-remplissage du formulaire de règle). */
export const SUGGESTED_ROLES_BY_GROUP: Record<string, string[]> = {
  Maintenance: ["resp_maintenance", "maintenancier"],
  Production: ["resp_production", "chef_ligne"],
  Qualité: ["responsable_controle_qualite", "directeur_qualite"],
  Stock: ["responsable_magasin", "gestionnaire_magasin", "responsable_inventaire"],
  Transverse: ["admin", "responsable_si"],
  Système: ["admin", "responsable_si"],
};

export function suggestedRolesForModule(module: string): string[] {
  const group = MODULES.find((m) => m.value === module)?.group ?? "Transverse";
  return SUGGESTED_ROLES_BY_GROUP[group] ?? ["admin"];
}
