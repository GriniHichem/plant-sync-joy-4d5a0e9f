import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";
import {
  IconDashboard, IconMachine, IconEquipment, IconFactory, IconSpare,
  IconTicket, IconPreventive, IconShift, IconAnalytics, IconChart,
  IconOrder, IconProduct, IconArticle, IconRecipe, IconTimer,
  IconConsumption, IconStop, IconSettings, IconMaintenance, IconProduction,
  IconOrganes, IconJournal, IconHistory, IconKpi, IconControl,
  IconNc, IconAction, IconTrace, IconReport, IconInventory,
  IconCampaign, IconSecurity, IconValidation, IconAudit, IconBell, IconSearch,
} from "@/components/icons/IndustrialIcons";
import { usePermissions } from "@/hooks/usePermissions";


type AppModule = {
  title: string;
  description: string;
  url: string;
  icon: React.FC<{ size?: number; className?: string }>;
  category: "Maintenance" | "Stock PDR" | "Production" | "Qualité" | "Inventaire" | "Configuration";
  permissionModule?: string;
  badge?: string;
  accent: string; // tailwind gradient classes
};

const MODULES: AppModule[] = [
  // ===== Maintenance (dégradations de bleu) =====
  { title: "Dashboard maintenance", description: "Vue synthétique de l'activité maintenance", url: "/", icon: IconDashboard, category: "Maintenance", permissionModule: "dashboard", accent: "from-sky-500/15 to-sky-500/5 text-sky-500" },
  { title: "Machines", description: "Parc machines, criticité et historique", url: "/machines", icon: IconMachine, category: "Maintenance", permissionModule: "machines", accent: "from-blue-500/15 to-blue-500/5 text-blue-500" },
  { title: "Équipements", description: "Équipements autonomes rattachés aux lignes", url: "/equipements", icon: IconEquipment, category: "Maintenance", permissionModule: "equipements", accent: "from-cyan-500/15 to-cyan-500/5 text-cyan-500" },
  { title: "Organes", description: "Sous-ensembles techniques des machines/équipements", url: "/organes", icon: IconOrganes, category: "Maintenance", permissionModule: "organes", accent: "from-blue-400/15 to-blue-400/5 text-blue-400" },
  { title: "Lignes de production", description: "Synoptique interactif des lignes", url: "/lignes", icon: IconFactory, category: "Maintenance", permissionModule: "lignes", accent: "from-indigo-500/15 to-indigo-500/5 text-indigo-500" },
  { title: "Dashboard PDR", description: "Supervision temps réel du stock et du magasin", url: "/magasin/shift", icon: IconChart, category: "Stock PDR", permissionModule: "shift_magasin", accent: "from-yellow-600/15 to-yellow-600/5 text-yellow-700" },
  { title: "Pièces de rechange", description: "Catalogue PDR, stock et liens machines", url: "/pdr", icon: IconSpare, category: "Stock PDR", permissionModule: "pdr", accent: "from-yellow-500/15 to-yellow-500/5 text-yellow-600" },
  { title: "Demandes pièces", description: "File des demandes de pièces à préparer", url: "/pdr/demandes", icon: IconSpare, category: "Stock PDR", permissionModule: "pdr_demandes", accent: "from-amber-500/15 to-amber-500/5 text-amber-600" },
  { title: "Shift Magasin", description: "Espace magasinier (kiosque temps réel)", url: "/magasin/shift/live", icon: IconShift, category: "Stock PDR", permissionModule: "shift_magasin", badge: "Live", accent: "from-amber-600/15 to-amber-600/5 text-amber-700" },
  { title: "Journal Stock", description: "Historique des mouvements de stock", url: "/magasin/journal", icon: IconJournal, category: "Stock PDR", permissionModule: "journal_stock", accent: "from-yellow-400/15 to-yellow-400/5 text-yellow-500" },
  { title: "Tickets", description: "Demandes d'intervention et suivi en temps réel", url: "/tickets", icon: IconTicket, category: "Maintenance", permissionModule: "tickets", accent: "from-blue-600/15 to-blue-600/5 text-blue-600" },
  { title: "Maintenance préventive", description: "Plans, gammes et déclenchements automatiques", url: "/preventif", icon: IconPreventive, category: "Maintenance", permissionModule: "preventif", accent: "from-cyan-600/15 to-cyan-600/5 text-cyan-600" },
  { title: "Shift Maintenance", description: "Vue opérationnelle du maintenancier", url: "/maintenance/shift", icon: IconShift, category: "Maintenance", permissionModule: "shift_maintenance", badge: "Live", accent: "from-indigo-600/15 to-indigo-600/5 text-indigo-600" },
  { title: "Journal d'interventions", description: "Historique consolidé des interventions", url: "/maintenance/journal", icon: IconJournal, category: "Maintenance", permissionModule: "journal", accent: "from-slate-400/15 to-slate-400/5 text-slate-400" },
  { title: "Historique interventions", description: "Recherche et filtres avancés sur les interventions passées", url: "/maintenance/historique", icon: IconHistory, category: "Maintenance", permissionModule: "historique", accent: "from-slate-500/15 to-slate-500/5 text-slate-500" },
  { title: "Analyse & KPI", description: "Indicateurs MTTR, MTBF, disponibilité", url: "/analytics", icon: IconAnalytics, category: "Maintenance", permissionModule: "analytiques", accent: "from-blue-700/15 to-blue-700/5 text-blue-700" },

  // ===== Production (vert) =====
  { title: "Dashboard Production", description: "Vue d'ensemble GPAO", url: "/gpao", icon: IconChart, category: "Production", permissionModule: "gpao_dashboard", accent: "from-emerald-500/15 to-emerald-500/5 text-emerald-500" },
  { title: "Ordres de fabrication", description: "OF, statuts et planification", url: "/gpao/of", icon: IconOrder, category: "Production", permissionModule: "of", accent: "from-emerald-400/15 to-emerald-400/5 text-emerald-400" },
  { title: "Produits", description: "Catalogue produits finis", url: "/gpao/produits", icon: IconProduct, category: "Production", permissionModule: "produits", accent: "from-emerald-600/15 to-emerald-600/5 text-emerald-600" },
  { title: "Articles", description: "Matières premières et composants", url: "/gpao/articles", icon: IconArticle, category: "Production", permissionModule: "articles", accent: "from-green-500/15 to-green-500/5 text-green-500" },
  { title: "Recettes / BOM", description: "Nomenclatures versionnées", url: "/gpao/recettes", icon: IconRecipe, category: "Production", permissionModule: "recettes", accent: "from-emerald-700/15 to-emerald-700/5 text-emerald-700" },
  { title: "Shift Production", description: "Saisie temps réel par équipe", url: "/gpao/shift", icon: IconTimer, category: "Production", permissionModule: "shift_production", badge: "Live", accent: "from-green-600/15 to-green-600/5 text-green-600" },
  { title: "Consommations", description: "Suivi et corrections de matières", url: "/gpao/consommations", icon: IconConsumption, category: "Production", permissionModule: "consommations", accent: "from-lime-600/15 to-lime-600/5 text-lime-600" },
  { title: "Arrêts", description: "Pannes et arrêts production", url: "/gpao/arrets", icon: IconStop, category: "Production", permissionModule: "arrets", accent: "from-teal-600/15 to-teal-600/5 text-teal-600" },

  // ===== Qualité (orange) =====
  { title: "Dashboard Qualité", description: "Indicateurs et synthèse qualité", url: "/qualite", icon: IconKpi, category: "Qualité", permissionModule: "qualite_dashboard", accent: "from-orange-500/15 to-orange-500/5 text-orange-500" },
  { title: "OF Qualité", description: "Suivi qualité par ordre de fabrication", url: "/qualite/of", icon: IconControl, category: "Qualité", permissionModule: "qualite_of", accent: "from-orange-400/15 to-orange-400/5 text-orange-400" },
  { title: "Indicateurs qualité", description: "Catalogue des indicateurs et tolérances", url: "/qualite/indicateurs", icon: IconAnalytics, category: "Qualité", permissionModule: "qualite_indicateurs", accent: "from-amber-500/15 to-amber-500/5 text-amber-500" },
  { title: "Contrôles", description: "Saisie et historique des contrôles qualité", url: "/qualite/controles", icon: IconPreventive, category: "Qualité", permissionModule: "qualite_controles", accent: "from-orange-600/15 to-orange-600/5 text-orange-600" },
  { title: "Non-conformités", description: "Déclaration, décisions et lots bloqués", url: "/qualite/non-conformites", icon: IconNc, category: "Qualité", permissionModule: "qualite_nc", accent: "from-red-400/15 to-red-400/5 text-red-400" },
  { title: "Actions qualité", description: "Plans d'actions correctives et préventives", url: "/qualite/actions", icon: IconAction, category: "Qualité", permissionModule: "qualite_actions", accent: "from-amber-600/15 to-amber-600/5 text-amber-600" },
  { title: "Recettes & Nomenclatures", description: "Versions recettes et BOM côté qualité", url: "/qualite/recettes-nomenclatures", icon: IconRecipe, category: "Qualité", permissionModule: "qualite_recettes", accent: "from-yellow-600/15 to-yellow-600/5 text-yellow-600" },
  { title: "Traçabilité", description: "Fiche traçabilité complète par OF", url: "/qualite/tracabilite", icon: IconTrace, category: "Qualité", permissionModule: "qualite_tracabilite", accent: "from-orange-700/15 to-orange-700/5 text-orange-700" },
  { title: "Shift contrôle", description: "Saisie temps réel par contrôleur qualité", url: "/qualite/shift", icon: IconTimer, category: "Qualité", permissionModule: "qualite_shift", badge: "Live", accent: "from-amber-700/15 to-amber-700/5 text-amber-700" },
  { title: "Rapports qualité", description: "Conformité, NC, actions, théorique vs réel", url: "/qualite/rapports", icon: IconReport, category: "Qualité", permissionModule: "qualite_rapports", accent: "from-orange-300/15 to-orange-300/5 text-orange-300" },
  { title: "Réception F&L", description: "Tickets qualitatifs, pont-bascule et consultation globale", url: "/qualite/reception", icon: IconTrace, category: "Qualité", permissionModule: "reception", accent: "from-lime-500/15 to-lime-500/5 text-lime-600" },

  // ===== Inventaire (gris) =====
  { title: "Dashboard Inventaire", description: "Vue d'ensemble des campagnes d'inventaire", url: "/inventaire", icon: IconInventory, category: "Inventaire", permissionModule: "inventaire", accent: "from-gray-500/15 to-gray-500/5 text-gray-500" },
  { title: "Campagnes d'inventaire", description: "Double comptage A/B avec arbitrage C", url: "/inventaire/campagnes", icon: IconCampaign, category: "Inventaire", permissionModule: "inventaire_campagnes", accent: "from-gray-600/15 to-gray-600/5 text-gray-600" },
  { title: "Dashboards Direction", description: "Tableaux de bord personnalisables multi-modules", url: "/direction/dashboards", icon: IconChart, category: "Direction", permissionModule: "direction_dashboards", accent: "from-indigo-500/15 to-indigo-500/5 text-indigo-500" },

  // ===== Configuration (mauve) =====
  { title: "Dashboard audit et système", description: "Journal complet des actions, sécurité et corrections", url: "/audit", icon: IconAudit, category: "Configuration", permissionModule: "audit", accent: "from-violet-600/15 to-violet-600/5 text-violet-600" },
  { title: "Sécurité & Accès", description: "Hub centralisé : utilisateurs, rôles, permissions, audit, self-hosting", url: "/securite", icon: IconSecurity, category: "Configuration", permissionModule: "securite", accent: "from-violet-500/15 to-violet-500/5 text-violet-500" },
  { title: "Validations", description: "Demandes d'approbation et règles", url: "/validations", icon: IconValidation, category: "Configuration", permissionModule: "validations", accent: "from-purple-500/15 to-purple-500/5 text-purple-500" },
  { title: "Paramètres", description: "Référentiels, utilisateurs et configuration", url: "/parametres", icon: IconSettings, category: "Configuration", permissionModule: "parametres", accent: "from-fuchsia-500/15 to-fuchsia-500/5 text-fuchsia-500" },
  { title: "Notifications", description: "Centre d'alertes, règles par rôle et événements", url: "/notifications", icon: IconBell, category: "Configuration", permissionModule: "notifications", accent: "from-purple-600/15 to-purple-600/5 text-purple-600" },
  { title: "Recherche globale", description: "Recherche transverse sur tous les modules", url: "/recherche", icon: IconSearch, category: "Configuration", permissionModule: "recherche", accent: "from-fuchsia-600/15 to-fuchsia-600/5 text-fuchsia-600" },
];

