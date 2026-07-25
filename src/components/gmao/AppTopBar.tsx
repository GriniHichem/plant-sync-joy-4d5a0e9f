import { NavLink as RRNavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { ImpersonationDialog } from "@/components/admin/ImpersonationDialog";
import { Eye } from "lucide-react";
import logoAsset from "@/assets/brand/prod-in-time-logo.png";
import logoAmour from "@/assets/brand/logo-amour.jpg";
import {
  IconDashboard, IconMachine, IconEquipment, IconFactory, IconSpare,
  IconTicket, IconPreventive, IconShift, IconAnalytics, IconChart,
  IconOrder, IconProduct, IconArticle, IconRecipe, IconTimer,
  IconConsumption, IconStop, IconSettings, IconLogout,
  IconMaintenance, IconProduction, IconBell, IconSearch,
} from "@/components/icons/IndustrialIcons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Menu, ChevronDown, LayoutGrid, ClipboardCheck, AlertTriangle, ListChecks, FileBarChart, GitBranch, Lock, CheckSquare, Cog, Activity, Sliders, ClipboardList } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { SearchTrigger } from "@/components/search/SearchTrigger";
import { HelpButton } from "@/components/manual/HelpButton";


type NavItem = { title: string; url: string; icon: React.FC<any>; module?: string };

const gmaoItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: IconDashboard, module: "dashboard" },
  { title: "Machines", url: "/machines", icon: IconMachine, module: "machines" },
  { title: "Équipements", url: "/equipements", icon: IconEquipment, module: "equipements" },
  { title: "Organes", url: "/organes", icon: IconEquipment, module: "organes" },
  { title: "Lignes", url: "/lignes", icon: IconFactory, module: "lignes" },
  { title: "Pièces (PDR)", url: "/pdr", icon: IconSpare, module: "pdr" },
  { title: "Tickets", url: "/tickets", icon: IconTicket, module: "tickets" },
  { title: "Préventif", url: "/preventif", icon: IconPreventive, module: "preventif" },
  { title: "Shift", url: "/maintenance/shift", icon: IconShift, module: "shift_maintenance" },
  { title: "Journal", url: "/maintenance/journal", icon: IconMaintenance, module: "journal" },
  { title: "Historique", url: "/maintenance/historique", icon: IconMaintenance, module: "historique" },
  { title: "Analyse & KPI", url: "/analytics", icon: IconAnalytics, module: "analytiques" },
];

const gpaoItems: NavItem[] = [
  { title: "Dashboard", url: "/gpao", icon: IconChart, module: "gpao_dashboard" },
  { title: "Ordres de fab.", url: "/gpao/of", icon: IconOrder, module: "of" },
  { title: "Produits", url: "/gpao/produits", icon: IconProduct, module: "produits" },
  { title: "Articles", url: "/gpao/articles", icon: IconArticle, module: "articles" },
  { title: "Recettes", url: "/gpao/recettes", icon: IconRecipe, module: "recettes" },
  { title: "Shift", url: "/gpao/shift", icon: IconTimer, module: "shift_production" },
  { title: "Consommations", url: "/gpao/consommations", icon: IconConsumption, module: "consommations" },
  { title: "Arrêts", url: "/gpao/arrets", icon: IconStop, module: "arrets" },
];

const qualiteItems: NavItem[] = [
  { title: "Dashboard", url: "/qualite", icon: IconDashboard, module: "qualite_dashboard" },
  { title: "Contrôles", url: "/qualite/controles", icon: ClipboardCheck, module: "qualite_controles" },
  { title: "Non-conformités", url: "/qualite/non-conformites", icon: AlertTriangle, module: "qualite_nc" },
  { title: "Actions", url: "/qualite/actions", icon: ListChecks, module: "qualite_actions" },
  { title: "Indicateurs", url: "/qualite/indicateurs", icon: IconAnalytics, module: "qualite_indicateurs" },
  { title: "OF Qualité", url: "/qualite/of", icon: IconOrder, module: "qualite_of" },
  { title: "Recettes & BOM", url: "/qualite/recettes-nomenclatures", icon: IconRecipe, module: "qualite_recettes" },
  { title: "Traçabilité", url: "/qualite/tracabilite", icon: GitBranch, module: "qualite_tracabilite" },
  { title: "Rapports", url: "/qualite/rapports", icon: FileBarChart, module: "qualite_rapports" },
];

const inventaireItems: NavItem[] = [
  { title: "Dashboard", url: "/inventaire", icon: IconDashboard, module: "inventaire" },
  { title: "Campagnes", url: "/inventaire/campagnes", icon: ClipboardList, module: "inventaire_campagnes" },
];

const configItems: NavItem[] = [
  { title: "Paramètres", url: "/parametres", icon: IconSettings, module: "parametres" },
  { title: "Sécurité & Accès", url: "/securite", icon: Lock, module: "securite" },
  { title: "Validations", url: "/validations", icon: CheckSquare, module: "validations" },
  { title: "Audit & Traçabilité", url: "/audit", icon: Activity, module: "audit" },
];

