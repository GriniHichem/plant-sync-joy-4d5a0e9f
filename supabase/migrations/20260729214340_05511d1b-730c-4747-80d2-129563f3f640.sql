CREATE TABLE public.direction_dashboard_defaults (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dashboard_id uuid NOT NULL REFERENCES public.direction_dashboards(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.direction_dashboard_defaults TO authenticated;
GRANT ALL ON public.direction_dashboard_defaults TO service_role;

ALTER TABLE public.direction_dashboard_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY ddd_select_own
ON public.direction_dashboard_defaults
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY ddd_insert_own_accessible
ON public.direction_dashboard_defaults
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.direction_dashboards d
    WHERE d.id = direction_dashboard_defaults.dashboard_id
  )
);

CREATE POLICY ddd_update_own_accessible
ON public.direction_dashboard_defaults
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.direction_dashboards d
    WHERE d.id = direction_dashboard_defaults.dashboard_id
  )
);

CREATE POLICY ddd_delete_own
ON public.direction_dashboard_defaults
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER direction_dashboard_defaults_updated_at
BEFORE UPDATE ON public.direction_dashboard_defaults
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();