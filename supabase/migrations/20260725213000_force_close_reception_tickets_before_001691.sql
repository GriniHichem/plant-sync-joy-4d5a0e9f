-- Reprise historique demandée : clôturer les tickets de réception encore
-- ouverts dont le numéro est strictement antérieur à 001691.
--
-- La comparaison est numérique afin de traiter de la même façon 334 et 000334.
-- Le ticket 001691 lui-même n'est pas modifié.

DO $$
DECLARE
  v_closed_count integer;
BEGIN
  PERFORM set_config('prodintime.bypass_lock', 'on', true);

  UPDATE public.reception_tickets
  SET
    statut = 'cloture',
    cloture_at = COALESCE(cloture_at, now())
  WHERE statut = 'ouvert'
    AND btrim(numero) ~ '^[0-9]+$'
    AND btrim(numero)::bigint < 1691;

  GET DIAGNOSTICS v_closed_count = ROW_COUNT;
  RAISE NOTICE '% ticket(s) de réception clôturé(s) avant 001691', v_closed_count;
END;
$$;
