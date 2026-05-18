#!/usr/bin/env bash
#
# Migra auth.users + auth.identities + auth.mfa_factors do projeto Lovable Cloud
# (origem) para o projeto Supabase espelho (destino).
#
# Uso (dia do cutover real):
#   bash scripts/migrate_auth_to_mirror.sh
#
# Pré-requisitos:
#   - psql e pg_dump instalados
#   - PG* envs apontando para a ORIGEM (pooler do Lovable Cloud)
#     [já é o default na sandbox Lovable]
#   - DEST_DB_URL exportada apontando para o espelho:
#     export DEST_DB_URL="postgresql://postgres:%23Sport%4012167318@db.ogpohiugfkvygcejrzfp.supabase.co:5432/postgres"
#
# Estratégia:
#   1. Dump --data-only --column-inserts das 3 tabelas relevantes
#   2. Reescreve INSERTs como `INSERT ... ON CONFLICT (id) DO NOTHING`
#      para permitir re-execução idempotente
#   3. Aplica no destino dentro de uma transação
#   4. Valida contagens

set -euo pipefail

: "${DEST_DB_URL:?defina DEST_DB_URL com a connection string do projeto espelho}"
: "${PGHOST:?PG* envs ausentes — rode dentro da sandbox Lovable ou exporte-as}"

OUT_DIR="${OUT_DIR:-/mnt/documents}"
mkdir -p "$OUT_DIR"
RAW="$OUT_DIR/auth_dump_raw.sql"
SAFE="$OUT_DIR/auth_dump_idempotent.sql"

echo "==> [1/4] Exportando auth.users / auth.identities / auth.mfa_factors da origem"
pg_dump \
  --data-only \
  --no-owner \
  --no-privileges \
  --column-inserts \
  -t auth.users \
  -t auth.identities \
  -t auth.mfa_factors \
  > "$RAW"

echo "    dump bruto: $(wc -l < "$RAW") linhas"

echo "==> [2/4] Convertendo INSERTs em ON CONFLICT DO NOTHING (idempotência)"
# Adiciona ON CONFLICT (id) DO NOTHING antes do ; final de cada INSERT
sed -E 's/^(INSERT INTO auth\.(users|identities|mfa_factors) [^;]+);$/\1 ON CONFLICT (id) DO NOTHING;/' \
  "$RAW" > "$SAFE"

INSERTS=$(grep -c '^INSERT INTO auth\.' "$SAFE" || true)
echo "    arquivo idempotente: $SAFE  ($INSERTS inserts)"

echo "==> [3/4] Aplicando no destino (espelho)"
# Envolve em transação. ON_ERROR_STOP=1 garante rollback em caso de erro.
psql "$DEST_DB_URL" -v ON_ERROR_STOP=1 <<SQL
BEGIN;
\i $SAFE
COMMIT;
SQL

echo "==> [4/4] Validação — contagens origem vs destino"
SRC_USERS=$(psql -tAc "SELECT count(*) FROM auth.users")
SRC_IDENT=$(psql -tAc "SELECT count(*) FROM auth.identities")
SRC_MFA=$(psql   -tAc "SELECT count(*) FROM auth.mfa_factors")

DST_USERS=$(psql "$DEST_DB_URL" -tAc "SELECT count(*) FROM auth.users")
DST_IDENT=$(psql "$DEST_DB_URL" -tAc "SELECT count(*) FROM auth.identities")
DST_MFA=$(psql   "$DEST_DB_URL" -tAc "SELECT count(*) FROM auth.mfa_factors")

printf '\n%-20s %10s %10s\n' "tabela" "origem" "destino"
printf '%-20s %10s %10s\n' "auth.users"        "$SRC_USERS" "$DST_USERS"
printf '%-20s %10s %10s\n' "auth.identities"   "$SRC_IDENT" "$DST_IDENT"
printf '%-20s %10s %10s\n' "auth.mfa_factors"  "$SRC_MFA"   "$DST_MFA"

echo
echo "==> Pós-migração (manual no destino, ao final do cutover):"
echo "    1. Reseedar public.user_roles (FK em auth.users) com:"
echo "       pg_dump -t public.user_roles --data-only --column-inserts | psql \"\$DEST_DB_URL\""
echo "    2. Disparar trigger on_auth_user_created_profile (cria profiles + bankrolls)"
echo "       ou rodar reseed manual de profiles/*_bankroll."
echo "    3. Re-registrar o cliente Google OAuth no novo projeto Supabase."
echo
echo "✅ Migração de auth concluída."
