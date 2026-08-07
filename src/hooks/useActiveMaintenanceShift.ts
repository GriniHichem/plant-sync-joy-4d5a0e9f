import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ActiveMaintenanceShift {
  id: string;
  date_shift: string;
  shift_type: string;
  shift_team_id: string | null;
  maintenancier_id: string;
  line_ids: string[];
  heure_debut: string;
  heure_fin: string | null;
  is_active: boolean;
  observations: string | null;
  opened_by: string | null;
  team?: { id: string; name: string; code: string; color: string | null } | null;
}

/**
 * Returns the maintenance shift currently opened for the connected user
 * (by the responsable maintenance). Returns null if none is active today.
 */
export function useActiveMaintenanceShift() {
  const { user } = useAuth();
  const [shift, setShift] = useState<ActiveMaintenanceShift | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setShift(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Pas de filtre date_shift : un shift de nuit ouvert hier reste actif après minuit.
    const { data } = await supabase
      .from("maintenance_shifts" as any)
      .select("*, shift_teams(id, name, code, color)")
      .eq("maintenancier_id", user.id)
      .eq("is_active", true)
      .order("heure_debut", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      setShift(null);
      setLoading(false);
      return;
    }
    const d = data as any;
    setShift({
      id: d.id,
      date_shift: d.date_shift,
      shift_type: d.shift_type,
      shift_team_id: d.shift_team_id,
      maintenancier_id: d.maintenancier_id,
      line_ids: d.line_ids ?? [],
      heure_debut: d.heure_debut,
      heure_fin: d.heure_fin,
      is_active: d.is_active,
      observations: d.observations,
      opened_by: d.opened_by,
      team: d.shift_teams ?? null,
    });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { shift, loading, refresh };
}
