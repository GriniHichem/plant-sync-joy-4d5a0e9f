import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Copy,
  GripVertical,
  LayoutTemplate,
  Maximize2,
  Minimize2,
  MoreVertical,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Sliders,
  Trash2,
  Pencil,
  History,
  Share2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { WidgetCard } from "@/components/direction/WidgetCard";
import { WidgetLibrary, WidgetLibraryPanel } from "@/components/direction/WidgetLibrary";
import { WidgetSettingsDialog } from "@/components/direction/WidgetSettingsDialog";
import { DashboardFilters } from "@/components/direction/DashboardFilters";
import { useDashboardFilterOptions } from "@/hooks/useDashboardFilterOptions";
import {
  DashboardConfig,
  DashboardWidget,
  REFRESH_OPTIONS,
  SavedFilter,
  WIDGETS_BY_ID,
  WidgetDef,
  resolvePeriod,
} from "@/lib/directionWidgets";
import { DASHBOARD_TEMPLATES } from "@/lib/directionTemplates";
import {
  useDashboardMutations,
  useDirectionDashboard,
} from "@/hooks/useDirectionDashboards";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { DashboardShareDialog } from "@/components/direction/DashboardShareDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const ROLE_OPTIONS = [
  "admin",
  "resp_maintenance",
  "resp_production",
  "directeur_qualite",
  "responsable_controle_qualite",
  "responsable_magasin",
  "responsable_inventaire",
  "bureau_methode",
  "responsable_si",
];

const SPAN: Record<DashboardWidget["w"], string> = {
  1: "lg:col-span-1",
  2: "sm:col-span-2 lg:col-span-2",
  3: "sm:col-span-2 lg:col-span-3",
  4: "sm:col-span-2 lg:col-span-4",
};

const COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const draftKey = (id: string) => `direction_dashboard_draft_${id}`;