function isActive(currentPath: string, path: string) {
  return path === "/" ? currentPath === "/" : currentPath.startsWith(path);
}

function MegaMenu({
  label,
  GroupIcon,
  items,
  active,
}: {
  label: string;
  GroupIcon: React.FC<any>;
  items: NavItem[];
  active: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-9 px-3 gap-2 text-[13px] font-semibold rounded-md transition-all",
            "text-foreground/70 hover:text-foreground hover:bg-accent/60",
            active && "text-primary bg-primary/10 hover:bg-primary/15 hover:text-primary"
          )}
        >
          <GroupIcon size={16} className="shrink-0" />
          <span className="hidden lg:inline">{label}</span>
          <ChevronDown size={13} className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="w-[520px] p-3 grid grid-cols-2 gap-1 bg-popover/95 backdrop-blur-xl border-border/60 shadow-xl"
      >
        <DropdownMenuLabel className="col-span-2 text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/70 px-2 pb-2 flex items-center gap-2">
          <GroupIcon size={12} />
          {label}
        </DropdownMenuLabel>
        {items.map((item) => (
          <DropdownMenuItem key={item.url} asChild className="p-0 focus:bg-transparent">
            <RRNavLink
              to={item.url}
              end={item.url === "/"}
              className={({ isActive: a }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] font-medium w-full transition-all",
                  "text-foreground/75 hover:bg-accent hover:text-foreground",
                  a && "bg-primary/10 text-primary font-semibold"
                )
              }
            >
              <span className="h-8 w-8 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                <item.icon size={16} />
              </span>
              <span className="truncate">{item.title}</span>
            </RRNavLink>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNav({
  visibleGmao,
  visibleGpao,
  visibleQualite,
  visibleInventaire,
  visibleConfig,
}: {
  visibleGmao: NavItem[];
  visibleGpao: NavItem[];
  visibleQualite: NavItem[];
  visibleInventaire: NavItem[];
  visibleConfig: NavItem[];
}) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  const renderItems = (label: string, items: NavItem[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground/60 px-2 pt-2 pb-1">
          {label}
        </p>
        {items.map((item) => (
          <RRNavLink
            key={item.url}
            to={item.url}
            end={item.url === "/"}
            className={({ isActive: a }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-[14px] font-medium",
                "text-foreground/75 hover:bg-accent hover:text-foreground",
                a && "bg-primary/10 text-primary font-semibold"
              )
            }
          >
            <item.icon size={18} />
            {item.title}
          </RRNavLink>
        ))}
      </div>
    );
  };

  const groups = [
    { label: "Maintenance", items: visibleGmao },
    { label: "Production", items: visibleGpao },
    { label: "Qualité", items: visibleQualite },
    { label: "Inventaire", items: visibleInventaire },
    { label: "Configuration", items: visibleConfig },
  ].filter((g) => g.items.length > 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
          <Menu size={20} />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] p-4 overflow-y-auto">
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-border/60">
          <img src={logoAmour} alt="Amour" className="h-7 w-auto object-contain rounded" />
          <img src={logoAsset} alt="Prod in Time" className="h-10 w-auto object-contain rounded-md" />
        </div>
        <RRNavLink
          to="/apps"
          className={({ isActive: a }) =>
            cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-[14px] font-medium mb-2",
              "text-foreground/75 hover:bg-accent hover:text-foreground",
              a && "bg-primary/10 text-primary font-semibold"
            )
          }
        >
          <Menu size={18} />
          Apps
        </RRNavLink>
        {groups.map((g, idx) => (
          <div key={g.label}>
            {idx > 0 && <div className="my-3 h-px bg-border/60" />}
            {renderItems(g.label, g.items)}
          </div>
        ))}
      </SheetContent>
    </Sheet>
  );
}


