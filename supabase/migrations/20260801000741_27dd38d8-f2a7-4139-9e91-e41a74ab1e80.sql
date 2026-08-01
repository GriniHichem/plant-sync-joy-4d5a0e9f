CREATE TABLE IF NOT EXISTS public.user_dashboard_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_dashboard_id uuid REFERENCES public.direction_dashboards(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_dashboard_preferences TO authenticated;
GRANT ALL ON public.user_dashboard_preferences TO service_role;

ALTER TABLE public.user_dashboard_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own dashboard preference" ON public.user_dashboard_preferences;
CREATE POLICY "Users manage their own dashboard preference"
ON public.user_dashboard_preferences
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_user_dashboard_preferences_updated_at ON public.user_dashboard_preferences;
CREATE TRIGGER update_user_dashboard_preferences_updated_at
BEFORE UPDATE ON public.user_dashboard_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();