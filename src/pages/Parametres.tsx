import { Card, CardContent } from "@/components/ui/card";
import { Users, FolderTree, AlertTriangle, Wrench, ShieldCheck, Clock, Factory, Package, ImageIcon, FileText, Lock, Cog, Shield, Settings2, Database, Bell, Mail, CheckSquare, ScanLine, Upload, Plug } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface Section {
  title: string;
  description: string;
  icon: React.ElementType;
  url: string;
  /** Carte visible uniquement par le rôle Administrateur. */
  adminOnly?: boolean;
}

interface SectionGroup {
  label: string;
  icon: React.ElementType;
  items: Section[];
}


const groups: SectionGroup[] = [
  {
    label: "Référentiels & Classification",
    icon: Database,
    items: [
      { title: "Familles machines", description: "Catégories et sous-familles", icon: FolderTree, url: "/parametres/familles" },
      { title: "Familles produits", description: "Catégories de produits et articles", icon: Package, url: "/parametres/familles-produits" },
      { title: "Familles PDR", description: "Familles de pièces de rechange", icon: Cog, url: "/parametres/familles-pdr" },
      { title: "Types de panne", description: "Référentiel des types de panne", icon: AlertTriangle, url: "/parametres/pannes" },
      { title: "Catégories documents", description: "Types de documents (fiche technique, certificat…)", icon: FileText, url: "/parametres/document-categories" },
    ],
  },
  {
    label: "Production & Organisation",
    icon: Factory,
    items: [
      { title: "Lignes de production", description: "Gérer les lignes et ateliers", icon: Factory, url: "/parametres/lignes" },
      { title: "Shifts & Rotations", description: "Équipes, membres, autorisations, modèles, plannings, systèmes & règles", icon: Clock, url: "/parametres/shifts" },
    ],
  },
  {
    label: "Qualité & Traçabilité",
    icon: CheckSquare,
    items: [
      { title: "Paramétrage Qualité", description: "Catégories NC, types de défauts, unités, points de contrôle, motifs de décision…", icon: CheckSquare, url: "/parametres/qualite" },
    ],
  },
  {
    label: "Configuration générale",
    icon: Settings2,
    items: [
      { title: "Importation de données", description: "Importer machines, équipements, organes et PDR via CSV", icon: Upload, url: "/parametres/import" },
      { title: "Photos & Images", description: "Taille max des photos par entité", icon: ImageIcon, url: "/parametres/images" },
      { title: "SMTP & Emails", description: "Serveur SMTP, test, rappels d'échéance", icon: Mail, url: "/parametres/smtp" },
      { title: "Historique des scans", description: "Tous les scans QR / code-barres (succès, ambigus, échecs)", icon: ScanLine, url: "/parametres/scan-history" },
      { title: "API ERP", description: "Synchronisation ERP : activation, rôles autorisés, supervision et tests", icon: Plug, url: "/parametres/erp-sync", adminOnly: true },
      { title: "Général", description: "Paramètres de l'application", icon: Wrench, url: "/parametres/general" },
    ],
  },
];

export default function Parametres() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.adminOnly || isAdmin) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground">Administration et référentiels</p>
      </div>

      {visibleGroups.map((group) => (
        <div key={group.label} className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            <group.icon className="h-4 w-4" />
            {group.label}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {group.items.map((s) => (
              <Card
                key={s.title}
                className="cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => navigate(s.url)}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <s.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-medium">{s.title}</p>
                    <p className="text-sm text-muted-foreground">{s.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
