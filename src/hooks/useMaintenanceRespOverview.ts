import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShiftRealtime } from "@/hooks/useShiftRealtime";

export interface RespTicket {
  id: string;
  numero: string;
  statut: string;
  priorite: string;
  description: string | null;
  heure_declaration: string;
  heure_prise_en_charge: string | null;
  declarant_id: string | null;
  assignee_id: string | null;
  assignment_status: string | null;
  machine?: { id: string; code: string; designation: string } | null;
  ligne?: { id: string; code: string; designation: string } | null;
  declarant_name?: string | null;
  assignee_name?: string | null;
  waiting_parts?: boolean;
}

export interface RespPreventive {
  id: string;
  plan_id: string;
  executed_by: string | null;
  heure_debut: string | null;
  session_id: string | null;
  plan_numero?: string | null;
  plan_title?: string | null;
  prochaine_echeance?: string | null;
  machine?: { id: string; code: string; designation: string } | null;
  executor_name?: string | null;
}

export interface RespMovement {
  id: string;
  type: string;
  quantite: number;
  motif: string | null;
  source_type: string | null;
  source_id: string | null;
  created_at: string;
  user_id: string | null;
  pdr?: { reference: string; designation: string; unite_stock: string | null } | null;
  agent_name?: string | null;
  ref_label?: string | null;
}

export interface ActiveTech {
  user_id: string;
  name: string;
  curative: number;
  preventive: number;
  since: string;
}

export interface MaintenanceRespOverview {
  tickets: RespTicket[];
  preventives: RespPreventive[];
  movements: RespMovement[];
  activeTechs: ActiveTech[];
  loading: boolean;
  reload: () => Promise<void>;
  kpis: {
    openTickets: number;
    urgentTickets: number;
    todayTickets: number;
    preventiveInProgress: number;
    activeTechCount: number;
    movementsToday: number;
  };
}

