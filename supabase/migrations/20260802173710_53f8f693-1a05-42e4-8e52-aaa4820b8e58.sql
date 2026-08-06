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