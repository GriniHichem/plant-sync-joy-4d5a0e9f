import { KpiCard } from "@/components/gmao/KpiCard";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardCheck, AlertTriangle, Hourglass, AlarmClock, Lock, Percent, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const kpis = [
  { title: "OF contrôlés", value: 0, icon: ClipboardCheck },
  { title: "Non-conformités ouvertes", value: 0, icon: AlertTriangle },
  { title: "Contrôles en attente", value: 0, icon: Hourglass },
  { title: "Actions qualité en retard", value: 0, icon: AlarmClock },
  { title: "Lots bloqués", value: 0, icon: Lock },
  { title: "Taux conformité", value: "—", icon: Percent },
];

const shortcuts = [
  { title: "Historique des contrôles", description: "Consulter les contrôles réalisés", url: "/qualite/controles" },
  { title: "Voir les non-conformités", description: "Suivre les NC ouvertes et bloquantes", url: "/qualite/non-conformites" },
];

export default function QualiteDashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Qualité &amp; Traçabilité</h1>
        <p className="text-muted-foreground">Tableau de bord des indicateurs qualité (données provisoires)</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((k) => (
          <KpiCard
            key={k.title}
            title={k.title}
            value={k.value}
            subtitle="Données provisoires"
            icon={k.icon}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {shortcuts.map((s) => (
          <Card
            key={s.url}
            className="cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => navigate(s.url)}
          >
            <CardContent className="p-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
