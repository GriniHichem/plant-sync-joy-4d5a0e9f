#!/usr/bin/env bash
# =============================================================================
# Prod-in-Time — Préparation d'une base de données VIERGE pour l'auto-hébergement
# =============================================================================
#
# Pourquoi ce script ?
#   Sur la plateforme Lovable, l'historique des fichiers de migration déjà
#   appliqués est immuable (lecture seule). Deux migrations historiques
#   contiennent des données de test mélangées au schéma :
#     - 20260320031539_*.sql  -> 100% données de test (rôles figés, PDR, plans)
#     - 20260316183840_*.sql  -> bloc "Équipes A/B/C/D" (données métier)
#
#   Ce script produit une COPIE PROPRE des migrations (schéma uniquement),
#   prête à être déployée sur votre instance Supabase auto-hébergée pour
#   obtenir une usine 100% vide. Le `seed.sql` n'est volontairement pas copié.
#
# Usage :
#   ./scripts/prepare-production-db.sh [dossier_sortie]
#   (défaut : ./dist/supabase)
#   ./scripts/prepare-production-db.sh --replace-local
#   (remplace supabase/migrations par la copie propre, avec sauvegarde)
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$ROOT_DIR/supabase/migrations"
REPLACE_LOCAL="false"

if [[ "${1:-}" == "--replace-local" ]]; then
  REPLACE_LOCAL="true"
  OUT_DIR="$ROOT_DIR/dist/supabase"
else
  OUT_DIR="${1:-$ROOT_DIR/dist/supabase}"
fi
OUT_MIG="$OUT_DIR/migrations"

# Vérification pré-requis
if ! command -v python3 &>/dev/null; then
  echo "❌ Erreur : python3 est requis pour les substitutions."
  exit 1
fi

# Fichiers à neutraliser (données de test)
FULL_MOCK_GLOB="20260320031539_*.sql"
TEAMS_GLOB="20260316183840_*.sql"

echo "→ Source     : $SRC_DIR"
echo "→ Destination: $OUT_MIG"

if [ -d "$OUT_MIG" ]; then
  rm -rf "$OUT_MIG"
