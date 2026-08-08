-- Force correct logical dates and timestamps for August 8 tickets
-- This handles tickets that were imported without a closure timestamp

DO $$ 
BEGIN
    UPDATE public.reception_tickets
    SET cloture_at = (date_ticket + COALESCE(heure_fin, heure_debut, '12:00'::time))::timestamp AT TIME ZONE 'UTC'
    WHERE (date_ticket = '2026-08-08' OR numero LIKE '3 5%') AND cloture_at IS NULL;
    
    -- Also fix the December error if it was a typo in import
    UPDATE public.reception_tickets
    SET date_ticket = '2026-08-07'
    WHERE date_ticket = '2026-12-07';
END $$;
