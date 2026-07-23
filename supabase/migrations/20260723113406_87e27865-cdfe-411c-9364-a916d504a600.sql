
-- Open read access to reception reference data (produits, campagnes, fournisseurs)
-- to every authenticated user. Access to the app itself is already gated by the
-- module permission system in the UI; RLS should not block reference lookups
-- for users who legitimately work in Réception (e.g. agréeur) but do not have
-- the paramétrage rights.

DROP POLICY IF EXISTS reception_products_read ON public.reception_products;
CREATE POLICY reception_products_read ON public.reception_products
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS reception_campaigns_read ON public.reception_campaigns;
CREATE POLICY reception_campaigns_read ON public.reception_campaigns
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS reception_suppliers_read ON public.reception_suppliers;
CREATE POLICY reception_suppliers_read ON public.reception_suppliers
  FOR SELECT TO authenticated USING (true);
