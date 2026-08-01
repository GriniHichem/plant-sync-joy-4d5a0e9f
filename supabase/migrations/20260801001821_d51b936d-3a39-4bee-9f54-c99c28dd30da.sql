INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete)
SELECT r.role, 'qualite_plan_controle',
  r.role IN ('admin','responsable_si','directeur_qualite','responsable_controle_qualite','controleur_qualite','auditeur','bureau_methode','resp_production','chef_ligne'),
  r.role IN ('admin','responsable_si','directeur_qualite','responsable_controle_qualite','bureau_methode'),
  r.role IN ('admin','responsable_si','directeur_qualite','responsable_controle_qualite','bureau_methode'),
  r.role IN ('admin','responsable_si','directeur_qualite','responsable_controle_qualite')
FROM (SELECT DISTINCT role FROM public.role_permissions) r
ON CONFLICT (role, module) DO NOTHING;