import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Trash2, User, Users } from "lucide-react";
import { toast } from "sonner";
import { useAllRoles } from "@/hooks/useAllRoles";
import { useDashboardShares, useShareMutations } from "@/hooks/useDirectionDashboards";

interface Props {
  dashboardId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface ProfileLite {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  poste: string | null;
}

function useProfiles(enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: ["share_profiles"],
    queryFn: async (): Promise<ProfileLite[]> => {
      const { data, error } = await (supabase
        .from("profiles")
        .select("user_id, first_name, last_name, poste")
        .eq("is_active" as any, true) as any)
        .order("first_name");
      if (error) throw error;
      return (data ?? []) as ProfileLite[];
    },
  });
}

const fullName = (p: ProfileLite) =>
  `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Utilisateur";

export function DashboardShareDialog({ dashboardId, open, onOpenChange }: Props) {
  const [q, setQ] = useState("");
  const { data: profiles = [] } = useProfiles(open);
  const { roles: allRoles } = useAllRoles();
  const { data: shares = [] } = useDashboardShares(open ? dashboardId : undefined);
  const { add, revoke } = useShareMutations(dashboardId);

  const sharedUserIds = new Set(shares.map((s) => s.shared_with_user_id).filter(Boolean));
  const sharedRoles = new Set(shares.map((s) => s.shared_with_role).filter(Boolean));

  const candidates = useMemo(() => {
    const t = q.trim().toLowerCase();
    return profiles
      .filter((p) => !sharedUserIds.has(p.user_id))
      .filter((p) => !t || fullName(p).toLowerCase().includes(t) || (p.poste ?? "").toLowerCase().includes(t))
      .slice(0, 30);
  }, [profiles, q, shares]);

  const roleLabel = (code: string) => allRoles.find((r) => r.code === code)?.label ?? code;
  const nameOf = (uid: string) => {
    const p = profiles.find((x) => x.user_id === uid);
    return p ? fullName(p) : "Utilisateur";
  };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e: any) {
      toast.error(e.message ?? "Opération impossible");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle>Partage du dashboard</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Accès actuels</Label>
            {!shares.length ? (
              <p className="text-xs text-muted-foreground">Ce dashboard n'est partagé avec personne.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {shares.map((s) => (
                  <Badge key={s.id} variant="secondary" className="gap-1.5 py-1">
                    {s.shared_with_role ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
                    {s.shared_with_role ? roleLabel(s.shared_with_role) : nameOf(s.shared_with_user_id!)}
                    <button
                      aria-label="Retirer l'accès"
                      onClick={() => run(() => revoke.mutateAsync(s.id), "Accès retiré")}
                      className="text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Partager avec un utilisateur</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Rechercher un utilisateur…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <ScrollArea className="h-40 rounded-md border">
              <div className="p-1">
                {!candidates.length && (
                  <p className="p-3 text-xs text-muted-foreground">Aucun utilisateur.</p>
                )}
                {candidates.map((p) => (
                  <button
                    key={p.user_id}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                    onClick={() =>
                      run(() => add.mutateAsync({ userId: p.user_id }), "Dashboard partagé")
                    }
                  >
                    <span className="truncate">{fullName(p)}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">{p.poste ?? ""}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <Label>Partager avec un rôle entier</Label>
            <ScrollArea className="h-32 rounded-md border">
              <div className="flex flex-wrap gap-1.5 p-2">
                {allRoles
                  .filter((r) => !sharedRoles.has(r.code))
                  .map((r) => (
                    <Button
                      key={r.code}
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() =>
                        run(() => add.mutateAsync({ role: r.code }), "Dashboard partagé au rôle")
                      }
                    >
                      {r.label}
                    </Button>
                  ))}
              </div>
            </ScrollArea>
          </div>

          <p className="text-xs text-muted-foreground">
            Les personnes concernées retrouvent ce dashboard dans « Mes Dashboards », en lecture seule.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