const CATEGORIES: Array<AppModule["category"] | "Tous"> = ["Tous", "Maintenance", "Stock PDR", "Production", "Qualité", "Inventaire", "Configuration"];

const CATEGORY_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  Maintenance: IconMaintenance,
  "Stock PDR": IconSpare,
  Production: IconProduction,
  Qualité: IconControl,
  Inventaire: IconInventory,
  Configuration: IconSettings,
};

const CARD_THEME: Record<string, {
  strip: string;
  washFrom: string;
  iconBg: string;
  iconText: string;
  hoverShadow: string;
}> = {
  sky: { strip: "bg-sky-500", washFrom: "from-sky-50/30", iconBg: "bg-sky-50", iconText: "text-sky-600", hoverShadow: "hover:shadow-sky-500/10" },
  blue: { strip: "bg-blue-500", washFrom: "from-blue-50/30", iconBg: "bg-blue-50", iconText: "text-blue-600", hoverShadow: "hover:shadow-blue-500/10" },
  cyan: { strip: "bg-cyan-500", washFrom: "from-cyan-50/30", iconBg: "bg-cyan-50", iconText: "text-cyan-600", hoverShadow: "hover:shadow-cyan-500/10" },
  teal: { strip: "bg-teal-500", washFrom: "from-teal-50/30", iconBg: "bg-teal-50", iconText: "text-teal-600", hoverShadow: "hover:shadow-teal-500/10" },
  indigo: { strip: "bg-indigo-600", washFrom: "from-indigo-50/30", iconBg: "bg-indigo-50", iconText: "text-indigo-600", hoverShadow: "hover:shadow-indigo-500/10" },
  amber: { strip: "bg-amber-500", washFrom: "from-amber-50/30", iconBg: "bg-amber-50", iconText: "text-amber-600", hoverShadow: "hover:shadow-amber-500/10" },
  rose: { strip: "bg-rose-500", washFrom: "from-rose-50/30", iconBg: "bg-rose-50", iconText: "text-rose-600", hoverShadow: "hover:shadow-rose-500/10" },
  emerald: { strip: "bg-emerald-600", washFrom: "from-emerald-50/30", iconBg: "bg-emerald-50", iconText: "text-emerald-600", hoverShadow: "hover:shadow-emerald-500/10" },
  violet: { strip: "bg-violet-500", washFrom: "from-violet-50/30", iconBg: "bg-violet-50", iconText: "text-violet-600", hoverShadow: "hover:shadow-violet-500/10" },
  slate: { strip: "bg-slate-400", washFrom: "from-slate-50/30", iconBg: "bg-slate-100", iconText: "text-slate-600", hoverShadow: "hover:shadow-slate-500/10" },
  stone: { strip: "bg-stone-400", washFrom: "from-stone-50/30", iconBg: "bg-stone-100", iconText: "text-stone-600", hoverShadow: "hover:shadow-stone-500/10" },
  fuchsia: { strip: "bg-fuchsia-500", washFrom: "from-fuchsia-50/30", iconBg: "bg-fuchsia-50", iconText: "text-fuchsia-600", hoverShadow: "hover:shadow-fuchsia-500/10" },
  orange: { strip: "bg-orange-500", washFrom: "from-orange-50/30", iconBg: "bg-orange-50", iconText: "text-orange-600", hoverShadow: "hover:shadow-orange-500/10" },
  red: { strip: "bg-red-500", washFrom: "from-red-50/30", iconBg: "bg-red-50", iconText: "text-red-600", hoverShadow: "hover:shadow-red-500/10" },
  gray: { strip: "bg-gray-500", washFrom: "from-gray-50/30", iconBg: "bg-gray-100", iconText: "text-gray-600", hoverShadow: "hover:shadow-gray-500/10" },
  purple: { strip: "bg-purple-500", washFrom: "from-purple-50/30", iconBg: "bg-purple-50", iconText: "text-purple-600", hoverShadow: "hover:shadow-purple-500/10" },
  lime: { strip: "bg-lime-600", washFrom: "from-lime-50/30", iconBg: "bg-lime-50", iconText: "text-lime-700", hoverShadow: "hover:shadow-lime-500/10" },
  green: { strip: "bg-green-500", washFrom: "from-green-50/30", iconBg: "bg-green-50", iconText: "text-green-600", hoverShadow: "hover:shadow-green-500/10" },
  yellow: { strip: "bg-yellow-600", washFrom: "from-yellow-50/30", iconBg: "bg-yellow-50", iconText: "text-yellow-700", hoverShadow: "hover:shadow-yellow-500/10" },
};

