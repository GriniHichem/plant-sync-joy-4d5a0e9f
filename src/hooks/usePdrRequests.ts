import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useShiftRealtime } from "@/hooks/useShiftRealtime";

export type PdrRequestType = "curative" | "preventive";
export type PdrRequestStatus = "demandee" | "prete" | "partielle" | "prise" | "refusee" | "annulee";
export type PdrRequestItemStatus = "demandee" | "prete" | "prise" | "refusee" | "annulee";

export interface PdrRequestItem {
  id: string;
  request_id: string;
  pdr_id: string;
  quantite_demandee: number;
  quantite_preparee: number | null;
  quantite_prise: number | null;
  statut: PdrRequestItemStatus;
  dispo_snapshot: boolean | null;
  position_id: string | null;
  cause_remplacement: string | null;
  commentaire: string | null;
  refused_reason: string | null;
  prepared_at: string | null;
  taken_at: string | null;
  pdr?: { id: string; reference: string; designation: string; stock_actuel: number; stock_reserve: number; unite_stock: string | null } | null;
}

export interface PdrRequest {
  id: string;
  numero: string;
  type: PdrRequestType;
  ticket_id: string | null;
  preventive_plan_id: string | null;
  intervention_id: string | null;
  machine_id: string | null;
  ligne_id: string | null;
  requested_by: string;
  priorite: string;
  statut: PdrRequestStatus;
  commentaire: string | null;
  created_at: string;
  items?: PdrRequestItem[];
  machines?: { id: string; code: string; designation: string } | null;
  tickets?: { id: string; numero: string } | null;
}

const SELECT =
  "*, machines(id, code, designation), tickets(id, numero), items:pdr_request_items(*, pdr(id, reference, designation, stock_actuel, stock_reserve, unite_stock))";

const OPEN_STATUSES: PdrRequestStatus[] = ["demandee", "prete", "partielle"];

/** Magasin queue: all requests with at least one open line. */
export function usePdrRequestQueue(includeClosed = false) {
  const [requests, setRequests] = useState<PdrRequest[]>([]);
  const [loading, setLoading] = useState(true);
  // Unique channel suffix per hook instance so multiple queues (open/closed,
  // several pages) don't collide on the same realtime channel name.
  const [uid] = useState(() => Math.random().toString(36).slice(2, 9));

  const reload = useCallback(async () => {
    let q = supabase.from("pdr_requests" as any).select(SELECT).order("created_at", { ascending: false });
    if (!includeClosed) q = q.in("statut", OPEN_STATUSES as any);
    const { data } = await q;
    setRequests((data as any) || []);
    setLoading(false);
  }, [includeClosed]);

  useEffect(() => { reload(); }, [reload]);
  useShiftRealtime(`pdr-queue-requests-${uid}`, "pdr_requests", reload, true);
  useShiftRealtime(`pdr-queue-items-${uid}`, "pdr_request_items", reload, true);


  return { requests, loading, reload };
}

/** Maintenance: my requests (created by me). */
export function useMyPdrRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PdrRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) { setRequests([]); setLoading(false); return; }
    const { data } = await supabase
      .from("pdr_requests" as any)
      .select(SELECT)
      .eq("requested_by", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setRequests((data as any) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { reload(); }, [reload]);
  useShiftRealtime(`pdr-mine-${user?.id ?? "anon"}`, "pdr_request_items", reload, !!user);

  return { requests, loading, reload };
}

// ---- Actions (RPC wrappers) ----

