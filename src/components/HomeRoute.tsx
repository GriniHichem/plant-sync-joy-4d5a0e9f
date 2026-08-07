import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import { useDefaultLandingPath } from "@/hooks/useDefaultLandingPath";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { useDefaultDirectionDashboard } from "@/hooks/useDirectionDashboards";
import { toast } from "sonner";

/**
 * Route element for "/".
 * - Admin (or users with dashboard view rights) and no override → render Dashboard in place.
 * - Everyone else → redirect to their computed landing path so they never see
 *   a module they cannot access.
 */
export default function HomeRoute() {
  const { data: defaultDashboard, isLoading: defaultDashboardLoading } = useDefaultDirectionDashboard();
  const { loading: permsLoading } = usePermissions();
  const { loading: landingLoading } = useDefaultLandingPath();

  useEffect(() => {
    if (landingLoading || permsLoading || defaultDashboardLoading) return;
    if (!defaultDashboard?.dashboard_id || defaultDashboard.accessible) return;
    try {
      const key = `default-dashboard-lost:${defaultDashboard.dashboard_id}`;
      if (sessionStorage.getItem(key) === "1") return;
      toast.warning("Dashboard par défaut inaccessible", {
        description: "Vous n'avez plus accès à ce dashboard. Redirection vers votre page disponible.",
      });
      sessionStorage.setItem(key, "1");
    } catch {
      /* sessionStorage indisponible : message ignoré */
    }
  }, [defaultDashboard?.accessible, defaultDashboard?.dashboard_id, defaultDashboardLoading, landingLoading, permsLoading]);

  if (landingLoading || permsLoading || defaultDashboardLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Si un dashboard de direction est défini par défaut et accessible, on l'affiche
  if (defaultDashboard?.accessible && defaultDashboard.dashboard_id) {
    return <Navigate to={`/direction/dashboards/${defaultDashboard.dashboard_id}`} replace />;
  }

  // Par défaut, rediriger vers l'affichage des applications (/apps)
  return <Navigate to="/apps" replace />;
}
