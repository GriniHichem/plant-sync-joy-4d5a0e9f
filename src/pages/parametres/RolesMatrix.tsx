import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCustomRoles } from "@/hooks/useCustomRoles";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Save, RotateCcw, ShieldCheck, Eye, Plus, Pencil, Trash2,
  Cog, Factory, Wrench, CheckCheck, XCircle, ChevronDown, ChevronRight,
  Search, Copy, Sparkles, ClipboardCheck, Boxes, FileSearch,
  ShieldAlert, Wand2,
} from "lucide-react";

// ── Module groups (synced with /apps and nav) ──────────────────
const MODULE_GROUPS = [
  {
    label: "Maintenance (GMAO)",
    icon: Wrench,
    modules: [
      { key: "dashboard", label: "Tableau de bord GMAO" },
      { key: "machines", label: "Machines" },
      { key: "equipements", label: "Équipements" },
      { key: "organes", label: "Organes" },
      { key: "lignes", label: "Lignes & synoptique" },
      { key: "pdr", label: "Pièces de rechange" },
      { key: "pdr_demandes", label: "Demandes pièces (magasin)" },
      { key: "shift_magasin", label: "Shift Magasin" },
      { key: "journal_stock", label: "Journal Stock" },
      { key: "tickets", label: "Tickets" },
      { key: "preventif", label: "Préventif" },
      { key: "shift_maintenance", label: "Shift Maintenance" },
      { key: "journal", label: "Journal d'interventions" },
      { key: "historique", label: "Historique interventions" },
      { key: "analytiques", label: "Analyse & KPI" },
    ],
  },
  {
    label: "Production (GPAO)",
    icon: Factory,
    modules: [
      { key: "gpao_dashboard", label: "Tableau de bord GPAO" },
      { key: "of", label: "Ordres de fab." },
      { key: "produits", label: "Produits" },
      { key: "articles", label: "Articles" },
      { key: "recettes", label: "Recettes / BOM" },
      { key: "shift_production", label: "Shift Production" },
      { key: "consommations", label: "Consommations" },
      { key: "arrets", label: "Arrêts" },
    ],
  },
  {
    label: "Qualité",
    icon: ClipboardCheck,
    modules: [
      { key: "qualite", label: "Module Qualité (umbrella)" },
      { key: "qualite_dashboard", label: "Dashboard Qualité" },
      { key: "qualite_of", label: "OF Qualité" },
      { key: "qualite_indicateurs", label: "Indicateurs" },
      { key: "qualite_plan_controle", label: "Plan de contrôle OF" },
      { key: "qualite_controles", label: "Historique des contrôles" },
      { key: "qualite_nc", label: "Non-conformités" },
      { key: "qualite_actions", label: "Actions correctives" },
      { key: "qualite_recettes", label: "Recettes & nomenclatures" },
      { key: "qualite_tracabilite", label: "Traçabilité" },
      { key: "qualite_rapports", label: "Rapports" },
      { key: "qualite_shift", label: "Shift contrôle" },
      { key: "reception", label: "Réception Fruits & Légumes" },
    ],
  },
  {
    label: "Inventaire",
    icon: Boxes,
    modules: [
      { key: "inventaire", label: "Module Inventaire (umbrella)" },
      { key: "inventaire_campagnes", label: "Campagnes (double comptage)" },
    ],
  },
  {
    label: "Direction",
    icon: ShieldCheck,
    modules: [
      { key: "direction", label: "Module Dashboard Design (umbrella)" },
      { key: "direction_dashboards", label: "Dashboard Design" },
    ],
  },
  {
    label: "Gouvernance",
    icon: ShieldCheck,
    modules: [
      { key: "audit", label: "Audit & traçabilité" },
      { key: "validations", label: "Validations" },
      { key: "validations_rules", label: "Règles de validation" },
      { key: "notifications", label: "Notifications" },
      { key: "notifications_rules", label: "Règles de notification" },
      { key: "securite", label: "Sécurité & accès" },
    ],
  },
  {
    label: "Configuration",
    icon: Cog,
    modules: [
      { key: "parametres", label: "Paramètres (hub)" },
      { key: "utilisateurs", label: "Utilisateurs" },
      { key: "referentiels", label: "Référentiels (familles, pannes…)" },
      { key: "documents", label: "Documents" },
      { key: "pdr_stock_config", label: "Permissions PDR & Stock" },
      { key: "qualite_parametres", label: "Paramètres Qualité" },
      { key: "smtp", label: "SMTP & emails" },
      { key: "general", label: "Général & branding" },
      { key: "images", label: "Images & médias" },
      { key: "recherche", label: "Recherche globale" },
      { key: "apps", label: "Catalogue d'applications" },
    ],
  },
] as const;

