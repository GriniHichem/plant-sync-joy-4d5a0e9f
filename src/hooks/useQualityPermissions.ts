import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type QualityAction =
  | "create_check" | "validate_check" | "reject_check"
  | "create_nc" | "close_nc" | "decide_nc"
  | "create_action" | "verify_action" | "close_action"
  | "manage_indicators" | "manage_assignments"
  | "publish_recipe" | "publish_bom"
  | "export_tracability" | "view_reports";

const COL: Record<QualityAction, string> = {
  create_check: "can_create_check",
  validate_check: "can_validate_check",
  reject_check: "can_reject_check",
  create_nc: "can_create_nc",
  close_nc: "can_close_nc",
  decide_nc: "can_decide_nc",
  create_action: "can_create_action",
  verify_action: "can_verify_action",
  close_action: "can_close_action",
  manage_indicators: "can_manage_indicators",
  manage_assignments: "can_manage_assignments",
  publish_recipe: "can_publish_recipe",
  publish_bom: "can_publish_bom",
  export_tracability: "can_export_tracability",
  view_reports: "can_view_reports",
};

export function useQualityPermissions() {
  const { roles } = useAuth();
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roles.length) { setPerms({}); setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("quality_permissions" as any)
        .select("*")
        .in("role", roles as string[]);
      const merged: Record<string, boolean> = {};
      for (const row of ((data ?? []) as unknown) as Record<string, unknown>[]) {
        for (const action of Object.keys(COL) as QualityAction[]) {
          merged[action] = (merged[action] || Boolean(row[COL[action]])) ?? false;
        }
      }
      setPerms(merged);
      setLoading(false);
    })();
  }, [roles]);

  return {
    loading,
    can: (a: QualityAction) => Boolean(perms[a]),
    permissions: perms,
  };
}
