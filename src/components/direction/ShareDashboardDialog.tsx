import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ResponsiveDialog } from "@/components/responsive/ResponsiveDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, Search, Trash2, UserPlus, Users } from "lucide-react";

interface Props {
  dashboardId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const roleLabel = (r: string) => r.split("_").join(" ");

export function ShareDashboardDialog({ dashboardId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string>("");

  const { data: shares = [] } = useQuery({
    queryKey: ["dashboard_shares", dashboardId],
    enabled: open && !!dashboardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direction_dashboard_shares" as any)
        .select("*")
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
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, poste, is_active")
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
    () => new Set(shares.filter((s) => s.shared_user_id).map((s) => s.shared_user_id)),
    [shares],
  );
  const sharedRoles = useMemo(
    () => new Set(shares.filter((s) => s.shared_role).map((s) => s.shared_role)),
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
      const { error } = await supabase.from("direction_dashboard_shares" as any).insert({
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
      const { error } = await supabase.from("direction_dashboard_shares" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard_shares", dashboardId] });
      toast.success("Partage révoqué");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Partager le dashboard"
      description="Les personnes ajoutées y accèdent en lecture seule, avec leurs propres droits sur les données."
      className="max-w-lg"
    >
      <div className="space-y-4">
        <div>
          <Label className="flex items-center gap-1.5"><UserPlus className="h-4 w-4" /> Ajouter des utilisateurs</Label>
          <div className="relative mt-1.5">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-11 pl-8"
              placeholder="Rechercher un nom ou un poste…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {search.trim() && (
            <div className="mt-2 rounded-md border divide-y max-h-52 overflow-auto">
              {results.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">Aucun utilisateur trouvé.</p>
              ) : (
                results.map((p: any) => (
                  <button
                    key={p.user_id}
                    type="button"
                    className="w-full text-left px-3 py-2.5 hover:bg-accent/60 flex items-center gap-2"
                    onClick={() => addShare.mutate({ shared_user_id: p.user_id })}
                  >
                    <span className="text-sm font-medium flex-1 truncate">
                      {`${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Utilisateur"}
                    </span>
                    {p.poste && <span className="text-xs text-muted-foreground truncate">{p.poste}</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div>
          <Label className="flex items-center gap-1.5"><Users className="h-4 w-4" /> Partager avec un rôle entier</Label>
          <div className="flex gap-2 mt-1.5">
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Choisir un rôle…" /></SelectTrigger>
              <SelectContent>
                {allRoles.filter((r) => !sharedRoles.has(r)).map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">{roleLabel(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="h-11" disabled={!role} onClick={() => addShare.mutate({ shared_role: role })}>
              Ajouter
            </Button>
          </div>
        </div>

        <div>
          <Label className="flex items-center gap-1.5"><Eye className="h-4 w-4" /> Accès actuels ({shares.length})</Label>
          <div className="mt-1.5 rounded-md border divide-y">
            {shares.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Ce dashboard n'est partagé avec personne.</p>
            ) : (
              shares.map((s) => (
                <div key={s.id} className="flex items-center gap-2 px-3 py-2">
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {s.shared_role ? "Rôle" : "Utilisateur"}
                  </Badge>
                  <span className="text-sm flex-1 truncate capitalize">
                    {s.shared_role ? roleLabel(s.shared_role) : nameOf(s.shared_user_id)}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">Lecture seule</Badge>
                  <Button size="icon" variant="ghost" className="text-destructive h-8 w-8"
                    onClick={() => removeShare.mutate(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
