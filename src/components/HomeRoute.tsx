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
  const { hasRole } = useAuth();
  const { canView, loading: permsLoading } = usePermissions();
  const { path, loading } = useDefaultLandingPath();
  const { data: defaultDashboard, isLoading: defaultDashboardLoading } = useDefaultDirectionDashboard();

  useEffect(() => {
    if (loading || permsLoading || defaultDashboardLoading) return;
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
  }, [defaultDashboard?.accessible, defaultDashboard?.dashboard_id, defaultDashboardLoading, loading, permsLoading]);

  if (loading || permsLoading || defaultDashboardLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // FORCE default landing to /apps as requested ("affichage app")
  // instead of the complex redirection logic.
  if (defaultDashboard?.accessible && defaultDashboard.dashboard_id) {
    return <Navigate to={`/direction/dashboards/${defaultDashboard.dashboard_id}`} replace />;
  }

  // If a specific default dashboard is set and accessible, we keep it.
  // Otherwise, the user wants the "apps" view as the default home.
  return <Navigate to="/apps" replace />;
}
