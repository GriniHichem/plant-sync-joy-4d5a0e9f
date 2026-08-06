-- Comptes email utilisateurs
CREATE TABLE public.user_email_accounts (
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
CREATE POLICY "own email account read" ON public.user_email_accounts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own email account delete" ON public.user_email_accounts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Modèles d'emails (admin en partie 2)
CREATE TABLE public.email_templates (
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
CREATE POLICY "templates readable by authenticated" ON public.email_templates
  FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage templates" ON public.email_templates
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Historique des envois
CREATE TABLE public.email_logs (
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
CREATE INDEX idx_email_logs_user_created ON public.email_logs(user_id, created_at DESC);
GRANT SELECT ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own email logs" ON public.email_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_user_email_accounts_updated BEFORE UPDATE ON public.user_email_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_email_templates_updated BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Accès module "email" : visible par tous les rôles, admin gère les modèles
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete)
SELECT unnest(enum_range(NULL::public.app_role)), 'email', true, true, false, false
ON CONFLICT DO NOTHING;
UPDATE public.role_permissions SET can_edit = true, can_delete = true
WHERE module = 'email' AND role = 'admin';