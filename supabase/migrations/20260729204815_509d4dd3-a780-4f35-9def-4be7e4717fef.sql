CREATE TABLE public.direction_dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  visibility text NOT NULL DEFAULT 'private',
  allowed_roles text[] NOT NULL DEFAULT '{}',
  layout jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.direction_dashboards TO authenticated;
GRANT ALL ON public.direction_dashboards TO service_role;

ALTER TABLE public.direction_dashboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dd_select" ON public.direction_dashboards FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR visibility = 'public'
  OR public.has_role(auth.uid(), 'admin')
  OR (
    visibility = 'roles'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role::text = ANY (direction_dashboards.allowed_roles)
    )
  )
);

CREATE POLICY "dd_insert" ON public.direction_dashboards FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "dd_update" ON public.direction_dashboards FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "dd_delete" ON public.direction_dashboards FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_direction_dashboards_owner ON public.direction_dashboards(owner_id);

CREATE TRIGGER direction_dashboards_updated_at
BEFORE UPDATE ON public.direction_dashboards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();