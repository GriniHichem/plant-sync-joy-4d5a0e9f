#!/usr/bin/env bash
# =============================================================================
# Prod-in-Time — Génère un BASELINE de schéma complet et fiable
# =============================================================================
# Ce script se connecte à la base SOURCE (Lovable Cloud) via $SUPABASE_DB_URL et
# produit UN SEUL fichier SQL autonome contenant TOUT le schéma applicatif :
#   - extensions requises (idempotentes)
#   - schéma public : types/enums, tables, fonctions, triggers, RLS, GRANT
#   - buckets storage + politiques storage (idempotents)
#
# Le fichier produit est la source de vérité pour un déploiement auto-hébergé :
# il s'applique en UNE PASSE sur une base vierge, sans dépendre des 85 migrations
# incrémentales (qui peuvent échouer en cascade).
#
# Usage :  SUPABASE_DB_URL=postgres://... ./scripts/generate-baseline.sh
# Sortie : supabase/baseline/00000000000000_baseline.sql
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/supabase/baseline"
OUT="$OUT_DIR/00000000000000_baseline.sql"
mkdir -p "$OUT_DIR"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "❌ SUPABASE_DB_URL doit pointer vers la base SOURCE." >&2
  exit 1
fi

TMP_PUBLIC="$(mktemp)"
TMP_STORAGE="$(mktemp)"

echo "→ Dump du schéma public (tables, fonctions, triggers, RLS, GRANT)..."
# On retire :
#  - les méta-commandes psql \restrict
#  - le CREATE SCHEMA public (déjà présent sur une base Supabase)
#  - les GRANT vers des rôles spécifiques à l'environnement source
#    (postgres, sandbox_exec, supabase_admin, authenticator, dashboard_user...)
#    qui n'existent pas sur une instance auto-hébergée.
pg_dump "$SUPABASE_DB_URL" --schema-only --schema=public --no-owner --no-comments \
  | grep -vE '^\\(un)?restrict' \
  | grep -vE '^CREATE SCHEMA public;$' \
  | grep -vE '^GRANT .* TO (postgres|sandbox_exec|supabase_admin|authenticator|dashboard_user|supabase_read_only_user|supabase_storage_admin|supabase_auth_admin);$' \
  | grep -vE '^ALTER DEFAULT PRIVILEGES ' \
  > "$TMP_PUBLIC"

echo "→ Dump des politiques storage.objects..."
pg_dump "$SUPABASE_DB_URL" --schema-only --schema=storage --table='storage.objects' --no-owner --no-comments \
  | grep -iE 'CREATE POLICY' > "$TMP_STORAGE" || true

echo "→ Assemblage de $OUT ..."
{
  cat <<'HEADER'
-- =============================================================================
-- Prod-in-Time — BASELINE de schéma (déploiement auto-hébergé)
-- Généré par scripts/generate-baseline.sh — NE PAS éditer à la main.
--
-- Ce fichier crée 100% du schéma applicatif sur une base Supabase VIERGE.
-- Il NE contient AUCUNE donnée métier ni utilisateur de test.
-- Toute l'autorisation repose sur auth.uid() + la table public.user_roles.
--
-- Application :  psql "$DATABASE_URL" -f 00000000000000_baseline.sql
-- =============================================================================

SET statement_timeout = 0;
SET client_min_messages = warning;
SET row_security = off;

-- 0) Extensions requises (idempotentes, tolérantes en auto-hébergement).
DO $ext$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE EXTENSION IF NOT EXISTS unaccent;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Extension non installée: %', SQLERRM;
END
$ext$;

HEADER

  echo "-- ============================================================================="
  echo "-- 1) SCHÉMA PUBLIC (types, tables, fonctions, triggers, RLS, GRANT)"
  echo "-- ============================================================================="
  cat "$TMP_PUBLIC"

  echo ""
  echo "-- ============================================================================="
  echo "-- 2) BUCKETS STORAGE (idempotents)"
  echo "-- ============================================================================="
  cat <<'BUCKETS'
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('entity-documents',  'entity-documents',  true),
  ('entity-images',     'entity-images',     true),
  ('machine-documents', 'machine-documents', true)
ON CONFLICT (id) DO NOTHING;

