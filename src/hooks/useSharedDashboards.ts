import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SharedDashboard {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  layout: any;
  refresh_seconds: number;
  global_filters: any;
  updated_at: string;
}

/**
 * Dashboards partagés avec l'utilisateur courant (hors ceux qu'il possède).
 * La RLS de direction_dashboard_shares ne renvoie que les partages qui le
 * concernent (utilisateur ciblé ou rôle possédé) ou dont il est propriétaire ;
 * on retire donc les siens côté client.
 */
export function useSharedDashboards() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["shared_dashboards", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direction_dashboard_shares" as any)
        .select("dashboard_id, direction_dashboards(*)");
      if (error) throw error;
      const map = new Map<string, SharedDashboard>();
      for (const row of (data ?? []) as any[]) {
        const d = row.direction_dashboards;
        if (!d || d.owner_id === user?.id) continue;
        map.set(d.id, d as SharedDashboard);
      }
      return Array.from(map.values()).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    },
  });
}

export function useSharedDashboardsCount() {
  const { data } = useSharedDashboards();
  return data?.length ?? 0;
}
