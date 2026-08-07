-- Step-by-step migration to identify the exact point of failure and fix column names.
-- Part 1: Tables and initial schema

DO $$ 
BEGIN
    -- Ensure the table quality_of_indicator_overrides exists with the correct columns
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

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'qoio_select_authenticated' AND tablename = 'quality_of_indicator_overrides') THEN
        CREATE POLICY "qoio_select_authenticated" ON public.quality_of_indicator_overrides FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'qoio_manage_quality' AND tablename = 'quality_of_indicator_overrides') THEN
        CREATE POLICY "qoio_manage_quality" ON public.quality_of_indicator_overrides FOR ALL TO authenticated
        USING (public.has_quality_permission(auth.uid(), 'can_manage_assignments') OR public.has_role(auth.uid(), 'admin'))
        WITH CHECK (public.has_quality_permission(auth.uid(), 'can_manage_assignments') OR public.has_role(auth.uid(), 'admin'));
    END IF;
END $$;