export function useMaintenanceRespOverview(): MaintenanceRespOverview {
  const [tickets, setTickets] = useState<RespTicket[]>([]);
  const [preventives, setPreventives] = useState<RespPreventive[]>([]);
  const [movements, setMovements] = useState<RespMovement[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const todayIso = new Date();
    todayIso.setHours(0, 0, 0, 0);

    // Initial parallel fetch for core data
    const [ticketsRes, execRes, openReqRes] = await Promise.all([
      supabase
        .from("tickets")
        .select("id, numero, statut, priorite, description, heure_declaration, heure_prise_en_charge, declarant_id, assignee_id, machines(id, code, designation), production_lines(id, code, designation)")
        .in("statut", ["ouvert", "pris_en_charge"])
        .order("heure_declaration", { ascending: false }),
      supabase
        .from("preventive_executions")
        .select("id, plan_id, executed_by, heure_debut, session_id, preventive_plans(numero, title, prochaine_echeance, machines(id, code, designation))")
        .eq("statut", "en_cours"),
      supabase
        .from("pdr_requests")
        .select("ticket_id")
        .in("statut", ["demandee", "prete", "partielle"]),
    ]);

    const ticketRows = (ticketsRes.data as any[]) ?? [];
    const execRows = (execRes.data as any[]) ?? [];
    const waitingTicketIds = new Set(
      ((openReqRes.data as any[]) ?? []).map((r) => r.ticket_id).filter(Boolean)
    );

    // Movements are usually the heaviest, load them separately or limit strictly
    const movesRes = await supabase
      .from("pdr_stock_movements")
      .select("id, type, quantite, motif, source_type, source_id, created_at, user_id, pdr(reference, designation, unite_stock)")
      .gte("created_at", todayIso.toISOString())
      .order("created_at", { ascending: false })
      .limit(20); // Reduced limit for dashboard overview

    const moveRows = (movesRes.data as any[]) ?? [];


    // collect user ids
    const userIds = new Set<string>();
    ticketRows.forEach((t) => { if (t.declarant_id) userIds.add(t.declarant_id); if (t.assignee_id) userIds.add(t.assignee_id); });
    execRows.forEach((e) => { if (e.executed_by) userIds.add(e.executed_by); });
    moveRows.forEach((m) => { if (m.user_id) userIds.add(m.user_id); });

    const ticketIds = [...new Set(moveRows.filter((m) => m.source_type === "ticket").map((m) => m.source_id).filter(Boolean))];

    const [profsRes, moveTicketsRes] = await Promise.all([
      userIds.size
        ? supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", [...userIds])
        : Promise.resolve({ data: [] as any[] }),
      ticketIds.length
        ? supabase.from("tickets").select("id, numero").in("id", ticketIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const nameById = new Map<string, string>();
    for (const p of (profsRes.data as any[]) ?? []) {
      nameById.set(p.user_id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—");
    }
    const ticketNumById = new Map<string, string>();
    for (const t of (moveTicketsRes.data as any[]) ?? []) ticketNumById.set(t.id, t.numero);

    setTickets(
      ticketRows.map((t) => ({
        id: t.id,
        numero: t.numero,
        statut: t.statut,
        priorite: t.priorite,
        description: t.description,
        heure_declaration: t.heure_declaration,
        heure_prise_en_charge: t.heure_prise_en_charge,
        declarant_id: t.declarant_id,
        assignee_id: t.assignee_id,
        assignment_status: t.assignment_status,
        machine: t.machines ?? null,
        ligne: t.production_lines ?? null,
        declarant_name: t.declarant_id ? nameById.get(t.declarant_id) ?? null : null,
        assignee_name: t.assignee_id ? nameById.get(t.assignee_id) ?? null : null,
        waiting_parts: waitingTicketIds.has(t.id),
      }))
    );

    setPreventives(
      execRows.map((e) => ({
        id: e.id,
        plan_id: e.plan_id,
        executed_by: e.executed_by,
        heure_debut: e.heure_debut,
        session_id: e.session_id,
        plan_numero: e.preventive_plans?.numero ?? null,
        plan_title: e.preventive_plans?.title ?? null,
        prochaine_echeance: e.preventive_plans?.prochaine_echeance ?? null,
        machine: e.preventive_plans?.machines ?? null,
        executor_name: e.executed_by ? nameById.get(e.executed_by) ?? null : null,
      }))
    );

    setMovements(
      moveRows.map((m) => ({
        id: m.id,
        type: m.type,
        quantite: m.quantite,
        motif: m.motif,
        source_type: m.source_type,
        source_id: m.source_id,
        created_at: m.created_at,
        user_id: m.user_id,
        pdr: m.pdr ?? null,
        agent_name: m.user_id ? nameById.get(m.user_id) ?? null : null,
        ref_label: m.source_type === "ticket" && m.source_id ? ticketNumById.get(m.source_id) ?? null : null,
      }))
    );

    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useShiftRealtime("resp-overview-tickets", "tickets", reload, true);
  useShiftRealtime("resp-overview-exec", "preventive_executions", reload, true);
  useShiftRealtime("resp-overview-sessions", "preventive_action_sessions", reload, true);
  useShiftRealtime("resp-overview-moves", "pdr_stock_movements", reload, true);
  useShiftRealtime("resp-overview-reqs", "pdr_requests", reload, true);

  const activeTechs = useMemo<ActiveTech[]>(() => {
    const map = new Map<string, ActiveTech>();
    for (const t of tickets) {
      if (t.statut === "pris_en_charge" && t.assignee_id) {
        const name = t.assignee_name ?? "—";
        const ex = map.get(t.assignee_id) ?? { user_id: t.assignee_id, name, curative: 0, preventive: 0, since: t.heure_prise_en_charge ?? t.heure_declaration };
        ex.curative += 1;
        if (t.heure_prise_en_charge && (!ex.since || t.heure_prise_en_charge < ex.since)) ex.since = t.heure_prise_en_charge;
        map.set(t.assignee_id, ex);
      }
    }
    for (const p of preventives) {
      if (p.executed_by) {
        const name = p.executor_name ?? "—";
        const ex = map.get(p.executed_by) ?? { user_id: p.executed_by, name, curative: 0, preventive: 0, since: p.heure_debut ?? new Date().toISOString() };
        ex.preventive += 1;
        if (p.heure_debut && (!ex.since || p.heure_debut < ex.since)) ex.since = p.heure_debut;
        map.set(p.executed_by, ex);
      }
    }
    return [...map.values()].sort((a, b) => (a.since < b.since ? -1 : 1));
  }, [tickets, preventives]);

  const kpis = useMemo(() => {
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    return {
      openTickets: tickets.length,
      urgentTickets: tickets.filter((t) => t.priorite === "critique" || t.priorite === "haute").length,
      todayTickets: tickets.filter((t) => new Date(t.heure_declaration) >= startToday).length,
      preventiveInProgress: preventives.length,
      activeTechCount: activeTechs.length,
      movementsToday: movements.length,
    };
  }, [tickets, preventives, movements, activeTechs]);

  return { tickets, preventives, movements, activeTechs, loading, reload, kpis };
}
