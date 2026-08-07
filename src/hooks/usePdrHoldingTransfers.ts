import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useShiftRealtime } from "@/hooks/useShiftRealtime";

export type TransferStatus = "en_attente" | "confirme" | "refuse" | "annule";
export type TransferDestination = "maintainer" | "magasin";

export interface HoldingTransfer {
  id: string;
  pdr_id: string;
  quantite: number;
  from_holder: string;
  destination: TransferDestination;
  to_holder: string | null;
  statut: TransferStatus;
  motif: string | null;
  request_item_id: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  pdr?: { id: string; reference: string; designation: string; unite_stock: string | null } | null;
  from_name?: string;
  to_name?: string;
}

export interface SimpleUser {
  user_id: string;
  full_name: string;
}

async function attachNames(rows: HoldingTransfer[]): Promise<HoldingTransfer[]> {
  const ids = Array.from(
    new Set(rows.flatMap((r) => [r.from_holder, r.to_holder]).filter(Boolean) as string[]),
  );
  if (ids.length === 0) return rows;
  const { data: profs } = await supabase
    .from("profiles")
    .select("user_id, first_name, last_name")
    .in("user_id", ids);
  const map = new Map<string, string>();
  for (const p of profs || []) {
    map.set(p.user_id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Utilisateur");
  }
  return rows.map((r) => ({
    ...r,
    from_name: map.get(r.from_holder) ?? "Utilisateur",
    to_name: r.to_holder ? map.get(r.to_holder) ?? "Utilisateur" : undefined,
  }));
}

/** Transfers concerning the connected maintainer: incoming (to confirm) + my outgoing pending. */
export function useMyHoldingTransfers() {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<HoldingTransfer[]>([]);
  const [outgoing, setOutgoing] = useState<HoldingTransfer[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) { setIncoming([]); setOutgoing([]); setLoading(false); return; }
    const { data } = await supabase
      .from("pdr_holding_transfers" as any)
      .select("*, pdr(id, reference, designation, unite_stock)")
      .or(`from_holder.eq.${user.id},to_holder.eq.${user.id}`)
      .order("created_at", { ascending: false });
    const rows = await attachNames((data as any) || []);
    setIncoming(rows.filter((r) => r.to_holder === user.id && r.statut === "en_attente"));
    setOutgoing(rows.filter((r) => r.from_holder === user.id && r.statut === "en_attente"));
    setLoading(false);
  }, [user]);

  useEffect(() => { reload(); }, [reload]);
  useShiftRealtime(`holding-transfers-${user?.id ?? "anon"}`, "pdr_holding_transfers", reload, !!user);

  return { incoming, outgoing, loading, reload };
}

/** Pending returns to the warehouse (magasin side). */
export function useMagasinReturns() {
  const [returns, setReturns] = useState<HoldingTransfer[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from("pdr_holding_transfers" as any)
      .select("*, pdr(id, reference, designation, unite_stock)")
      .eq("destination", "magasin")
      .eq("statut", "en_attente")
      .order("created_at", { ascending: false });
    const rows = await attachNames((data as any) || []);
    setReturns(rows);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useShiftRealtime("magasin-returns", "pdr_holding_transfers", reload, true);

  return { returns, loading, reload };
}

/** Maintainers/responsables that can receive a transfer (excluding self). */
export function useTransferRecipients() {
  const { user } = useAuth();
  const [recipients, setRecipients] = useState<SimpleUser[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["maintenancier", "resp_maintenance"] as any);
      const ids = Array.from(new Set((roles || []).map((r: any) => r.user_id))).filter(
        (uid) => uid !== user?.id,
      );
      if (ids.length === 0) { if (active) setRecipients([]); return; }
      const { data: profs } = await supabase
        .from("profiles").select("user_id, first_name, last_name").in("user_id", ids);
      if (!active) return;
      setRecipients(
        (profs || [])
          .map((p: any) => ({
            user_id: p.user_id,
            full_name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Utilisateur",
          }))
          .sort((a, b) => a.full_name.localeCompare(b.full_name)),
      );
    })();
    return () => { active = false; };
  }, [user?.id]);

  return recipients;
}

export async function initiateHoldingTransfer(input: {
  holdingId: string;
  qte: number;
  destination: TransferDestination;
  toHolder?: string | null;
  motif?: string | null;
}) {
  const { error } = await supabase.rpc("initiate_holding_transfer" as any, {
    p_holding_id: input.holdingId,
    p_qte: input.qte,
    p_destination: input.destination,
    p_to_holder: input.toHolder ?? null,
    p_motif: input.motif ?? null,
  });
  if (error) throw error;
}

export async function confirmHoldingTransfer(transferId: string) {
  const { error } = await supabase.rpc("confirm_holding_transfer" as any, {
    p_transfer_id: transferId,
  });
  if (error) throw error;
}

export async function cancelHoldingTransfer(transferId: string, raison?: string) {
  const { error } = await supabase.rpc("cancel_holding_transfer" as any, {
    p_transfer_id: transferId,
    p_raison: raison ?? null,
  });
  if (error) throw error;
}
