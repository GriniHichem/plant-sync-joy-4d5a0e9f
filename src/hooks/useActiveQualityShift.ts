import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ActiveQualityShift {
  id: string;
  date_shift: string;
  shift_type: string;
  shift_team_id: string | null;
  controller_id: string;
  heure_debut: string;
  heure_fin: string | null;
  is_active: boolean;
  observations: string | null;
  team?: { id: string; name: string; code: string; color: string | null } | null;
  lines: { id: string; code: string; designation: string }[];
  production_shift_ids: string[];
}

const SELECTED_KEY = "active-quality-shift-id";

export function useActiveQualityShift() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<ActiveQualityShift[]>([]);
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
    try { await supabase.rpc("ensure_my_quality_shifts" as any); } catch { /* ignore */ }

    const { data: rows } = await supabase
      .from("quality_shifts" as any)
      .select("*, shift_teams(id, name, code, color)")
      .eq("controller_id", user.id)
      .eq("is_active", true)
      .order("heure_debut", { ascending: false });

    const baseRows = (rows as any[]) ?? [];
    if (baseRows.length === 0) {
      setShifts([]);
      if (selectedId) setSelectedId(null);
      setLoading(false);
      return;
    }

    const ids = baseRows.map((r) => r.id);
    const [linesRes, linksRes] = await Promise.all([
      supabase
        .from("quality_shift_lines" as any)
        .select("quality_shift_id, production_line_id, production_lines(id, code, designation)")
        .in("quality_shift_id", ids),
      supabase
        .from("quality_shift_production_links" as any)
        .select("quality_shift_id, production_shift_id")
        .in("quality_shift_id", ids),
    ]);

    const linesByShift = new Map<string, any[]>();
    ((linesRes.data as any[]) ?? []).forEach((r) => {
      const arr = linesByShift.get(r.quality_shift_id) ?? [];
      if (r.production_lines) arr.push(r.production_lines);
      linesByShift.set(r.quality_shift_id, arr);
    });
    const linksByShift = new Map<string, string[]>();
    ((linksRes.data as any[]) ?? []).forEach((r) => {
      const arr = linksByShift.get(r.quality_shift_id) ?? [];
      arr.push(r.production_shift_id);
      linksByShift.set(r.quality_shift_id, arr);
    });

    const list: ActiveQualityShift[] = baseRows.map((qsAny) => ({
      id: qsAny.id,
      date_shift: qsAny.date_shift,
      shift_type: qsAny.shift_type,
      shift_team_id: qsAny.shift_team_id,
      controller_id: qsAny.controller_id,
      heure_debut: qsAny.heure_debut,
      heure_fin: qsAny.heure_fin,
      is_active: qsAny.is_active,
      observations: qsAny.observations,
      team: qsAny.shift_teams ?? null,
      lines: linesByShift.get(qsAny.id) ?? [],
      production_shift_ids: linksByShift.get(qsAny.id) ?? [],
    }));
    setShifts(list);

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

export function deriveShiftTypeFromHour(hour: number): "matin" | "apres_midi" | "nuit" {
  if (hour >= 5 && hour < 13) return "matin";
  if (hour >= 13 && hour < 21) return "apres_midi";
  return "nuit";
}
