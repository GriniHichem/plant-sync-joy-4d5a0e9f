import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { AppLayout } from "@/components/gmao/AppLayout";
import { InventoryLayout } from "@/components/inventaire/InventoryLayout";
import { useInventoryPermissions } from "@/hooks/useInventoryPermissions";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import MachinesList from "@/pages/MachinesList";
import MachineDetail from "@/pages/MachineDetail";
import MachineForm from "@/pages/MachineForm";
import PdrList from "@/pages/PdrList";
import PdrDetail from "@/pages/PdrDetail";
import PdrForm from "@/pages/PdrForm";
import TicketsList from "@/pages/TicketsList";
import TicketDetail from "@/pages/TicketDetail";
import PreventifList from "@/pages/PreventifList";
import PreventifForm from "@/pages/PreventifForm";
import PreventifDetail from "@/pages/PreventifDetail";
import MaintenancierShiftView from "@/pages/MaintenancierShiftView";
import InterventionJournal from "@/pages/InterventionJournal";
import InterventionHistory from "@/pages/InterventionHistory";
import Parametres from "@/pages/Parametres";
import UsersAdmin from "@/pages/parametres/UsersAdmin";
import FamillesAdmin from "@/pages/parametres/FamillesAdmin";
import PannesAdmin from "@/pages/parametres/PannesAdmin";
import RolesMatrix from "@/pages/parametres/RolesMatrix";
import RotationsAdmin from "@/pages/parametres/RotationsAdmin";
import LignesAdmin from "@/pages/parametres/LignesAdmin";
import GeneralSettings from "@/pages/parametres/GeneralSettings";
import ImageSettings from "@/pages/parametres/ImageSettings";
import ProductFamiliesAdmin from "@/pages/parametres/ProductFamiliesAdmin";
import DocumentCategoriesAdmin from "@/pages/parametres/DocumentCategoriesAdmin";
import DocumentPermissionsAdmin from "@/pages/parametres/DocumentPermissionsAdmin";
import PdrFamiliesAdmin from "@/pages/parametres/PdrFamiliesAdmin";
import PdrStockPermissionsAdmin from "@/pages/parametres/PdrStockPermissionsAdmin";
import ScanHistoryAdmin from "@/pages/parametres/ScanHistoryAdmin";
import ImportData from "@/pages/parametres/ImportData";
import MonProfil from "@/pages/MonProfil";


