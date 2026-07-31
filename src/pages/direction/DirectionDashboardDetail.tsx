import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Responsive as ResponsiveGrid } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveDialog } from "@/components/responsive/ResponsiveDialog";
import { toast } from "sonner";
import { ArrowLeft, Check, LayoutGrid, Plus, RefreshCw, Save, Search, Settings2 } from "lucide-react";
import { DirectionWidget } from "@/components/direction/DirectionWidget";
import { WIDGETS, WIDGET_CATEGORIES, WIDGET_MAP, type LayoutItem } from "@/lib/direction/widgetCatalog";

const REFRESH_OPTIONS = [
  { v: 0, l: "Manuel" }, { v: 30, l: "30 s" }, { v: 60, l: "1 min" },
  { v: 300, l: "5 min" }, { v: 900, l: "15 min" },
];

export default function DirectionDashboardDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, roles } = useAuth();
  const { canView } = usePermissions();
  const [params] = useSearchParams();

  const [editing, setEditing] = useState(params.get("edit") === "1");
  const [items, setItems] = useState<LayoutItem[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [configId, setConfigId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [meta, setMeta] = useState({ name: "", description: "", visibility: "private", refresh_seconds: 0 });

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["direction_dashboard", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direction_dashboards" as any)
        .select("*").eq("id", id!).single();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (!dashboard) return;
    setItems(Array.isArray(dashboard.layout) ? dashboard.layout : []);
    setMeta({
      name: dashboard.name,
      description: dashboard.description ?? "",
      visibility: dashboard.visibility,
      refresh_seconds: dashboard.refresh_seconds ?? 0,
    });
  }, [dashboard]);

  const isOwner = dashboard?.owner_id === user?.id || roles.includes("admin");

  const save = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const { error } = await supabase
        .from("direction_dashboards" as any)
        .update(patch).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["direction_dashboard", id] });
      qc.invalidateQueries({ queryKey: ["direction_dashboards"] });
      toast.success("Dashboard enregistré");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Bibliothèque filtrée par les droits de l'utilisateur (aucune donnée hors périmètre).
  const availableWidgets = useMemo(
    () => WIDGETS.filter((w) => roles.includes("admin") || canView(w.permissionModule)),
    [canView, roles],
  );
  const filteredLibrary = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    if (!q) return availableWidgets;
    return availableWidgets.filter(
      (w) => w.title.toLowerCase().includes(q) || w.description.toLowerCase().includes(q) || w.category.toLowerCase().includes(q),
    );
  }, [availableWidgets, librarySearch]);

  const visibleItems = useMemo(
    () => items.filter((it) => {
      const def = WIDGET_MAP.get(it.widgetId);
      return !!def && (roles.includes("admin") || canView(def.permissionModule));
    }),
    [items, canView, roles],
  );

  const addWidget = (widgetId: string) => {
    const def = WIDGET_MAP.get(widgetId)!;
    const maxY = items.reduce((m, it) => Math.max(m, it.y + it.h), 0);
    setItems((prev) => [
      ...prev,
      {
        i: `${widgetId}-${Date.now().toString(36)}`,
        widgetId,
        x: 0, y: maxY,
        w: def.defaultSize.w, h: def.defaultSize.h,
        filters: def.supportsPeriod ? { days: def.defaultDays ?? 7 } : {},
      },
    ]);
    setLibraryOpen(false);
    toast.success(`${def.title} ajouté`);
  };

  const onLayoutChange = (layout: any[]) => {
    if (!editing) return;
    setItems((prev) =>
      prev.map((it) => {
        const l = layout.find((x) => x.i === it.i);
        return l ? { ...it, x: l.x, y: l.y, w: l.w, h: l.h } : it;
      }),
    );
  };

  const configItem = items.find((it) => it.i === configId) ?? null;
  const configDef = configItem ? WIDGET_MAP.get(configItem.widgetId) : null;

  if (isLoading) return <div className="p-6 space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>;
  if (!dashboard) return <div className="p-6 text-muted-foreground">Dashboard introuvable ou inaccessible.</div>;

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/direction/dashboards")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl md:text-2xl font-bold truncate">{meta.name}</h1>
          {meta.description && <p className="text-sm text-muted-foreground truncate">{meta.description}</p>}
        </div>
        <Badge variant="outline" className="gap-1">
          <RefreshCw className="h-3 w-3" />
          {REFRESH_OPTIONS.find((o) => o.v === meta.refresh_seconds)?.l ?? "Manuel"}
        </Badge>
        {isOwner && (
          <>
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="h-4 w-4 mr-1" /> Réglages
            </Button>
            {editing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setLibraryOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Widget
                </Button>
                <Button size="sm" disabled={save.isPending}
                  onClick={() => save.mutate({ layout: items as any }, { onSuccess: () => setEditing(false) })}>
                  <Save className="h-4 w-4 mr-1" /> Enregistrer
                </Button>
              </>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                <LayoutGrid className="h-4 w-4 mr-1" /> Composer
              </Button>
            )}
          </>
        )}
      </div>

      {visibleItems.length === 0 ? (
        <Card><CardContent className="py-12 text-center space-y-3">
          <LayoutGrid className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Aucun widget. Ajoutez des indicateurs depuis la bibliothèque.</p>
          {isOwner && (
            <Button onClick={() => { setEditing(true); setLibraryOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Ajouter un widget
            </Button>
          )}
        </CardContent></Card>
      ) : (
        <ResponsiveGrid
          className="layout"
          layouts={{ lg: visibleItems.map(({ i, x, y, w, h }) => ({ i, x, y, w, h, minW: 2, minH: 3 })) }}
          breakpoints={{ lg: 1200, md: 900, sm: 640, xs: 0 }}
          cols={{ lg: 12, md: 8, sm: 4, xs: 2 }}
          rowHeight={30}
          margin={[12, 12]}
          dragConfig={{ enabled: editing, handle: ".drag-handle" }}
          resizeConfig={{ enabled: editing }}
          onLayoutChange={onLayoutChange}
        >
          {visibleItems.map((it) => (
            <div key={it.i}>
              <DirectionWidget
                item={it}
                refreshSeconds={meta.refresh_seconds}
                editing={editing}
                onConfigure={() => setConfigId(it.i)}
                onRemove={() => setItems((prev) => prev.filter((x) => x.i !== it.i))}
              />
            </div>
          ))}
        </ResponsiveGrid>
      )}

      {/* Bibliothèque de composants */}
      <ResponsiveDialog
        open={libraryOpen} onOpenChange={setLibraryOpen}
        title="Bibliothèque de widgets"
        description="Indicateurs, graphiques et états disponibles selon vos droits."
        className="max-w-2xl"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8 h-11" placeholder="Rechercher un widget…" value={librarySearch} onChange={(e) => setLibrarySearch(e.target.value)} />
          </div>
          <div className="max-h-[60vh] overflow-auto space-y-4">
            {WIDGET_CATEGORIES.map((cat) => {
              const list = filteredLibrary.filter((w) => w.category === cat);
              if (list.length === 0) return null;
              return (
                <div key={cat} className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cat}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {list.map((w) => (
                      <button key={w.id} type="button" onClick={() => addWidget(w.id)}
                        className="text-left rounded-md border p-2.5 hover:bg-accent/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate flex-1">{w.title}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {w.kind === "kpi" ? "KPI" : w.kind === "table" ? "Tableau" : w.chart === "pie" ? "Camembert" : w.chart === "line" ? "Courbe" : "Barres"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{w.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {filteredLibrary.length === 0 && (
              <p className="text-sm text-muted-foreground p-3">Aucun widget accessible avec vos droits.</p>
            )}
          </div>
        </div>
      </ResponsiveDialog>

      {/* Configuration d'un widget */}
      <ResponsiveDialog
        open={!!configItem} onOpenChange={(o) => !o && setConfigId(null)}
        title="Configurer le widget" description={configDef?.title ?? ""}
      >
        {configItem && configDef && (
          <div className="space-y-3">
            <div>
              <Label>Titre affiché</Label>
              <Input className="h-11" value={configItem.title ?? ""} placeholder={configDef.title}
                onChange={(e) => setItems((prev) => prev.map((x) => x.i === configItem.i ? { ...x, title: e.target.value } : x))} />
            </div>
            {configDef.supportsPeriod && (
              <div>
                <Label>Période (jours)</Label>
                <Select value={String(configItem.filters?.days ?? configDef.defaultDays ?? 7)}
                  onValueChange={(v) => setItems((prev) => prev.map((x) => x.i === configItem.i ? { ...x, filters: { ...x.filters, days: Number(v) } } : x))}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 7, 14, 30, 90, 365].map((d) => <SelectItem key={d} value={String(d)}>{d} jour(s)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {configDef.kind === "table" && (
              <div>
                <Label>Nombre de lignes</Label>
                <Select value={String(configItem.filters?.limit ?? 10)}
                  onValueChange={(v) => setItems((prev) => prev.map((x) => x.i === configItem.i ? { ...x, filters: { ...x.filters, limit: Number(v) } } : x))}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[5, 10, 20, 50].map((n) => <SelectItem key={n} value={String(n)}>{n} lignes</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button className="w-full h-11" onClick={() => setConfigId(null)}>
              <Check className="h-4 w-4 mr-1" /> Terminer
            </Button>
          </div>
        )}
      </ResponsiveDialog>

      {/* Réglages du dashboard */}
      <ResponsiveDialog open={settingsOpen} onOpenChange={setSettingsOpen} title="Réglages du dashboard">
        <div className="space-y-3">
          <div>
            <Label>Nom</Label>
            <Input className="h-11" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
          </div>
          <div>
            <Label>Description</Label>
            <Input className="h-11" value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} />
          </div>
          <div>
            <Label>Visibilité</Label>
            <Select value={meta.visibility} onValueChange={(v) => setMeta({ ...meta, visibility: v })}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Privé (moi uniquement)</SelectItem>
                <SelectItem value="public">Public (tous les utilisateurs)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Actualisation automatique</Label>
            <Select value={String(meta.refresh_seconds)} onValueChange={(v) => setMeta({ ...meta, refresh_seconds: Number(v) })}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REFRESH_OPTIONS.map((o) => <SelectItem key={o.v} value={String(o.v)}>{o.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full h-11" disabled={save.isPending}
            onClick={() => save.mutate({
              name: meta.name.trim() || "Sans titre",
              description: meta.description.trim() || null,
              visibility: meta.visibility,
              refresh_seconds: meta.refresh_seconds,
            }, { onSuccess: () => setSettingsOpen(false) })}>
            <Save className="h-4 w-4 mr-1" /> Enregistrer les réglages
          </Button>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