const ALL_MODULES = MODULE_GROUPS.flatMap((g) => g.modules.map((m) => ({ ...m, group: g.label })));

const ROLES = [
  { key: "admin", label: "Admin", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", group: "Direction" },
  { key: "responsable_si", label: "Responsable SI", color: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300", group: "Direction" },
  { key: "auditeur", label: "Auditeur", color: "bg-zinc-100 text-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300", group: "Direction" },

  { key: "resp_maintenance", label: "Resp. Maintenance", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", group: "Maintenance" },
  { key: "maintenancier", label: "Maintenancier", color: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300", group: "Maintenance" },
  { key: "bureau_methode", label: "Bureau Méthode", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300", group: "Maintenance" },

  { key: "resp_production", label: "Resp. Production", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", group: "Production" },
  { key: "chef_ligne", label: "Chef de ligne", color: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300", group: "Production" },
  { key: "operateur", label: "Opérateur", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", group: "Production" },

  { key: "directeur_qualite", label: "Directeur Qualité", color: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300", group: "Qualité" },
  { key: "responsable_controle_qualite", label: "Resp. Contrôle Qualité", color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300", group: "Qualité" },
  { key: "controleur_qualite", label: "Contrôleur Qualité", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300", group: "Qualité" },
  { key: "agent_pont_bascule", label: "Agent Pont Bascule", color: "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300", group: "Qualité" },
  { key: "agreeur", label: "Agréeur", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", group: "Qualité" },

  { key: "gestionnaire_magasin", label: "Gest. Magasin", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300", group: "Logistique" },
  { key: "responsable_magasin", label: "Resp. Magasin", color: "bg-purple-200 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200", group: "Logistique" },
  { key: "responsable_inventaire", label: "Resp. Inventaire", color: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300", group: "Logistique" },
  { key: "agent_inventaire", label: "Agent Inventaire", color: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300", group: "Logistique" },
];

const ROLE_GROUPS = ["Direction", "Maintenance", "Production", "Qualité", "Logistique", "Personnalisés"];

const ACTIONS = [
  { key: "can_view" as const, label: "Voir", short: "V", icon: Eye, activeClass: "bg-blue-500/15 text-blue-700 border-blue-300 dark:text-blue-300 dark:border-blue-700" },
  { key: "can_create" as const, label: "Créer", short: "C", icon: Plus, activeClass: "bg-green-500/15 text-green-700 border-green-300 dark:text-green-300 dark:border-green-700" },
  { key: "can_edit" as const, label: "Modifier", short: "M", icon: Pencil, activeClass: "bg-amber-500/15 text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-700" },
  { key: "can_delete" as const, label: "Supprimer", short: "S", icon: Trash2, activeClass: "bg-red-500/15 text-red-700 border-red-300 dark:text-red-300 dark:border-red-700" },
];

type ActionKey = (typeof ACTIONS)[number]["key"];

interface PermRow {
  id?: string;
  role: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

// ── Presets (sensible defaults per role) ───────────────────────
type Preset = { view: boolean; create: boolean; edit: boolean; delete: boolean };
const FULL: Preset = { view: true, create: true, edit: true, delete: true };
const RW: Preset = { view: true, create: true, edit: true, delete: false };
const RC: Preset = { view: true, create: true, edit: false, delete: false };
const RO: Preset = { view: true, create: false, edit: false, delete: false };
const NONE: Preset = { view: false, create: false, edit: false, delete: false };

function ap(modules: string[], preset: Preset, base: Record<string, Preset> = {}) {
  const out = { ...base };
  for (const m of modules) out[m] = preset;
  return out;
}

const MAINT_MODS = ["dashboard", "machines", "equipements", "organes", "lignes", "pdr", "tickets", "preventif", "shift_maintenance", "journal", "historique", "analytiques"];
const LOG_MODS = ["pdr_demandes", "shift_magasin", "journal_stock"];
const PROD_MODS = ["gpao_dashboard", "of", "produits", "articles", "recettes", "shift_production", "consommations", "arrets"];
const QUALITY_MODS = ["qualite", "qualite_dashboard", "qualite_of", "qualite_indicateurs", "qualite_plan_controle", "qualite_controles", "qualite_nc", "qualite_actions", "qualite_recettes", "qualite_tracabilite", "qualite_rapports", "qualite_shift", "reception"];
const INV_MODS = ["inventaire", "inventaire_campagnes"];
const DIR_MODS = ["direction", "direction_dashboards"];
const GOV_MODS = ["audit", "validations", "validations_rules", "notifications", "notifications_rules", "securite"];
const CFG_MODS = ["parametres", "utilisateurs", "referentiels", "documents", "pdr_stock_config", "qualite_parametres", "smtp", "general", "images", "recherche", "apps"];
const ALL_KEYS = [...MAINT_MODS, ...LOG_MODS, ...PROD_MODS, ...QUALITY_MODS, ...INV_MODS, ...DIR_MODS, ...GOV_MODS, ...CFG_MODS];

const ROLE_DEFAULTS: Record<string, Record<string, Preset>> = {
  admin: ap(ALL_KEYS, FULL),
  responsable_si: ap(ALL_KEYS, FULL),
  auditeur: ap(ALL_KEYS, RO),

  resp_maintenance: { ...ap(DIR_MODS, FULL), ...ap(MAINT_MODS, FULL), ...ap(PROD_MODS, RO), qualite: RO, inventaire: RO, audit: RO, validations: RW, notifications: RW, apps: RO, recherche: RO, parametres: RO, referentiels: RO },
  maintenancier: { ...ap(MAINT_MODS, RW), tickets: FULL, journal: RO, historique: RO, analytiques: RO, notifications: RO, apps: RO, recherche: RO },
  bureau_methode: { ...ap(MAINT_MODS, RW), preventif: FULL, recettes: RW, analytiques: RO, notifications: RO, apps: RO, recherche: RO },

  resp_production: { ...ap(DIR_MODS, FULL), ...ap(PROD_MODS, FULL), ...ap(MAINT_MODS, RO), tickets: RC, qualite: RO, inventaire: RO, analytiques: RO, audit: RO, validations: RW, notifications: RW, apps: RO, recherche: RO, parametres: RO },
  chef_ligne: { ...ap(PROD_MODS, RW), of: RW, dashboard: RO, machines: RO, equipements: RO, organes: RO, lignes: RO, tickets: RC, analytiques: RO, notifications: RO, apps: RO, recherche: RO },
  operateur: { gpao_dashboard: RO, of: RO, produits: RO, articles: RO, recettes: RO, shift_production: RW, arrets: RW, consommations: RW, dashboard: RO, machines: RO, lignes: RO, tickets: RC, notifications: RO, apps: RO, recherche: RO },

  directeur_qualite: { ...ap(DIR_MODS, FULL), ...ap(QUALITY_MODS, FULL), ...ap(PROD_MODS, RO), ...ap(MAINT_MODS, RO), qualite_parametres: RW, analytiques: RO, audit: RO, validations: RW, notifications: RW, apps: RO, recherche: RO, parametres: RO },
  responsable_controle_qualite: { ...ap(DIR_MODS, FULL), ...ap(QUALITY_MODS, FULL), of: RO, produits: RO, articles: RO, recettes: RO, dashboard: RO, machines: RO, lignes: RO, analytiques: RO, qualite_parametres: RW, notifications: RW, apps: RO, recherche: RO },
  controleur_qualite: { qualite: RW, qualite_dashboard: RO, qualite_of: RO, qualite_indicateurs: RO, qualite_plan_controle: RO, qualite_controles: RW, qualite_nc: RW, qualite_actions: RO, qualite_recettes: RO, qualite_tracabilite: RO, qualite_rapports: RO, qualite_shift: RW, of: RO, produits: RO, lignes: RO, machines: RO, notifications: RO, apps: RO, recherche: RO },
  agent_pont_bascule: { reception: RO, qualite: RO, qualite_dashboard: RO, notifications: RO, apps: RO, recherche: RO },
  agreeur: { reception: RW, qualite: RO, notifications: RO, apps: RO, recherche: RO },

  gestionnaire_magasin: { pdr: FULL, pdr_demandes: RW, shift_magasin: RW, journal_stock: RO, articles: RW, dashboard: RO, machines: RO, equipements: RO, organes: RO, inventaire: RW, inventaire_campagnes: RW, notifications: RO, apps: RO, recherche: RO },
  responsable_magasin: { ...ap(DIR_MODS, FULL), pdr: FULL, pdr_demandes: FULL, shift_magasin: FULL, journal_stock: FULL, articles: RW, dashboard: RO, machines: RO, equipements: RO, organes: RO, pdr_stock_config: FULL, journal: RO, historique: RO, analytiques: RO, documents: RO, audit: RO, inventaire: RW, inventaire_campagnes: RW, notifications: RW, apps: RO, recherche: RO },
  responsable_inventaire: { ...ap(DIR_MODS, FULL), inventaire: FULL, inventaire_campagnes: FULL, pdr: RW, articles: RO, dashboard: RO, machines: RO, organes: RO, analytiques: RO, notifications: RW, apps: RO, recherche: RO },
  agent_inventaire: { inventaire: RW, inventaire_campagnes: RW, pdr: RO, articles: RO, machines: RO, organes: RO, apps: RO, recherche: RO },
};

function presetToRows(role: string): PermRow[] {
  const cfg = ROLE_DEFAULTS[role] ?? {};
  return ALL_MODULES.map((m) => {
    const p = cfg[m.key] ?? NONE;
    return {
      role, module: m.key,
      can_view: p.view, can_create: p.create, can_edit: p.edit, can_delete: p.delete,
    };
  });
}

export default function RolesMatrix() {
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [perms, setPerms] = useState<PermRow[]>([]);
  const [original, setOriginal] = useState<PermRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("__all__");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("role_permissions")
      .select("*")
      .order("role")
      .order("module");
    if (data) {
      setPerms(data as PermRow[]);
      setOriginal(JSON.parse(JSON.stringify(data)));
    }
    setLoading(false);
  }

  const hasChanges = useMemo(() => JSON.stringify(perms) !== JSON.stringify(original), [perms, original]);

  const RECEPTION_SUB = ["reception_qualitative", "reception_quantitative", "reception_global", "reception_settings"] as const;

  const getPerm = useCallback((role: string, module: string): PermRow => {
    const direct = perms.find((p) => p.role === role && p.module === module) || {
      role, module, can_view: false, can_create: false, can_edit: false, can_delete: false,
    };
    // Umbrella `reception` reflects AND of its 4 sub-modules when any of them exists in perms.
    if (module === "reception") {
      const subs = RECEPTION_SUB
        .map((k) => perms.find((p) => p.role === role && p.module === k))
        .filter(Boolean) as PermRow[];
      if (subs.length > 0) {
        const allOf = (a: ActionKey) => RECEPTION_SUB.every((k) => {
          const row = perms.find((p) => p.role === role && p.module === k);
          return row ? row[a] : false;
        });
        return {
          ...direct,
          can_view: allOf("can_view"),
          can_create: allOf("can_create"),
          can_edit: allOf("can_edit"),
          can_delete: allOf("can_delete"),
        };
      }
    }
    return direct;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perms]);

  function toggleRole(roleKey: string) {
    setExpandedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(roleKey)) next.delete(roleKey); else next.add(roleKey);
      return next;
    });
  }

  function upsertRow(list: PermRow[], role: string, module: string, patch: Partial<PermRow>): PermRow[] {
    const idx = list.findIndex((p) => p.role === role && p.module === module);
    if (idx >= 0) {
      const updated = [...list];
      updated[idx] = { ...updated[idx], ...patch };
      return updated;
    }
    return [...list, { role, module, can_view: false, can_create: false, can_edit: false, can_delete: false, ...patch }];
  }

  function toggle(role: string, module: string, action: ActionKey) {
    setPerms((prev) => {
      // Reception umbrella toggle → propagate to all 4 sub-modules and mirror on umbrella row.
      if (module === "reception") {
        const current = getPerm(role, "reception")[action];
        const newVal = !current;
        let next = prev;
        for (const sub of RECEPTION_SUB) {
          const patch: Partial<PermRow> = { [action]: newVal };
          if (newVal && action !== "can_view") patch.can_view = true;
          next = upsertRow(next, role, sub, patch);
        }
        const umbrellaPatch: Partial<PermRow> = { [action]: newVal };
        if (newVal && action !== "can_view") umbrellaPatch.can_view = true;
        next = upsertRow(next, role, "reception", umbrellaPatch);
        return next;
      }

      const idx = prev.findIndex((p) => p.role === role && p.module === module);
      if (idx >= 0) {
        const updated = [...prev];
        const newVal = !updated[idx][action];
        updated[idx] = { ...updated[idx], [action]: newVal };
        if (newVal && action !== "can_view") updated[idx].can_view = true;
        return updated;
      }
      const fresh: PermRow = { role, module, can_view: false, can_create: false, can_edit: false, can_delete: false, [action]: true };
      if (action !== "can_view") fresh.can_view = true;
      return [...prev, fresh];
    });
  }

  function setRoleRows(role: string, mapper: (current: PermRow, m: typeof ALL_MODULES[number]) => PermRow) {
    setPerms((prev) => {
      const next = prev.filter((p) => p.role !== role);
      for (const m of ALL_MODULES) {
        const current = prev.find((p) => p.role === role && p.module === m.key) ||
          { role, module: m.key, can_view: false, can_create: false, can_edit: false, can_delete: false };
        next.push(mapper(current, m));
      }
      return next;
    });
  }

  function toggleAllForRole(role: string, action: ActionKey) {
    const allSet = ALL_MODULES.every((m) => getPerm(role, m.key)[action]);
    setRoleRows(role, (curr) => {
      const updated = { ...curr, [action]: !allSet };
      if (!allSet && action !== "can_view") updated.can_view = true;
      return updated;
    });
  }

  function toggleFullAccess(role: string) {
    const allSet = ALL_MODULES.every((m) => {
      const p = getPerm(role, m.key);
      return p.can_view && p.can_create && p.can_edit && p.can_delete;
    });
    const v = !allSet;
    setRoleRows(role, (curr) => ({ ...curr, can_view: v, can_create: v, can_edit: v, can_delete: v }));
  }

  function clearRole(role: string) {
    setRoleRows(role, (curr) => ({ ...curr, can_view: false, can_create: false, can_edit: false, can_delete: false }));
  }

  function applyPresetForRole(role: string) {
    const rows = presetToRows(role);
    setPerms((prev) => [...prev.filter((p) => p.role !== role), ...rows]);
    toast({ title: "Preset appliqué", description: `Configuration recommandée chargée pour ${ROLES.find(r => r.key === role)?.label}.` });
  }

  function copyFromRole(targetRole: string, sourceRole: string) {
    if (!sourceRole || sourceRole === targetRole) return;
    setRoleRows(targetRole, (_curr, m) => {
      const src = getPerm(sourceRole, m.key);
      return { role: targetRole, module: m.key, can_view: src.can_view, can_create: src.can_create, can_edit: src.can_edit, can_delete: src.can_delete };
    });
    toast({ title: "Copié", description: `Permissions de ${ROLES.find(r => r.key === sourceRole)?.label} copiées.` });
  }

  function applyAllPresets() {
    const all: PermRow[] = ROLES.flatMap((r) => presetToRows(r.key));
    setPerms(all);
    toast({ title: "Presets globaux", description: "Configuration recommandée appliquée pour tous les rôles. Pensez à sauvegarder." });
  }

  function getRoleStats(role: string) {
    let total = 0, active = 0;
    for (const m of ALL_MODULES) {
      const p = getPerm(role, m.key);
      total += 4;
      if (p.can_view) active++;
      if (p.can_create) active++;
      if (p.can_edit) active++;
      if (p.can_delete) active++;
    }
    return { total, active, pct: Math.round((active / total) * 100) };
  }

  function getRoleSummaryActions(role: string) {
    let v = 0, c = 0, e = 0, d = 0;
    for (const m of ALL_MODULES) {
      const p = getPerm(role, m.key);
      if (p.can_view) v++;
      if (p.can_create) c++;
      if (p.can_edit) e++;
      if (p.can_delete) d++;
    }
    return { view: v, create: c, edit: e, delete: d, totalModules: ALL_MODULES.length };
  }

  const incoherences = useMemo(() => {
    const issues: { role: string; module: string; reason: string }[] = [];
    for (const p of perms) {
      if (!p.can_view && (p.can_create || p.can_edit || p.can_delete)) {
        issues.push({ role: p.role, module: p.module, reason: "Action sans 'Voir'" });
      }
    }
    return issues;
  }, [perms]);

  async function handleSave() {
    setSaving(true);
    try {
      const rows = perms.map((p) => ({
        role: p.role,
        module: p.module,
        can_view: Boolean(p.can_view),
        can_create: Boolean(p.can_create),
        can_edit: Boolean(p.can_edit),
        can_delete: Boolean(p.can_delete),
      }));
      const { error } = await supabase
        .from("role_permissions")
        .upsert(rows as any, { onConflict: "role,module" });
      if (error) {
        toast({
          title: "Erreur de sauvegarde des accès",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "✅ Sauvegardé", description: "Matrice des permissions mise à jour." });
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm("Annuler toutes les modifications non sauvegardées ?")) return;
    setPerms(JSON.parse(JSON.stringify(original)));
    toast({ title: "Réinitialisé", description: "Modifications annulées." });
  }

  const { roles: customRoles } = useCustomRoles();
  const allRoles = useMemo(() => {
    const custom = customRoles.filter((r) => r.is_active).map((r) => ({
      key: r.code,
      label: r.label,
      color: "bg-primary/10 text-primary border-primary/30",
      group: "Personnalisés" as const,
    }));
    return [...ROLES, ...custom];
  }, [customRoles]);

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRoles.filter((r) => {
      if (groupFilter !== "__all__" && r.group !== groupFilter) return false;
      if (!q) return true;
      return r.label.toLowerCase().includes(q) || r.key.includes(q);
    });
  }, [search, groupFilter, allRoles]);

  function expandAll() { setExpandedRoles(new Set(filteredRoles.map((r) => r.key))); }
  function collapseAll() { setExpandedRoles(new Set()); }

  if (!hasRole("admin")) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Accès réservé aux administrateurs.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/parametres")}>Retour</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isEmpty = original.length === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/parametres")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Matrice des rôles &amp; modules
            </h1>
            <p className="text-sm text-muted-foreground">
              {ROLES.length} rôles × {ALL_MODULES.length} modules × 4 actions = {ROLES.length * ALL_MODULES.length * 4} droits configurables
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasChanges && (
            <Badge variant="outline" className="border-amber-400 text-amber-600 animate-pulse">
              Modifications non sauvegardées
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleReset} disabled={!hasChanges}>
            <RotateCcw className="h-4 w-4 mr-1" /> Annuler
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
            <Save className="h-4 w-4 mr-1" /> {saving ? "Enregistrement..." : "Sauvegarder"}
          </Button>
        </div>
      </div>

      {isEmpty && (
        <Card className="border-dashed border-2 border-primary/40 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Aucune permission configurée</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Initialisez la matrice avec les profils recommandés. Vous pourrez ensuite ajuster finement chaque rôle.
              </p>
            </div>
            <Button size="sm" onClick={applyAllPresets}>
              <Wand2 className="h-4 w-4 mr-1" /> Initialiser les presets
            </Button>
          </CardContent>
        </Card>
      )}

      {incoherences.length > 0 && (
        <Card className="border-amber-400/60 bg-amber-500/5">
          <CardContent className="p-3 flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs">
              <span className="font-semibold text-amber-700 dark:text-amber-300">{incoherences.length} incohérence(s) :</span>
              {" "}des actions Créer/Modifier/Supprimer sont actives sans le droit "Voir". Elles seront corrigées automatiquement à la prochaine modification.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search + filter + bulk actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un rôle..."
              className="pl-8 h-8 w-56 text-sm"
            />
          </div>
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="h-8 w-44 text-sm">
              <SelectValue placeholder="Toutes les familles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Toutes les familles</SelectItem>
              {ROLE_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Wand2 className="h-3.5 w-3.5 mr-1" /> Appliquer presets globaux
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Réinitialiser tous les rôles ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Toutes les permissions actuelles seront remplacées par la configuration recommandée pour chaque rôle.
                  La sauvegarde reste manuelle, vous pouvez encore annuler avant.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={applyAllPresets}>Appliquer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs mr-2">
            {ACTIONS.map((a) => (
              <span key={a.key} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${a.activeClass}`}>
                <a.icon className="h-3 w-3" /> {a.label}
              </span>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs h-7">Tout déplier</Button>
          <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs h-7">Tout replier</Button>
        </div>
      </div>

      {/* Roles list grouped by family */}
      <div className="space-y-4">
        {ROLE_GROUPS.map((group) => {
          const items = filteredRoles.filter((r) => r.group === group);
          if (!items.length) return null;
          return (
            <div key={group} className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 px-1">
                {group}
              </div>
              {items.map((role) => {
                const stats = getRoleStats(role.key);
                const summary = getRoleSummaryActions(role.key);
                const isExpanded = expandedRoles.has(role.key);

                return (
                  <Card key={role.key} className="overflow-hidden">
                    <button
                      onClick={() => toggleRole(role.key)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <Badge className={`${role.color} border-0 font-semibold text-xs`}>
                          {role.label}
                        </Badge>
                        <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{stats.active}/{stats.total} permissions</span>
                          <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-300"
                              style={{ width: `${stats.pct}%` }}
                            />
                          </div>
                          <span className="font-medium">{stats.pct}%</span>
                        </div>
                      </div>
                      {!isExpanded && (
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300">
                            <Eye className="h-2.5 w-2.5" /> {summary.view}/{summary.totalModules}
                          </span>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-500/10 text-green-700 dark:text-green-300">
                            <Plus className="h-2.5 w-2.5" /> {summary.create}/{summary.totalModules}
                          </span>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300">
                            <Pencil className="h-2.5 w-2.5" /> {summary.edit}/{summary.totalModules}
                          </span>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-500/10 text-red-700 dark:text-red-300">
                            <Trash2 className="h-2.5 w-2.5" /> {summary.delete}/{summary.totalModules}
                          </span>
                        </div>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t">
                        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-muted/20 border-b flex-wrap">
                          <div className="flex items-center gap-1 flex-wrap">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); applyPresetForRole(role.key); }}>
                              <Sparkles className="h-3.5 w-3.5 mr-1" /> Preset recommandé
                            </Button>
                            <Select onValueChange={(val) => copyFromRole(role.key, val)}>
                              <SelectTrigger className="h-7 text-xs w-44" onClick={(e) => e.stopPropagation()}>
                                <Copy className="h-3 w-3 mr-1" />
                                <SelectValue placeholder="Copier d'un rôle..." />
                              </SelectTrigger>
                              <SelectContent>
                                {allRoles.filter((r) => r.key !== role.key).map((r) => (
                                  <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); clearRole(role.key); }}>
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Tout effacer
                            </Button>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground mr-1 uppercase tracking-wider">Tout :</span>
                            {ACTIONS.map((a) => {
                              const allSet = ALL_MODULES.every((m) => getPerm(role.key, m.key)[a.key]);
                              return (
                                <Tooltip key={a.key}>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleAllForRole(role.key, a.key); }}
                                      className={`p-1 rounded transition-colors ${allSet ? a.activeClass : "text-muted-foreground hover:bg-muted"}`}
                                    >
                                      <a.icon className="h-3.5 w-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    {allSet ? "Retirer" : "Activer"} « {a.label} » sur tous
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleFullAccess(role.key); }}
                                  className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors ml-1"
                                >
                                  <CheckCheck className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">Tout activer / désactiver</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>

                        <CardContent className="p-0">
                          <ScrollArea className="w-full">
                            <div className="min-w-[700px]">
                              {MODULE_GROUPS.map((mg) => (
                                <div key={mg.label}>
                                  <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/15 border-b border-dashed">
                                    <mg.icon className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                      {mg.label}
                                    </span>
                                  </div>
                                  {mg.modules.map((m) => {
                                    const perm = getPerm(role.key, m.key);
                                    return (
                                      <div
                                        key={m.key}
                                        className="flex items-center justify-between px-4 py-2 border-b last:border-b-0 hover:bg-muted/20 transition-colors"
                                      >
                                        <span className="text-sm font-medium min-w-[160px]">{m.label}</span>
                                        <div className="flex items-center gap-1.5">
                                          {ACTIONS.map((a) => {
                                            const isActive = perm[a.key];
                                            return (
                                              <Tooltip key={a.key}>
                                                <TooltipTrigger asChild>
                                                  <button
                                                    onClick={() => toggle(role.key, m.key, a.key)}
                                                    className={`
                                                      inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                                                      border transition-all duration-150 select-none
                                                      ${isActive
                                                        ? a.activeClass
                                                        : "border-transparent bg-muted/40 text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground"
                                                      }
                                                    `}
                                                  >
                                                    <a.icon className="h-3 w-3" />
                                                    <span className="hidden sm:inline">{a.short}</span>
                                                  </button>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="text-xs">
                                                  {a.label} — {m.label}
                                                </TooltipContent>
                                              </Tooltip>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                            <ScrollBar orientation="horizontal" />
                          </ScrollArea>
                        </CardContent>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          );
        })}
        {filteredRoles.length === 0 && (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground"><FileSearch className="h-8 w-8 mx-auto mb-2 opacity-50" />Aucun rôle ne correspond à votre recherche.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
