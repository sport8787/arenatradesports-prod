#!/usr/bin/env bash
# Wrapper para invocar a edge function migrate-auth-to-mirror.
#
# Pré-requisitos:
#   - Secret MIGRATION_TOKEN configurado em Lovable Cloud (adicione via UI ou add_secret)
#   - EXTERNAL_SUPABASE_URL e EXTERNAL_SUPABASE_SERVICE_ROLE já configurados (✅)
#
# Uso:
#   bash scripts/migrate_auth_to_mirror.sh dry        # dry-run (só conta)
#   bash scripts/migrate_auth_to_mirror.sh run        # migração real
#   bash scripts/migrate_auth_to_mirror.sh run 50     # migra só os 50 primeiros (teste)

set -euo pipefail
: "${SUPABASE_URL:?defina SUPABASE_URL}"
: "${MIGRATION_TOKEN:?defina MIGRATION_TOKEN (mesmo valor configurado no secret)}"

MODE="${1:-dry}"
LIMIT="${2:-}"

case "$MODE" in
  dry) BODY='{"dryRun":true}' ;;
  run) BODY="{\"dryRun\":false${LIMIT:+,\"limit\":$LIMIT}}" ;;
  *) echo "uso: $0 dry|run [limit]"; exit 1 ;;
esac

echo "==> POST migrate-auth-to-mirror | body: $BODY"
curl -sS -X POST "$SUPABASE_URL/functions/v1/migrate-auth-to-mirror" \
  -H "X-Migration-Token: $MIGRATION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$BODY" | python3 -m json.tool
