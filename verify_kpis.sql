BEGIN;

-- Setup test data
DELETE FROM reception_tickets WHERE numero LIKE 'TEST-%';

-- 1. Create a ticket at 01:00 UTC on 08/08 (belongs to Nuit of 07/08)
INSERT INTO reception_tickets (numero, campaign_id, product_id, supplier_id, statut, cloture_at, taux_abattement)
VALUES ('TEST-01', (SELECT id FROM reception_campaigns LIMIT 1), (SELECT product_id FROM reception_campaigns LIMIT 1), (SELECT id FROM reception_suppliers LIMIT 1), 'cloture', '2026-08-08 01:00:00+00', 5);

INSERT INTO reception_weighings (ticket_id, poids_brut_kg, taux_abattement_snapshot)
VALUES ((SELECT id FROM reception_tickets WHERE numero = 'TEST-01'), 1000, 5);

-- 2. Create a ticket at 23:00 UTC on 07/08 (belongs to Nuit of 07/08)
INSERT INTO reception_tickets (numero, campaign_id, product_id, supplier_id, statut, cloture_at, taux_abattement)
VALUES ('TEST-02', (SELECT id FROM reception_campaigns LIMIT 1), (SELECT product_id FROM reception_campaigns LIMIT 1), (SELECT id FROM reception_suppliers LIMIT 1), 'cloture', '2026-08-07 23:00:00+00', 10);

INSERT INTO reception_weighings (ticket_id, poids_brut_kg, taux_abattement_snapshot)
VALUES ((SELECT id FROM reception_tickets WHERE numero = 'TEST-02'), 2000, 10);

-- 3. Create a ticket at 07:00 UTC on 07/08 (belongs to Matin of 07/08)
INSERT INTO reception_tickets (numero, campaign_id, product_id, supplier_id, statut, cloture_at, taux_abattement)
VALUES ('TEST-03', (SELECT id FROM reception_campaigns LIMIT 1), (SELECT product_id FROM reception_campaigns LIMIT 1), (SELECT id FROM reception_suppliers LIMIT 1), 'cloture', '2026-08-07 07:00:00+00', 2);

INSERT INTO reception_weighings (ticket_id, poids_brut_kg, taux_abattement_snapshot)
VALUES ((SELECT id FROM reception_tickets WHERE numero = 'TEST-03'), 500, 2);

-- Run KPI for 07/08
SELECT * FROM json_populate_recordset(null::record, get_reception_qualitative_kpis('2026-08-07'))
AS (period_name text, avg_abattement_pct numeric, total_abattement_kg numeric, total_net_kg numeric, tickets_count int);

ROLLBACK;