BUCKETS

  echo "-- ============================================================================="
  echo "-- 3) POLITIQUES STORAGE (idempotentes)"
  echo "-- ============================================================================="
  # Rendre chaque CREATE POLICY idempotent via DROP POLICY IF EXISTS préalable.
  while IFS= read -r line; do
    name="$(echo "$line" | sed -E 's/^CREATE POLICY "([^"]+)".*/\1/')"
    echo "DROP POLICY IF EXISTS \"$name\" ON storage.objects;"
    echo "$line"
  done < "$TMP_STORAGE"

  echo ""
  echo "-- ============================================================================="
  echo "-- 4) DROITS EXECUTE SUR LES FONCTIONS (durcissement sécurité)"
  echo "-- ============================================================================="
  # pg_dump --schema-only n'émet pas toujours de GRANT EXECUTE explicite quand les
  # fonctions reposent sur les privilèges par défaut. Sur une base auto-hébergée,
  # cela peut casser les politiques RLS qui appellent has_role() côté 'authenticated'.
  # On rejoue donc le même durcissement que les migrations de sécurité :
  #  - REVOKE de anon/public sur toutes les fonctions public
  #  - re-GRANT EXECUTE à authenticated (non-trigger) + service_role (toutes)
  #  - re-GRANT EXECUTE à anon uniquement pour resolve_scanned_code (scan pré-auth)
  cat <<'FNGRANTS'
DO $fn$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args,
           (p.prorettype = 'trigger'::regtype) AS is_trigger
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, public;', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role;', r.proname, r.args);
    IF NOT r.is_trigger THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated;', r.proname, r.args);
    END IF;
  END LOOP;

  -- Scan QR/code-barres avant authentification : exécutable par anon.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'resolve_scanned_code'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.resolve_scanned_code(text) TO anon;';
  END IF;
END
$fn$;

FNGRANTS

  echo "-- ============================================================================="
  echo "-- 5) MATRICE DE PERMISSIONS PAR ROLE (config systeme, idempotente)"
  echo "-- ============================================================================="
  # role_permissions est une table de configuration (pas de donnee metier/utilisateur).
  # Elle est indispensable au fonctionnement des menus/acces : sans elle, des modules
  # comme shift_maintenance sont invisibles sur un deploiement auto-heberge.
  # On rejoue la matrice complete depuis la base de reference au moment de la generation.
  echo "ALTER TABLE public.role_permissions"
  echo "  ALTER COLUMN created_at SET DEFAULT now(),"
  echo "  ALTER COLUMN updated_at SET DEFAULT now();"
  echo ""
  echo "GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;"
  echo "GRANT ALL ON public.role_permissions TO service_role;"
  echo ""
  echo "INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete, created_at, updated_at)"
  echo "VALUES"
  psql "$SUPABASE_DB_URL" -t -A -F$'\t' \
    -c "SELECT role, module, can_view, can_create, can_edit, can_delete FROM public.role_permissions ORDER BY role, module;" \
    | awk -F'\t' 'NR>1{printf ",\n"} {printf "  ('\''%s'\'','\''%s'\'',%s,%s,%s,%s,now(),now())", $1,$2, ($3=="t"?"true":"false"), ($4=="t"?"true":"false"), ($5=="t"?"true":"false"), ($6=="t"?"true":"false")}'
  echo ""
  echo "ON CONFLICT (role, module) DO UPDATE"
  echo "  SET can_view = EXCLUDED.can_view,"
  echo "      can_create = EXCLUDED.can_create,"
  echo "      can_edit = EXCLUDED.can_edit,"
  echo "      can_delete = EXCLUDED.can_delete,"
  echo "      updated_at = now();"
  echo ""


  echo "-- ============================================================================="
  echo "-- FIN DU BASELINE"
  echo "-- ============================================================================="
} > "$OUT"

rm -f "$TMP_PUBLIC" "$TMP_STORAGE"

echo "✓ Baseline généré : $OUT ($(wc -l < "$OUT") lignes)"
echo "  Vérification (aucune donnée de test attendue) :"
if grep -nE "INSERT INTO public\.(user_roles|profiles|shift_teams)" "$OUT"; then
  echo "  ⚠ Des INSERT métier ont été détectés — à vérifier."
else
  echo "  ✓ Aucun INSERT de données métier/test dans le baseline."
fi
