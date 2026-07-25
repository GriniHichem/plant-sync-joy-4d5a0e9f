DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.app_role'::regtype AND enumlabel = 'agent_pont_bascule') THEN
    ALTER TYPE public.app_role ADD VALUE 'agent_pont_bascule';
  END IF;
END $$;
