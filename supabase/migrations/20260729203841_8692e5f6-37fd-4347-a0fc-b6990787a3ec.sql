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