import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ActiveShiftContextData {
  teamId: string | null;
  teamName: string | null;
  templateId: string | null;
  templateCode: string | null;
  heureDebut: string | null;
  heureFin: string | null;
  isOnShift: boolean;
  autorisationLibre: boolean;
}

const EMPTY: ActiveShiftContextData = {
  teamId: null,
  teamName: null,
  templateId: null,
  templateCode: null,
  heureDebut: null,
  heureFin: null,
  isOnShift: false,
  autorisationLibre: false,
};

/**
 * Reads the user's currently active team + shift template (and on-shift state)
 * from the backend RPC get_active_shift_context. Refreshes periodically so the
 * context switches slots automatically over time.
 */
export function useActiveShiftContext(refreshIntervalMs = 5 * 60 * 1000) {
  const { user } = useAuth();
  const [data, setData] = useState<ActiveShiftContextData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    const { data: rows, error } = await supabase.rpc("get_active_shift_context", {
      _user_id: user.id,
    });
    if (error || !rows || (rows as any[]).length === 0) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    const r = (rows as any[])[0];
    setData({
      teamId: r.team_id ?? null,
      teamName: r.team_name ?? null,
      templateId: r.template_id ?? null,
      templateCode: r.template_code ?? null,
      heureDebut: r.heure_debut ?? null,
      heureFin: r.heure_fin ?? null,
      isOnShift: !!r.is_on_shift,
      autorisationLibre: !!r.autorisation_libre,
    });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
    if (refreshIntervalMs <= 0) return;
    const id = setInterval(refresh, refreshIntervalMs);
    return () => clearInterval(id);
  }, [refresh, refreshIntervalMs]);

  return { ...data, loading, refresh };
}
