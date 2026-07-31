CREATE TABLE IF NOT EXISTS public.direction_dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public','roles')),
  allowed_roles public.app_role[] NOT NULL DEFAULT '{}',
  layout jsonb NOT NULL DEFAULT '[]'::jsonb,
  refresh_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.direction_dashboards TO authenticated;
GRANT ALL ON public.direction_dashboards TO service_role;

ALTER TABLE public.direction_dashboards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dd_select" ON public.direction_dashboards;
CREATE POLICY "dd_select" ON public.direction_dashboards
FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR visibility = 'public'
  OR (visibility = 'roles' AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = ANY (allowed_roles)))
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "dd_insert" ON public.direction_dashboards;
CREATE POLICY "dd_insert" ON public.direction_dashboards
FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "dd_update" ON public.direction_dashboards;
CREATE POLICY "dd_update" ON public.direction_dashboards
FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "dd_delete" ON public.direction_dashboards;
CREATE POLICY "dd_delete" ON public.direction_dashboards
FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_direction_dashboards_owner ON public.direction_dashboards(owner_id);

DROP TRIGGER IF EXISTS trg_direction_dashboards_updated ON public.direction_dashboards;
CREATE TRIGGER trg_direction_dashboards_updated
BEFORE UPDATE ON public.direction_dashboards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();