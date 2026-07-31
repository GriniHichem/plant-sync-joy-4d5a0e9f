import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Nombre de dashboards partagés avec l'utilisateur courant.
 * La RLS de direction_dashboard_shares ne renvoie que les partages
 * qui le concernent (utilisateur ciblé ou rôle possédé).
 */
export function useSharedDashboardsCount() {
  const { user } = useAuth();
  const { data = 0 } = useQuery({
    queryKey: ["shared_dashboards_count", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direction_dashboard_shares" as any)
        .select("dashboard_id");
      if (error) return 0;
      const owned = new Set((data ?? []).map((r: any) => r.dashboard_id));
      return owned.size;
    },
  });
  return data as number;
}
