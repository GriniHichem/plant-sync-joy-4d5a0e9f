import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveMaintenanceShift } from "@/hooks/useActiveMaintenanceShift";

export interface MaintenanceWorkloadTicket {
  id: string;
  numero: string;
  statut: string;
  priorite: string;
  description: string;
  heure_declaration: string;
  assignee_id: string | null;
  machine_id: string;
  ligne_id: string | null;
  machines?: { id: string; code: string; designation: string } | null;
  production_lines?: { id: string; code: string; designation: string } | null;
  quality_risk?: boolean | null;
  quality_risk_level?: string | null;
}

export interface MaintenanceWorkloadPlan {
  id: string;
  title: string;
  description: string | null;
  frequence: string;
  prochaine_echeance: string | null;
  statut_plan: string;
  is_active: boolean;
  machine_id: string;
  line_id: string | null;
  machines?: { id: string; code: string; designation: string } | null;
  production_lines?: { id: string; code: string; designation: string } | null;
}

export interface MaintenanceWorkload {
  tickets: MaintenanceWorkloadTicket[];
  plans: MaintenanceWorkloadPlan[];
  loading: boolean;
  refresh: () => Promise<void>;
  /** True if the workload is restricted to the shift's lines */
  restrictedToShiftLines: boolean;
  shiftLineIds: string[];
  /** Plan ids ayant une exécution préventive en cours */
  inProgressPlanIds: string[];
}

/**
 * Calcule la charge dynamique du shift maintenance courant :
 *  - Tickets ouverts / pris en charge **assignés au user** ou **non assignés** sur ses lignes de shift.
 *  - Plans préventifs **assignés au user**, valides + actifs, filtrés sur ses lignes de shift si possible.
 * Si aucun shift n'est ouvert : renvoie quand même les éléments assignés au user (vue "à faire").
 */
export function useMaintenanceShiftWorkload(): MaintenanceWorkload {
  const { user } = useAuth();
  const { shift } = useActiveMaintenanceShift();
  const [tickets, setTickets] = useState<MaintenanceWorkloadTicket[]>([]);
  const [plans, setPlans] = useState<MaintenanceWorkloadPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [inProgressPlanIds, setInProgressPlanIds] = useState<string[]>([]);


  const shiftLineIds = useMemo(() => shift?.line_ids ?? [], [shift]);
  const restrictedToShiftLines = shiftLineIds.length > 0;

  const refresh = useCallback(async () => {
    if (!user) {
      setTickets([]); setPlans([]); setLoading(false);
      return;
    }
    setLoading(true);

    // ---- Plans préventifs assignés au user ----
    const { data: assigned } = await supabase
      .from("preventive_plan_assignees")
      .select("plan_id")
      .eq("user_id", user.id);
    const planIds = (assigned ?? []).map((a: any) => a.plan_id);

    let loadedPlans: any[] = [];
    if (planIds.length > 0) {
      let q = supabase
        .from("preventive_plans")
        .select("*, machines(id, code, designation), production_lines(id, code, designation)")
        .in("id", planIds)
        .eq("statut_plan", "valide")
        .eq("is_active", true);
      const { data } = await q;
      const all = (data ?? []) as any[];

      if (restrictedToShiftLines) {
        // L6: a plan matches if line_id ∈ shift OR machine is assigned to any shift line.
        // Plans with line_id=null inheriting via machine_line_assignments were previously excluded.
        const machineIds = Array.from(new Set(all.map((p) => p.machine_id).filter(Boolean)));
        let machinesOnShiftLines = new Set<string>();
        if (machineIds.length > 0) {
          const { data: ma } = await supabase
            .from("machine_line_assignments")
            .select("machine_id, line_id")
            .in("machine_id", machineIds)
            .in("line_id", shiftLineIds);
          machinesOnShiftLines = new Set((ma ?? []).map((r: any) => r.machine_id));
        }
        loadedPlans = all.filter((p) =>
          (p.line_id && shiftLineIds.includes(p.line_id)) ||
          (p.machine_id && machinesOnShiftLines.has(p.machine_id))
        );
      } else {
        loadedPlans = all;
      }
    }

    // ---- Tickets ouverts / en cours, mes assignés OU non assignés sur mes lignes ----
    let tq = supabase
      .from("tickets")
      .select("*, machines(id, code, designation), production_lines(id, code, designation)")
      .in("statut", ["ouvert", "pris_en_charge"]);

    if (restrictedToShiftLines) {
      // (mine) OR (unassigned AND on my lines)
      tq = tq.or(
        `assignee_id.eq.${user.id},and(assignee_id.is.null,ligne_id.in.(${shiftLineIds.join(",")}))`
      );
    } else {
      tq = tq.or(`assignee_id.eq.${user.id},assignee_id.is.null`);
    }
    const { data: loadedTickets } = await tq.order("heure_declaration", { ascending: false });

    // Plans avec une exécution en cours (intervention démarrée)
    const loadedPlanIds = (loadedPlans as any[]).map((p) => p.id);
    let openIds: string[] = [];
    if (loadedPlanIds.length > 0) {
      const { data: openExecs } = await supabase
        .from("preventive_executions")
        .select("plan_id")
        .eq("statut", "en_cours")
        .in("plan_id", loadedPlanIds);
      openIds = Array.from(new Set((openExecs ?? []).map((e: any) => e.plan_id)));
    }
    setInProgressPlanIds(openIds);

    setPlans(loadedPlans as any[]);
    setTickets((loadedTickets ?? []) as any[]);
    setLoading(false);
  }, [user, restrictedToShiftLines, shiftLineIds]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime — refresh on ticket/plan changes
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`maint-workload-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "preventive_plans" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "preventive_plan_assignees" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "preventive_executions" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refresh]);

  return { tickets, plans, loading, refresh, restrictedToShiftLines, shiftLineIds, inProgressPlanIds };
}
