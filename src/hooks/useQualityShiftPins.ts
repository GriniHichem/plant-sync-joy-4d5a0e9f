import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface QualityShiftPin {
  id: string;
  quality_shift_id: string;
  of_id: string;
  indicator_id: string;
}

/**
 * Manages "pinned" (priority) quality controls for a given quality shift.
 * Pins are shared across controllers/relief so the whole team sees the same
 * priorities during the shift.
 */
export function useQualityShiftPins(qualityShiftId: string | null) {
  const { user } = useAuth();
  const [pins, setPins] = useState<QualityShiftPin[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!qualityShiftId) {
      setPins([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("quality_shift_pins" as any)
      .select("id, quality_shift_id, of_id, indicator_id")
      .eq("quality_shift_id", qualityShiftId);
    setPins(((data as any[]) ?? []) as QualityShiftPin[]);
    setLoading(false);
  }, [qualityShiftId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isPinned = useCallback(
    (ofId: string, indicatorId: string) =>
      pins.some((p) => p.of_id === ofId && p.indicator_id === indicatorId),
    [pins],
  );

  const togglePin = useCallback(
    async (ofId: string, indicatorId: string) => {
      if (!qualityShiftId) return;
      const existing = pins.find((p) => p.of_id === ofId && p.indicator_id === indicatorId);
      if (existing) {
        setPins((prev) => prev.filter((p) => p.id !== existing.id));
        await supabase.from("quality_shift_pins" as any).delete().eq("id", existing.id);
      } else {
        const { data } = await supabase
          .from("quality_shift_pins" as any)
          .insert({
            quality_shift_id: qualityShiftId,
            of_id: ofId,
            indicator_id: indicatorId,
            pinned_by: user?.id ?? null,
          } as any)
          .select("id, quality_shift_id, of_id, indicator_id")
          .single();
        if (data) setPins((prev) => [...prev, data as any]);
      }
    },
    [pins, qualityShiftId, user?.id],
  );

  return { pins, isPinned, togglePin, loading, refresh };
}
