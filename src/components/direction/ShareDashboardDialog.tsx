import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, UserPlus, UserMinus, Shield } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardId: string;
}

export function ShareDashboardDialog({ open, onOpenChange, dashboardId }: Props) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: shares = [] } = useQuery({
    queryKey: ["dashboard_shares", dashboardId],
    enabled: open && !!dashboardId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("direction_dashboard_shares" as any)
        .select("*") as any)
        .eq("dashboard_id", dashboardId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["share_profiles"],
    enabled: open,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("profiles")
        .select("user_id, first_name, last_name, poste, is_active") as any)
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allRoles = [] } = useQuery({
    queryKey: ["share_roles"],
    enabled: open,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role");
      if (error) throw error;
      return Array.from(new Set((data ?? []).map((r: any) => r.role as string))).sort();
    },
  });

  const sharedUserIds = useMemo(
    () => new Set(shares.filter((s: any) => s.shared_user_id).map((s: any) => s.shared_user_id)),
    [shares],
  );
  const sharedRoles = useMemo(
    () => new Set(shares.filter((s: any) => s.shared_role).map((s: any) => s.shared_role)),
    [shares],
  );

  const nameOf = (uid: string) => {
    const p: any = profiles.find((x: any) => x.user_id === uid);
    return p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Utilisateur" : "Utilisateur";
  };

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (profiles as any[])
      .filter((p) => p.user_id !== user?.id && !sharedUserIds.has(p.user_id))
      .filter((p) =>
        !q ||
        `${p.first_name ?? ""} ${p.last_name ?? ""} ${p.poste ?? ""}`.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [profiles, search, sharedUserIds, user?.id]);

  const addShare = useMutation({
    mutationFn: async (payload: { shared_user_id?: string; shared_role?: string }) => {
      const { error } = await (supabase.from("direction_dashboard_shares" as any) as any).insert({
        dashboard_id: dashboardId,
        shared_user_id: payload.shared_user_id ?? null,
        shared_role: payload.shared_role ?? null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSearch(""); setRole("");
      qc.invalidateQueries({ queryKey: ["dashboard_shares", dashboardId] });
      toast.success("Partage ajouté");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeShare = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("direction_dashboard_shares" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard_shares", dashboardId] });
      toast.success("Partage révoqué");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Partager le tableau de bord</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Par Utilisateur */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Par utilisateur</h4>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un utilisateur..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {results.length > 0 && (
              <div className="border rounded-lg divide-y bg-muted/30">
                {results.map((p) => (
                  <div key={p.user_id} className="flex items-center justify-between p-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {p.first_name} {p.last_name}
                      </p>
                      {p.poste && <p className="text-xs text-muted-foreground truncate">{p.poste}</p>}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => addShare.mutate({ shared_user_id: p.user_id })}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Par Rôle */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Par rôle industriel</h4>
            <div className="flex gap-2">
              <select
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="">Sélectionner un rôle...</option>
                {allRoles
                  .filter((r) => !sharedRoles.has(r))
                  .map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/_/g, " ").toUpperCase()}
                    </option>
                  ))}
              </select>
              <Button
                size="sm"
                disabled={!role}
                onClick={() => addShare.mutate({ shared_role: role })}
              >
                Ajouter
              </Button>
            </div>
          </div>

          {/* Liste des partages actifs */}
          {shares.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Partages actifs</h4>
              <div className="space-y-2">
                {shares.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-2 border rounded-lg bg-background">
                    <div className="flex items-center gap-2">
                      {s.shared_role ? (
                        <>
                          <Shield className="h-4 w-4 text-primary" />
                          <Badge variant="outline">{s.shared_role.replace(/_/g, " ").toUpperCase()}</Badge>
                        </>
                      ) : (
                        <span className="text-sm">{nameOf(s.shared_user_id!)}</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeShare.mutate(s.id)}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
