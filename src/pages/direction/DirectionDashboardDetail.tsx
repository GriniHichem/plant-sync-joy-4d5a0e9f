import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Responsive as ResponsiveGrid, useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ResponsiveDialog } from "@/components/responsive/ResponsiveDialog";
import { toast } from "sonner";
import {
  ArrowLeft, Check, History, LayoutGrid, Plus, RefreshCw, Save, Settings2, Share2, Sparkles, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DirectionWidget, ACCENT_KEYS } from "@/components/direction/DirectionWidget";
import { DirectionFilterBar } from "@/components/direction/DirectionFilterBar";
import { WidgetLibraryPanel } from "@/components/direction/WidgetLibraryPanel";
import { ShareDashboardDialog } from "@/components/direction/ShareDashboardDialog";
import { WIDGETS, WIDGET_MAP, type LayoutItem } from "@/lib/direction/widgetCatalog";
import { PERIOD_OPTIONS, type DashboardFilters } from "@/lib/direction/filters";
import { DASHBOARD_TEMPLATES, buildLayout } from "@/lib/direction/templates";

const REFRESH_OPTIONS = [
  { v: 0, l: "Manuel" }, { v: 30, l: "30 s" }, { v: 60, l: "1 min" },
  { v: 300, l: "5 min" }, { v: 900, l: "15 min" },
];

const favKey = (id?: string) => `direction_fav_filters_${id ?? "x"}`;

