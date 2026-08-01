import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSharedDashboardsCount } from "@/hooks/useSharedDashboards";
import { useDefaultDashboard } from "@/hooks/useDefaultDashboard";
import { usePermissions } from "@/hooks/usePermissions";
import logoEntreprise from "@/assets/logo-entreprise.jpg";
import {
  IconDashboard, IconMachine, IconEquipment, IconFactory, IconSpare,
  IconTicket, IconPreventive, IconShift, IconAnalytics, IconChart,
  IconOrder, IconProduct, IconArticle, IconRecipe, IconTimer,
  IconConsumption, IconStop, IconSettings, IconLogout,
  IconMaintenance, IconProduction, IconJournal,
} from "@/components/icons/IndustrialIcons";
import { ShieldCheck, ClipboardCheck, AlertTriangle, Wrench, FileText, Lock, CheckSquare, Cog, Timer, ClipboardList, Truck, Star } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type NavItem = { title: string; url: string; icon: React.ComponentType<{ size?: number | string; className?: string }>; module?: string };

const gmaoItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: IconDashboard, module: "dashboard" },
  { title: "Machines", url: "/machines", icon: IconMachine, module: "machines" },
  { title: "Équipements", url: "/equipements", icon: IconEquipment, module: "equipements" },
  { title: "Organes", url: "/organes", icon: IconEquipment, module: "organes" },
  { title: "Lignes", url: "/lignes", icon: IconFactory, module: "lignes" },
  { title: "Tickets", url: "/tickets", icon: IconTicket, module: "tickets" },
  { title: "Préventif", url: "/preventif", icon: IconPreventive, module: "preventif" },
  { title: "Shift", url: "/maintenance/shift", icon: IconShift, module: "shift_maintenance" },
  { title: "Journal", url: "/maintenance/journal", icon: IconMaintenance, module: "journal" },
  { title: "Historique", url: "/maintenance/historique", icon: IconMaintenance, module: "historique" },
  { title: "Analyse & KPI", url: "/analytics", icon: IconAnalytics, module: "analytiques" },
];

const stockItems: NavItem[] = [
  { title: "Dashboard PDR", url: "/magasin/shift", icon: IconChart, module: "shift_magasin" },
  { title: "Pièces (PDR)", url: "/pdr", icon: IconSpare, module: "pdr" },
  { title: "Shift Magasin", url: "/magasin/shift/live", icon: IconShift, module: "shift_magasin" },
  { title: "Journal Stock", url: "/magasin/journal", icon: IconJournal, module: "journal_stock" },
  { title: "Demandes pièces", url: "/pdr/demandes", icon: IconSpare, module: "pdr_demandes" },
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
  { title: "Dashboard", url: "/qualite", icon: IconChart, module: "qualite_dashboard" },
  { title: "OF qualité", url: "/qualite/of", icon: IconOrder, module: "qualite_of" },
  { title: "Indicateurs", url: "/qualite/indicateurs", icon: IconAnalytics, module: "qualite_indicateurs" },
  { title: "Shift contrôle", url: "/qualite/shift", icon: Timer, module: "qualite_shift" },
  { title: "Saisie en ligne", url: "/qualite/saisie", icon: ClipboardCheck, module: "qualite_controles" },
  { title: "Console contrôle", url: "/qualite/console", icon: IconChart, module: "qualite_controles" },
  { title: "Contrôles", url: "/qualite/controles", icon: ClipboardCheck, module: "qualite_controles" },
  { title: "Non-conformités", url: "/qualite/non-conformites", icon: AlertTriangle, module: "qualite_nc" },
  { title: "Actions", url: "/qualite/actions", icon: Wrench, module: "qualite_actions" },
  { title: "Recettes & nomenclatures", url: "/qualite/recettes-nomenclatures", icon: IconRecipe, module: "qualite_recettes" },
  { title: "Traçabilité", url: "/qualite/tracabilite", icon: IconChart, module: "qualite_tracabilite" },
  { title: "Rapports", url: "/qualite/rapports", icon: FileText, module: "qualite_rapports" },
  { title: "Réception F&L", url: "/qualite/reception", icon: Truck, module: "reception" },
];

const inventaireItems: NavItem[] = [
  { title: "Dashboard", url: "/inventaire", icon: IconDashboard, module: "inventaire" },
  { title: "Campagnes", url: "/inventaire/campagnes", icon: ClipboardList, module: "inventaire_campagnes" },
];

const directionItems: NavItem[] = [
  { title: "Dashboard Design", url: "/dashboard-design/dashboards", icon: IconChart, module: "direction_dashboards" },
];

const sharedDashboardItem: NavItem = {
  title: "Mes Dashboards", url: "/dashboard-design/partages", icon: IconChart,
};

