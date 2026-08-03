import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { LotEvent, LotInvestigation } from "@/lib/lotInvestigation";
import { computeWindow } from "@/lib/lotInvestigation";

const MANAGER_ROLES = ["admin", "directeur_qualite", "responsable_controle_qualite"];

/** Droits du module Enquête de lot (miroir des politiques d'accès en base). */
export function useLotInvestigationPermissions() {
  const { roles } = useAuth();
  const canManage = roles.some((r) => MANAGER_ROLES.includes(r as string));
  return { canManage, canDelete: roles.includes("admin" as never) };
}

export interface InvestigationLog {
  id: string;
  investigation_id: string;
  action: string;
  details: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
}

export function useLotInvestigations() {
  const [rows, setRows] = useState<LotInvestigation[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("quality_lot_investigations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setRows((data ?? []) as LotInvestigation[]);
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  return { rows, loading, reload };
}

export function useLotInvestigation(id?: string) {
  const [inv, setInv] = useState<LotInvestigation | null>(null);
  const [logs, setLogs] = useState<InvestigationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!id) return;
    const [a, b] = await Promise.all([
      (supabase as any).from("quality_lot_investigations").select("*").eq("id", id).maybeSingle(),
      (supabase as any)
        .from("quality_lot_investigation_logs")
        .select("*")
        .eq("investigation_id", id)
        .order("created_at", { ascending: false }),
    ]);
    setInv((a.data ?? null) as LotInvestigation | null);
    setLogs((b.data ?? []) as InvestigationLog[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { void reload(); }, [reload]);

  return { inv, logs, loading, reload };
}

/** Journalisation d'une action sur une enquête (traçabilité). */
export async function logInvestigation(
  investigationId: string,
  action: string,
  details?: Record<string, unknown>,
) {
  const { data } = await supabase.auth.getUser();
  await (supabase as any).from("quality_lot_investigation_logs").insert({
    investigation_id: investigationId,
    action,
    details: details ?? null,
    user_id: data.user?.id ?? null,
  });
}

/** Événements collectés (lecture seule) autour de l'heure de production. */
export function useLotEvents(params?: {
  date: string;
  time: string;
  windowHours: number;
}) {
  const [events, setEvents] = useState<LotEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const win = useMemo(
    () => (params ? computeWindow(params.date, params.time, params.windowHours) : null),
    [params?.date, params?.time, params?.windowHours],
  );

  useEffect(() => {
    if (!win) { setEvents([]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await (supabase as any).rpc("lot_investigation_events", {
        p_from: win.from.toISOString(),
        p_to: win.to.toISOString(),
      });
      if (!cancelled) {
        setEvents((data ?? []) as LotEvent[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [win?.from.getTime(), win?.to.getTime()]);

  return { events, loading, window: win };
}
