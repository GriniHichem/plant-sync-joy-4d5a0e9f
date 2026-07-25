import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { resolveLandingPath, FALLBACK_LANDING_PATH } from "@/lib/landing";

/**
 * Returns the landing path for the currently authenticated user.
 * `loading` stays true until permissions AND overrides are known so callers
 * can hold the redirect and avoid a wrong-page flash.
 */
export function useDefaultLandingPath() {
  const { roles, hasRole } = useAuth();
  const { canView, canCreate, canEdit, canDelete, loading: permsLoading } = usePermissions();
  const [overrides, setOverrides] = useState<Record<string, string> | null>(null);
  const [overridesLoading, setOverridesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "landing.defaults_by_role")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        try {
          const parsed = data?.value ? JSON.parse(data.value as unknown as string) : {};
          setOverrides(parsed && typeof parsed === "object" ? parsed : {});
        } catch {
          setOverrides({});
        }
        setOverridesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const loading = permsLoading || overridesLoading;
  const path = loading
    ? FALLBACK_LANDING_PATH
    : resolveLandingPath(roles as unknown as string[], overrides, { canView, canCreate, canEdit, canDelete }, hasRole("admin"));

  return { path, loading };
}