import GpaoDashboard from "@/pages/gpao/GpaoDashboard";
import OfList from "@/pages/gpao/OfList";
import OfDetail from "@/pages/gpao/OfDetail";
import ProductsList from "@/pages/gpao/ProductsList";
import ArticlesList from "@/pages/gpao/ArticlesList";
import ProductDetail from "@/pages/gpao/ProductDetail";
import ArticleDetail from "@/pages/gpao/ArticleDetail";
import ShiftScreen from "@/pages/gpao/ShiftScreen";
import ConsumptionPage from "@/pages/gpao/ConsumptionPage";
import StopsPage from "@/pages/gpao/StopsPage";
import RecipesPage from "@/pages/gpao/RecipesPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import EquipmentsList from "@/pages/EquipmentsList";
import EquipmentDetail from "@/pages/EquipmentDetail";
import EquipmentForm from "@/pages/EquipmentForm";
import LinesList from "@/pages/LinesList";
import LineSynoptic from "@/pages/LineSynoptic";
import LineConfig from "@/pages/LineConfig";
import NotFound from "@/pages/NotFound";
import ResetPassword from "@/pages/ResetPassword";
import OrganesList from "@/pages/OrganesList";
import Apps from "@/pages/Apps";
import { ShiftLayout } from "@/components/shift/ShiftLayout";
import { ShiftGuard } from "@/components/shift/ShiftGuard";
import { ActiveShiftProvider } from "@/contexts/ActiveShiftContext";
import SecurityHub from "@/pages/SecurityHub";
import OrganeForm from "@/pages/OrganeForm";
import OrganeDetail from "@/pages/OrganeDetail";
import AuditPage from "@/pages/AuditPage";
import NotificationsPage from "@/pages/NotificationsPage";
import NotificationRulesAdmin from "@/pages/parametres/NotificationRulesAdmin";
import SmtpConfigAdmin from "@/pages/parametres/SmtpConfigAdmin";
import ErpSyncAdmin from "@/pages/parametres/ErpSyncAdmin";
import ValidationsPage from "@/pages/ValidationsPage";
import ValidationRulesAdmin from "@/pages/parametres/ValidationRulesAdmin";
import QualiteParametresHub from "@/pages/parametres/qualite/QualiteParametresHub";
import QualiteNcCategoriesAdmin from "@/pages/parametres/qualite/QualiteNcCategoriesAdmin";
import QualiteActionCategoriesAdmin from "@/pages/parametres/qualite/QualiteActionCategoriesAdmin";
import QualiteUnitsAdmin from "@/pages/parametres/qualite/QualiteUnitsAdmin";
import QualiteControlPointsAdmin from "@/pages/parametres/qualite/QualiteControlPointsAdmin";
import QualiteDefectTypesAdmin from "@/pages/parametres/qualite/QualiteDefectTypesAdmin";
import QualiteDecisionReasonsAdmin from "@/pages/parametres/qualite/QualiteDecisionReasonsAdmin";
import QualiteShiftPlanAdmin from "@/pages/parametres/qualite/QualiteShiftPlanAdmin";
import SearchPage from "@/pages/SearchPage";
import { GlobalSearchProvider } from "@/components/search/GlobalSearchProvider";
import { ManualProvider } from "@/contexts/ManualContext";
import QualiteDashboard from "@/pages/qualite/QualiteDashboard";
import QualiteOf from "@/pages/qualite/QualiteOf";
import QualiteIndicateurs from "@/pages/qualite/QualiteIndicateurs";
import QualiteAffectations from "@/pages/qualite/QualiteAffectations";
import QualiteControles from "@/pages/qualite/QualiteControles";
import QualiteSaisieLigne from "@/pages/qualite/QualiteSaisieLigne";
import QualiteConsoleControle from "@/pages/qualite/QualiteConsoleControle";
import QualiteNonConformites from "@/pages/qualite/QualiteNonConformites";
import QualiteActions from "@/pages/qualite/QualiteActions";
import QualiteRecettesNomenclatures from "@/pages/qualite/QualiteRecettesNomenclatures";
import QualiteTracabilite from "@/pages/qualite/QualiteTracabilite";
import QualiteEnquetesLot from "@/pages/qualite/QualiteEnquetesLot";
import QualiteEnqueteLotDetail from "@/pages/qualite/QualiteEnqueteLotDetail";
import QualiteRapports from "@/pages/qualite/QualiteRapports";
import QualiteShiftScreen from "@/pages/qualite/QualiteShiftScreen";
import ReceptionPage from "@/pages/qualite/reception/ReceptionPage";
import InventoryDashboard from "@/pages/inventaire/InventoryDashboard";
import InventoryCampaignsList from "@/pages/inventaire/InventoryCampaignsList";
import InventoryCampaignNew from "@/pages/inventaire/InventoryCampaignNew";
import InventoryCampaignDetail from "@/pages/inventaire/InventoryCampaignDetail";
import InventoryCountScreen from "@/pages/inventaire/InventoryCountScreen";
import ProductionShiftDeclare from "@/pages/shift/ProductionShiftDeclare";
import ProductionShiftStop from "@/pages/shift/ProductionShiftStop";
import ProductionShiftTicket from "@/pages/shift/ProductionShiftTicket";
import MaintenanceShiftIntervention from "@/pages/shift/MaintenanceShiftIntervention";
import MaintenancePieces from "@/pages/shift/MaintenancePieces";
import PdrRequestsQueue from "@/pages/pdr/PdrRequestsQueue";
import QualityShiftCheck from "@/pages/shift/QualityShiftCheck";
import QualityShiftNc from "@/pages/shift/QualityShiftNc";
import QualityShiftLines from "@/pages/shift/QualityShiftLines";
import { ShiftHomePage } from "@/components/shift/ShiftHomePage";
import MagasinShiftHome from "@/pages/magasin/MagasinShiftHome";
import MagasinKiosk from "@/pages/magasin/MagasinKiosk";
import MagasinJournal from "@/pages/magasin/MagasinJournal";
import HomeRoute from "@/components/HomeRoute";
import DirectionDashboards from "@/pages/direction/DirectionDashboards";
import DirectionDashboardDetail from "@/pages/direction/DirectionDashboardDetail";
import MyDashboards from "@/pages/direction/MyDashboards";
import EmailModule from "@/pages/email/EmailModule";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const auth = useAuth();
  const inventoryPermissions = useInventoryPermissions();
  const location = useLocation();

  // Handle case where AuthProvider might be missing or hook used outside
  if (!auth) {
    console.error("useAuth must be used within AuthProvider");
    return <Navigate to="/auth" replace />;
  }

  const { user, loading } = auth;
  const { isInventoryOnly } = inventoryPermissions;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Inventory-only users → isolated kiosk layout, restricted to inventaire / pdr / organes
  if (isInventoryOnly) {
    const p = location.pathname;
    const allowed =
      p === "/" ||
      p.startsWith("/inventaire") ||
      p.startsWith("/pdr") ||
      p.startsWith("/organes");
    if (!allowed) return <Navigate to="/inventaire" replace />;
    return (
      <ManualProvider>
        <GlobalSearchProvider>
          <InventoryLayout />
        </GlobalSearchProvider>
      </ManualProvider>
    );
  }

  return (
    <ManualProvider>
      <GlobalSearchProvider>
        <AppLayout />
      </GlobalSearchProvider>
    </ManualProvider>
  );
}

