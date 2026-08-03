-- ============ Table enquêtes de lot ============
CREATE TABLE IF NOT EXISTS public.quality_lot_investigations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  investigation_number text UNIQUE,
  production_date date NOT NULL,
  production_time time without time zone NOT NULL,
  window_hours numeric NOT NULL DEFAULT 2,
  lot_reference text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  anomaly_description text,
  analysis text,
  conclusion text,
  status text NOT NULL DEFAULT 'en_cours',
  nc_id uuid REFERENCES public.quality_non_conformities(id) ON DELETE SET NULL,
  created_by uuid,
  closed_by uuid,
  closed_at timestamp with time zone,
  reopened_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qli_status ON public.quality_lot_investigations(status);
CREATE INDEX IF NOT EXISTS idx_qli_nc ON public.quality_lot_investigations(nc_id);
CREATE INDEX IF NOT EXISTS idx_qli_date ON public.quality_lot_investigations(production_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_lot_investigations TO authenticated;
GRANT ALL ON public.quality_lot_investigations TO service_role;
ALTER TABLE public.quality_lot_investigations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_lot_investigation(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR public.has_role(_user_id, 'directeur_qualite')
      OR public.has_role(_user_id, 'responsable_controle_qualite');
$$;

DROP POLICY IF EXISTS "Authenticated can view lot investigations" ON public.quality_lot_investigations;
CREATE POLICY "Authenticated can view lot investigations"
  ON public.quality_lot_investigations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Quality managers can create lot investigations" ON public.quality_lot_investigations;
CREATE POLICY "Quality managers can create lot investigations"
  ON public.quality_lot_investigations FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_lot_investigation(auth.uid()) AND created_by = auth.uid());
DROP POLICY IF EXISTS "Quality managers can update lot investigations" ON public.quality_lot_investigations;
CREATE POLICY "Quality managers can update lot investigations"
  ON public.quality_lot_investigations FOR UPDATE TO authenticated
  USING (public.can_manage_lot_investigation(auth.uid()))
  WITH CHECK (public.can_manage_lot_investigation(auth.uid()));
DROP POLICY IF EXISTS "Admins can delete lot investigations" ON public.quality_lot_investigations;
CREATE POLICY "Admins can delete lot investigations"
  ON public.quality_lot_investigations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_qli_updated_at ON public.quality_lot_investigations;
CREATE TRIGGER trg_qli_updated_at BEFORE UPDATE ON public.quality_lot_investigations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.generate_lot_investigation_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seq int;
BEGIN
  IF NEW.investigation_number IS NULL OR NEW.investigation_number = '' THEN
    SELECT COUNT(*) + 1 INTO v_seq FROM public.quality_lot_investigations
      WHERE date_part('year', created_at) = date_part('year', now());
    NEW.investigation_number := 'ENQ-' || to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_qli_number ON public.quality_lot_investigations;
CREATE TRIGGER trg_qli_number BEFORE INSERT ON public.quality_lot_investigations
  FOR EACH ROW EXECUTE FUNCTION public.generate_lot_investigation_number();

-- ============ Historique ============
CREATE TABLE IF NOT EXISTS public.quality_lot_investigation_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  investigation_id uuid NOT NULL REFERENCES public.quality_lot_investigations(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qlil_inv ON public.quality_lot_investigation_logs(investigation_id, created_at DESC);

GRANT SELECT, INSERT ON public.quality_lot_investigation_logs TO authenticated;
GRANT ALL ON public.quality_lot_investigation_logs TO service_role;
ALTER TABLE public.quality_lot_investigation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view investigation logs" ON public.quality_lot_investigation_logs;
CREATE POLICY "Authenticated can view investigation logs"
  ON public.quality_lot_investigation_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Quality managers can add investigation logs" ON public.quality_lot_investigation_logs;
CREATE POLICY "Quality managers can add investigation logs"
  ON public.quality_lot_investigation_logs FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_lot_investigation(auth.uid()) AND user_id = auth.uid());

-- ============ Collecte des événements (lecture seule) ============
CREATE OR REPLACE FUNCTION public.lot_investigation_events(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (
  event_type text,
  occurred_at timestamptz,
  ended_at timestamptz,
  duration_minutes numeric,
  title text,
  detail text,
  ref_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'panne'::text,
         t.heure_declaration,
         COALESCE(t.heure_resolution, t.heure_cloture),
         COALESCE(t.temps_arret_minutes::numeric,
                  EXTRACT(EPOCH FROM (COALESCE(t.heure_resolution, t.heure_cloture) - t.heure_declaration)) / 60),
         COALESCE('Ticket ' || t.numero, 'Panne') || COALESCE(' — ' || m.designation, ''),
         COALESCE(pt.name || ' · ', '') || COALESCE(t.description, ''),
         t.id
  FROM public.tickets t
  LEFT JOIN public.machines m ON m.id = t.machine_id
  LEFT JOIN public.panne_types pt ON pt.id = t.panne_type_id
  WHERE t.heure_declaration BETWEEN p_from AND p_to

  UNION ALL
  SELECT 'intervention'::text,
         i.date_debut,
         i.date_fin,
         EXTRACT(EPOCH FROM (COALESCE(i.date_fin, i.date_debut) - i.date_debut)) / 60,
         'Intervention' || COALESCE(' · ' || t.numero, '')
           || COALESCE(' — ' || TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), ''),
         COALESCE(i.description, i.notes),
         i.id
  FROM public.interventions i
  LEFT JOIN public.tickets t ON t.id = i.ticket_id
  LEFT JOIN public.profiles p ON p.user_id = i.technicien_id
  WHERE i.date_debut BETWEEN p_from AND p_to

  UNION ALL
  SELECT 'controle'::text,
         qc.control_time,
         NULL::timestamptz,
         NULL::numeric,
         COALESCE(qi.name, 'Contrôle qualité')
           || CASE WHEN qc.is_conform IS TRUE THEN ' · OK'
                   WHEN qc.is_conform IS FALSE THEN ' · NOK' ELSE '' END,
         COALESCE(qc.measured_value_numeric::text || COALESCE(' ' || qc.unit, ''),
                  qc.selected_value, qc.measured_value_text,
                  CASE WHEN qc.measured_value_boolean THEN 'Oui' ELSE 'Non' END)
           || COALESCE(' · ' || TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), '')
           || COALESCE(' · ' || qc.comment, ''),
         qc.id
  FROM public.quality_checks qc
  LEFT JOIN public.quality_indicators qi ON qi.id = qc.indicator_id
  LEFT JOIN public.profiles p ON p.user_id = qc.controlled_by
  WHERE qc.control_time BETWEEN p_from AND p_to

  UNION ALL
  SELECT CASE WHEN ps.type IN ('changement_serie','nettoyage') THEN 'changement_serie' ELSE 'arret' END,
         ps.heure_debut,
         ps.heure_fin,
         COALESCE(ps.duree_minutes::numeric,
                  EXTRACT(EPOCH FROM (ps.heure_fin - ps.heure_debut)) / 60),
         REPLACE(ps.type::text, '_', ' ') || COALESCE(' — ' || l.designation, ''),
         COALESCE(ps.description, ''),
         ps.id
  FROM public.production_stops ps
  LEFT JOIN public.production_lines l ON l.id = ps.line_id
  WHERE ps.heure_debut BETWEEN p_from AND p_to

  UNION ALL
  SELECT 'alerte'::text,
         n.created_at,
         NULL::timestamptz,
         NULL::numeric,
         COALESCE(n.title, 'Alerte') || ' · ' || n.severity::text,
         COALESCE(n.message, ''),
         n.id
  FROM public.notifications n
  WHERE n.created_at BETWEEN p_from AND p_to
    AND n.severity IN ('medium','high','critical')

  UNION ALL
  SELECT 'reception'::text,
         (rt.date_ticket + COALESCE(rt.heure_debut, '00:00'::time))::timestamptz,
         CASE WHEN rt.heure_fin IS NOT NULL THEN (rt.date_ticket + rt.heure_fin)::timestamptz END,
         NULL::numeric,
         'Réception ' || rt.numero || COALESCE(' — ' || rs.nom, ''),
         COALESCE(rp.designation, '') || COALESCE(' · ' || ROUND(w.net, 2)::text || ' kg', ''),
         rt.id
  FROM public.reception_tickets rt
  LEFT JOIN public.reception_suppliers rs ON rs.id = rt.supplier_id
  LEFT JOIN public.reception_products rp ON rp.id = rt.product_id
  LEFT JOIN (
    SELECT ticket_id, SUM(poids_net_kg) AS net
    FROM public.reception_weighings GROUP BY ticket_id
  ) w ON w.ticket_id = rt.id
  WHERE (rt.date_ticket + COALESCE(rt.heure_debut, '00:00'::time))::timestamptz BETWEEN p_from AND p_to

  ORDER BY 2;
$$;

GRANT EXECUTE ON FUNCTION public.lot_investigation_events(timestamptz, timestamptz) TO authenticated;