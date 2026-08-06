import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Search, Eye, Star } from "lucide-react";
import { toast } from "sonner";
import {
  useDefaultDashboardMutation,
  useDefaultDirectionDashboard,
  useSharedDashboards,
} from "@/hooks/useDirectionDashboards";

export default function MyDashboards() {
  const navigate = useNavigate();
  const { data: dashboards = [], isLoading, error } = useSharedDashboards();
  const { data: defaultDashboard } = useDefaultDirectionDashboard();
  const defaultMutation = useDefaultDashboardMutation();
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return dashboards.filter(
      (d) => !t || d.name.toLowerCase().includes(t) || (d.description ?? "").toLowerCase().includes(t),
    );
  }, [dashboards, q]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold md:text-2xl">Mes Dashboards</h1>
        <p className="text-sm text-muted-foreground">
          Tableaux de bord partagés avec vous — consultation en lecture seule.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : error ? (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <LayoutDashboard className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Impossible de charger les dashboards partagés.</p>
            <p className="text-xs text-muted-foreground">Veuillez actualiser la page ou vérifier les accès.</p>
          </CardContent>
        </Card>
      ) : !list.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <LayoutDashboard className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucun dashboard partagé.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((d) => (
            <Card
              key={d.id}
              className="cursor-pointer transition-colors hover:border-primary"
              onClick={() => navigate(`/direction/dashboards/${d.id}`)}
            >
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{d.name}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{d.description || "—"}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 gap-1">
                    <Eye className="h-3 w-3" /> Lecture
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{d.layout.widgets.length} widget(s)</span>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {defaultDashboard?.dashboard_id === d.id && (
                      <Badge variant="secondary" className="gap-1">
                        <Star className="h-3 w-3 fill-current" /> Défaut
                      </Badge>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Définir comme dashboard par défaut"
                      disabled={defaultMutation.isPending}
                      onClick={async () => {
                        await defaultMutation.mutateAsync(d.id);
                        toast.success("Dashboard par défaut enregistré");
                      }}
                    >
                      <Star className={defaultDashboard?.dashboard_id === d.id ? "h-4 w-4 fill-current" : "h-4 w-4"} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
