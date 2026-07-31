ALTER TABLE public.direction_dashboards
  ADD COLUMN IF NOT EXISTS global_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS theme jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.direction_dashboard_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id uuid NOT NULL REFERENCES public.direction_dashboards(id) ON DELETE CASCADE,
  name text NOT NULL,
  layout jsonb NOT NULL DEFAULT '[]'::jsonb,
  global_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dashboard_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.direction_dashboard_versions TO authenticated;
GRANT ALL ON public.direction_dashboard_versions TO service_role;

ALTER TABLE public.direction_dashboard_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ddv_select" ON public.direction_dashboard_versions;
CREATE POLICY "ddv_select" ON public.direction_dashboard_versions
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.direction_dashboards d
  WHERE d.id = dashboard_id
    AND (
      d.owner_id = auth.uid()
      OR d.visibility = 'public'
      OR (d.visibility = 'roles' AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = ANY (d.allowed_roles)))
      OR public.has_role(auth.uid(), 'admin')
    )
));

DROP POLICY IF EXISTS "ddv_write" ON public.direction_dashboard_versions;
CREATE POLICY "ddv_write" ON public.direction_dashboard_versions
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.direction_dashboards d
  WHERE d.id = dashboard_id
    AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.direction_dashboards d
  WHERE d.id = dashboard_id
    AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
));

CREATE INDEX IF NOT EXISTS idx_ddv_dashboard ON public.direction_dashboard_versions(dashboard_id);

DROP TRIGGER IF EXISTS trg_ddv_updated ON public.direction_dashboard_versions;
CREATE TRIGGER trg_ddv_updated
BEFORE UPDATE ON public.direction_dashboard_versions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index de performance pour les widgets Direction (lecture seule, gros volumes)
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_heure_declaration ON public.tickets(heure_declaration DESC);
CREATE INDEX IF NOT EXISTS idx_prod_stops_heure_debut ON public.production_stops(heure_debut DESC);
CREATE INDEX IF NOT EXISTS idx_prod_decl_heure ON public.production_declarations(heure_production DESC);
CREATE INDEX IF NOT EXISTS idx_quality_checks_control_time ON public.quality_checks(control_time DESC);
CREATE INDEX IF NOT EXISTS idx_qnc_created_at ON public.quality_non_conformities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdr_mov_created_at ON public.pdr_stock_movements(created_at DESC);