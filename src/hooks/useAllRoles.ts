import { useMemo } from "react";
import { ROLES as SYSTEM_ROLES } from "@/lib/ruleCatalog";
import { useCustomRoles } from "@/hooks/useCustomRoles";

export interface RoleEntry {
  code: string;
  label: string;
  isCustom: boolean;
  color?: string;
}

const SYSTEM_LABELS: Record<string, string> = {
  admin: "Administrateur",
  responsable_si: "Responsable SI",
  resp_maintenance: "Resp. Maintenance",
  maintenancier: "Maintenancier",
  resp_production: "Resp. Production",
  chef_ligne: "Chef de ligne",
  operateur: "Opérateur",
  gestionnaire_magasin: "Gest. Magasin",
  responsable_magasin: "Resp. Magasin",
  bureau_methode: "Bureau Méthode",
  auditeur: "Auditeur",
  controleur_qualite: "Contrôleur Qualité",
  responsable_controle_qualite: "Resp. Contrôle Qualité",
  directeur_qualite: "Directeur Qualité",
  agreeur: "Agréeur",
  agent_pont_bascule: "Agent Pont Bascule",
  responsable_inventaire: "Resp. Inventaire",
  agent_inventaire: "Agent Inventaire",
};

/** Merged list of system roles + active custom roles. */
export function useAllRoles() {
  const { roles: custom, loading } = useCustomRoles();
  const all = useMemo<RoleEntry[]>(() => {
    const sys: RoleEntry[] = SYSTEM_ROLES.map((r) => ({
      code: r,
      label: SYSTEM_LABELS[r] ?? r.replace(/_/g, " "),
      isCustom: false,
    }));
    const cus: RoleEntry[] = custom
      .filter((r) => r.is_active)
      .map((r) => ({ code: r.code, label: r.label, isCustom: true, color: r.color }));
    return [...sys, ...cus];
  }, [custom]);
  return { roles: all, loading };
}
