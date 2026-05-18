#!/usr/bin/env python3
"""Parse Go-map style output do supabase--read_query e gera JSON limpo.

A saída do tool tem formato:
  map[active:true command:
    SELECT ...
     jobid:N jobname:NAME schedule:CRON_EXPR]

Cada 'map[' inicia um job. Extraímos jobname, schedule, active e o command bruto."""
import json
import re
import sys
from pathlib import Path

src = Path("/tmp/cron_raw.txt").read_text()

# Cada job começa em "map[active:true command:" e termina em "schedule:<expr>]"
# (até o próximo "map[" ou EOF).
chunks = re.split(r"\bmap\[active:", src)[1:]  # primeiro elemento é prefixo do array

jobs = []
for ch in chunks:
    # ch começa com "true command:" (ou false)
    m = re.match(r"(true|false)\s+command:(.*?)\s+jobid:\d+\s+jobname:(\S+)\s+schedule:(.*?)\]\s*$", ch, re.DOTALL)
    if not m:
        print("⚠️ chunk não bateu:", ch[:200], file=sys.stderr)
        continue
    active, command, jobname, schedule = m.groups()
    jobs.append({
        "jobname": jobname.strip(),
        "schedule": schedule.strip(),
        "active": active == "true",
        "command": command.strip(),
    })

out = Path("/mnt/documents/cron_jobs_source.json")
out.write_text(json.dumps(jobs, indent=2, ensure_ascii=False))
print(f"✅ {len(jobs)} jobs → {out}")
for j in jobs[:5]:
    print(f"  - {j['jobname']:50s} {j['schedule']}")
print(f"  ... ({len(jobs)-5} outros)" if len(jobs) > 5 else "")
