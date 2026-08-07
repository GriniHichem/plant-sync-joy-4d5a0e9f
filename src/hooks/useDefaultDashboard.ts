import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface DefaultDashboard {
  id: string;
  name: string;
}

/**
 * Dashboard par défaut de l'utilisateur courant.
 * La RLS de direction_dashboards garantit que l'on ne résout que les
 * dashboards auxquels l'utilisateur a encore accès : si l'accès a été révoqué
 * (ou le dashboard supprimé), la préférence est considérée comme vide.
 */
export function useDefaultDashboard() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["default_dashboard", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async (): Promise<DefaultDashboard | null> => {
      const { data, error } = await supabase
        .from("user_dashboard_preferences" as any)
        .select("default_dashboard_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      const id = (data as any)?.default_dashboard_id as string | undefined;
      if (!id) return null;

      const { data: d, error: e2 } = await supabase
        .from("direction_dashboards" as any)
        .select("id, name")
        .eq("id", id)
        .maybeSingle();
      if (e2) return null;
      if (!d) return null; // supprimé ou accès révoqué → pas de défaut
      return d as unknown as DefaultDashboard;
    },
  });
}

export function useSetDefaultDashboard() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (dashboardId: string | null) => {
      if (!user?.id) throw new Error("Non authentifié");
      const { error } = await supabase
        .from("user_dashboard_preferences" as any)
        .upsert(
          { user_id: user.id, default_dashboard_id: dashboardId, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      return dashboardId;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["default_dashboard", user?.id] });
      toast.success(id ? "Dashboard défini comme page par défaut avec succès" : "Dashboard par défaut retiré");
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });
}
