import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ActiveProductionShift {
  id: string;
  date_shift: string;
  shift_type: string;
  shift_team_id: string | null;
  line_id: string | null;
  of_id: string | null;
  chef_ligne_id: string | null;
  heure_debut: string;
  heure_fin: string | null;
  is_active: boolean;
  observations: string | null;
  team?: { id: string; name: string; code: string; color: string | null } | null;
  line?: { id: string; code: string; designation: string } | null;
  of?: { id: string; numero: string; product_id: string | null } | null;
}

const SELECTED_KEY = "active-production-shift-id";

/**
 * Hook returning ALL the user's active production shifts for today
 * (a single supervisor can pilot several lines / OFs in parallel).
 * - `shifts` : tous les shifts actifs du jour pour le user
 * - `shift`  : le shift "courant" (sélection persistée, fallback : le plus récent)
 */
export function useActiveProductionShift() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<ActiveProductionShift[]>([]);
  const [selectedId, setSelectedIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(SELECTED_KEY); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  const setSelectedId = useCallback((id: string | null) => {
    setSelectedIdState(id);
    try {
      if (id) localStorage.setItem(SELECTED_KEY, id);
      else localStorage.removeItem(SELECTED_KEY);
    } catch { /* ignore */ }
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setShifts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Auto-create today's sessions for ALL active OFs the user is assigned to
    try { await supabase.rpc("ensure_my_production_shifts" as any); } catch {
      // Compat fallback if old function still present
      try { await supabase.rpc("ensure_my_production_shift_session" as any); } catch { /* ignore */ }
    }
    // Date du jour calculée côté serveur via RPC ? Pour rester simple : on filtre par is_active uniquement.
    const { data } = await supabase
      .from("shifts")
      .select(
        "*, shift_teams(id, name, code, color), production_lines(id, code, designation), ordres_fabrication(id, numero, product_id)"
      )
      .eq("chef_ligne_id", user.id)
      .eq("is_active", true)
      .order("heure_debut", { ascending: false });

    const list: ActiveProductionShift[] = ((data as any[]) ?? []).map((d) => ({
      id: d.id,
      date_shift: d.date_shift,
      shift_type: d.shift_type,
      shift_team_id: d.shift_team_id,
      line_id: d.line_id,
      of_id: d.of_id,
      chef_ligne_id: d.chef_ligne_id,
      heure_debut: d.heure_debut,
      heure_fin: d.heure_fin,
      is_active: d.is_active,
      observations: d.observations,
      team: d.shift_teams ?? null,
      line: d.production_lines ?? null,
      of: d.ordres_fabrication ?? null,
    }));
    setShifts(list);

    // Maintenir/valider la sélection
    if (list.length > 0) {
      const stillThere = selectedId && list.some((s) => s.id === selectedId);
      if (!stillThere) setSelectedId(list[0].id);
    } else if (selectedId) {
      setSelectedId(null);
    }
    setLoading(false);
  }, [user, selectedId, setSelectedId]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const shift = shifts.find((s) => s.id === selectedId) ?? shifts[0] ?? null;

  return { shift, shifts, selectedId: shift?.id ?? null, setSelectedId, loading, refresh };
}
