CREATE OR REPLACE FUNCTION public.is_dashboard_owner(_dashboard_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.direction_dashboards d WHERE d.id = _dashboard_id AND d.owner_id = _user_id)
$$;

CREATE TABLE public.direction_dashboard_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id uuid NOT NULL REFERENCES public.direction_dashboards(id) ON DELETE CASCADE,
  shared_with_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_role app_role,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dds_target_chk CHECK (num_nonnulls(shared_with_user_id, shared_with_role) = 1)
);

CREATE UNIQUE INDEX dds_uniq_user ON public.direction_dashboard_shares (dashboard_id, shared_with_user_id) WHERE shared_with_user_id IS NOT NULL;
CREATE UNIQUE INDEX dds_uniq_role ON public.direction_dashboard_shares (dashboard_id, shared_with_role) WHERE shared_with_role IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.direction_dashboard_shares TO authenticated;
GRANT ALL ON public.direction_dashboard_shares TO service_role;

ALTER TABLE public.direction_dashboard_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY dds_select ON public.direction_dashboard_shares FOR SELECT TO authenticated
USING (
  shared_with_user_id = auth.uid()
  OR public.is_dashboard_owner(dashboard_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR (shared_with_role IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = shared_with_role))
);

CREATE POLICY dds_manage ON public.direction_dashboard_shares FOR ALL TO authenticated
USING (public.is_dashboard_owner(dashboard_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.is_dashboard_owner(dashboard_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER dds_set_updated_at BEFORE UPDATE ON public.direction_dashboard_shares
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.has_dashboard_share(_dashboard_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.direction_dashboard_shares s
    WHERE s.dashboard_id = _dashboard_id
      AND (s.shared_with_user_id = _user_id
           OR (s.shared_with_role IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _user_id AND ur.role = s.shared_with_role)))
  )
$$;

DROP POLICY IF EXISTS dd_select ON public.direction_dashboards;
CREATE POLICY dd_select ON public.direction_dashboards FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR visibility = 'public'
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR (visibility = 'roles' AND EXISTS (
        SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = ANY (direction_dashboards.allowed_roles)))
  OR public.has_dashboard_share(id, auth.uid())
);