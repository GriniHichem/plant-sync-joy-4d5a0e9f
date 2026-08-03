CREATE TABLE IF NOT EXISTS public.erp_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL CHECK (direction IN ('export','import','system')),
  resource text NOT NULL,
  method text NOT NULL,
  status_code integer NOT NULL DEFAULT 200,
  ok boolean NOT NULL DEFAULT true,
  record_count integer NOT NULL DEFAULT 0,
  error text,
  request_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms integer,
  actor_id uuid,
  actor_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.erp_sync_logs TO authenticated;
GRANT ALL ON public.erp_sync_logs TO service_role;
ALTER TABLE public.erp_sync_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "erp_sync_logs_select_admin" ON public.erp_sync_logs;
CREATE POLICY "erp_sync_logs_select_admin" ON public.erp_sync_logs
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'responsable_si'));
CREATE INDEX IF NOT EXISTS idx_erp_sync_logs_created_at ON public.erp_sync_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_erp_sync_logs_resource ON public.erp_sync_logs (resource, created_at DESC);

CREATE TABLE IF NOT EXISTS public.erp_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource text NOT NULL UNIQUE,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  last_record_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.erp_sync_state TO authenticated;
GRANT ALL ON public.erp_sync_state TO service_role;
ALTER TABLE public.erp_sync_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "erp_sync_state_select_admin" ON public.erp_sync_state;
CREATE POLICY "erp_sync_state_select_admin" ON public.erp_sync_state
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'responsable_si'));
DROP TRIGGER IF EXISTS trg_erp_sync_state_updated_at ON public.erp_sync_state;
CREATE TRIGGER trg_erp_sync_state_updated_at
BEFORE UPDATE ON public.erp_sync_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.consumptions
  ADD COLUMN IF NOT EXISTS erp_ref text,
  ADD COLUMN IF NOT EXISTS erp_synced_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS uq_consumptions_erp_ref
  ON public.consumptions (erp_ref) WHERE erp_ref IS NOT NULL AND erp_ref <> '';
ALTER TABLE public.production_declarations
  ADD COLUMN IF NOT EXISTS erp_ref text,
  ADD COLUMN IF NOT EXISTS erp_synced_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS uq_production_declarations_erp_ref
  ON public.production_declarations (erp_ref) WHERE erp_ref IS NOT NULL AND erp_ref <> '';
ALTER TABLE public.pdr_stock_movements
  ADD COLUMN IF NOT EXISTS erp_synced_at timestamptz;

INSERT INTO public.app_settings (key, value, label, description, is_secret)
VALUES
  ('erp_sync.api_key', 'erp_' || replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''), 'Clé de service API ERP', 'Clé machine-to-machine (header X-API-Key). Plusieurs clés séparées par des virgules pour la rotation.', true),
  ('erp_sync.service_user_id', COALESCE((SELECT user_id::text FROM public.user_roles WHERE role = 'admin' ORDER BY user_id LIMIT 1), ''), 'Utilisateur technique API ERP', 'Compte auquel sont imputées les écritures faites via clé de service', false)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  encrypted_password TEXT,
  provider TEXT NOT NULL DEFAULT 'custom',
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_secure TEXT DEFAULT 'tls',
  display_name TEXT,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  connected_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.user_email_accounts TO authenticated;
GRANT ALL ON public.user_email_accounts TO service_role;
ALTER TABLE public.user_email_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own email account read" ON public.user_email_accounts;
CREATE POLICY "own email account read" ON public.user_email_accounts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "own email account delete" ON public.user_email_accounts;
CREATE POLICY "own email account delete" ON public.user_email_accounts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_html BOOLEAN NOT NULL DEFAULT true,
  default_recipients TEXT,
  variables TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "templates readable by authenticated" ON public.email_templates;
CREATE POLICY "templates readable by authenticated" ON public.email_templates
  FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admins manage templates" ON public.email_templates;
CREATE POLICY "admins manage templates" ON public.email_templates
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  template_name TEXT,
  from_email TEXT,
  sent_to TEXT[] NOT NULL DEFAULT '{}',
  cc TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT NOT NULL,
  body TEXT,
  is_html BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_logs_user_created ON public.email_logs(user_id, created_at DESC);
GRANT SELECT ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own email logs" ON public.email_logs;
CREATE POLICY "own email logs" ON public.email_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_user_email_accounts_updated ON public.user_email_accounts;
CREATE TRIGGER trg_user_email_accounts_updated BEFORE UPDATE ON public.user_email_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_email_templates_updated ON public.email_templates;
CREATE TRIGGER trg_email_templates_updated BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete)
SELECT unnest(enum_range(NULL::public.app_role)), 'email', true, true, false, false
ON CONFLICT (role, module) DO NOTHING;
UPDATE public.role_permissions SET can_edit = true, can_delete = true
WHERE module = 'email' AND role = 'admin';

INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete)
SELECT rp.role, 'qualite_enquetes', true,
  bool_or(rp.can_create), bool_or(rp.can_edit), bool_or(rp.can_delete)
FROM public.role_permissions rp
WHERE rp.module = 'qualite_tracabilite'
GROUP BY rp.role
ON CONFLICT (role, module) DO NOTHING;

INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete)
VALUES ('admin','qualite_enquetes',true,true,true,true),
       ('admin','erp_sync',true,true,true,true),
       ('responsable_si','erp_sync',true,true,true,true)
ON CONFLICT (role, module) DO UPDATE SET can_view=true, can_create=true, can_edit=true, can_delete=true;