import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const CONTROL_KEYS = [
  "control.enforce_validations",
  "control.enforce_notifications",
  "control.enforce_audit",
  "control.enforce_rls_strict",
  "control.allow_custom_roles",
  "control.maintenance_mode",
  "control.enforce_public_access_gate",
] as const;

export type ControlKey = typeof CONTROL_KEYS[number];

export interface ControlSwitch {
  key: ControlKey;
  value: boolean;
  label: string;
  description: string | null;
  updated_at: string;
}

export function useControlSwitches() {
  const [switches, setSwitches] = useState<ControlSwitch[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("app_settings")
      .select("key, value, label, description, updated_at")
      .in("key", CONTROL_KEYS as unknown as string[]);
    setSwitches(((data ?? []) as Array<{ key: string; value: string; label: string; description: string | null; updated_at: string }>).map((r) => ({
      key: r.key as ControlKey,
      value: r.value === "true",
      label: r.label,
      description: r.description,
      updated_at: r.updated_at,
    })));
    setLoading(false);
  }, []);

  const setSwitch = useCallback(async (key: ControlKey, value: boolean) => {
    await supabase.from("app_settings").update({ value: value ? "true" : "false" }).eq("key", key);
    await reload();
  }, [reload]);

  useEffect(() => { reload(); }, [reload]);

  return { switches, loading, reload, setSwitch };
}