export async function createPdrRequest(input: {
  type: PdrRequestType;
  ticket_id?: string | null;
  preventive_plan_id?: string | null;
  intervention_id?: string | null;
  machine_id?: string | null;
  ligne_id?: string | null;
  priorite?: string;
  commentaire?: string | null;
  items: { pdr_id: string; quantite_demandee: number; dispo_snapshot?: boolean; commentaire?: string | null; cause_remplacement?: string | null; position_id?: string | null }[];
}) {
  const { data: req, error } = await supabase
    .from("pdr_requests" as any)
    .insert({
      type: input.type,
      ticket_id: input.ticket_id ?? null,
      preventive_plan_id: input.preventive_plan_id ?? null,
      intervention_id: input.intervention_id ?? null,
      machine_id: input.machine_id ?? null,
      ligne_id: input.ligne_id ?? null,
      priorite: input.priorite ?? "normale",
      commentaire: input.commentaire ?? null,
    } as any)
    .select("id")
    .single();
  if (error) throw error;
  const requestId = (req as any).id;
  const { error: itemsErr } = await supabase.from("pdr_request_items" as any).insert(
    input.items.map((it) => ({
      request_id: requestId,
      pdr_id: it.pdr_id,
      quantite_demandee: it.quantite_demandee,
      dispo_snapshot: it.dispo_snapshot ?? null,
      commentaire: it.commentaire ?? null,
      cause_remplacement: it.cause_remplacement ?? null,
      position_id: it.position_id ?? null,
    })) as any,
  );
  if (itemsErr) throw itemsErr;
  return requestId as string;
}

export async function setItemReady(itemId: string, qte?: number, comment?: string) {
  const { error } = await supabase.rpc("set_request_item_ready", {
    p_item_id: itemId, p_qte: qte ?? null, p_comment: comment ?? null,
  } as any);
  if (error) throw error;
}

export async function refuseItem(itemId: string, motif: string) {
  const { error } = await supabase.rpc("refuse_request_item", { p_item_id: itemId, p_motif: motif } as any);
  if (error) throw error;
}

export async function confirmItemTaken(itemId: string, qte?: number) {
  const { error } = await supabase.rpc("confirm_request_item_taken", {
    p_item_id: itemId, p_qte: qte ?? null,
  } as any);
  if (error) throw error;
}

export async function cancelPdrRequest(requestId: string, motif?: string) {
  const { error } = await supabase.rpc("cancel_pdr_request", {
    p_request_id: requestId, p_motif: motif ?? null,
  } as any);
  if (error) throw error;
}

export async function consumeMaintenanceHolding(input: {
  holding_id: string; intervention_id: string; qte_consomme: number;
  position_id?: string | null; cause?: string | null; commentaire?: string | null;
}) {
  const { error } = await supabase.rpc("consume_maintenance_holding", {
    p_holding_id: input.holding_id,
    p_intervention_id: input.intervention_id,
    p_qte_consomme: input.qte_consomme,
    p_position_id: input.position_id ?? null,
    p_cause: input.cause ?? null,
    p_commentaire: input.commentaire ?? null,
  } as any);
  if (error) throw error;
}

/**
 * Consume a held piece onto a PREVENTIVE plan execution (leftover returned to magasin,
 * exactly like the curative consumeMaintenanceHolding).
 */
export async function consumePreventiveHolding(input: {
  holding_id: string; execution_id: string; qte_consomme: number;
  position_id?: string | null; cause?: string | null; commentaire?: string | null;
}) {
  const { error } = await supabase.rpc("consume_maintenance_holding_preventive", {
    p_holding_id: input.holding_id,
    p_execution_id: input.execution_id,
    p_qte_consomme: input.qte_consomme,
    p_position_id: input.position_id ?? null,
    p_cause: input.cause ?? null,
    p_commentaire: input.commentaire ?? null,
  } as any);
  if (error) throw error;
}

/**
 * Consume a partial quantity from the maintainer's mini-stock (holding) onto an intervention.
 * Unlike consumeMaintenanceHolding, the leftover STAYS in the mini-stock (decremented),
 * available for other tickets — nothing is returned to the warehouse here.
 */
export async function consumeFromMinistock(input: {
  holding_id: string; intervention_id: string; qte_consomme: number;
  position_id?: string | null; cause?: string | null; commentaire?: string | null;
}) {
  const { error } = await supabase.rpc("consume_from_ministock", {
    p_holding_id: input.holding_id,
    p_intervention_id: input.intervention_id,
    p_qte_consomme: input.qte_consomme,
    p_position_id: input.position_id ?? null,
    p_cause: input.cause ?? null,
    p_commentaire: input.commentaire ?? null,
  } as any);
  if (error) throw error;
}


