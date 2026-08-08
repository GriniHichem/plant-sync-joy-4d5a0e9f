-- Force correct logical dates and timestamps for August 8 tickets
-- This handles tickets that were imported without a closure timestamp

DO $$ 
BEGIN
    -- Fix tickets from August 8 that have null cloture_at
    -- We derive it from date_ticket + heure_fin (or 12:00 if unknown)
    UPDATE public.reception_tickets
    SET cloture_at = (date_ticket + COALESCE(heure_fin, heure_debut, '12:00'::time))::timestamp AT TIME ZONE 'UTC'
    WHERE (date_ticket = '2026-08-08' OR numero LIKE '3 5%') AND cloture_at IS NULL;
    
    -- Fix any logical errors where August was imported as December (2026-12-07 -> 2026-08-07)
    UPDATE public.reception_tickets
    SET date_ticket = '2026-08-07',
        cloture_at = ('2026-08-07'::date + COALESCE(heure_fin, heure_debut, '12:00'::time))::timestamp AT TIME ZONE 'UTC'
    WHERE date_ticket = '2026-12-07';
END $$;
