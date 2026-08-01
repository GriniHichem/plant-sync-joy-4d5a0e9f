import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, LayoutDashboard, Share2, Star } from "lucide-react";
import { useDefaultDashboard, useSetDefaultDashboard } from "@/hooks/useDefaultDashboard";
import { cn } from "@/lib/utils";
import { useSharedDashboards } from "@/hooks/useSharedDashboards";

export default function SharedDashboards() {
  const navigate = useNavigate();
  const { data: dashboards = [], isLoading } = useSharedDashboards();
  const { data: defaultDashboard } = useDefaultDashboard();
  const setDefault = useSetDefaultDashboard();

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Share2 className="h-6 w-6 text-primary" /> Mes Dashboards
        </h1>
        <p className="text-sm text-muted-foreground">
          Tableaux de bord partagés avec vous — consultation seule, données filtrées selon vos droits.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : dashboards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <LayoutDashboard className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucun dashboard partagé.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {dashboards.map((d) => (
            <Card key={d.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-2">
                  <LayoutDashboard className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base truncate">{d.name}</CardTitle>
                    <CardDescription className="truncate">{d.description || "—"}</CardDescription>
                  </div>
                  {defaultDashboard?.id === d.id && (
                    <Badge className="gap-1 text-[10px] bg-amber-500 text-white hover:bg-amber-500 shrink-0">
                      <Star className="h-3 w-3 fill-current" /> Défaut
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] shrink-0">Lecture seule</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  {Array.isArray(d.layout) ? d.layout.length : 0} widget(s)
                </Badge>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="outline"
                  title={defaultDashboard?.id === d.id ? "Retirer le défaut" : "Définir comme dashboard par défaut"}
                  disabled={setDefault.isPending}
                  onClick={() => setDefault.mutate(defaultDashboard?.id === d.id ? null : d.id)}
                >
                  <Star className={cn("h-4 w-4", defaultDashboard?.id === d.id && "fill-amber-400 text-amber-500")} />
                </Button>
                <Button size="sm" onClick={() => navigate(`/dashboard-design/dashboards/${d.id}`)}>
                  <Eye className="h-4 w-4 mr-1" /> Consulter
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