fi
mkdir -p "$OUT_MIG"
cp "$SRC_DIR"/*.sql "$OUT_MIG"/

# 1) Migration 100% mock -> no-op
for f in "$OUT_MIG"/$FULL_MOCK_GLOB; do
  [ -e "$f" ] || continue
  cat > "$f" <<'SQL'
-- Données de test retirées pour la production (déplacées dans supabase/seed.sql).
-- Migration laissée vide (no-op) pour préserver l'historique.
SELECT 1;
SQL
  echo "✓ Neutralisé (mock complet): $(basename "$f")"
done

# 2) Suppression du bloc d'insertion des équipes (shift_teams)
for f in "$OUT_MIG"/$TEAMS_GLOB; do
  [ -e "$f" ] || continue
  python3 - "$f" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
# Retire le bloc INSERT INTO public.shift_teams (...) VALUES ... ; (équipes de test)
# Version robuste : gère plusieurs lignes et stop au premier ; hors chaîne
s = re.sub(
    r"INSERT INTO\s+public\.shift_teams\s*\(.*?\)\s*VALUES.*?;",
    "-- (Équipes de démonstration retirées pour la production — voir supabase/seed.sql)",
    s,
    flags=re.IGNORECASE | re.DOTALL,
)
open(p, "w", encoding="utf-8").write(s)
PY
  echo "✓ Nettoyé (équipes de test): $(basename "$f")"
done

# 3) Rendre idempotents les appels cron.unschedule(...) sur une base vierge.
#    Sur une base neuve, le job n'existe pas et cron.unschedule(...) lève
#    "could not find valid entry for job" (XX000) -> migration en échec.
echo ""
echo "→ Sécurisation des appels cron.unschedule (base vierge)..."
for f in "$OUT_MIG"/*.sql; do
  [ -e "$f" ] || continue
  python3 - "$f" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
# Remplace:  SELECT cron.unschedule('job');   (avec ou sans SELECT/PERFORM)
# par un bloc DO ... gardé par un test d'existence + tolérance pg_cron absent.
def repl(m):
    # Ne pas retraiter un appel déjà encapsulé dans notre bloc sûr.
    if "$cron_cleanup$" in s[max(0, m.start() - 200):m.start()]:
        return m.group(0)
    job = m.group("job")
    return (
        "DO $cron_cleanup$\n"
        "BEGIN\n"
        "  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = '%s') THEN\n"
        "    PERFORM cron.unschedule('%s');\n"
        "  END IF;\n"
        "EXCEPTION WHEN undefined_table OR undefined_function THEN\n"
        "  NULL;\n"
        "END\n"
        "$cron_cleanup$;" % (job, job)
    )
# Regex améliorée pour supporter les espaces avant la parenthèse
pattern = re.compile(
    r"(?:SELECT|PERFORM)\s+cron\.unschedule\s*\(\s*'(?P<job>[^']+)'\s*\)\s*;",
    flags=re.IGNORECASE,
)
new = pattern.sub(repl, s)
if new != s:
    with open(p, "w", encoding="utf-8") as f:
        f.write(new)
    print("  ✓ %s" % p.split("/")[-1])
PY
done

# 4) Rendre les migrations cron auto-hébergeables.
#    - pg_cron/pg_net sont optionnels : leur absence ne doit jamais bloquer le schéma.
#    - les jobs ne doivent pas pointer vers une URL Lovable/Supabase Cloud figée.
echo ""
echo "→ Sécurisation des migrations cron (auto-hébergement)..."
for f in "$OUT_MIG"/20260428101115_*.sql; do
  [ -e "$f" ] || continue
  python3 - "$f" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
if "edge_functions_base_url" not in s:
    s = s.replace(
        "  ('cron_secret', encode(gen_random_bytes(24), 'hex'), 'Secret cron interne', 'Utilisé par les jobs cron pour appeler les edge functions', true)\nON CONFLICT (key) DO NOTHING;",
        "  ('cron_secret', encode(gen_random_bytes(24), 'hex'), 'Secret cron interne', 'Utilisé par les jobs cron pour appeler les edge functions', true),\n"
        "  ('edge_functions_base_url', '', 'URL fonctions backend', 'URL accessible depuis Postgres, sans slash final, ex: http://kong:8000/functions/v1', false)\n"
        "ON CONFLICT (key) DO NOTHING;",
    )
if "CREATE EXTENSION IF NOT EXISTS pg_cron;" in s or "CREATE EXTENSION IF NOT EXISTS pg_net;" in s:
    s = s.replace(
        "-- 3) Extensions for cron\nCREATE EXTENSION IF NOT EXISTS pg_cron;\nCREATE EXTENSION IF NOT EXISTS pg_net;",
        "-- 3) Extensions for cron (optionnelles en auto-hébergement)\n"
        "DO $optional_extensions$\n"
        "BEGIN\n"
        "  BEGIN\n"
        "    CREATE EXTENSION IF NOT EXISTS pg_cron;\n"
        "  EXCEPTION WHEN OTHERS THEN\n"
        "    RAISE NOTICE 'Extension pg_cron non activée: %', SQLERRM;\n"
        "  END;\n\n"
        "  BEGIN\n"
        "    CREATE EXTENSION IF NOT EXISTS pg_net;\n"
        "  EXCEPTION WHEN OTHERS THEN\n"
        "    RAISE NOTICE 'Extension pg_net non activée: %', SQLERRM;\n"
        "  END;\n"
        "END\n"
        "$optional_extensions$;",
    )
open(p, "w", encoding="utf-8").write(s)
print("  ✓ %s" % p.split("/")[-1])
PY
done

for f in "$OUT_MIG"/20260428101448_*.sql; do
  [ -e "$f" ] || continue
  cat > "$f" <<'SQL'
-- Job cron de rappels : auto-hébergeable et non bloquant.
-- Le job n'est créé que si pg_cron + pg_net existent ET si app_settings.edge_functions_base_url est renseigné.
DO $$
DECLARE
  v_secret text;
  v_base_url text;
  v_jobid bigint;
BEGIN
  SELECT value INTO v_secret FROM public.app_settings WHERE key = 'cron_secret';
  IF v_secret IS NULL OR v_secret = '' THEN
    v_secret := encode(gen_random_bytes(24), 'hex');
    INSERT INTO public.app_settings(key, value, label, description, is_secret)
      VALUES ('cron_secret', v_secret, 'Secret cron interne', 'Cron auth', true)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  END IF;

  INSERT INTO public.app_settings(key, value, label, description, is_secret)
    VALUES ('edge_functions_base_url', '', 'URL fonctions backend', 'URL accessible depuis Postgres, sans slash final, ex: http://kong:8000/functions/v1', false)
    ON CONFLICT (key) DO NOTHING;

  SELECT NULLIF(TRIM(value), '') INTO v_base_url
  FROM public.app_settings
  WHERE key = 'edge_functions_base_url';

  IF to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE 'pg_cron absent: job notifications-check-deadlines non créé.';
    RETURN;
  END IF;

  IF to_regnamespace('net') IS NULL THEN
    RAISE NOTICE 'pg_net absent: job notifications-check-deadlines non créé.';
    RETURN;
  END IF;

  IF v_base_url IS NULL THEN
    RAISE NOTICE 'app_settings.edge_functions_base_url vide: job notifications-check-deadlines non créé.';
    RETURN;
  END IF;

  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'notifications-check-deadlines';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  PERFORM cron.schedule(
    'notifications-check-deadlines',
    '0 6 * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', %L),
        body := '{}'::jsonb
      );
    $cron$, v_base_url || '/check-deadlines', v_secret)
  );
EXCEPTION WHEN undefined_schema OR undefined_table OR undefined_function OR insufficient_privilege THEN
  RAISE NOTICE 'Job notifications-check-deadlines ignoré: %', SQLERRM;
END$$;
SQL
  echo "  ✓ $(basename "$f")"
done

# 5) Rendre les buckets storage idempotents en cas de reprise/relance partielle.
echo ""
echo "→ Sécurisation des buckets storage..."
for f in "$OUT_MIG"/*.sql; do
  [ -e "$f" ] || continue
  python3 - "$f" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
new = re.sub(
    r"INSERT\s+INTO\s+storage\.buckets\s*\(([^)]*)\)\s*VALUES\s*\(([^;]*?)\)\s*;(?!\s*ON\s+CONFLICT)",
    r"INSERT INTO storage.buckets (\1) VALUES (\2)\nON CONFLICT (id) DO NOTHING;",
    s,
    flags=re.IGNORECASE | re.DOTALL,
)
if new != s:
    open(p, "w", encoding="utf-8").write(new)
    print("  ✓ %s" % p.split("/")[-1])
PY
done

# 6) Migration finale de durcissement pour l'auto-hébergement.
#    Les anciennes migrations historiques n'ajoutaient pas toutes les GRANT Data API.
cat > "$OUT_MIG/99999999999999_self_host_hardening.sql" <<'SQL'
-- Durcissement auto-hébergement : accès Data API explicite pour les tables publiques.
-- Ne crée aucune donnée métier ; garantit que RLS + GRANT fonctionnent sur une base vierge.
GRANT USAGE ON SCHEMA public TO authenticated, service_role;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', r.tablename);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', r.tablename);
  END LOOP;
END$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO authenticated', r.sequencename);
    EXECUTE format('GRANT ALL ON SEQUENCE public.%I TO service_role', r.sequencename);
  END LOOP;
END$$;
SQL
echo "✓ Migration de durcissement ajoutée: 99999999999999_self_host_hardening.sql"

# 7) Vérification : aucune donnée de test résiduelle évidente
echo ""
echo "→ Vérification des UUID de test résiduels..."
# On cherche les UUID connus de Lovable (admin par défaut, pdr de test, etc.)
TEST_UUIDS="61d5a0dd-40d9-41f5-aa30-3346ab8eec67|a0000001-0000-0000|d1000000-0000-0000"
if grep -RInE "$TEST_UUIDS" "$OUT_MIG" >/dev/null; then
  echo "⚠️  Des UUID de test subsistent dans $OUT_MIG — vérifiez manuellement :"
  grep -RInE "$TEST_UUIDS" "$OUT_MIG" || true
  exit 1
fi

echo "✓ Aucune donnée de test résiduelle détectée."
echo "→ Vérification des URLs Supabase/Lovable figées..."
ENV_URLS="https://[a-z0-9-]+\.supabase\.co|lovable\.app|luryiclhlftqikiqkwsp|izbgfamvoioznmelerui"
if grep -RInE "$ENV_URLS" "$OUT_MIG" >/dev/null; then
  echo "⚠️  Des URLs d'environnement figées subsistent dans $OUT_MIG — vérifiez manuellement :"
  grep -RInE "$ENV_URLS" "$OUT_MIG" || true
  exit 1
fi
echo "✓ Aucune URL d'environnement figée."
echo "→ Vérification anti-données utilisateur et idempotence storage..."
python3 - "$OUT_MIG" <<'PY'
import pathlib, re, sys
root = pathlib.Path(sys.argv[1])
errors = []
for p in sorted(root.glob("*.sql")):
    s = p.read_text(encoding="utf-8")
    if re.search(r"INSERT\s+INTO\s+public\.user_roles\b", s, re.I):
        errors.append(f"{p.name}: insertion directe dans public.user_roles")
    if re.search(r"(?:Équipe|Equipe)\s+[ABCD]\b", s, re.I):
        errors.append(f"{p.name}: équipes de démonstration encore présentes")
    for m in re.finditer(r"INSERT\s+INTO\s+storage\.buckets\b.*?;", s, re.I | re.S):
        if not re.search(r"ON\s+CONFLICT\s*\(", m.group(0), re.I):
            line = s[:m.start()].count("\n") + 1
            errors.append(f"{p.name}:{line}: bucket storage sans ON CONFLICT")
if errors:
    print("⚠️  Vérification échouée :")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("✓ Aucune insertion user_roles, aucune équipe démo, buckets idempotents.")
PY
echo ""
echo "Migrations propres générées dans : $OUT_MIG"
echo "Le fichier seed.sql n'a PAS été copié (base vierge garantie)."

if [[ "$REPLACE_LOCAL" == "true" ]]; then
  BACKUP_DIR="/tmp/prod-in-time-migrations.backup.$(date +%Y%m%d%H%M%S)"
  mv "$SRC_DIR" "$BACKUP_DIR"
  cp -R "$OUT_MIG" "$SRC_DIR"
  echo ""
  echo "✓ supabase/migrations remplacé par la version propre."
  echo "✓ Sauvegarde conservée dans : $BACKUP_DIR"
  echo "Vous pouvez maintenant relancer : supabase db push"
fi
