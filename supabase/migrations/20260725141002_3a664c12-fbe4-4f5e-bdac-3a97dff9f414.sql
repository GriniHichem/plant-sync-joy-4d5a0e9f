INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, created_at, updated_at)
VALUES ('agent_pont_bascule','reception', true, false, false, false, now(), now())
ON CONFLICT (role, module) DO UPDATE SET can_view = EXCLUDED.can_view, updated_at = now();
