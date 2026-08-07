import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Umbrella → children. A parent module grants its sub-modules unless
// a sub-module is explicitly configured in role_permissions.
export const UMBRELLAS: Record<string, string[]> = {
  qualite: [
    "qualite_dashboard", "qualite_of", "qualite_indicateurs",
    "qualite_controles", "qualite_nc", "qualite_actions",
    "qualite_recettes", "qualite_tracabilite", "qualite_rapports", "qualite_shift",
    "reception",
  ],
  reception: [
    "reception_qualitative", "reception_quantitative",
    "reception_global", "reception_settings",
  ],
  inventaire: ["inventaire_campagnes"],
};

interface Permission {
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export function usePermissions() {
  const { roles } = useAuth();
  const rolesKey = roles.slice().sort().join("|");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Reset immediately on role change to avoid leaking previous role's perms
    // (e.g., during impersonation switch).
    setPermissions([]);
    setLoading(true);

    if (roles.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      // Expand roles with inherits_from chain from custom_roles so a
      // custom role gets the exact same permissions as the base role
      // it inherits from (unless overridden in role_permissions).
      const effectiveRoles = new Set<string>(roles);
      try {
        const { data: cr } = await (supabase
          .from("custom_roles")
          .select("code, inherits_from, is_active") as any);
        const byCode = new Map<string, { inherits_from: string | null; is_active: boolean }>();
        (cr ?? []).forEach((r: any) => byCode.set(r.code, { inherits_from: r.inherits_from, is_active: r.is_active }));
        // Walk inheritance chain up to 10 levels to avoid cycles.
        for (const r of Array.from(effectiveRoles)) {
          let cur = byCode.get(r);
          let guard = 0;
          while (cur && cur.inherits_from && guard++ < 10) {
            if (effectiveRoles.has(cur.inherits_from)) break;
            effectiveRoles.add(cur.inherits_from);
            cur = byCode.get(cur.inherits_from);
          }
        }
      } catch {}

      const { data } = await (supabase
        .from("role_permissions")
        .select("module, can_view, can_create, can_edit, can_delete, role") as any)
        .in("role", Array.from(effectiveRoles) as any);


      if (cancelled) return;
      if (data) {
        // Merge permissions across roles (OR logic)
        const merged = new Map<string, Permission>();
        for (const row of (data as any[])) {
          const existing = merged.get(row.module);
          if (existing) {
            existing.can_view = existing.can_view || row.can_view;
            existing.can_create = existing.can_create || row.can_create;
            existing.can_edit = existing.can_edit || row.can_edit;
            existing.can_delete = existing.can_delete || row.can_delete;
          } else {
            merged.set(row.module, {
              module: row.module,
              can_view: row.can_view,
              can_create: row.can_create,
              can_edit: row.can_edit,
              can_delete: row.can_delete,
            });
          }
        }
        // Umbrella inheritance: a parent module grants its children unless
        // the child has been explicitly configured (present in merged).
        for (const [parent, children] of Object.entries(UMBRELLAS)) {
          const p = merged.get(parent);
          if (!p) continue;
          for (const child of children) {
            if (merged.has(child)) continue;
            merged.set(child, {
              module: child,
              can_view: p.can_view,
              can_create: p.can_create,
              can_edit: p.can_edit,
              can_delete: p.can_delete,
            });
          }
        }
        // Reception visibility rule: the "reception" umbrella must be visible
        // as soon as the user has ANY right (view/create/edit/delete) on ANY
        // reception sub-module. This unlocks the menu entry even when the
        // umbrella row itself has can_view = false in DB.
        const receptionChildren = UMBRELLAS.reception ?? [];
        const hasAnyReceptionRight = receptionChildren.some((child) => {
          const c = merged.get(child);
          return !!(c && (c.can_view || c.can_create || c.can_edit || c.can_delete));
        });
        if (hasAnyReceptionRight) {
          const existing = merged.get("reception");
          merged.set("reception", {
            module: "reception",
            can_view: true,
            can_create: existing?.can_create ?? false,
            can_edit: existing?.can_edit ?? false,
            can_delete: existing?.can_delete ?? false,
          });
        }
        if (cancelled) return;
        setPermissions(Array.from(merged.values()));
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [rolesKey]);

  const getPermission = (module: string) =>
    permissions.find((p) => p.module === module);

  const canView = (module: string) => getPermission(module)?.can_view ?? false;
  const canCreate = (module: string) => getPermission(module)?.can_create ?? false;
  const canEdit = (module: string) => getPermission(module)?.can_edit ?? false;
  const canDelete = (module: string) => getPermission(module)?.can_delete ?? false;

  return { permissions, loading, canView, canCreate, canEdit, canDelete };
}