function ProtectedShiftRoute({
  kind,
  children,
  allowWithoutShift = false,
}: {
  kind: "production" | "maintenance" | "quality";
  children: React.ReactNode;
  allowWithoutShift?: boolean;
}) {
  const auth = useAuth();
  if (!auth || auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!auth.user) return <Navigate to="/auth" replace />;
  return (
    <ActiveShiftProvider kind={kind}>
      <ShiftLayout>
        <ShiftGuard allowWithoutShift={allowWithoutShift}>{children}</ShiftGuard>
      </ShiftLayout>
    </ActiveShiftProvider>
  );
}

function ProtectedKioskRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (!auth || auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!auth.user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ImpersonationProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* Isolated kiosk shift apps — no global sidebar (operator-only) */}
            {/* Production kiosk */}
            <Route path="/gpao/shift/live" element={<ProtectedShiftRoute kind="production" allowWithoutShift><ShiftScreen /></ProtectedShiftRoute>} />
            <Route path="/gpao/shift/declarer" element={<ProtectedShiftRoute kind="production"><ProductionShiftDeclare /></ProtectedShiftRoute>} />
            <Route path="/gpao/shift/arret" element={<ProtectedShiftRoute kind="production"><ProductionShiftStop /></ProtectedShiftRoute>} />
            <Route path="/gpao/shift/ticket" element={<ProtectedShiftRoute kind="production"><ProductionShiftTicket /></ProtectedShiftRoute>} />
            {/* Maintenance kiosk */}
            <Route path="/maintenance/shift/live" element={<ProtectedShiftRoute kind="maintenance" allowWithoutShift><MaintenancierShiftView /></ProtectedShiftRoute>} />
            <Route path="/maintenance/shift/intervention" element={<ProtectedShiftRoute kind="maintenance" allowWithoutShift><MaintenanceShiftIntervention /></ProtectedShiftRoute>} />
            <Route path="/maintenance/shift/intervention/:ticketId" element={<ProtectedShiftRoute kind="maintenance" allowWithoutShift><MaintenanceShiftIntervention /></ProtectedShiftRoute>} />
            <Route path="/maintenance/shift/pieces" element={<ProtectedShiftRoute kind="maintenance" allowWithoutShift><MaintenancePieces /></ProtectedShiftRoute>} />
            {/* Quality kiosk */}
            <Route path="/qualite/shift/live" element={<ProtectedShiftRoute kind="quality" allowWithoutShift><QualiteShiftScreen /></ProtectedShiftRoute>} />
            <Route path="/qualite/shift/check" element={<ProtectedShiftRoute kind="quality"><QualityShiftCheck /></ProtectedShiftRoute>} />
            <Route path="/qualite/shift/nc" element={<ProtectedShiftRoute kind="quality"><QualityShiftNc /></ProtectedShiftRoute>} />
            <Route path="/qualite/shift/lignes" element={<ProtectedShiftRoute kind="quality"><QualityShiftLines /></ProtectedShiftRoute>} />
            {/* Magasin kiosk (full screen, no sidebar) */}
            <Route path="/magasin/shift/live" element={<ProtectedKioskRoute><MagasinKiosk /></ProtectedKioskRoute>} />
            
            <Route element={<ProtectedRoutes />}>
              {/* GMAO */}
              <Route path="/" element={<HomeRoute />} />
              <Route path="/apps" element={<Apps />} />
              <Route path="/mon-profil" element={<MonProfil />} />
              <Route path="/securite" element={<SecurityHub />} />
              <Route path="/parametres/access-control" element={<Navigate to="/securite" replace />} />
              <Route path="/machines" element={<MachinesList />} />
              <Route path="/machines/new" element={<MachineForm />} />
              <Route path="/machines/:id" element={<MachineDetail />} />
              <Route path="/machines/:id/edit" element={<MachineForm />} />
              <Route path="/pdr" element={<PdrList />} />
              <Route path="/pdr/demandes" element={<PdrRequestsQueue />} />
              <Route path="/pdr/new" element={<PdrForm />} />
              <Route path="/pdr/:id" element={<PdrDetail />} />
              <Route path="/pdr/:id/edit" element={<PdrForm />} />
              <Route path="/tickets" element={<TicketsList />} />
              <Route path="/tickets/:id" element={<TicketDetail />} />
              <Route path="/preventif" element={<PreventifList />} />
              <Route path="/preventif/new" element={<PreventifForm />} />
              <Route path="/preventif/:id" element={<PreventifDetail />} />
              <Route path="/preventif/:id/edit" element={<PreventifForm />} />
              {/* Maintenance shift home — managers see console, operators redirected to /maintenance/shift/live */}
              <Route path="/maintenance/shift" element={
                <ShiftHomePage
                  kind="maintenance"
                  operatorRedirect="/maintenance/shift/live"
                  managerRoles={["admin", "resp_maintenance"]}
                  operatorRoles={["maintenancier"]}
                />
              } />
              {/* Magasin shift home — keepers redirected to kiosk, managers see dashboard */}
              <Route path="/magasin/shift" element={<MagasinShiftHome />} />
              <Route path="/magasin/journal" element={<MagasinJournal />} />

              <Route path="/maintenance/journal" element={<InterventionJournal />} />
              <Route path="/maintenance/historique" element={<InterventionHistory />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/equipements" element={<EquipmentsList />} />
              <Route path="/equipements/new" element={<EquipmentForm />} />
              <Route path="/equipements/:id" element={<EquipmentDetail />} />
              <Route path="/equipements/:id/edit" element={<EquipmentForm />} />
              <Route path="/organes" element={<OrganesList />} />
              <Route path="/organes/new" element={<OrganeForm />} />
              <Route path="/organes/:id" element={<OrganeDetail />} />
              <Route path="/organes/:id/edit" element={<OrganeForm />} />
              {/* Lignes synoptique */}
              <Route path="/lignes" element={<LinesList />} />
              <Route path="/lignes/:id" element={<LineSynoptic />} />
              <Route path="/lignes/:id/config" element={<LineConfig />} />
              {/* GPAO */}
              <Route path="/gpao" element={<GpaoDashboard />} />
              <Route path="/gpao/of" element={<OfList />} />
              <Route path="/gpao/of/:id" element={<OfDetail />} />
              <Route path="/gpao/produits" element={<ProductsList />} />
              <Route path="/gpao/produits/:id" element={<ProductDetail />} />
              <Route path="/gpao/articles" element={<ArticlesList />} />
              <Route path="/gpao/articles/:id" element={<ArticleDetail />} />
              {/* Production shift home — managers see console, operators redirected to /gpao/shift/live */}
              <Route path="/gpao/shift" element={
                <ShiftHomePage
                  kind="production"
                  operatorRedirect="/gpao/shift/live"
                  managerRoles={["admin", "resp_production"]}
                  operatorRoles={["chef_ligne", "operateur"]}
                />
              } />
              <Route path="/gpao/consommations" element={<ConsumptionPage />} />
              <Route path="/gpao/arrets" element={<StopsPage />} />
              <Route path="/gpao/recettes" element={<RecipesPage readOnly />} />
              {/* Admin */}
              <Route path="/parametres" element={<Parametres />} />
              <Route path="/parametres/users" element={<UsersAdmin />} />
              
              <Route path="/parametres/familles" element={<FamillesAdmin />} />
              <Route path="/parametres/pannes" element={<PannesAdmin />} />
              <Route path="/parametres/roles" element={<RolesMatrix />} />
              <Route path="/parametres/shifts" element={<RotationsAdmin />} />
              <Route path="/parametres/rotations" element={<Navigate to="/parametres/shifts" replace />} />
              <Route path="/parametres/lignes" element={<LignesAdmin />} />
              <Route path="/parametres/familles-produits" element={<ProductFamiliesAdmin />} />
              <Route path="/parametres/images" element={<ImageSettings />} />
              <Route path="/parametres/document-categories" element={<DocumentCategoriesAdmin />} />
              <Route path="/parametres/document-permissions" element={<DocumentPermissionsAdmin />} />
              <Route path="/parametres/familles-pdr" element={<PdrFamiliesAdmin />} />
              <Route path="/parametres/general" element={<GeneralSettings />} />
              <Route path="/parametres/pdr-stock-permissions" element={<PdrStockPermissionsAdmin />} />
              <Route path="/parametres/scan-history" element={<ScanHistoryAdmin />} />
              <Route path="/parametres/import" element={<ImportData />} />
              <Route path="/scan-history" element={<Navigate to="/parametres/scan-history" replace />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/parametres/notifications" element={<NotificationRulesAdmin />} />
              <Route path="/parametres/smtp" element={<SmtpConfigAdmin />} />
              <Route path="/parametres/erp-sync" element={<ErpSyncAdmin />} />
              <Route path="/validations" element={<ValidationsPage />} />
              <Route path="/parametres/validations" element={<ValidationRulesAdmin />} />
              <Route path="/parametres/qualite" element={<QualiteParametresHub />} />
              <Route path="/parametres/qualite/nc-categories" element={<QualiteNcCategoriesAdmin />} />
              <Route path="/parametres/qualite/action-categories" element={<QualiteActionCategoriesAdmin />} />
              <Route path="/parametres/qualite/units" element={<QualiteUnitsAdmin />} />
              <Route path="/parametres/qualite/control-points" element={<QualiteControlPointsAdmin />} />
              <Route path="/parametres/qualite/defect-types" element={<QualiteDefectTypesAdmin />} />
              <Route path="/parametres/qualite/decision-reasons" element={<QualiteDecisionReasonsAdmin />} />
              <Route path="/parametres/qualite/shift-plan" element={<QualiteShiftPlanAdmin />} />
              <Route path="/recherche" element={<SearchPage />} />
              {/* Qualité & Traçabilité */}
              <Route path="/qualite" element={<QualiteDashboard />} />
              <Route path="/qualite/of" element={<QualiteOf />} />
              {/* Quality shift home — managers see console, controllers redirected to /qualite/shift/live */}
              <Route path="/qualite/shift" element={
                <ShiftHomePage
                  kind="quality"
                  operatorRedirect="/qualite/shift/live"
                  managerRoles={["admin", "responsable_controle_qualite", "directeur_qualite"]}
                  operatorRoles={["controleur_qualite"]}
                />
              } />
              <Route path="/qualite/indicateurs" element={<QualiteIndicateurs />} />
              <Route path="/qualite/affectations" element={<QualiteAffectations />} />
              <Route path="/qualite/saisie" element={<QualiteSaisieLigne />} />
              <Route path="/qualite/console" element={<QualiteConsoleControle />} />
              <Route path="/qualite/controles" element={<QualiteControles />} />
              <Route path="/qualite/non-conformites" element={<QualiteNonConformites />} />
              <Route path="/qualite/actions" element={<QualiteActions />} />
              <Route path="/qualite/recettes-nomenclatures" element={<QualiteRecettesNomenclatures />} />
              <Route path="/qualite/tracabilite" element={<QualiteTracabilite />} />
              <Route path="/qualite/enquetes-lot" element={<QualiteEnquetesLot />} />
              <Route path="/qualite/enquetes-lot/:id" element={<QualiteEnqueteLotDetail />} />

              <Route path="/qualite/rapports" element={<QualiteRapports />} />
              <Route path="/qualite/reception" element={<ReceptionPage />} />
              {/* Direction — reporting personnalisable (lecture seule) */}
              <Route path="/direction/dashboards" element={<DirectionDashboards />} />
              <Route path="/direction/dashboards/:id" element={<DirectionDashboardDetail />} />
              <Route path="/direction/mes-dashboards" element={<MyDashboards />} />
              {/* Email — connexion du compte, devis PDR, envoi via modèles */}
              <Route path="/email" element={<EmailModule />} />
              <Route path="/email/:tab" element={<EmailModule />} />

              {/* Inventaire */}
              <Route path="/inventaire" element={<InventoryDashboard />} />
              <Route path="/inventaire/campagnes" element={<InventoryCampaignsList />} />
              <Route path="/inventaire/campagnes/nouvelle" element={<InventoryCampaignNew />} />
              <Route path="/inventaire/campagnes/:id" element={<InventoryCampaignDetail />} />
              <Route path="/inventaire/compter/:campaignId" element={<InventoryCountScreen />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ImpersonationProvider>
  </TooltipProvider>
</QueryClientProvider>
);

export default App;