export default function DirectionDashboardDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, roles } = useAuth();
  const isMobile = useIsMobile();
  const { data: dashboard, isLoading } = useDirectionDashboard(id);
  const { update } = useDashboardMutations();
  const { canEdit: canEditModule } = usePermissions();
  const [shareOpen, setShareOpen] = useState(false);

  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [designMode, setDesignMode] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [meta, setMeta] = useState({
    name: "",
    description: "",
    visibility: "private" as "private" | "roles" | "public",
    allowed_roles: [] as string[],
  });
  const dragUid = useRef<string | null>(null);

  /* ------------------------------------------------- chargement + brouillon */
  useEffect(() => {
    if (!dashboard) return;
    let layout = dashboard.layout;
    let restored = false;
    try {
      const raw = localStorage.getItem(draftKey(dashboard.id));
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft?.updatedAt && draft.updatedAt > dashboard.updated_at) {
          layout = draft.layout;
          restored = true;
        } else {
          localStorage.removeItem(draftKey(dashboard.id));
        }
      }
    } catch {
      /* brouillon illisible : ignoré */
    }
    setConfig(layout);
    setMeta({
      name: dashboard.name,
      description: dashboard.description ?? "",
      visibility: dashboard.visibility,
      allowed_roles: dashboard.allowed_roles,
    });
    setDirty(restored);
    if (restored) toast.info("Modifications non enregistrées restaurées");
  }, [dashboard?.id, dashboard?.updated_at]);

  /* --------------------------------------- persistance locale anti-perte */
  useEffect(() => {
    if (!dashboard || !config || !dirty) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey(dashboard.id),
          JSON.stringify({ layout: config, updatedAt: new Date().toISOString() }),
        );
      } catch {
        /* quota dépassé : sans conséquence */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [config, dirty, dashboard?.id]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const isAdmin = roles.includes("admin");
  const isOwner = !!dashboard && dashboard.owner_id === user?.id;
  // Lecture seule pour les dashboards partagés : seuls le propriétaire (avec le
  // droit "Modifier" sur le module) et les administrateurs peuvent composer.
  const canEdit = !!dashboard && ((isOwner && canEditModule("direction")) || isAdmin);
  const canShare = isOwner || isAdmin;

  const patch = useCallback((fn: (c: DashboardConfig) => DashboardConfig) => {
    setConfig((c) => (c ? fn(c) : c));
    setDirty(true);
  }, []);

  const period = useMemo(
    () =>
      config
        ? resolvePeriod(config.period, config.customFrom, config.customTo)
        : resolvePeriod("month"),
    [config?.period, config?.customFrom, config?.customTo],
  );
  const { data: filterOptions } = useDashboardFilterOptions(period);

  const addWidget = (def: WidgetDef) => {
    patch((c) => ({
      ...c,
      widgets: [
        ...c.widgets,
        {
          uid: uid(def.id),
          widgetId: def.id,
          w: def.kind === "kpi" ? 1 : 2,
          h: def.kind === "kpi" ? "sm" : def.kind === "table" ? "lg" : "md",
          period: null,
          filters: {},
          useGlobalFilters: true,
          compare: def.kind === "kpi",
          align: "left",
          emphasis: "normal",
        },
      ],
    }));
    toast.success(`« ${def.title} » ajouté`);
  };

  const updateWidget = (u: string, p: Partial<DashboardWidget>) =>
    patch((c) => ({
      ...c,
      widgets: c.widgets.map((w) => (w.uid === u ? { ...w, ...p } : w)),
    }));

  const removeWidget = (u: string) =>
    patch((c) => ({ ...c, widgets: c.widgets.filter((w) => w.uid !== u) }));

  const duplicateWidget = (u: string) =>
    patch((c) => {
      const i = c.widgets.findIndex((w) => w.uid === u);
      if (i < 0) return c;
      const copy = { ...c.widgets[i], uid: uid(c.widgets[i].widgetId) };
      const arr = [...c.widgets];
      arr.splice(i + 1, 0, copy);
      return { ...c, widgets: arr };
    });

  const moveWidget = (from: string, to: string) => {
    if (from === to) return;
    patch((c) => {
      const arr = [...c.widgets];
      const fi = arr.findIndex((w) => w.uid === from);
      const ti = arr.findIndex((w) => w.uid === to);
      if (fi < 0 || ti < 0) return c;
      const [item] = arr.splice(fi, 1);
      arr.splice(ti, 0, item);
      return { ...c, widgets: arr };
    });
  };

  const moveBy = (u: string, delta: number) =>
    patch((c) => {
      const arr = [...c.widgets];
      const i = arr.findIndex((w) => w.uid === u);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= arr.length) return c;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...c, widgets: arr };
    });

  const applyTemplate = (tplId: string) => {
    const tpl = DASHBOARD_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    patch((c) => ({
      ...c,
      period: tpl.period,
      columns: tpl.columns,
      widgets: tpl.widgets.map((w) => ({ ...w, uid: uid(w.widgetId) })),
    }));
    setTplOpen(false);
    setDesignMode(true);
    toast.success(`Modèle « ${tpl.name} » appliqué`);
  };

  /* ------------------------------------------------------------- versions */
  const saveVersion = () => {
    if (!config) return;
    const name = window.prompt("Nom de la version (ex : Hebdo, Mensuel)");
    if (!name?.trim()) return;
    patch((c) => ({
      ...c,
      versions: [
        ...c.versions.filter((v) => v.name !== name.trim()),
        {
          id: uid("v"),
          name: name.trim(),
          widgets: c.widgets,
          updatedAt: new Date().toISOString(),
        },
      ],
    }));
    toast.success("Version enregistrée (pensez à sauvegarder)");
  };

  const loadVersion = (vid: string) =>
    patch((c) => {
      const v = c.versions.find((x) => x.id === vid);
      if (!v) return c;
      toast.success(`Version « ${v.name} » chargée`);
      return { ...c, widgets: v.widgets.map((w) => ({ ...w })) };
    });

  const deleteVersion = (vid: string) =>
    patch((c) => ({ ...c, versions: c.versions.filter((v) => v.id !== vid) }));

  /* -------------------------------------------------------------- favoris */
  const saveFavorite = () => {
    if (!config) return;
    const name = window.prompt("Nom du filtre favori");
    if (!name?.trim()) return;
    const fav: SavedFilter = {
      id: uid("f"),
      name: name.trim(),
      period: config.period,
      customFrom: config.customFrom,
      customTo: config.customTo,
      filters: config.filters,
    };
    patch((c) => ({ ...c, savedFilters: [...c.savedFilters, fav] }));
    toast.success("Filtre favori enregistré");
  };

  const save = async () => {
    if (!dashboard || !config) return;
    try {
      await update.mutateAsync({
        id: dashboard.id,
        name: meta.name.trim() || dashboard.name,
        description: meta.description.trim() || null,
        visibility: meta.visibility,
        allowed_roles: meta.visibility === "roles" ? meta.allowed_roles : [],
        layout: config as any,
      });
      setDirty(false);
      localStorage.removeItem(draftKey(dashboard.id));
      toast.success("Dashboard enregistré");
    } catch (e: any) {
      toast.error(e.message ?? "Enregistrement impossible");
    }
  };

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["direction_widget"] });
    toast.success("Données actualisées");
  };

  const grid = config?.widgets ?? [];

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  }
  if (!dashboard) {
    return (
      <div className="space-y-3 p-6">
        <div className="rounded-lg border border-dashed p-5">
          <p className="font-medium">Dashboard inaccessible</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ce dashboard n'existe plus ou votre accès a été retiré. Choisissez un autre dashboard disponible.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/direction/mes-dashboards")}>
              Mes Dashboards
            </Button>
            <Button variant="outline" onClick={() => navigate("/")}>Accueil</Button>
          </div>
        </div>
      </div>
    );
  }
  if (!config) {
    return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  }

  const library = <WidgetLibraryPanel onAdd={addWidget} />;

  return (
    <div className="space-y-3 p-3 md:p-6">
      {canShare && id && (
        <DashboardShareDialog dashboardId={id} open={shareOpen} onOpenChange={setShareOpen} />
      )}
      {/* -------------------------------------------------------- en-tête */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/direction/dashboards")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold md:text-xl">{meta.name}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {meta.description || "Reporting en lecture seule"}
            {dirty && " · modifications non enregistrées"}
          </p>
        </div>

        <Select
          value={String(config.refreshSeconds)}
          onValueChange={(v) => patch((c) => ({ ...c, refreshSeconds: Number(v) }))}
        >
          <SelectTrigger className="h-9 w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            {REFRESH_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={String(o.value)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon" onClick={refreshAll} title="Actualiser">
          <RefreshCw className="h-4 w-4" />
        </Button>

        {canShare && (
          <Button variant="outline" size="icon" onClick={() => setShareOpen(true)} title="Partager">
            <Share2 className="h-4 w-4" />
          </Button>
        )}

        {canEdit && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" title="Versions">
                  <History className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover">
                <DropdownMenuLabel className="text-xs">Versions du dashboard</DropdownMenuLabel>
                <DropdownMenuItem onClick={saveVersion}>
                  <Save className="mr-2 h-4 w-4" /> Enregistrer la version courante
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {!config.versions.length && (
                  <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
                    Aucune version
                  </DropdownMenuLabel>
                )}
                {config.versions.map((v) => (
                  <DropdownMenuItem key={v.id} onClick={() => loadVersion(v.id)}>
                    <span className="flex-1 truncate">{v.name}</span>
                    <button
                      className="ml-2 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteVersion(v.id);
                      }}
                      aria-label={`Supprimer la version ${v.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="icon" onClick={() => setTplOpen(true)} title="Modèles">
              <LayoutTemplate className="h-4 w-4" />
            </Button>
            <Button
              variant={designMode ? "default" : "outline"}
              onClick={() => setDesignMode((v) => !v)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {designMode ? "Terminer" : "Composer"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              title="Paramètres"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button onClick={save} disabled={!dirty || update.isPending}>
              <Save className="mr-2 h-4 w-4" /> Enregistrer
            </Button>
          </>
        )}
      </div>

      {/* -------------------------------------------------------- filtres */}
      <DashboardFilters
        period={config.period}
        customFrom={config.customFrom}
        customTo={config.customTo}
        filters={config.filters}
        compare={config.compare}
        options={filterOptions}
        savedFilters={config.savedFilters}
        onChange={(p) => patch((c) => ({ ...c, ...p }))}
        onSaveFavorite={canEdit ? saveFavorite : undefined}
        onApplyFavorite={(f) =>
          patch((c) => ({
            ...c,
            period: f.period,
            customFrom: f.customFrom ?? null,
            customTo: f.customTo ?? null,
            filters: f.filters,
          }))
        }
        onRemoveFavorite={
          canEdit
            ? (fid) => patch((c) => ({ ...c, savedFilters: c.savedFilters.filter((f) => f.id !== fid) }))
            : undefined
        }
      />

      {/* --------------------------------------------- barre mode composer */}
      {designMode && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-2.5">
          {isMobile ? (
            <Sheet open={libOpen} onOpenChange={setLibOpen}>
              <SheetTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Composants
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[85vh] overflow-hidden">
                <SheetHeader>
                  <SheetTitle>Bibliothèque</SheetTitle>
                </SheetHeader>
                <div className="mt-3 h-[calc(85vh-5rem)] overflow-auto">
                  <WidgetLibraryPanel onAdd={addWidget} />
                </div>
              </SheetContent>
            </Sheet>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setLibOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Ajouter (recherche plein écran)
            </Button>
          )}

          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">Colonnes</Label>
            <Select
              value={String(config.columns)}
              onValueChange={(v) => patch((c) => ({ ...c, columns: Number(v) as any }))}
            >
              <SelectTrigger className="h-8 w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {[1, 2, 3, 4].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-muted-foreground">
            Glissez-déposez les cartes pour les réorganiser · utilisez le menu de chaque widget pour la
            taille, les couleurs et les filtres locaux.
          </span>
        </div>
      )}

      {/* -------------------------------------------------- grille + panneau */}
      <div className={cn("gap-3", designMode && !isMobile ? "lg:flex lg:items-start" : "")}>
        {designMode && !isMobile && (
          <aside className="mb-3 w-[320px] shrink-0 lg:mb-0">{library}</aside>
        )}

        <div className="min-w-0 flex-1">
          {!grid.length ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <LayoutTemplate className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Ce dashboard est vide. Partez d'un modèle prédéfini ou composez le vôtre.
                </p>
                {canEdit && (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={() => setTplOpen(true)}>
                      <LayoutTemplate className="mr-2 h-4 w-4" /> Choisir un modèle
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDesignMode(true);
                        if (isMobile) setLibOpen(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Composer
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", COLS[config.columns])}>
              {grid.map((item) => {
                const def = WIDGETS_BY_ID.get(item.widgetId);
                return (
                  <div
                    key={item.uid}
                    className={cn(
                      SPAN[item.w],
                      designMode && "rounded-lg ring-1 ring-primary/30",
                    )}
                    draggable={designMode}
                    onDragStart={() => (dragUid.current = item.uid)}
                    onDragEnd={() => (dragUid.current = null)}
                    onDragOver={(e) => {
                      if (designMode) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragUid.current) moveWidget(dragUid.current, item.uid);
                      dragUid.current = null;
                    }}
                  >
                    <WidgetCard
                      item={item}
                      globalPeriod={period}
                      globalFilters={config.filters}
                      globalCompare={config.compare}
                      refreshSeconds={config.refreshSeconds}
                      toolbar={
                        designMode ? (
                          <div className="flex shrink-0 items-center gap-0.5">
                            <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Réduire la largeur"
                              onClick={() =>
                                updateWidget(item.uid, {
                                  w: Math.max(1, item.w - 1) as DashboardWidget["w"],
                                })
                              }
                            >
                              <Minimize2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Élargir"
                              onClick={() =>
                                updateWidget(item.uid, {
                                  w: Math.min(4, item.w + 1) as DashboardWidget["w"],
                                })
                              }
                            >
                              <Maximize2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Personnaliser"
                              onClick={() => setEditing(item.uid)}
                            >
                              <Sliders className="h-3.5 w-3.5" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52 bg-popover">
                                <DropdownMenuLabel className="truncate text-xs">
                                  {def?.title ?? item.widgetId}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => moveBy(item.uid, -1)}>
                                  Déplacer avant
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => moveBy(item.uid, 1)}>
                                  Déplacer après
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => duplicateWidget(item.uid)}>
                                  <Copy className="mr-2 h-4 w-4" /> Dupliquer
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                                  Hauteur
                                </DropdownMenuLabel>
                                {(["sm", "md", "lg"] as const).map((h) => (
                                  <DropdownMenuItem
                                    key={h}
                                    onClick={() => updateWidget(item.uid, { h })}
                                  >
                                    {h === "sm" ? "Compacte" : h === "md" ? "Moyenne" : "Grande"}{" "}
                                    {item.h === h && "✓"}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => removeWidget(item.uid)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Retirer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ) : undefined
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <WidgetLibrary open={libOpen && !isMobile} onOpenChange={setLibOpen} onAdd={addWidget} />

      <WidgetSettingsDialog
        item={grid.find((w) => w.uid === editing) ?? null}
        options={filterOptions}
        onOpenChange={(v) => !v && setEditing(null)}
        onChange={updateWidget}
      />

      {/* -------------------------------------------------------- modèles */}
      <Dialog open={tplOpen} onOpenChange={setTplOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-auto">
          <DialogHeader>
            <DialogTitle>Modèles prédéfinis</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            {DASHBOARD_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t.id)}
                className="rounded-lg border p-3 text-left transition-colors hover:border-primary hover:bg-accent"
              >
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.description}</p>
                <Badge variant="secondary" className="mt-2 text-[10px]">
                  {t.widgets.length} composants
                </Badge>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Appliquer un modèle remplace la composition actuelle (les données métier ne sont jamais
            modifiées).
          </p>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------------- paramètres */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Paramètres du dashboard</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input
                value={meta.name}
                onChange={(e) => {
                  setMeta({ ...meta, name: e.target.value });
                  setDirty(true);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={meta.description}
                onChange={(e) => {
                  setMeta({ ...meta, description: e.target.value });
                  setDirty(true);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Visibilité</Label>
              <Select
                value={meta.visibility}
                onValueChange={(v: any) => {
                  setMeta({ ...meta, visibility: v });
                  setDirty(true);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="private">Privé (moi uniquement)</SelectItem>
                  <SelectItem value="roles">Partagé avec des rôles</SelectItem>
                  <SelectItem value="public">Public (tous les utilisateurs)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {meta.visibility === "roles" && (
              <div className="space-y-1.5">
                <Label>Rôles autorisés</Label>
                <div className="flex flex-wrap gap-1.5">
                  {ROLE_OPTIONS.map((r) => {
                    const on = meta.allowed_roles.includes(r);
                    return (
                      <Badge
                        key={r}
                        variant={on ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          setMeta({
                            ...meta,
                            allowed_roles: on
                              ? meta.allowed_roles.filter((x) => x !== r)
                              : [...meta.allowed_roles, r],
                          });
                          setDirty(true);
                        }}
                      >
                        {r}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Fermer
            </Button>
            <Button
              onClick={async () => {
                await save();
                setSettingsOpen(false);
              }}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