export function AppTopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, roles, realRoles, signOut, hasRole } = useAuth();
  const { canView, loading: permsLoading } = usePermissions();
  const [impersonationOpen, setImpersonationOpen] = useState(false);
  const isRealAdmin = realRoles.includes("admin" as any);

  const filterByPerm = (items: NavItem[]) => {
    if (permsLoading) return [];
    return items.filter((i) => !i.module || canView(i.module));
  };
  const visibleGmao = filterByPerm(gmaoItems);
  const visibleGpao = filterByPerm(gpaoItems);
  const visibleQualite = filterByPerm(qualiteItems);
  const visibleInventaire = filterByPerm(inventaireItems);
  const visibleConfig = filterByPerm(configItems);

  const isGmaoActive = visibleGmao.some((i) => isActive(location.pathname, i.url));
  const isGpaoActive = visibleGpao.some((i) => isActive(location.pathname, i.url));
  const isQualiteActive = visibleQualite.some((i) => isActive(location.pathname, i.url));
  const isInventaireActive = visibleInventaire.some((i) => isActive(location.pathname, i.url));
  const isConfigActive = visibleConfig.some((i) => isActive(location.pathname, i.url));

  const showInventaire = visibleInventaire.length > 0;
  const showQualite = visibleQualite.length > 0;
  const showGmao = visibleGmao.length > 0;
  const showGpao = visibleGpao.length > 0;
  const showConfig = visibleConfig.length > 0;

  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim() || "Utilisateur"
    : "Utilisateur";
  const initials = profile
    ? `${(profile.first_name || "")[0] || ""}${(profile.last_name || "")[0] || ""}`.toUpperCase()
    : "U";
  const roleLabel = roles.length > 0 ? (roles[0] as string).split("_").join(" ") : "";

  return (
    <header
      className="h-14 sticky top-0 z-40 border-b backdrop-blur-xl"
      style={{
        backgroundColor: "hsl(var(--header-background) / 0.85)",
        borderColor: "hsl(var(--header-border))",
        color: "hsl(var(--header-foreground))",
      }}
    >
      <div className="h-full flex items-center gap-2 px-3 md:px-5">
        {/* Mobile menu */}
        <MobileNav />

        {/* Brand */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2.5 shrink-0 group"
        >
          <img src={logoAmour} alt="Amour" className="h-7 w-auto object-contain rounded transition-transform group-hover:scale-105" />
          <img src={logoAsset} alt="Prod in Time" className="h-10 w-auto object-contain rounded-md border border-border/60 shadow-sm transition-transform group-hover:scale-105" />
        </button>

        <div className="hidden md:block h-7 w-px bg-border/60 mx-2" />

        {/* Primary nav */}
        <nav className="hidden md:flex items-center gap-1">
          <Button
            asChild
            variant="ghost"
            className={cn(
              "h-9 px-3 gap-2 text-[13px] font-semibold rounded-md",
              "text-foreground/70 hover:text-foreground hover:bg-accent/60",
              isActive(location.pathname, "/apps") && "text-primary bg-primary/10 hover:bg-primary/15 hover:text-primary"
            )}
          >
            <RRNavLink to="/apps">
              <LayoutGrid size={16} />
              <span className="hidden lg:inline">Apps</span>
            </RRNavLink>
          </Button>
          {showGmao && <MegaMenu label="Maintenance" GroupIcon={IconMaintenance} items={visibleGmao} active={isGmaoActive} />}
          {showGpao && <MegaMenu label="Production" GroupIcon={IconProduction} items={visibleGpao} active={isGpaoActive} />}
          {showQualite && <MegaMenu label="Qualité" GroupIcon={ClipboardCheck} items={visibleQualite} active={isQualiteActive} />}
          {showInventaire && (
            <MegaMenu label="Inventaire" GroupIcon={ClipboardList} items={visibleInventaire} active={isInventaireActive} />
          )}
          {showConfig && <MegaMenu label="Configuration" GroupIcon={Cog} items={visibleConfig} active={isConfigActive} />}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right zone */}
        <div className="flex items-center gap-2">
          <SearchTrigger variant="input" className="hidden md:flex" />
          <SearchTrigger variant="icon" className="md:hidden" />
          {isRealAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setImpersonationOpen(true)}
              className="h-9 px-2.5 gap-1.5 text-[12px] font-semibold text-orange-600 hover:bg-orange-500/10 hover:text-orange-700"
              title="Voir l'app comme un autre utilisateur"
            >
              <Eye size={15} />
              <span className="hidden lg:inline">Voir comme</span>
            </Button>
          )}
          <HelpButton />
          <NotificationBell />

          <div className="h-7 w-px bg-border/60 mx-1.5" />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 px-2 gap-2.5 rounded-md hover:bg-accent/60">
                <div className="hidden md:flex flex-col items-end leading-tight">
                  <span className="text-[13px] font-semibold text-foreground truncate max-w-[140px]">{displayName}</span>
                  {roleLabel && (
                    <span className="text-[10px] text-muted-foreground capitalize font-medium tracking-wide">
                      {roleLabel}
                    </span>
                  )}
                </div>
                <Avatar className="h-8 w-8 border border-border/60">
                  {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={displayName} className="object-cover" />}
                  <AvatarFallback className="text-[11px] bg-primary/10 text-primary font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold">{displayName}</span>
                  {roleLabel && (
                    <Badge variant="outline" className="mt-1 w-fit text-[10px] capitalize font-medium">
                      {roleLabel}
                    </Badge>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/mon-profil")} className="gap-2">
                <Avatar className="h-4 w-4">
                  <AvatarFallback className="text-[8px] bg-primary/10 text-primary font-bold">{initials}</AvatarFallback>
                </Avatar>
                Mon profil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/parametres")} className="gap-2">
                <IconSettings size={15} />
                Paramètres
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/audit")} className="gap-2">
                <IconAnalytics size={15} />
                Audit & Traçabilité
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="gap-2 text-destructive focus:text-destructive">
                <IconLogout size={15} />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {isRealAdmin && <ImpersonationDialog open={impersonationOpen} onOpenChange={setImpersonationOpen} />}
    </header>
  );
}
