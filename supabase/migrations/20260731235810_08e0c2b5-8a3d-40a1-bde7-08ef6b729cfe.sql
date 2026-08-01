CREATE TABLE IF NOT EXISTS public.direction_dashboard_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id uuid NOT NULL REFERENCES public.direction_dashboards(id) ON DELETE CASCADE,
  shared_user_id uuid,
  shared_role public.app_role,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dds_target_chk CHECK (
    (shared_user_id IS NOT NULL AND shared_role IS NULL)
    OR (shared_user_id IS NULL AND shared_role IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS dds_uniq_user ON public.direction_dashboard_shares (dashboard_id, shared_user_id) WHERE shared_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS dds_uniq_role ON public.direction_dashboard_shares (dashboard_id, shared_role) WHERE shared_role IS NOT NULL;
CREATE INDEX IF NOT EXISTS dds_user_idx ON public.direction_dashboard_shares (shared_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.direction_dashboard_shares TO authenticated;
GRANT ALL ON public.direction_dashboard_shares TO service_role;

ALTER TABLE public.direction_dashboard_shares ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.dashboard_is_shared_with_me(_dashboard_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.direction_dashboard_shares s
    WHERE s.dashboard_id = _dashboard_id
      AND (
        s.shared_user_id = auth.uid()
        OR (s.shared_role IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = s.shared_role
        ))
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.dashboard_is_mine(_dashboard_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.direction_dashboards d
    WHERE d.id = _dashboard_id
      AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
$$;

DROP POLICY IF EXISTS dds_select ON public.direction_dashboard_shares;
CREATE POLICY dds_select ON public.direction_dashboard_shares
FOR SELECT TO authenticated
USING (
  public.dashboard_is_mine(dashboard_id)
  OR shared_user_id = auth.uid()
  OR (shared_role IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = direction_dashboard_shares.shared_role
  ))
);

DROP POLICY IF EXISTS dds_write ON public.direction_dashboard_shares;
CREATE POLICY dds_write ON public.direction_dashboard_shares
FOR ALL TO authenticated
USING (public.dashboard_is_mine(dashboard_id))
WITH CHECK (public.dashboard_is_mine(dashboard_id));

-- Lecture des dashboards : ajouter l'accès via partage
DROP POLICY IF EXISTS dd_select ON public.direction_dashboards;
CREATE POLICY dd_select ON public.direction_dashboards
FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR visibility = 'public'
  OR (visibility = 'roles' AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = ANY (direction_dashboards.allowed_roles)
  ))
  OR public.dashboard_is_shared_with_me(id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS ddv_select ON public.direction_dashboard_versions;
CREATE POLICY ddv_select ON public.direction_dashboard_versions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.direction_dashboards d
    WHERE d.id = direction_dashboard_versions.dashboard_id
      AND (
        d.owner_id = auth.uid()
        OR d.visibility = 'public'
        OR (d.visibility = 'roles' AND EXISTS (
          SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = ANY (d.allowed_roles)
        ))
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
  OR public.dashboard_is_shared_with_me(direction_dashboard_versions.dashboard_id)
);