// Landing pages catalog + resolver.
// Determines the default page a user lands on after login, based on:
//  1) An admin override per role (app_settings key `landing.defaults_by_role`)
//  2) Otherwise: the accessible module with the most rights (view+create+edit+delete)
//  3) Fallback: "/apps" (module launcher — always safe)

export interface LandingModule {
  /** role_permissions.module code */
  module: string;
  /** URL to navigate to */
  path: string;
  /** Human label shown in admin picker */
  label: string;
  /** Higher = preferred as a landing page when scores tie */
  weight?: number;
}

/**
 * Whitelist of modules that can serve as a landing page.
 * Kept intentionally small — dashboards and main list pages only,
 * so we never drop a user on a deep detail screen.
 */
export const LANDING_MODULES: LandingModule[] = [
  { module: "dashboard",        path: "/",                   label: "Dashboard GMAO",         weight: 3 },
  { module: "gpao_dashboard",   path: "/gpao",               label: "Dashboard GPAO",         weight: 3 },
  { module: "qualite_dashboard",path: "/qualite",            label: "Dashboard Qualité",      weight: 3 },
  { module: "shift_magasin",    path: "/magasin/shift",      label: "Dashboard PDR",          weight: 3 },
  { module: "inventaire",       path: "/inventaire",         label: "Dashboard Inventaire",   weight: 3 },
  { module: "reception",        path: "/qualite/reception",  label: "Réception F&L",          weight: 2 },
  { module: "tickets",          path: "/tickets",            label: "Tickets maintenance",    weight: 1 },
  { module: "machines",         path: "/machines",           label: "Machines",               weight: 1 },
  { module: "pdr",              path: "/pdr",                label: "Pièces (PDR)",           weight: 1 },
  { module: "of",               path: "/gpao/of",            label: "Ordres de fabrication",  weight: 1 },
  { module: "qualite_shift",    path: "/qualite/shift",      label: "Shift Qualité",          weight: 1 },
  { module: "shift_maintenance",path: "/maintenance/shift",  label: "Shift Maintenance",      weight: 1 },
  { module: "shift_production", path: "/gpao/shift",         label: "Shift Production",       weight: 1 },
  { module: "validations",      path: "/validations",        label: "Validations",            weight: 1 },
  { module: "parametres",       path: "/parametres",         label: "Paramètres",             weight: 0 },
];

export const FALLBACK_LANDING_PATH = "/apps";

export interface PermChecker {
  canView: (m: string) => boolean;
  canCreate: (m: string) => boolean;
  canEdit: (m: string) => boolean;
  canDelete: (m: string) => boolean;
}

/** Score a module by summing granted rights (view=1, others=1). */
function scoreModule(mod: string, perms: PermChecker): number {
  let s = 0;
  if (perms.canView(mod)) s += 1;
  if (perms.canCreate(mod)) s += 1;
  if (perms.canEdit(mod)) s += 1;
  if (perms.canDelete(mod)) s += 1;
  return s;
}

/** Landing modules the user has at least "view" access to. */
export function accessibleLandingModules(perms: PermChecker): LandingModule[] {
  return LANDING_MODULES.filter((m) => perms.canView(m.module));
}

/**
 * Resolve the landing path.
 * @param roles       User's role codes (used to look up overrides)
 * @param overrides   Map roleCode -> path (from app_settings)
 * @param perms       Permission checkers
 * @param isAdmin     Admin bypass — admins land on "/" (full dashboard) unless overridden
 */
export function resolveLandingPath(
  roles: string[],
  overrides: Record<string, string> | null | undefined,
  perms: PermChecker,
  isAdmin: boolean,
): string {
  // 1) Admin override per assigned role — take the first match.
  if (overrides) {
    for (const r of roles) {
      const p = overrides[r];
      if (p && typeof p === "string") return p;
    }
  }

  // 2) Admin bypass — the full GMAO dashboard.
  if (isAdmin && perms.canView("dashboard")) return "/";

  // 3) Auto: the accessible module with the highest score.
  const accessible = accessibleLandingModules(perms);
  if (accessible.length === 0) return FALLBACK_LANDING_PATH;
  let best = accessible[0];
  let bestScore = scoreModule(best.module, perms) * 10 + (best.weight ?? 0);
  for (const m of accessible.slice(1)) {
    const s = scoreModule(m.module, perms) * 10 + (m.weight ?? 0);
    if (s > bestScore) { best = m; bestScore = s; }
  }
  return best.path;
}