function getTheme(m: AppModule) {
  if (m.title === "Shift Maintenance") return CARD_THEME["indigo"];
  if (m.title === "Shift Production") return CARD_THEME["emerald"];
  if (m.title === "Shift contrôle") return CARD_THEME["amber"];
  if (m.title === "Dashboard maintenance") return CARD_THEME["blue"];
  if (m.title === "Dashboard Production") return CARD_THEME["emerald"];
  if (m.title === "Dashboard Qualité") return CARD_THEME["orange"];
  if (m.title === "Dashboard Inventaire") return CARD_THEME["gray"];
  const match = m.accent.match(/text-([a-z]+)-\d+/);
  const key = match ? match[1] : "slate";
  return CARD_THEME[key] ?? CARD_THEME["slate"];
}

export default function Apps() {
  const navigate = useNavigate();
  const { canView, loading } = usePermissions();
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<(typeof CATEGORIES)[number]>("Tous");

  const visible = useMemo(() => {
    if (loading) return [] as AppModule[];
    return MODULES.filter((m) => {
      if (m.permissionModule && !canView(m.permissionModule)) return false;
      if (activeCat !== "Tous" && m.category !== activeCat) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [search, activeCat, canView, loading]);

  const grouped = useMemo(() => {
    const map = new Map<string, AppModule[]>();
    for (const m of visible) {
      if (!map.has(m.category)) map.set(m.category, []);
      map.get(m.category)!.push(m);
    }
    return Array.from(map.entries());
  }, [visible]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
        <p className="text-sm text-muted-foreground">
          Tous les modules de la plateforme PROD IN TIME — explorez, recherchez et accédez à un module en un clic.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un module..."
            className="pl-9 pr-9 h-10"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent"
              aria-label="Effacer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="-mx-1 px-1 overflow-x-auto">
          <div className="flex gap-1.5 flex-nowrap md:flex-wrap min-w-max md:min-w-0">
            {CATEGORIES.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={activeCat === cat ? "default" : "outline"}
                onClick={() => setActiveCat(cat)}
                className="h-8 text-xs font-semibold whitespace-nowrap"
              >
                {cat}
                {cat !== "Tous" && (
                  <span className="ml-1.5 opacity-70">
                    {MODULES.filter((m) => m.category === cat).length}
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {visible.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">Aucun module ne correspond à votre recherche.</p>
        </Card>
      )}

      {/* Grouped modules */}
      {grouped.map(([cat, items]) => {
        const CatIcon = CATEGORY_ICONS[cat] ?? IconDashboard;
        return (
          <section key={cat} className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
              <CatIcon size={14} />
              {cat}
              <span className="h-px flex-1 bg-border/60 ml-2" />
              <span className="text-muted-foreground/50 normal-case tracking-normal font-medium">
                {items.length} module{items.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
               {items.map((m) => {
                 const theme = getTheme(m);
                 return (
                   <button
                     key={m.url}
                     onClick={() => navigate(m.url)}
                     aria-label={`${m.title} — ${m.description}`}
                     className={cn(
                       "group relative flex flex-col items-center text-center gap-3 p-5 rounded-xl border overflow-hidden",
                       "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                       "transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg",
                       "bg-card",
                       theme.hoverShadow
                     )}
                   >
                     {/* Left accent strip */}
                     <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", theme.strip)} />
                     
                     {/* Hover wash gradient */}
                     <div className={cn(
                       "absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                       theme.washFrom
                     )} />
                     
                     {m.badge && (
                       <Badge
                         variant="secondary"
                         className={cn(
                           "absolute top-3 right-3 h-5 px-2 text-[9px] font-bold tracking-wider uppercase border-0",
                           m.badge === "Live"
                             ? "bg-green-50 text-green-700 border border-green-100"
                             : "bg-primary/15 text-primary"
                         )}
                       >
                         {m.badge === "Live" ? (
                           <>
                             <span className="relative flex h-2 w-2 mr-1">
                               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                               <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                             </span>
                             {m.badge}
                           </>
                         ) : (
                           <>
                             <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full animate-pulse bg-primary" />
                             {m.badge}
                           </>
                         )}
                       </Badge>
                     )}
                     
                     <div
                       className={cn(
                         "relative h-14 w-14 rounded-2xl flex items-center justify-center border shadow-sm",
                         "group-hover:scale-110 group-hover:shadow-md transition-all duration-200",
                         "border-border/40",
                         theme.iconBg,
                         theme.iconText
                       )}
                     >
                       <m.icon size={26} />
                     </div>
                     
                     <div className="relative space-y-1 min-h-[3.5rem]">
                       <p className="text-[13px] font-semibold leading-tight line-clamp-2 text-foreground group-hover:text-primary transition-colors">
                         {m.title}
                       </p>
                       <p className="text-[10.5px] leading-snug line-clamp-2 text-muted-foreground">
                         {m.description}
                       </p>
                     </div>
                   </button>
                 );
               })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
