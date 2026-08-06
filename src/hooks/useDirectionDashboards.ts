import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardConfig, EMPTY_CONFIG, parseConfig } from "@/lib/directionWidgets";
import { useAuth } from "@/contexts/AuthContext";

export interface DirectionDashboard {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  visibility: "private" | "roles" | "public";
  allowed_roles: string[];
  layout: DashboardConfig;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const db = () => (supabase as any).from("direction_dashboards");

function map(row: any): DirectionDashboard {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    owner_id: row.owner_id,
    visibility: row.visibility,
    allowed_roles: row.allowed_roles ?? [],
    layout: parseConfig(row.layout),
    is_default: row.is_default,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useDirectionDashboards() {
  return useQuery({
    queryKey: ["direction_dashboards"],
    queryFn: async (): Promise<DirectionDashboard[]> => {
      const { data, error } = await db().select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(map);
    },
  });
}

export function useDirectionDashboard(id?: string) {
  return useQuery({
    enabled: !!id,
    queryKey: ["direction_dashboard", id],
    queryFn: async (): Promise<DirectionDashboard | null> => {
      const { data, error } = await db().select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? map(data) : null;
    },
  });
}

export function useDashboardMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["direction_dashboards"] });
    qc.invalidateQueries({ queryKey: ["direction_dashboard"] });
    qc.invalidateQueries({ queryKey: ["default_direction_dashboard"] });
  };

  const create = useMutation({
    mutationFn: async (payload: Partial<DirectionDashboard>) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await db()
        .insert({
          name: payload.name,
          description: payload.description ?? null,
          visibility: payload.visibility ?? "private",
          allowed_roles: payload.allowed_roles ?? [],
          layout: payload.layout ?? EMPTY_CONFIG,
          owner_id: auth.user?.id,
        })
        .select("*")
        .single();
      if (error) throw error;
      return map(data);
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<DirectionDashboard>) => {
      const { error } = await db().update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

/* ------------------------------------------------------ dashboard par défaut */

const defaults = () => (supabase as any).from("direction_dashboard_defaults");

export function useDefaultDirectionDashboard() {
  return useQuery({
    queryKey: ["default_direction_dashboard"],
    queryFn: async (): Promise<{ dashboard_id: string | null; accessible: boolean; dashboard: DirectionDashboard | null }> => {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id;
      if (!me) return { dashboard_id: null, accessible: false, dashboard: null };

      const { data: pref, error: prefError } = await defaults()
        .select("dashboard_id")
        .eq("user_id", me)
        .maybeSingle();
      if (prefError) throw prefError;
      const dashboardId = pref?.dashboard_id as string | undefined;
      if (!dashboardId) return { dashboard_id: null, accessible: false, dashboard: null };

      const { data, error } = await db().select("*").eq("id", dashboardId).maybeSingle();
      if (error) throw error;
      return { dashboard_id: dashboardId, accessible: !!data, dashboard: data ? map(data) : null };
    },
  });
}

export function useDefaultDashboardMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dashboardId: string | null) => {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id;
      if (!me) throw new Error("Utilisateur non connecté");

      if (!dashboardId) {
        const { error } = await defaults().delete().eq("user_id", me);
        if (error) throw error;
        return;
      }

      const { error } = await defaults().upsert(
        { user_id: me, dashboard_id: dashboardId },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["default_direction_dashboard"] }),
  });
}

/* ------------------------------------------------------------------ partage */

export interface DashboardShare {
  id: string;
  dashboard_id: string;
  shared_with_user_id: string | null;
  shared_with_role: string | null;
  created_at: string;
}

const shares = () => (supabase as any).from("direction_dashboard_shares");

/** Partages configurés sur un dashboard (propriétaire / admin). */
export function useDashboardShares(dashboardId?: string) {
  return useQuery({
    enabled: !!dashboardId,
    queryKey: ["dashboard_shares", dashboardId],
    queryFn: async (): Promise<DashboardShare[]> => {
      const { data, error } = await shares()
        .select("id, dashboard_id, shared_with_user_id, shared_with_role, created_at")
        .eq("dashboard_id", dashboardId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as DashboardShare[];
    },
  });
}

export function useShareMutations(dashboardId?: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["dashboard_shares", dashboardId] });
    qc.invalidateQueries({ queryKey: ["shared_dashboards"] });
  };

  const add = useMutation({
    mutationFn: async (target: { userId?: string; role?: string }) => {
      const { error } = await shares().insert({
        dashboard_id: dashboardId,
        shared_with_user_id: target.userId ?? null,
        shared_with_role: target.role ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await shares().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, revoke };
}

/** Dashboards partagés avec l'utilisateur courant (lecture seule). */
export function useSharedDashboards() {
  const { user, profile, roles, loading } = useAuth();
  const viewerId = profile?.user_id ?? user?.id ?? null;
  const rolesKey = roles.slice().sort().join("|");

  return useQuery({
    enabled: !loading && !!viewerId,
    queryKey: ["shared_dashboards", viewerId, rolesKey],
    queryFn: async (): Promise<DirectionDashboard[]> => {
      if (!viewerId) return [];
      const myRoles = roles.map((r) => r as string);

      // Les policies RLS renvoient aussi les partages dont je suis propriétaire
      // (ou tous, si je suis admin). On filtre donc explicitement côté client.
      // Important: viewerId vient du profil effectif, ce qui permet aussi de
      // tester correctement via l'impersonation admin.
      const { data: sh, error: e1 } = await shares().select(
        "dashboard_id, shared_with_user_id, shared_with_role",
      );
      if (e1) throw e1;

      const ids = Array.from(
        new Set(
          (sh ?? [])
            .filter(
              (s: any) =>
                s.shared_with_user_id === viewerId ||
                (s.shared_with_role && myRoles.includes(s.shared_with_role)),
            )
            .map((s: any) => s.dashboard_id),
        ),
      );
      if (!ids.length) return [];

      const { data, error } = await db().select("*").in("id", ids).neq("owner_id", viewerId);
      if (error) throw error;
      return (data ?? []).map(map);
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}


