GRANT SELECT, INSERT, UPDATE, DELETE ON public.direction_dashboards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.direction_dashboard_shares TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.direction_dashboard_defaults TO authenticated;

GRANT ALL ON public.direction_dashboards TO service_role;
GRANT ALL ON public.direction_dashboard_shares TO service_role;
GRANT ALL ON public.direction_dashboard_defaults TO service_role;