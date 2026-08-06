import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { LayoutDashboard, Plus, Copy, Trash2, Globe, Lock, Users, Search, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  useDashboardMutations,
  useDefaultDashboardMutation,
  useDefaultDirectionDashboard,
  useDirectionDashboards,
} from "@/hooks/useDirectionDashboards";
import { toast } from "sonner";
import { DASHBOARD_TEMPLATES } from "@/lib/directionTemplates";
import { DashboardConfig, EMPTY_CONFIG } from "@/lib/directionWidgets";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VIS_META = {
  private: { label: "Privé", icon: Lock },
  roles: { label: "Rôles", icon: Users },
  public: { label: "Public", icon: Globe },
} as const;

export default function DirectionDashboards() {
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const { data: dashboards = [], isLoading } = useDirectionDashboards();
  const { data: defaultDashboard } = useDefaultDirectionDashboard();
  const { create, remove } = useDashboardMutations();
  const defaultMutation = useDefaultDashboardMutation();
  const { canCreate, canDelete } = usePermissions();
  const isAdmin = roles.includes("admin");
  const allowCreate = canCreate("direction") || isAdmin;

  const [q, setQ] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState("blank");
  const [toDelete, setToDelete] = useState<string | null>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return dashboards.filter(
      (d) => !t || d.name.toLowerCase().includes(t) || (d.description ?? "").toLowerCase().includes(t),
    );
  }, [dashboards, q]);

  const submitNew = async () => {
    if (!name.trim()) return;
    try {
      const tpl = DASHBOARD_TEMPLATES.find((t) => t.id === template);
      const layout: DashboardConfig = {
        ...EMPTY_CONFIG,
        period: tpl?.period ?? EMPTY_CONFIG.period,
        columns: tpl?.columns ?? EMPTY_CONFIG.columns,
        widgets: (tpl?.widgets ?? []).map((w, i) => ({
          ...w,
          uid: `${w.widgetId}-${Date.now().toString(36)}-${i}`,
        })),
      };
      const d = await create.mutateAsync({
        name: name.trim(),
        description: description.trim() || tpl?.description || null,
        layout,
      });
      setNewOpen(false);
      setName("");
      setDescription("");
      setTemplate("blank");
      navigate(`/direction/dashboards/${d.id}`);
    } catch (e: any) {
      toast.error(e.message ?? "Création impossible");
    }
  };

  const duplicate = async (id: string) => {
    const src = dashboards.find((d) => d.id === id);
    if (!src) return;
    try {
      const d = await create.mutateAsync({
        name: `${src.name} (copie)`,
        description: src.description,
        layout: src.layout,
        visibility: "private",
      });
      toast.success("Dashboard dupliqué");
      navigate(`/direction/dashboards/${d.id}`);
    } catch (e: any) {
      toast.error(e.message ?? "Duplication impossible");
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">Dashboard Design</h1>
          <p className="text-sm text-muted-foreground">
            Tableaux de bord personnalisables construits à partir des données de l'application (lecture seule).
          </p>
        </div>
        {allowCreate && (
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nouveau dashboard
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : !list.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <LayoutDashboard className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Aucun dashboard pour le moment. Créez votre premier tableau de bord de pilotage.
            </p>
            {allowCreate && (
              <Button onClick={() => setNewOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Créer
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((d) => {
            const Meta = VIS_META[d.visibility] ?? VIS_META.private;
            const Icon = Meta.icon;
            const mine = d.owner_id === user?.id;
            return (
              <Card
                key={d.id}
                className="cursor-pointer transition-colors hover:border-primary"
                onClick={() => navigate(`/direction/dashboards/${d.id}`)}
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{d.name}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {d.description || "—"}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 gap-1">
                      <Icon className="h-3 w-3" /> {Meta.label}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {d.layout.widgets.length} widget(s)
                    </span>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {defaultDashboard?.dashboard_id === d.id && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3 fill-current" /> Défaut
                        </Badge>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          await defaultMutation.mutateAsync(d.id);
                          toast.success("Dashboard par défaut enregistré");
                        }}
                        disabled={defaultMutation.isPending}
                        title="Définir comme dashboard par défaut"
                      >
                        <Star className={defaultDashboard?.dashboard_id === d.id ? "h-4 w-4 fill-current" : "h-4 w-4"} />
                      </Button>
                      {allowCreate && (
                        <Button size="icon" variant="ghost" onClick={() => duplicate(d.id)} title="Dupliquer">
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                      {(mine && (canDelete("direction") || isAdmin)) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setToDelete(d.id)}
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau dashboard</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Production Direction" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Pilotage global de l'activité…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Modèle de départ</Label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {DASHBOARD_TEMPLATES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {DASHBOARD_TEMPLATES.find((t) => t.id === template)?.description}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submitNew} disabled={!name.trim() || create.isPending}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce dashboard ?</AlertDialogTitle>
            <AlertDialogDescription>
              Seule la configuration du tableau de bord est supprimée. Aucune donnée métier n'est affectée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!toDelete) return;
                await remove.mutateAsync(toDelete);
                setToDelete(null);
                toast.success("Dashboard supprimé");
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