const adminItems: NavItem[] = [
  { title: "Sécurité & Accès", url: "/securite", icon: Lock, module: "securite" },
  { title: "Validations", url: "/validations", icon: CheckSquare, module: "validations" },
  { title: "Paramètres", url: "/parametres", icon: IconSettings, module: "parametres" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, roles, signOut, hasRole } = useAuth();
  const { canView, loading: permsLoading } = usePermissions();
  const sharedCount = useSharedDashboardsCount();
  const { data: defaultDashboard } = useDefaultDashboard();

  const filterByPerm = (items: NavItem[]) => {
    if (permsLoading) return [];
    return items.filter((i) => !i.module || canView(i.module));
  };

  const visibleGmao = filterByPerm(gmaoItems);
  const visibleStock = filterByPerm(stockItems);
  const visibleGpao = filterByPerm(gpaoItems);
  const visibleQualite = filterByPerm(qualiteItems);
  const visibleInventaire = filterByPerm(inventaireItems);
  const visibleDirection = [
    ...filterByPerm(directionItems),
    ...(sharedCount > 0 ? [sharedDashboardItem] : []),
    ...(defaultDashboard
      ? [{
          title: "Mon dashboard",
          url: `/dashboard-design/dashboards/${defaultDashboard.id}`,
          icon: Star,
        } as NavItem]
      : []),
  ];

  const visibleAdmin = filterByPerm(adminItems);

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const isGmaoActive = visibleGmao.some((i) => isActive(i.url));
  const isStockActive = visibleStock.some((i) => isActive(i.url));
  const isGpaoActive = visibleGpao.some((i) => isActive(i.url));
  const isQualiteActive = visibleQualite.some((i) => isActive(i.url));
  const isAdminActive = visibleAdmin.some((i) => isActive(i.url));
  const isInventaireActive = visibleInventaire.some((i) => isActive(i.url));
  const isDirectionActive = visibleDirection.some((i) => isActive(i.url));
  const showDirection = visibleDirection.length > 0;
  const showQualite = visibleQualite.length > 0;
  const showInventaire = visibleInventaire.length > 0;
  const showGmao = visibleGmao.length > 0;
  const showStock = visibleStock.length > 0;
  const showGpao = visibleGpao.length > 0;
  const showAdmin = visibleAdmin.length > 0;

  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim() || "Utilisateur"
    : "Utilisateur";

  const roleLabel = roles.length > 0 ? (roles[0] as string).split("_").join(" ") : "—";

  const renderGroup = (
    label: string,
    GroupIcon: React.ComponentType<{ size?: number | string; className?: string }>,
    items: { title: string; url: string; icon: React.ComponentType<{ size?: number | string; className?: string }> }[],
    defaultOpen: boolean,
  ) => (
    <SidebarGroup>
      <Collapsible defaultOpen={defaultOpen}>
        <CollapsibleTrigger className="w-full group/trigger">
          <SidebarGroupLabel className="cursor-pointer flex items-center gap-2 text-[10px] font-bold tracking-[0.15em] uppercase text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors px-3 py-2">
            <GroupIcon size={14} />
            {!collapsed && <span>{label}</span>}
            {!collapsed && (
              <svg className="h-3 w-3 ml-auto transition-transform group-data-[state=open]/trigger:rotate-180 text-sidebar-foreground/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 space-y-0.5">
              {items.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200",
                          "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
                          active && "sidebar-active-glow text-sidebar-primary-foreground"
                        )}
                        activeClassName=""
                      >
                        <item.icon size={18} className="shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      {/* Header — Brand identity */}
      <SidebarHeader className="p-4 pb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "shrink-0 rounded-lg overflow-hidden border border-sidebar-border/50",
            "shadow-[0_0_12px_hsl(var(--sidebar-glow)/0.15)]",
            collapsed ? "h-9 w-9" : "h-10 w-10"
          )}>
            <img src={logoEntreprise} alt="Entreprise" className="h-full w-full object-cover" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[14px] font-extrabold tracking-[0.12em] uppercase text-sidebar-primary-foreground leading-none">
                PROD IN TIME
              </span>
              <span className="text-[9px] font-semibold tracking-[0.2em] text-sidebar-foreground/35 uppercase mt-1">
                GMAO · GPAO
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Divider with glow */}
      <div className="mx-3 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />

      <SidebarContent className="pt-3 overflow-y-auto">
        {showGmao && renderGroup("Maintenance", IconMaintenance, visibleGmao, isGmaoActive || !isGpaoActive)}

        {showStock && (
          <>
            <div className="mx-3 my-1 h-px bg-gradient-to-r from-transparent via-sidebar-border/50 to-transparent" />
            {renderGroup("Stock PDR", IconSpare, visibleStock, isStockActive)}
          </>
        )}

        {(showGmao || showStock) && showGpao && <div className="mx-3 my-1 h-px bg-gradient-to-r from-transparent via-sidebar-border/50 to-transparent" />}

        {showGpao && renderGroup("Production", IconProduction, visibleGpao, isGpaoActive)}

        {showQualite && (
          <>
            <div className="mx-3 my-1 h-px bg-gradient-to-r from-transparent via-sidebar-border/50 to-transparent" />
            {renderGroup("Qualité", ShieldCheck, visibleQualite, isQualiteActive)}
          </>
        )}

        {showInventaire && (
          <>
            <div className="mx-3 my-1 h-px bg-gradient-to-r from-transparent via-sidebar-border/50 to-transparent" />
            {renderGroup("Inventaire", ClipboardList, visibleInventaire, isInventaireActive)}
          </>
        )}

        {showDirection && (
          <>
            <div className="mx-3 my-1 h-px bg-gradient-to-r from-transparent via-sidebar-border/50 to-transparent" />
            {renderGroup("Dashboard Design", IconChart, visibleDirection, isDirectionActive)}
          </>
        )}

        {showAdmin && (
          <>
            <div className="mx-3 my-1 h-px bg-gradient-to-r from-transparent via-sidebar-border/50 to-transparent" />
            {renderGroup("Administration", Cog, visibleAdmin, isAdminActive)}
          </>
        )}
      </SidebarContent>

      {/* Footer — User area */}
      <SidebarFooter className="p-3 pt-0">
        <div className="mx-0 mb-2 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />
        {!collapsed && (
          <div className="mb-2 px-2">
            <p className="text-[13px] font-semibold text-sidebar-foreground truncate">{displayName}</p>
            <p className="text-[10px] text-sidebar-foreground/45 capitalize font-medium tracking-wide">{roleLabel}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          className="w-full justify-start gap-3 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-destructive/10 rounded-lg text-[13px] font-medium px-3"
          onClick={signOut}
        >
          <IconLogout size={18} className="shrink-0" />
          {!collapsed && <span>Déconnexion</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
