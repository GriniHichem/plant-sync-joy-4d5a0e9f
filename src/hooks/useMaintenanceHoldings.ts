import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useShiftRealtime } from "@/hooks/useShiftRealtime";

export type HoldingStatus = "en_main" | "consomme" | "retourne";

export interface MaintenanceHolding {
  id: string;
  pdr_id: string;
  request_item_id: string | null;
  holder_id: string;
  quantite: number;
  statut: HoldingStatus;
  intervention_id: string | null;
  created_at: string;
  pdr?: { id: string; reference: string; designation: string; unite_stock: string | null } | null;
}

/** Pieces currently held by the connected maintainer (intermediate maintenance stock). */
export function useMaintenanceHoldings(onlyHeld = true) {
  const { user } = useAuth();
  const [holdings, setHoldings] = useState<MaintenanceHolding[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) { setHoldings([]); setLoading(false); return; }
    let q = supabase
      .from("pdr_maintenance_holdings" as any)
      .select("*, pdr(id, reference, designation, unite_stock)")
      .eq("holder_id", user.id)
      .order("created_at", { ascending: false });
    if (onlyHeld) q = q.eq("statut", "en_main");
    const { data } = await q;
    setHoldings((data as any) || []);
    setLoading(false);
  }, [user, onlyHeld]);

  useEffect(() => { reload(); }, [reload]);
  useShiftRealtime(`maint-holdings-${user?.id ?? "anon"}`, "pdr_maintenance_holdings", reload, !!user);

  return { holdings, loading, reload };
}
