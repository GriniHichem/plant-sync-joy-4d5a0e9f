import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveDialog } from "@/components/responsive/ResponsiveDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Copy, Eye, Globe, LayoutDashboard, Lock, Plus, Trash2, Users } from "lucide-react";

interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  visibility: "private" | "public" | "roles";
  allowed_roles: string[];
  layout: any;
  refresh_seconds: number;
  updated_at: string;
}

export default function DirectionDashboards() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: dashboards = [], isLoading } = useQuery({
    queryKey: ["direction_dashboards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direction_dashboards" as any)
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Dashboard[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nom requis");
      const { data, error } = await supabase
        .from("direction_dashboards" as any)
        .insert({ name: name.trim(), description: description.trim() || null, owner_id: user?.id })
        .select("id")
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: (d: any) => {
      setOpen(false); setName(""); setDescription("");
      qc.invalidateQueries({ queryKey: ["direction_dashboards"] });
      navigate(`/direction/dashboards/${d.id}?edit=1`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: async (d: Dashboard) => {
      const { error } = await supabase.from("direction_dashboards" as any).insert({
        name: `${d.name} (copie)`,
        description: d.description,
        owner_id: user?.id,
        layout: d.layout,
        refresh_seconds: d.refresh_seconds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dashboard dupliqué");
      qc.invalidateQueries({ queryKey: ["direction_dashboards"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("direction_dashboards" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dashboard supprimé");
      qc.invalidateQueries({ queryKey: ["direction_dashboards"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mine = useMemo(() => dashboards.filter((d) => d.owner_id === user?.id), [dashboards, user?.id]);
  const shared = useMemo(() => dashboards.filter((d) => d.owner_id !== user?.id), [dashboards, user?.id]);

  const VisibilityBadge = ({ v }: { v: Dashboard["visibility"] }) => (
    <Badge variant="outline" className="gap-1 text-[10px]">
      {v === "public" ? <Globe className="h-3 w-3" /> : v === "roles" ? <Users className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
      {v === "public" ? "Public" : v === "roles" ? "Rôles" : "Privé"}
    </Badge>
  );

  const renderCard = (d: Dashboard, owned: boolean) => (
    <Card key={d.id} className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base truncate">{d.name}</CardTitle>
            <CardDescription className="truncate">{d.description || "—"}</CardDescription>
          </div>
          <VisibilityBadge v={d.visibility} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="text-[10px]">
          {Array.isArray(d.layout) ? d.layout.length : 0} widget(s)
        </Badge>
        <div className="flex-1" />
        <Button size="sm" onClick={() => navigate(`/direction/dashboards/${d.id}`)}>
          <Eye className="h-4 w-4 mr-1" /> Ouvrir
        </Button>
        <Button size="sm" variant="outline" onClick={() => duplicate.mutate(d)}>
          <Copy className="h-4 w-4" />
        </Button>
        {owned && (
          <Button size="sm" variant="ghost" className="text-destructive"
            onClick={() => { if (confirm(`Supprimer « ${d.name} » ?`)) remove.mutate(d.id); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">Dashboard Direction</h1>
          <p className="text-sm text-muted-foreground">
            Composez vos tableaux de bord à partir des indicateurs de tous les modules — lecture seule.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nouveau dashboard
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mes dashboards</h2>
            {mine.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
                Aucun dashboard. Créez-en un pour commencer.
              </CardContent></Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{mine.map((d) => renderCard(d, true))}</div>
            )}
          </section>

          {shared.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Partagés avec moi</h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{shared.map((d) => renderCard(d, false))}</div>
            </section>
          )}
        </>
      )}

      <ResponsiveDialog open={open} onOpenChange={setOpen} title="Nouveau dashboard" description="Vous pourrez ajouter les widgets ensuite.">
        <div className="space-y-3">
          <div>
            <Label>Nom *</Label>
            <Input className="h-11" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Production Direction" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button className="w-full h-11" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            Créer et composer
          </Button>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
