// =============================================
// Catalogue centralisé pour la création de règles
// (Notifications & Validations)
// =============================================

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
  // GPAO / Production
  { value: "gpao", label: "GPAO (général)", group: "Production" },
  { value: "of", label: "Ordres de fabrication", group: "Production" },
  { value: "produits", label: "Produits", group: "Production" },
  { value: "articles", label: "Articles", group: "Production" },
  { value: "recettes", label: "Recettes", group: "Production" },
  { value: "consommations", label: "Consommations", group: "Production" },
  { value: "arrets", label: "Arrêts", group: "Production" },
  // Transverse
  { value: "documents", label: "Documents", group: "Transverse" },
  { value: "images", label: "Images", group: "Transverse" },
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

// =============================================
// Événements de notification par module
// =============================================
export interface NotifEventEntry {
  value: string;
  label: string;
  /** Exemple de données pour le dry-run */
  sampleContext: Record<string, unknown>;
}

export const NOTIF_EVENTS_BY_MODULE: Record<string, NotifEventEntry[]> = {
  tickets: [
    { value: "ticket_created", label: "Ticket créé", sampleContext: { priority: "high", machine_criticality: "A" } },
    { value: "ticket_assigned", label: "Ticket assigné", sampleContext: { priority: "medium" } },
    { value: "ticket_resolved", label: "Ticket résolu", sampleContext: { duration_minutes: 90, priority: "high" } },
    { value: "ticket_closed", label: "Ticket clôturé", sampleContext: { duration_minutes: 120 } },
  ],
  interventions: [
    { value: "intervention_started", label: "Intervention démarrée", sampleContext: {} },
    { value: "intervention_finished", label: "Intervention terminée", sampleContext: { duration_minutes: 45 } },
  ],
  preventif: [
    { value: "preventive_due", label: "Préventif dû", sampleContext: { days_until: 0 } },
    { value: "preventive_late", label: "Préventif en retard", sampleContext: { days_late: 5 } },
    { value: "preventive_executed", label: "Préventif exécuté", sampleContext: {} },
  ],
  machines: [
    { value: "machine_down", label: "Machine en panne", sampleContext: { criticality: "A" } },
    { value: "machine_status_changed", label: "Statut changé", sampleContext: { new_status: "en_panne" } },
  ],
  pdr_stock: [
    { value: "pdr_stock_critical", label: "Stock critique", sampleContext: { stock_actuel: 2, stock_min: 5 } },
    { value: "pdr_stock_out", label: "Rupture", sampleContext: { stock_actuel: 0 } },
    { value: "pdr_stock_entry", label: "Entrée stock", sampleContext: { quantite: 10 } },
    { value: "pdr_stock_exit", label: "Sortie stock", sampleContext: { quantite: 3 } },
    { value: "pdr_dead_age", label: "Âge mort atteint", sampleContext: { age_jours: 400 } },
  ],
  of: [
    { value: "of_created", label: "OF créé", sampleContext: {} },
    { value: "of_started", label: "OF démarré", sampleContext: {} },
    { value: "of_completed", label: "OF terminé", sampleContext: { quantite_produite: 1000 } },
  ],
  consommations: [
    { value: "production_declaration_missing", label: "Déclaration manquante", sampleContext: { hours_late: 2 } },
    { value: "consumption_correction", label: "Correction conso", sampleContext: { ecart_pct: 12 } },
  ],
  arrets: [
    { value: "production_stop_created", label: "Arrêt créé", sampleContext: { duration_minutes: 30 } },
  ],
  documents: [
    { value: "document_uploaded", label: "Document ajouté", sampleContext: {} },
    { value: "document_deleted", label: "Document supprimé", sampleContext: {} },
  ],
  users: [
    { value: "user_role_changed", label: "Rôle modifié", sampleContext: {} },
  ],
  permissions: [
    { value: "permission_changed", label: "Permission modifiée", sampleContext: {} },
  ],
  audit: [
    { value: "audit_critical_event", label: "Événement critique", sampleContext: { severity: "critical" } },
    { value: "access_denied", label: "Accès refusé", sampleContext: {} },
  ],
  system: [
    { value: "system_error", label: "Erreur système", sampleContext: {} },
  ],
};

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
  users: [
    { value: "role_change", label: "Changement de rôle", entity: "user", defaultEnforcement: "blocking", sampleContext: {} },
  ],
  permissions: [
    { value: "permission_change", label: "Changement de permission", entity: "user", defaultEnforcement: "blocking", sampleContext: {} },
  ],
};

// =============================================
// Champs disponibles pour les conditions (par module)
// =============================================
export type ConditionFieldType = "number" | "string" | "enum" | "boolean";
export interface ConditionFieldDef {
  key: string;
  label: string;
  type: ConditionFieldType;
  values?: string[];
  unit?: string;
}

const COMMON_FIELDS: ConditionFieldDef[] = [
  { key: "priority", label: "Priorité", type: "enum", values: ["low","medium","high","critical"] },
  { key: "machine_criticality", label: "Criticité machine", type: "enum", values: ["A","B","C","D"] },
  { key: "duration_minutes", label: "Durée", type: "number", unit: "min" },
  { key: "age_hours", label: "Âge", type: "number", unit: "h" },
  { key: "ecart_pct", label: "Écart", type: "number", unit: "%" },
];

export const CONDITION_FIELDS: Record<string, ConditionFieldDef[]> = {
  tickets: [
    { key: "priority", label: "Priorité", type: "enum", values: ["low","medium","high","critical"] },
    { key: "machine_criticality", label: "Criticité machine", type: "enum", values: ["A","B","C","D"] },
    { key: "impact_ligne", label: "Impact ligne", type: "enum", values: ["aucun","partiel","total"] },
    { key: "duration_minutes", label: "Durée d'arrêt", type: "number", unit: "min" },
  ],
  interventions: [
    { key: "duration_minutes", label: "Durée intervention", type: "number", unit: "min" },
    { key: "has_pdr_exit", label: "Avec sortie PDR", type: "boolean" },
  ],
  pdr_stock: [
    { key: "ecart_pct", label: "Écart vs théorique", type: "number", unit: "%" },
    { key: "quantite", label: "Quantité", type: "number" },
    { key: "stock_actuel", label: "Stock actuel", type: "number" },
    { key: "stock_min", label: "Stock min", type: "number" },
    { key: "valeur", label: "Valeur (DA)", type: "number", unit: "DA" },
  ],
  consommations: [
    { key: "ecart_pct", label: "Écart vs prévu", type: "number", unit: "%" },
    { key: "age_hours", label: "Âge déclaration", type: "number", unit: "h" },
    { key: "quantite", label: "Quantité", type: "number" },
  ],
  of: [
    { key: "age_hours", label: "Âge OF", type: "number", unit: "h" },
    { key: "statut", label: "Statut", type: "enum", values: ["planifie","en_cours","termine","cloture"] },
  ],
  preventif: [
    { key: "days_late", label: "Jours de retard", type: "number", unit: "j" },
    { key: "days_until", label: "Jours restants", type: "number", unit: "j" },
  ],
  machines: COMMON_FIELDS,
  arrets: [
    { key: "duration_minutes", label: "Durée arrêt", type: "number", unit: "min" },
    { key: "type_arret", label: "Type", type: "enum", values: ["panne","reglage","changement_format","autre"] },
  ],
};

export function getConditionFields(module: string): ConditionFieldDef[] {
  return CONDITION_FIELDS[module] ?? COMMON_FIELDS;
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
