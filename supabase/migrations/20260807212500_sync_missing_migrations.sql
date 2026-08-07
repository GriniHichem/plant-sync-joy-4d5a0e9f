-- Consolidated migrations for sync

-- Migration: 20260729193102_aa233b58-5ab0-4ee3-b307-47cb7686c172.sql
CREATE TABLE IF NOT EXISTS public.quality_of_indicator_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  of_id uuid NOT NULL REFERENCES public.ordres_fabrication(id) ON DELETE CASCADE,
  indicator_id uuid NOT NULL REFERENCES public.quality_indicators(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'add',
  is_required boolean,
  is_blocking boolean,
  frequency_type public.quality_frequency_type,
  frequency_minutes integer,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quality_of_indicator_overrides_mode_chk CHECK (mode IN ('add','remove')),
  CONSTRAINT quality_of_indicator_overrides_uniq UNIQUE (of_id, indicator_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_of_indicator_overrides TO authenticated;
GRANT ALL ON public.quality_of_indicator_overrides TO service_role;

ALTER TABLE public.quality_of_indicator_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qoio_select_authenticated"
  ON public.quality_of_indicator_overrides FOR SELECT TO authenticated USING (true);

CREATE POLICY "qoio_manage_quality"
  ON public.quality_of_indicator_overrides FOR ALL TO authenticated
  USING (public.has_quality_permission(auth.uid(), 'can_manage_assignments') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_quality_permission(auth.uid(), 'can_manage_assignments') OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_qoio_of ON public.quality_of_indicator_overrides(of_id);
CREATE INDEX IF NOT EXISTS idx_qoio_indicator ON public.quality_of_indicator_overrides(indicator_id);

CREATE TRIGGER trg_qoio_updated_at
  BEFORE UPDATE ON public.quality_of_indicator_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_quality_indicators_for_of(p_of_id uuid)
 RETURNS TABLE(indicator_id uuid, code text, name text, description text, indicator_type text, category text, unit text, target_value numeric, min_value numeric, max_value numeric, tolerance_minus numeric, tolerance_plus numeric, select_options jsonb, effective_frequency_type text, effective_frequency_minutes integer, effective_is_required boolean, effective_is_blocking boolean, match_scope text, assignment_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH of_ctx AS (
    SELECT
      o.id AS of_id, o.product_id, o.recipe_id, o.line_id, p.family_id
    FROM public.ordres_fabrication o
    LEFT JOIN public.products p ON p.id = o.product_id
    WHERE o.id = p_of_id
  ),
  ov AS (
    SELECT * FROM public.quality_of_indicator_overrides WHERE of_id = p_of_id
  ),
  candidates AS (
    SELECT
      qi.id AS indicator_id,
      qi.code, qi.name, qi.description,
      qi.indicator_type::text, qi.category::text,
      qi.unit, qi.target_value, qi.min_value, qi.max_value,
      qi.tolerance_minus, qi.tolerance_plus,
      to_jsonb(qi.select_options) AS select_options,
      COALESCE(a.frequency_type::text, qi.frequency_type::text) AS effective_frequency_type,
      COALESCE(a.frequency_minutes, qi.frequency_minutes) AS effective_frequency_minutes,
      (a.is_required OR qi.is_required) AS effective_is_required,
      (a.is_blocking OR qi.is_blocking) AS effective_is_blocking,
      CASE
        WHEN a.recipe_id IS NOT NULL THEN 'recipe'
        WHEN a.product_id IS NOT NULL THEN 'product'
        WHEN a.product_family_id IS NOT NULL THEN 'family'
        WHEN a.production_line_id IS NOT NULL THEN 'line'
        ELSE 'global'
      END AS match_scope,
      CASE
        WHEN a.recipe_id IS NOT NULL THEN 5
        WHEN a.product_id IS NOT NULL THEN 4
        WHEN a.product_family_id IS NOT NULL THEN 3
        WHEN a.production_line_id IS NOT NULL THEN 2
        ELSE 1
      END AS scope_priority,
      a.id AS assignment_id
    FROM public.quality_indicator_assignments a
    JOIN public.quality_indicators qi ON qi.id = a.indicator_id
    CROSS JOIN of_ctx ctx
    WHERE qi.is_active = true
      AND (
        (a.product_id IS NOT NULL AND a.product_id = ctx.product_id)
        OR (a.product_family_id IS NOT NULL AND a.product_family_id = ctx.family_id)
        OR (a.production_line_id IS NOT NULL AND a.production_line_id = ctx.line_id)
        OR (a.recipe_id IS NOT NULL AND a.recipe_id = ctx.recipe_id)
        OR (a.product_id IS NULL AND a.product_family_id IS NULL AND a.production_line_id IS NULL AND a.recipe_id IS NULL)
      )

    UNION ALL

    SELECT
      qi.id, qi.code, qi.name, qi.description,
      qi.indicator_type::text, qi.category::text,
      qi.unit, qi.target_value, qi.min_value, qi.max_value,
      qi.tolerance_minus, qi.tolerance_plus,
      to_jsonb(qi.select_options),
      qi.frequency_type::text, qi.frequency_minutes,
      qi.is_required, qi.is_blocking,
      'global'::text, 1, NULL::uuid
    FROM public.quality_indicators qi
    WHERE qi.is_active = true
      AND NOT EXISTS (SELECT 1 FROM public.quality_indicator_assignments a WHERE a.indicator_id = qi.id)

    UNION ALL

    -- Dérogation locale : contrôle ajouté directement sur l'OF
    SELECT
      qi.id, qi.code, qi.name, qi.description,
      qi.indicator_type::text, qi.category::text,
      qi.unit, qi.target_value, qi.min_value, qi.max_value,
      qi.tolerance_minus, qi.tolerance_plus,
      to_jsonb(qi.select_options),
      COALESCE(o.frequency_type::text, qi.frequency_type::text),
      COALESCE(o.frequency_minutes, qi.frequency_minutes),
      COALESCE(o.is_required, qi.is_required),
      COALESCE(o.is_blocking, qi.is_blocking),
      'of'::text, 6, NULL::uuid
    FROM ov o
    JOIN public.quality_indicators qi ON qi.id = o.indicator_id
    WHERE o.mode = 'add' AND qi.is_active = true
  ),
  ranked AS (
    SELECT c.*,
      ROW_NUMBER() OVER (PARTITION BY c.indicator_id ORDER BY c.scope_priority DESC, c.assignment_id NULLS LAST) AS rn
    FROM candidates c
  )
  SELECT
    r.indicator_id, r.code, r.name, r.description,
    r.indicator_type, r.category, r.unit,
    r.target_value, r.min_value, r.max_value,
    r.tolerance_minus, r.tolerance_plus, r.select_options,
    COALESCE(o.frequency_type::text, r.effective_frequency_type),
    COALESCE(o.frequency_minutes, r.effective_frequency_minutes),
    COALESCE(o.is_required, r.effective_is_required),
    COALESCE(o.is_blocking, r.effective_is_blocking),
    CASE WHEN o.id IS NOT NULL THEN 'of' ELSE r.match_scope END,
    r.assignment_id
  FROM ranked r
  LEFT JOIN ov o ON o.indicator_id = r.indicator_id
  WHERE r.rn = 1
    AND COALESCE(o.mode, 'add') <> 'remove'
  ORDER BY r.category, r.code;
$function$;

-- Migration: 20260729203841_8692e5f6-37fd-4347-a0fc-b6990787a3ec.sql
-- 1) Unicité stricte des affectations (même indicateur / même périmètre)
CREATE UNIQUE INDEX IF NOT EXISTS quality_indicator_assignments_scope_uniq
  ON public.quality_indicator_assignments (
    indicator_id,
    COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(product_family_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(production_line_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(recipe_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- 2) Pas d'ajout local d'un contrôle déjà présent dans le plan de l'OF
CREATE OR REPLACE FUNCTION public.quality_of_override_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_scope text;
BEGIN
  IF NEW.mode = 'add' THEN
    SELECT g.match_scope INTO v_scope
    FROM public.get_quality_indicators_for_of(NEW.of_id) g
    WHERE g.indicator_id = NEW.indicator_id
    LIMIT 1;

    IF v_scope IS NOT NULL AND v_scope <> 'of' THEN
      RAISE EXCEPTION 'Ce contrôle est déjà présent dans le plan de cet OF (origine : %). Ajout en double impossible.', v_scope
        USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qoio_validate ON public.quality_of_indicator_overrides;
CREATE TRIGGER trg_qoio_validate
  BEFORE INSERT OR UPDATE ON public.quality_of_indicator_overrides
  FOR EACH ROW EXECUTE FUNCTION public.quality_of_override_validate();

-- 3) Anti double-saisie de la même mesure
CREATE UNIQUE INDEX IF NOT EXISTS quality_checks_of_indicator_time_uniq
  ON public.quality_checks (of_id, indicator_id, control_time);

-- Migration: 20260729204815_509d4dd3-a780-4f35-9def-4be7e4717fef.sql
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

-- Migration: 20260729212048_4ab296bb-f319-46d9-a1fc-21e2f0743c5e.sql
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

-- Migration: 20260729214340_05511d1b-730c-4747-80d2-129563f3f640.sql
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

-- Migration: 20260729214904_e4251eea-94a8-4f04-9084-95baaedbc758.sql
ALTER TABLE public.direction_dashboard_defaults
DROP CONSTRAINT IF EXISTS direction_dashboard_defaults_user_id_fkey;

-- Migration: 20260729215659_a6d6490b-2fc6-4285-be77-9ccf07ca7a3e.sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.direction_dashboards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.direction_dashboard_shares TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.direction_dashboard_defaults TO authenticated;

GRANT ALL ON public.direction_dashboards TO service_role;
GRANT ALL ON public.direction_dashboard_shares TO service_role;
GRANT ALL ON public.direction_dashboard_defaults TO service_role;

-- Migration: 20260802172304_8c58ce99-97c0-40b7-9f71-ad4a72c901ae.sql
-- ============ Table enquêtes de lot ============
CREATE TABLE public.quality_lot_investigations (
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

CREATE INDEX idx_qli_status ON public.quality_lot_investigations(status);
CREATE INDEX idx_qli_nc ON public.quality_lot_investigations(nc_id);
CREATE INDEX idx_qli_date ON public.quality_lot_investigations(production_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_lot_investigations TO authenticated;
GRANT ALL ON public.quality_lot_investigations TO service_role;
ALTER TABLE public.quality_lot_investigations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_lot_investigation(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR public.has_role(_user_id, 'directeur_qualite')
      OR public.has_role(_user_id, 'responsable_controle_qualite');
$$;

CREATE POLICY "Authenticated can view lot investigations"
  ON public.quality_lot_investigations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Quality managers can create lot investigations"
  ON public.quality_lot_investigations FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_lot_investigation(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Quality managers can update lot investigations"
  ON public.quality_lot_investigations FOR UPDATE TO authenticated
  USING (public.can_manage_lot_investigation(auth.uid()))
  WITH CHECK (public.can_manage_lot_investigation(auth.uid()));
CREATE POLICY "Admins can delete lot investigations"
  ON public.quality_lot_investigations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_qli_updated_at BEFORE UPDATE ON public.quality_lot_investigations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- numéro auto ENQ-YYYY-#####
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
CREATE TRIGGER trg_qli_number BEFORE INSERT ON public.quality_lot_investigations
  FOR EACH ROW EXECUTE FUNCTION public.generate_lot_investigation_number();

-- ============ Historique ============
CREATE TABLE public.quality_lot_investigation_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  investigation_id uuid NOT NULL REFERENCES public.quality_lot_investigations(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX idx_qlil_inv ON public.quality_lot_investigation_logs(investigation_id, created_at DESC);

GRANT SELECT, INSERT ON public.quality_lot_investigation_logs TO authenticated;
GRANT ALL ON public.quality_lot_investigation_logs TO service_role;
ALTER TABLE public.quality_lot_investigation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view investigation logs"
  ON public.quality_lot_investigation_logs FOR SELECT TO authenticated USING (true);
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
  -- Pannes machine (tickets)
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
  -- Interventions techniques
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
  -- Contrôles qualité
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
  -- Arrêts de production / changements de série / nettoyages
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
  -- Alertes / notifications
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
  -- Réceptions matières
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

-- Migration: 20260802173710_53f8f693-1a05-42e4-8e52-aaa4820b8e58.sql
INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete)
SELECT rp.role, 'qualite_enquetes',
  true,
  bool_or(rp.can_create), bool_or(rp.can_edit), bool_or(rp.can_delete)
FROM public.role_permissions rp
WHERE rp.module = 'qualite_tracabilite'
GROUP BY rp.role
ON CONFLICT (role, module) DO NOTHING;

INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete)
VALUES ('admin','qualite_enquetes',true,true,true,true)
ON CONFLICT (role, module) DO UPDATE SET can_view=true, can_create=true, can_edit=true, can_delete=true;

-- Migration: 20260802182304_d18f6e52-46f4-49b2-ba81-72ae71c683a5.sql
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

-- Migration: 20260802190231_b8561c1e-2743-444b-a72d-4aeacb077edc.sql
INSERT INTO public.app_settings (key, value, label, description, is_secret)
VALUES
  ('erp_sync.api_key', 'erp_' || replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''), 'Clé de service API ERP', 'Clé machine-to-machine (header X-API-Key). Plusieurs clés séparées par des virgules pour la rotation.', true),
  ('erp_sync.service_user_id', COALESCE((SELECT user_id::text FROM public.user_roles WHERE role = 'admin' ORDER BY user_id LIMIT 1), ''), 'Utilisateur technique API ERP', 'Compte auquel sont imputées les écritures faites via clé de service', false)
ON CONFLICT (key) DO NOTHING;

-- Migration: 20260802195332_b3e17a30-1c75-41f9-bce1-6b21975a089c.sql
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
