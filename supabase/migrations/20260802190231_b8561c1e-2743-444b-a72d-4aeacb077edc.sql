INSERT INTO public.app_settings (key, value, label, description, is_secret)
VALUES
  ('erp_sync.api_key', 'erp_' || replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''), 'Clé de service API ERP', 'Clé machine-to-machine (header X-API-Key). Plusieurs clés séparées par des virgules pour la rotation.', true),
  ('erp_sync.service_user_id', COALESCE((SELECT user_id::text FROM public.user_roles WHERE role = 'admin' ORDER BY user_id LIMIT 1), ''), 'Utilisateur technique API ERP', 'Compte auquel sont imputées les écritures faites via clé de service', false)
ON CONFLICT (key) DO NOTHING;