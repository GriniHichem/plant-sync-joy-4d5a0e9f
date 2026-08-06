-- 1) Logs de synchronisation ERP
CREATE TABLE public.erp_sync_logs (
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

CREATE POLICY "erp_sync_logs_select_admin" ON public.erp_sync_logs
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'responsable_si'));

CREATE INDEX idx_erp_sync_logs_created_at ON public.erp_sync_logs (created_at DESC);
CREATE INDEX idx_erp_sync_logs_resource ON public.erp_sync_logs (resource, created_at DESC);

-- 2) Etat de synchronisation par ressource
CREATE TABLE public.erp_sync_state (
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

CREATE POLICY "erp_sync_state_select_admin" ON public.erp_sync_state
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'responsable_si'));

CREATE TRIGGER trg_erp_sync_state_updated_at
BEFORE UPDATE ON public.erp_sync_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Idempotence des imports ERP
ALTER TABLE public.consumptions
  ADD COLUMN IF NOT EXISTS erp_ref text,
  ADD COLUMN IF NOT EXISTS erp_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uq_consumptions_erp_ref
  ON public.consumptions (erp_ref) WHERE erp_ref IS NOT NULL;

ALTER TABLE public.production_declarations
  ADD COLUMN IF NOT EXISTS erp_ref text,
  ADD COLUMN IF NOT EXISTS erp_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uq_production_declarations_erp_ref
  ON public.production_declarations (erp_ref) WHERE erp_ref IS NOT NULL;

ALTER TABLE public.pdr_stock_movements
  ADD COLUMN IF NOT EXISTS erp_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pdr_stock_movements_erp_ref
  ON public.pdr_stock_movements (ref_document_erp) WHERE ref_document_erp IS NOT NULL;