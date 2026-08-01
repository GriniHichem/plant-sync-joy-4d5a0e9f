import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveDialog } from "@/components/responsive/ResponsiveDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Copy, Eye, Globe, LayoutDashboard, Lock, Plus, Share2, Sparkles, Trash2, Users } from "lucide-react";
import { DASHBOARD_TEMPLATES, buildLayout } from "@/lib/direction/templates";
import { WIDGETS, WIDGET_MAP } from "@/lib/direction/widgetCatalog";
import { ShareDashboardDialog } from "@/components/direction/ShareDashboardDialog";

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
  const { user, roles } = useAuth();
  const { canView } = usePermissions();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState("direction");

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
      const tpl = DASHBOARD_TEMPLATES.find((t) => t.id === templateId);
      const allowed = (tpl?.widgets ?? []).filter((w) => {
        const def = WIDGET_MAP.get(w.widgetId);
        return def && (roles.includes("admin") || canView(def.permissionModule));
      });
      const layout = buildLayout(allowed, (wid) => WIDGET_MAP.get(wid)?.defaultSize ?? { w: 3, h: 4 });
      const { data, error } = await supabase
        .from("direction_dashboards" as any)
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          owner_id: user?.id,
          layout: layout as any,
          global_filters: (tpl?.filters ?? { period: "7d" }) as any,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: (d: any) => {
      setOpen(false); setName(""); setDescription(""); setTemplateId("direction");
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
  const others = useMemo(() => dashboards.filter((d) => d.owner_id !== user?.id), [dashboards, user?.id]);
  const widgetCount = useMemo(
    () => WIDGETS.filter((w) => roles.includes("admin") || canView(w.permissionModule)).length,
    [canView, roles],
  );

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
          {owned ? <VisibilityBadge v={d.visibility} /> : <Badge variant="secondary" className="text-[10px]">Lecture seule</Badge>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="text-[10px]">
          {Array.isArray(d.layout) ? d.layout.length : 0} widget(s)
        </Badge>
        <div className="flex-1" />
        <Button size="sm" onClick={() => navigate(`/dashboard-design/dashboards/${d.id}`)}>
          <Eye className="h-4 w-4 mr-1" /> Ouvrir
        </Button>
        {owned && (
          <Button size="sm" variant="outline" title="Partager" onClick={() => setShareId(d.id)}>
            <Share2 className="h-4 w-4" />
          </Button>
        )}
        {mayCreate && (
          <Button size="sm" variant="outline" title="Dupliquer" onClick={() => duplicate.mutate(d)}>
            <Copy className="h-4 w-4" />
          </Button>
        )}
        {owned && mayDelete && (
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
          <h1 className="text-2xl font-bold">Dashboard Design</h1>
          <p className="text-sm text-muted-foreground">
            Composez vos tableaux de bord à partir des {widgetCount} indicateurs accessibles — lecture seule sur les données.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/dashboard-design/partages")}>
          <Share2 className="h-4 w-4 mr-1" /> Mes Dashboards
        </Button>
        {mayCreate && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nouveau dashboard
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mes créations</h2>
            {mine.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
                {mayCreate ? "Aucun dashboard. Créez-en un à partir d'un modèle prédéfini." : "Aucun dashboard."}
              </CardContent></Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{mine.map((d) => renderCard(d, true))}</div>
            )}
          </section>

          {others.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Accessibles / partagés</h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{others.map((d) => renderCard(d, false))}</div>
            </section>
          )}
        </>
      )}

      <ResponsiveDialog
        open={open} onOpenChange={setOpen}
        title="Nouveau dashboard"
        description="Choisissez un modèle de départ, tout reste personnalisable ensuite."
        className="max-w-2xl"
      >
        <div className="space-y-3">
          <div>
            <Label>Nom *</Label>
            <Input className="h-11" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Pilotage Direction" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label className="flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> Modèle</Label>
            <div className="grid gap-2 sm:grid-cols-2 mt-1.5 max-h-[40vh] overflow-auto">
              {DASHBOARD_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  className={cn(
                    "text-left rounded-md border p-2.5 transition-colors",
                    templateId === t.id ? "border-primary bg-accent/50" : "hover:bg-accent/40",
                  )}
                >
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p>
                  <Badge variant="outline" className="mt-1.5 text-[10px]">{t.widgets.length} widget(s)</Badge>
                </button>
              ))}
            </div>
          </div>
          <Button className="w-full h-11" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            Créer et composer
          </Button>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
