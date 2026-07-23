
-- Ajout du rôle agreeur aux politiques RLS Réception
DROP POLICY IF EXISTS reception_tickets_ins ON public.reception_tickets;
CREATE POLICY reception_tickets_ins ON public.reception_tickets FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'responsable_si'::app_role)
  OR has_role(auth.uid(),'directeur_qualite'::app_role) OR has_role(auth.uid(),'responsable_controle_qualite'::app_role)
  OR has_role(auth.uid(),'controleur_qualite'::app_role) OR has_role(auth.uid(),'agreeur'::app_role)
);

DROP POLICY IF EXISTS reception_tickets_upd ON public.reception_tickets;
CREATE POLICY reception_tickets_upd ON public.reception_tickets FOR UPDATE TO authenticated
USING (
  statut = 'ouvert' AND (
    has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'responsable_si'::app_role)
    OR has_role(auth.uid(),'directeur_qualite'::app_role) OR has_role(auth.uid(),'responsable_controle_qualite'::app_role)
    OR has_role(auth.uid(),'controleur_qualite'::app_role) OR has_role(auth.uid(),'agreeur'::app_role)
  )
);

DROP POLICY IF EXISTS reception_tickets_read ON public.reception_tickets;
CREATE POLICY reception_tickets_read ON public.reception_tickets FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'responsable_si'::app_role)
  OR has_role(auth.uid(),'directeur_qualite'::app_role) OR has_role(auth.uid(),'responsable_controle_qualite'::app_role)
  OR has_role(auth.uid(),'controleur_qualite'::app_role) OR has_role(auth.uid(),'agent_pont_bascule'::app_role)
  OR has_role(auth.uid(),'auditeur'::app_role) OR has_role(auth.uid(),'agreeur'::app_role)
);

DROP POLICY IF EXISTS reception_photos_write ON public.reception_ticket_photos;
CREATE POLICY reception_photos_write ON public.reception_ticket_photos FOR ALL TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'responsable_si'::app_role)
  OR has_role(auth.uid(),'directeur_qualite'::app_role) OR has_role(auth.uid(),'responsable_controle_qualite'::app_role)
  OR has_role(auth.uid(),'controleur_qualite'::app_role) OR has_role(auth.uid(),'agreeur'::app_role)
)
WITH CHECK (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'responsable_si'::app_role)
  OR has_role(auth.uid(),'directeur_qualite'::app_role) OR has_role(auth.uid(),'responsable_controle_qualite'::app_role)
  OR has_role(auth.uid(),'controleur_qualite'::app_role) OR has_role(auth.uid(),'agreeur'::app_role)
);

DROP POLICY IF EXISTS reception_photos_read ON public.reception_ticket_photos;
CREATE POLICY reception_photos_read ON public.reception_ticket_photos FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'responsable_si'::app_role)
  OR has_role(auth.uid(),'directeur_qualite'::app_role) OR has_role(auth.uid(),'responsable_controle_qualite'::app_role)
  OR has_role(auth.uid(),'controleur_qualite'::app_role) OR has_role(auth.uid(),'agent_pont_bascule'::app_role)
  OR has_role(auth.uid(),'auditeur'::app_role) OR has_role(auth.uid(),'agreeur'::app_role)
);

DROP POLICY IF EXISTS reception_weighings_read ON public.reception_weighings;
CREATE POLICY reception_weighings_read ON public.reception_weighings FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'responsable_si'::app_role)
  OR has_role(auth.uid(),'directeur_qualite'::app_role) OR has_role(auth.uid(),'responsable_controle_qualite'::app_role)
  OR has_role(auth.uid(),'controleur_qualite'::app_role) OR has_role(auth.uid(),'agent_pont_bascule'::app_role)
  OR has_role(auth.uid(),'auditeur'::app_role) OR has_role(auth.uid(),'agreeur'::app_role)
);
