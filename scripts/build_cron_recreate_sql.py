#!/usr/bin/env python3
"""
Gera SQL para recriar os cron jobs do projeto Lovable Cloud (origem) no projeto
Supabase espelho (destino), substituindo:
  - URL  : affquongjlhmusxzohjl → ogpohiugfkvygcejrzfp
  - Anon key (JWT antigo)      → anon key do destino ($EXTERNAL_SUPABASE_ANON_KEY)
  - Schedule e command         : preservados

Entrada : /mnt/documents/cron_jobs_source.json (export da origem em JSON puro)
Saída   : /mnt/documents/recreate_cron_jobs_dest.sql

Como rodar manualmente no dia do cutover:
  psql "$DEST_DB_URL" -f /mnt/documents/recreate_cron_jobs_dest.sql

O SQL gerado:
  1. CREATE EXTENSION pg_cron, pg_net (idempotente)
  2. Para cada job: cron.unschedule(jobname) (ignora se não existe) + cron.schedule(...)
  3. Resumo final com SELECT cron.job para conferência

Reexecutável: limpa o cron antigo de mesmo nome antes de criar.
"""
import json
import os
import re
import sys
from pathlib import Path

SRC_REF = "affquongjlhmusxzohjl"
DST_REF = "ogpohiugfkvygcejrzfp"
DST_URL = f"https://{DST_REF}.supabase.co"
SRC_ANON_JWT = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmZnF1b25namxobXVzeHpvaGpsIiwicm9sZSI6ImFub24i"
    "LCJpYXQiOjE3NzE3NDIzMDcsImV4cCI6MjA4NzMxODMwN30."
    "MZIH_-r7YpR4BLs1zyLD9pMTTq7zp_vCUESZXUYomQU"
)
DST_ANON_JWT = os.environ.get("EXTERNAL_SUPABASE_ANON_KEY") or sys.exit(
    "❌ EXTERNAL_SUPABASE_ANON_KEY ausente — exporte ou rode no sandbox Lovable."
)

IN_PATH = Path("/mnt/documents/cron_jobs_source.json")
OUT_PATH = Path("/mnt/documents/recreate_cron_jobs_dest.sql")


def pg_quote(s: str) -> str:
    """Escapa string para uso entre $$...$$ (mantém literal)."""
    return s.replace("$$", "$$ || '\\$\\$' || $$")


def rewrite_command(cmd: str) -> str:
    """Troca project ref na URL e anon key antiga pela nova."""
    cmd = cmd.replace(f"https://{SRC_REF}.supabase.co", DST_URL)
    cmd = cmd.replace(SRC_ANON_JWT, DST_ANON_JWT)
    return cmd


def main() -> None:
    if not IN_PATH.exists():
        sys.exit(f"❌ {IN_PATH} não existe. Rode antes o exportador (sql json).")

    jobs = json.loads(IN_PATH.read_text())
    print(f"==> {len(jobs)} jobs lidos de {IN_PATH}")

    out = []
    out.append("-- Recriação automática dos cron jobs no projeto espelho")
    out.append(f"-- Origem: {SRC_REF}  →  Destino: {DST_REF}")
    out.append(f"-- Gerado por scripts/build_cron_recreate_sql.py")
    out.append("-- Reexecutável: faz unschedule antes do schedule.\n")
    out.append("CREATE EXTENSION IF NOT EXISTS pg_cron;")
    out.append("CREATE EXTENSION IF NOT EXISTS pg_net;\n")

    cnt_url = cnt_inline = 0
    for j in jobs:
        name = j["jobname"]
        sched = j["schedule"]
        cmd = rewrite_command(j["command"]).strip()
        if SRC_REF in cmd:
            sys.exit(f"❌ {name}: ainda contém SRC_REF após rewrite — abortando.")
        if DST_REF in cmd:
            cnt_url += 1
        else:
            cnt_inline += 1

        out.append(f"-- ── {name} ── schedule: {sched}")
        out.append(
            f"DO $do$ BEGIN PERFORM cron.unschedule('{name}'); "
            f"EXCEPTION WHEN OTHERS THEN NULL; END $do$;"
        )
        out.append(
            f"SELECT cron.schedule(\n"
            f"  '{name}',\n"
            f"  '{sched}',\n"
            f"  $cron${cmd}$cron$\n"
            f");\n"
        )

    out.append("-- ── Verificação final ──")
    out.append("SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;")

    OUT_PATH.write_text("\n".join(out))
    print(f"==> SQL gerado em {OUT_PATH}")
    print(f"    {cnt_url} jobs com chamada HTTP (URL reescrita)")
    print(f"    {cnt_inline} jobs internos (SQL puro, sem URL)")
    print(f"\nAplicar no destino com:")
    print(f'  psql "$DEST_DB_URL" -f {OUT_PATH}')


if __name__ == "__main__":
    main()