export default function DirectionDashboardDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, roles } = useAuth();
  const { canView, canEdit } = usePermissions();
  const isMobile = useIsMobile();
  const [params] = useSearchParams();
  const { width: gridWidth, containerRef: gridRef } = useContainerWidth();

  const [editing, setEditing] = useState(params.get("edit") === "1");
  const [items, setItems] = useState<LayoutItem[]>([]);
  const [filters, setFilters] = useState<DashboardFilters>({ period: "7d" });
  const [dirty, setDirty] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [meta, setMeta] = useState({ name: "", description: "", visibility: "private", refresh_seconds: 0 });
  const [favorites, setFavorites] = useState<{ name: string; filters: DashboardFilters }[]>([]);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["direction_dashboard", id],
    enabled: !!id,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direction_dashboards" as any)
        .select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: versions = [] } = useQuery({
    queryKey: ["direction_dashboard_versions", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direction_dashboard_versions" as any)
        .select("*").eq("dashboard_id", id!).order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Chargement initial (une seule fois par dashboard) : ne pas écraser une édition en cours.
  useEffect(() => {
    if (!dashboard) return;
    setItems(Array.isArray(dashboard.layout) ? dashboard.layout : []);
    setFilters(
      dashboard.global_filters && Object.keys(dashboard.global_filters).length
        ? dashboard.global_filters
        : { period: "7d" },
    );
    setMeta({
      name: dashboard.name,
      description: dashboard.description ?? "",
      visibility: dashboard.visibility,
      refresh_seconds: dashboard.refresh_seconds ?? 0,
    });
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard?.id]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(favKey(id));
      if (raw) setFavorites(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [id]);

  // Garde-fou : prévenir la perte de configuration.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const isOwner = dashboard?.owner_id === user?.id || roles.includes("admin");

  const save = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const { error } = await supabase.from("direction_dashboards" as any).update(patch).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["direction_dashboard", id] });
      qc.invalidateQueries({ queryKey: ["direction_dashboards"] });
      toast.success("Dashboard enregistré");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveVersion = useMutation({
    mutationFn: async (name: string) => {
      const payload = { dashboard_id: id, name, layout: items as any, global_filters: filters as any };
      const { error } = await supabase
        .from("direction_dashboard_versions" as any)
        .upsert(payload, { onConflict: "dashboard_id,name" });
      if (error) throw error;
    },
    onSuccess: () => {
      setVersionName("");
      qc.invalidateQueries({ queryKey: ["direction_dashboard_versions", id] });
      toast.success("Version enregistrée");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteVersion = useMutation({
    mutationFn: async (vid: string) => {
      const { error } = await supabase.from("direction_dashboard_versions" as any).delete().eq("id", vid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["direction_dashboard_versions", id] }),
    onError: (e: any) => toast.error(e.message),
  });

  // Bibliothèque filtrée par les droits (aucune donnée hors périmètre).
  const availableWidgets = useMemo(
    () => WIDGETS.filter((w) => roles.includes("admin") || canView(w.permissionModule)),
    [canView, roles],
  );

  const visibleItems = useMemo(
    () => items.filter((it) => {
      const def = WIDGET_MAP.get(it.widgetId);
      return !!def && (roles.includes("admin") || canView(def.permissionModule));
    }),
    [items, canView, roles],
  );

  const contexts = useMemo(() => {
    const s = new Set<"line" | "product" | "supplier" | "campaign">();
    visibleItems.forEach((it) => WIDGET_MAP.get(it.widgetId)?.supportsFilters?.forEach((c) => s.add(c)));
    return [...s];
  }, [visibleItems]);

  const addWidget = useCallback((widgetId: string) => {
    const def = WIDGET_MAP.get(widgetId);
    if (!def) return;
    setItems((prev) => {
      const maxY = prev.reduce((m, it) => Math.max(m, it.y + it.h), 0);
      return [
        ...prev,
        {
          i: `${widgetId}-${Date.now().toString(36)}`,
          widgetId,
          x: 0,
          y: maxY,
          w: def.defaultSize.w,
          h: def.defaultSize.h,
          filters: {},
          style: { accent: "primary", fontScale: "md", density: "normal" },
        },
      ];
    });
    setDirty(true);
    if (isMobile) setLibraryOpen(false);
    toast.success(`${def.title} ajouté`);
  }, [isMobile]);

  const applyTemplate = (templateId: string) => {
    const tpl = DASHBOARD_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    const allowed = tpl.widgets.filter((w) => availableWidgets.some((a) => a.id === w.widgetId));
    setItems(buildLayout(allowed, (wid) => WIDGET_MAP.get(wid)?.defaultSize ?? { w: 3, h: 4 }));
    setFilters(tpl.filters);
    setDirty(true);
    setTemplatesOpen(false);
    setEditing(true);
    toast.success(`Modèle « ${tpl.name} » appliqué`);
  };

  const onLayoutChange = (layout: any[]) => {
    if (!editing) return;
    setItems((prev) => {
      let changed = false;
      const next = prev.map((it) => {
        const l = layout.find((x) => x.i === it.i);
        if (!l) return it;
        if (l.x === it.x && l.y === it.y && l.w === it.w && l.h === it.h) return it;
        changed = true;
        return { ...it, x: l.x, y: l.y, w: l.w, h: l.h };
      });
      if (changed) setDirty(true);
      return changed ? next : prev;
    });
  };

  const patchItem = (i: string, patch: Partial<LayoutItem>) => {
    setItems((prev) => prev.map((x) => (x.i === i ? { ...x, ...patch } : x)));
    setDirty(true);
  };

  const persistFavorites = (list: { name: string; filters: DashboardFilters }[]) => {
    setFavorites(list);
    try { localStorage.setItem(favKey(id), JSON.stringify(list)); } catch { /* ignore */ }
  };

  const configItem = items.find((it) => it.i === configId) ?? null;
  const configDef = configItem ? WIDGET_MAP.get(configItem.widgetId) : null;

  if (isLoading) return <div className="p-6 space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>;
  if (!dashboard) return <div className="p-6 text-muted-foreground">Dashboard introuvable ou inaccessible.</div>;

  const library = (
    <WidgetLibraryPanel widgets={availableWidgets} onAdd={addWidget} className="h-full" />
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* En-tête collant */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-3 md:px-6 py-2.5 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/direction/dashboards")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg md:text-2xl font-bold truncate">{meta.name}</h1>
            {meta.description && <p className="text-xs md:text-sm text-muted-foreground truncate">{meta.description}</p>}
          </div>
          {dirty && <Badge variant="destructive" className="text-[10px]">Non enregistré</Badge>}
          <Badge variant="outline" className="gap-1 text-[11px]">
            <RefreshCw className="h-3 w-3" />
            {REFRESH_OPTIONS.find((o) => o.v === meta.refresh_seconds)?.l ?? "Manuel"}
          </Badge>
          {isOwner && (
            <>
              <Button variant="outline" size="sm" onClick={() => setVersionsOpen(true)}>
                <History className="h-4 w-4 md:mr-1" /><span className="hidden md:inline">Versions</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                <Settings2 className="h-4 w-4 md:mr-1" /><span className="hidden md:inline">Réglages</span>
              </Button>
              {editing ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setTemplatesOpen(true)}>
                    <Sparkles className="h-4 w-4 md:mr-1" /><span className="hidden md:inline">Modèles</span>
                  </Button>
                  {isMobile && (
                    <Button variant="outline" size="sm" onClick={() => setLibraryOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" /> Widget
                    </Button>
                  )}
                  <Button size="sm" disabled={save.isPending}
                    onClick={() => save.mutate(
                      { layout: items as any, global_filters: filters as any },
                      { onSuccess: () => setEditing(false) },
                    )}>
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

        <DirectionFilterBar
          value={filters}
          onChange={(f) => { setFilters(f); setDirty(true); }}
          contexts={contexts.length ? contexts : ["line", "product", "supplier", "campaign"]}
          favorites={favorites}
          onApplyFavorite={(f) => { setFilters(f); setDirty(true); }}
          onSaveFavorite={() => {
            const name = window.prompt("Nom du filtre favori ?");
            if (!name?.trim()) return;
            persistFavorites([...favorites.filter((f) => f.name !== name.trim()), { name: name.trim(), filters }]);
            toast.success("Filtre favori enregistré");
          }}
          onDeleteFavorite={(name) => persistFavorites(favorites.filter((f) => f.name !== name))}
        />
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Panneau latéral des composants (desktop, mode composition) */}
        {editing && !isMobile && (
          <aside className="w-72 shrink-0 border-r bg-muted/20 flex flex-col min-h-0">
            <div className="px-3 py-2 border-b">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Composants</p>
            </div>
            {library}
          </aside>
        )}

        <div className="flex-1 min-w-0 overflow-auto p-3 md:p-5">
          {visibleItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center space-y-3">
                <LayoutGrid className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Aucun widget. Partez d'un modèle prédéfini ou ajoutez vos indicateurs.
                </p>
                {isOwner && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Button onClick={() => setTemplatesOpen(true)}><Sparkles className="h-4 w-4 mr-1" /> Choisir un modèle</Button>
                    <Button variant="outline" onClick={() => { setEditing(true); if (isMobile) setLibraryOpen(true); }}>
                      <Plus className="h-4 w-4 mr-1" /> Ajouter un widget
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div ref={gridRef as any}>
              <ResponsiveGrid
                width={gridWidth}
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
                      globalFilters={filters}
                      refreshSeconds={meta.refresh_seconds}
                      editing={editing}
                      onConfigure={() => setConfigId(it.i)}
                      onRemove={() => { setItems((prev) => prev.filter((x) => x.i !== it.i)); setDirty(true); }}
                    />
                  </div>
                ))}
              </ResponsiveGrid>
            </div>
          )}
        </div>
      </div>

      {/* Bibliothèque mobile */}
      <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}>
        <SheetContent side="bottom" className="h-[80vh] p-0 flex flex-col">
          <SheetHeader className="p-3 pb-0"><SheetTitle>Bibliothèque de composants</SheetTitle></SheetHeader>
          {library}
        </SheetContent>
      </Sheet>

      {/* Modèles prédéfinis */}
      <ResponsiveDialog
        open={templatesOpen} onOpenChange={setTemplatesOpen}
        title="Modèles de tableaux de bord"
        description="Le modèle remplace la composition actuelle (enregistrez une version avant si besoin)."
        className="max-w-2xl"
      >
        <div className="grid gap-2 sm:grid-cols-2 max-h-[65vh] overflow-auto">
          {DASHBOARD_TEMPLATES.map((t) => (
            <button key={t.id} type="button" onClick={() => applyTemplate(t.id)}
              className="text-left rounded-md border p-3 hover:bg-accent/60 hover:border-primary/40 transition-colors">
              <p className="text-sm font-semibold">{t.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
              <Badge variant="outline" className="mt-2 text-[10px]">{t.widgets.length} widget(s)</Badge>
            </button>
          ))}
        </div>
      </ResponsiveDialog>

      {/* Versions */}
      <ResponsiveDialog open={versionsOpen} onOpenChange={setVersionsOpen} title="Versions du dashboard"
        description="Enregistrez plusieurs compositions (Hebdo, Mensuelle…) et rechargez-les à la demande.">
        <div className="space-y-3">
          {isOwner && (
            <div className="flex gap-2">
              <Input className="h-11" placeholder="Nom de la version (ex : Hebdo)" value={versionName}
                onChange={(e) => setVersionName(e.target.value)} />
              <Button className="h-11" disabled={!versionName.trim() || saveVersion.isPending}
                onClick={() => saveVersion.mutate(versionName.trim())}>
                <Save className="h-4 w-4 mr-1" /> Créer
              </Button>
            </div>
          )}
          <Separator />
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune version enregistrée.</p>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-auto">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center gap-2 rounded-md border p-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{v.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {Array.isArray(v.layout) ? v.layout.length : 0} widget(s) · {new Date(v.updated_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => {
                    setItems(Array.isArray(v.layout) ? v.layout : []);
                    setFilters(v.global_filters ?? { period: "7d" });
                    setDirty(true);
                    setVersionsOpen(false);
                    toast.success(`Version « ${v.name} » chargée`);
                  }}>Charger</Button>
                  {isOwner && (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteVersion.mutate(v.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </ResponsiveDialog>

      {/* Configuration d'un widget */}
      <ResponsiveDialog
        open={!!configItem} onOpenChange={(o) => !o && setConfigId(null)}
        title="Configurer le widget" description={configDef?.title ?? ""}
      >
        {configItem && configDef && (
          <div className="space-y-3 max-h-[70vh] overflow-auto pr-1">
            <div>
              <Label>Titre affiché</Label>
              <Input className="h-11" value={configItem.title ?? ""} placeholder={configDef.title}
                onChange={(e) => patchItem(configItem.i, { title: e.target.value })} />
            </div>

            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="cursor-pointer">Suivre les filtres globaux</Label>
                <p className="text-[11px] text-muted-foreground">Désactivez pour un filtre local à ce widget.</p>
              </div>
              <Switch
                checked={configItem.filters?.useGlobal !== false}
                onCheckedChange={(c) =>
                  patchItem(configItem.i, { filters: { ...configItem.filters, useGlobal: c ? undefined : false } })
                }
              />
            </div>

            {configDef.supportsPeriod && (
              <div>
                <Label>Période {configItem.filters?.useGlobal === false ? "(locale)" : "(surcharge)"}</Label>
                <Select
                  value={configItem.filters?.period ?? "__global__"}
                  onValueChange={(v) =>
                    patchItem(configItem.i, {
                      filters: { ...configItem.filters, period: v === "__global__" ? undefined : (v as any) },
                    })
                  }
                >
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__global__">Comme le dashboard</SelectItem>
                    {PERIOD_OPTIONS.filter((p) => p.key !== "custom").map((p) => (
                      <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {configDef.supportsCompare && (
              <div className="flex items-center justify-between">
                <Label className="cursor-pointer">Comparer à la période précédente</Label>
                <Switch
                  checked={configItem.filters?.compare ?? false}
                  onCheckedChange={(c) => patchItem(configItem.i, { filters: { ...configItem.filters, compare: c || undefined } })}
                />
              </div>
            )}

            {configDef.kind === "table" && (
              <div>
                <Label>Nombre de lignes</Label>
                <Select value={String(configItem.filters?.limit ?? 10)}
                  onValueChange={(v) => patchItem(configItem.i, { filters: { ...configItem.filters, limit: Number(v) } })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[5, 10, 20, 50].map((n) => <SelectItem key={n} value={String(n)}>{n} lignes</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator />
            <div>
              <Label>Couleur d'accent</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {ACCENT_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => patchItem(configItem.i, { style: { ...configItem.style, accent: k } })}
                    className={cn(
                      "h-9 w-9 rounded-md border-2 transition-transform",
                      (configItem.style?.accent ?? "primary") === k ? "border-foreground scale-105" : "border-transparent",
                    )}
                    style={{
                      background:
                        k === "primary" ? "hsl(var(--primary))"
                        : k === "blue" ? "hsl(217 91% 55%)"
                        : k === "emerald" ? "hsl(160 84% 34%)"
                        : k === "amber" ? "hsl(38 92% 48%)"
                        : k === "violet" ? "hsl(263 70% 58%)"
                        : k === "rose" ? "hsl(348 83% 55%)"
                        : "hsl(190 90% 40%)",
                    }}
                    aria-label={k}
                  />
                ))}
              </div>
            </div>

            {configDef.kind === "kpi" && (
              <div>
                <Label>Taille du chiffre</Label>
                <Select value={configItem.style?.fontScale ?? "md"}
                  onValueChange={(v) => patchItem(configItem.i, { style: { ...configItem.style, fontScale: v as any } })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sm">Compacte</SelectItem>
                    <SelectItem value="md">Normale</SelectItem>
                    <SelectItem value="lg">Grande</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Densité</Label>
              <Select value={configItem.style?.density ?? "normal"}
                onValueChange={(v) => patchItem(configItem.i, { style: { ...configItem.style, density: v as any } })}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normale</SelectItem>
                  <SelectItem value="compact">Compacte</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
