import { Navigate } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import { useDefaultLandingPath } from "@/hooks/useDefaultLandingPath";
import { useDefaultDashboard } from "@/hooks/useDefaultDashboard";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Route element for "/".
 * - Dashboard Design par défaut choisi par l'utilisateur → priorité absolue.
 * - Admin (or users with dashboard view rights) and no override → render Dashboard in place.
 * - Everyone else → redirect to their computed landing path so they never see
 *   a module they cannot access.
 */
export default function HomeRoute() {
  const { hasRole } = useAuth();
  const { canView, loading: permsLoading } = usePermissions();
  const { path, loading } = useDefaultLandingPath();
  const { data: defaultDashboard, isLoading: dashLoading } = useDefaultDashboard();

  if (loading || permsLoading || dashLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 0) Préférence utilisateur : dashboard personnalisé (accessible uniquement).
  if (defaultDashboard?.id) {
    return <Navigate to={`/dashboard-design/dashboards/${defaultDashboard.id}`} replace />;
  }

  // If the resolved landing is "/" and the user can actually view the GMAO
  // dashboard (or is admin) → render it. Otherwise redirect.
  if (path === "/" && (hasRole("admin") || canView("dashboard"))) {
    return <Dashboard />;
  }
  if (path === "/") {
    // Safety net — shouldn't happen, but avoid an infinite loop.
    return <Navigate to="/apps" replace />;
  }
  return <Navigate to={path} replace />;
}
