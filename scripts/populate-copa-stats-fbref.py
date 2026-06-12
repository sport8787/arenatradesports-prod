#!/usr/bin/env python3
"""
scripts/populate-copa-stats-fbref.py

Popula copa_2026_stats com xG por partida (FBref) para os times da Copa 2026.
Extrai: xG, xGA, gols, forma (W/D/L), últimos 10 placares.

PRÉ-REQUISITOS
  pip install cloudscraper beautifulsoup4 pandas lxml supabase python-dotenv

CONFIGURAÇÃO
  Adicione ao .env:
    SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  (Dashboard → Settings → API → service_role)

USO
  python scripts/populate-copa-stats-fbref.py              # todos os times
  python scripts/populate-copa-stats-fbref.py --team Brazil  # time específico
  python scripts/populate-copa-stats-fbref.py --force       # reprocessa mesmo os já populados
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ── Verificar dependências ────────────────────────────────────────────────────
missing = []
for pkg in ["cloudscraper", "bs4", "pandas", "lxml", "supabase", "dotenv"]:
    try:
        __import__(pkg)
    except ImportError:
        missing.append(pkg.replace("bs4", "beautifulsoup4").replace("dotenv", "python-dotenv"))

if missing:
    print("❌ Dependências ausentes. Instale:")
    print(f"   pip install {' '.join(missing)}")
    sys.exit(1)

import cloudscraper
import pandas as pd
from bs4 import BeautifulSoup
from supabase import create_client
from dotenv import load_dotenv

# ── Config ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")

SUPABASE_URL = (
    os.getenv("VITE_SUPABASE_URL")
    or os.getenv("SUPABASE_URL")
    or ""
)
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL:
    print("❌ VITE_SUPABASE_URL não encontrado no .env")
    sys.exit(1)

if not SUPABASE_KEY:
    print("❌ SUPABASE_SERVICE_ROLE_KEY não encontrado no .env")
    print("   Obtenha em: supabase.com/dashboard → seu projeto → Settings → API → service_role")
    print("   Adicione ao .env:  SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...")
    sys.exit(1)

db = create_client(SUPABASE_URL, SUPABASE_KEY)

scraper = cloudscraper.create_scraper(
    browser={"browser": "chrome", "platform": "windows", "mobile": False},
    delay=1,
)

FBREF_BASE = "https://fbref.com"
DELAY_SEARCH = 5   # segundos após busca
DELAY_PAGE   = 5   # segundos após scraping de página
N_MATCHES    = 10  # últimas N partidas

# Nomes alternativos para busca no FBref
SEARCH_ALIASES: dict[str, str] = {
    "USA":                    "United States",
    "South Korea":            "Korea Republic",
    "North Korea":            "Korea DPR",
    "Ivory Coast":            "Côte d'Ivoire",
    "Congo DR":               "DR Congo",
    "Cape Verde Islands":     "Cape Verde",
    "Bosnia & Herzegovina":   "Bosnia-Herzegovina",
    "Trinidad & Tobago":      "Trinidad and Tobago",
    "Türkiye":                "Turkey",
    "Curaçao":                "Curacao",
}

# ── FBref scraping ─────────────────────────────────────────────────────────────

def fbref_search(team_name: str) -> tuple[str, str] | None:
    """Busca o time no FBref. Retorna (squad_id, nome_fbref) ou None."""
    query = SEARCH_ALIASES.get(team_name, team_name)
    url = f"{FBREF_BASE}/search/search.fcgi"

    try:
        resp = scraper.get(url, params={"search": query}, timeout=20)
        resp.raise_for_status()
    except Exception as e:
        print(f"    ⚠️  Erro na busca: {e}")
        return None

    soup = BeautifulSoup(resp.text, "html.parser")

    # Links para squad pages: /en/squads/xxxxxxxx/…
    matches_found: list[tuple[str, str]] = []
    for a in soup.find_all("a", href=re.compile(r"/en/squads/[a-f0-9]{8}/")):
        m = re.search(r"/en/squads/([a-f0-9]{8})/", a["href"])
        if not m:
            continue
        squad_id   = m.group(1)
        squad_name = a.get_text(strip=True)
        matches_found.append((squad_id, squad_name))

    if not matches_found:
        return None

    query_lower = query.lower()
    # Prefere resultado cujo nome contenha o query
    for sid, sname in matches_found:
        if query_lower in sname.lower() or sname.lower() in query_lower:
            return sid, sname

    # Fallback: primeiro resultado
    return matches_found[0]


def fbref_shooting_logs(squad_id: str) -> list[dict]:
    """
    Scrape da página de shooting match logs.
    URL: /en/squads/{id}/matchlogs/all_comps/shooting/
    Contém: date, opponent, venue, result, GF, GA, Sh, SoT, xG, npxG, xGA
    """
    url = f"{FBREF_BASE}/en/squads/{squad_id}/matchlogs/all_comps/shooting/"
    try:
        resp = scraper.get(url, timeout=25)
        resp.raise_for_status()
    except Exception as e:
        print(f"    ⚠️  Shooting logs inacessível: {e}")
        return []

    return _extract_matchlog_table(resp.text, has_xg=True)


def fbref_schedule(squad_id: str) -> list[dict]:
    """
    Fallback: schedule page (sem xG, mas tem resultado e placar).
    URL: /en/squads/{id}/matchlogs/all_comps/schedule/
    """
    url = f"{FBREF_BASE}/en/squads/{squad_id}/matchlogs/all_comps/schedule/"
    try:
        resp = scraper.get(url, timeout=25)
        resp.raise_for_status()
    except Exception as e:
        print(f"    ⚠️  Schedule inacessível: {e}")
        return []

    return _extract_matchlog_table(resp.text, has_xg=False)


def _extract_matchlog_table(html: str, has_xg: bool) -> list[dict]:
    """Parseia a tabela de match logs do HTML do FBref."""
    soup = BeautifulSoup(html, "html.parser")

    # Tenta encontrar tabela com id "matchlogs_for" ou qualquer "matchlogs*"
    table = soup.find("table", {"id": re.compile(r"matchlogs_for")})
    if table is None:
        table = soup.find("table", {"id": re.compile(r"matchlogs")})
    if table is None:
        return []

    try:
        df = pd.read_html(str(table), flavor="lxml")[0]
    except Exception:
        return []

    # Achata cabeçalho multi-nível
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [
            " ".join(str(c) for c in col if "Unnamed" not in str(c)).strip()
            for col in df.columns
        ]

    # Normaliza: mapeia colunas lower → nome original
    col_map = {c.strip().lower(): c for c in df.columns}

    results: list[dict] = []
    for _, row in df.iterrows():
        entry = _parse_match_row(row, col_map, has_xg)
        if entry:
            results.append(entry)

    return results[:N_MATCHES]


def _parse_match_row(row: pd.Series, col_map: dict[str, str], has_xg: bool) -> dict | None:
    """Extrai campos de uma linha do DataFrame. Retorna None se linha inválida."""
    # Resultado
    res_col = col_map.get("result") or col_map.get("res")
    if not res_col:
        return None
    result = str(row.get(res_col, "")).strip().upper()
    if result not in ("W", "D", "L"):
        return None  # linha de separador ou cabeçalho repetido

    # Data
    date_col = col_map.get("date")
    date = str(row.get(date_col, "")).strip() if date_col else ""

    # Adversário
    opp_col = col_map.get("opponent")
    opponent = str(row.get(opp_col, "")).strip() if opp_col else ""

    # Mando (H/A/N)
    venue_col = col_map.get("venue")
    venue = str(row.get(venue_col, "N")).strip()[:1].upper() if venue_col else "N"

    # Gols
    gf_col = col_map.get("gf") or col_map.get("f")
    ga_col = col_map.get("ga") or col_map.get("a")
    gf = _to_int(row, gf_col)
    ga = _to_int(row, ga_col)
    if gf is None or ga is None:
        return None

    # xG (só disponível na shooting page)
    xg  = _to_float(row, col_map.get("xg"))  if has_xg else None
    xga = _to_float(row, col_map.get("xga")) if has_xg else None

    # Finalizações no alvo
    sot = _to_float(row, col_map.get("sot"))

    return {
        "date":          date,
        "opponent":      opponent,
        "venue":         venue,
        "result":        result,
        "goals_for":     gf,
        "goals_against": ga,
        "xg":            xg,
        "xga":           xga,
        "shots_on_target": sot,
    }


def _to_int(row: pd.Series, col: str | None) -> int | None:
    if not col:
        return None
    val = row.get(col)
    if pd.isna(val):
        return None
    try:
        return int(float(str(val).strip()))
    except (ValueError, TypeError):
        return None


def _to_float(row: pd.Series, col: str | None) -> float | None:
    if not col:
        return None
    val = row.get(col)
    if pd.isna(val):
        return None
    try:
        f = float(str(val).strip())
        return round(f, 2) if f >= 0 else None
    except (ValueError, TypeError):
        return None


# ── Aggregação ────────────────────────────────────────────────────────────────

def aggregate(matches: list[dict], source: str) -> dict:
    """Calcula métricas agregadas a partir dos matches individuais."""
    n = len(matches)
    if n == 0:
        return {}

    avg_gf  = round(sum(m["goals_for"]      for m in matches) / n, 2)
    avg_ga  = round(sum(m["goals_against"]   for m in matches) / n, 2)

    xg_vals  = [m["xg"]  for m in matches if m.get("xg")  is not None]
    xga_vals = [m["xga"] for m in matches if m.get("xga") is not None]
    avg_xg   = round(sum(xg_vals)  / len(xg_vals),  2) if xg_vals  else None
    avg_xga  = round(sum(xga_vals) / len(xga_vals), 2) if xga_vals else None

    sot_vals = [m["shots_on_target"] for m in matches if m.get("shots_on_target") is not None]
    avg_sot  = round(sum(sot_vals) / len(sot_vals), 2) if sot_vals else None

    over25   = sum(1 for m in matches if (m["goals_for"] + m["goals_against"]) > 2.5)
    btts     = sum(1 for m in matches if m["goals_for"] > 0 and m["goals_against"] > 0)
    cs       = sum(1 for m in matches if m["goals_against"] == 0)

    form5 = "".join(m["result"] for m in matches[:5])

    return {
        "last_matches":        n,
        "avg_goals_scored":    avg_gf,
        "avg_goals_conceded":  avg_ga,
        "avg_xg":              avg_xg,
        "avg_xga":             avg_xga,
        "avg_shots_on_target": avg_sot,
        "over_25_pct":         round(over25 / n * 100, 1),
        "btts_pct":            round(btts   / n * 100, 1),
        "clean_sheet_pct":     round(cs     / n * 100, 1),
        "form_last5":          form5,
        "matches_data":        matches,
        "source":              source,
        "last_updated":        datetime.now(timezone.utc).isoformat(),
    }


# ── Supabase ───────────────────────────────────────────────────────────────────

def get_teams(force: bool) -> list[dict]:
    """Retorna times de copa_2026_stats (todos ou só os não-fbref se force=False)."""
    resp = db.table("copa_2026_stats").select("team_name, source").execute()
    rows = resp.data or []
    if force:
        return rows
    # Pula times já populados com fonte fbref
    return [r for r in rows if r.get("source") != "fbref"]


def save_team(team_name: str, stats: dict) -> bool:
    payload = {"team_name": team_name, **stats}
    try:
        db.table("copa_2026_stats").upsert(payload).execute()
        return True
    except Exception as e:
        print(f"    ❌ Erro ao salvar no Supabase: {e}")
        return False


# ── Processamento por time ────────────────────────────────────────────────────

def process(team_name: str) -> str:
    """Retorna 'ok' | 'skip' | 'error'."""
    print(f"\n⚽ {team_name}")

    # 1) Busca no FBref
    time.sleep(DELAY_SEARCH)
    squad = fbref_search(team_name)
    if not squad:
        print("  ⚠️  Não encontrado no FBref")
        return "skip"
    squad_id, fbref_name = squad
    print(f"  🔍 {fbref_name}  (id: {squad_id})")

    # 2) Tenta shooting logs (com xG)
    time.sleep(DELAY_PAGE)
    matches = fbref_shooting_logs(squad_id)
    source  = "fbref"

    # Fallback para schedule (sem xG)
    if not matches:
        print("  ⚙️  Sem shooting logs — tentando schedule...")
        time.sleep(DELAY_PAGE)
        matches = fbref_schedule(squad_id)
        source  = "fbref-schedule"

    if not matches:
        print("  ⚠️  Nenhuma partida encontrada")
        return "skip"

    n_xg = sum(1 for m in matches if m.get("xg") is not None)
    print(f"  📊 {len(matches)} partidas  |  xG disponível: {n_xg}/{len(matches)}")

    # 3) Agrega e salva
    stats = aggregate(matches, source)
    ok    = save_team(team_name, stats)

    if ok:
        form = stats.get("form_last5") or "—"
        axg  = stats.get("avg_xg",  "n/d")
        axga = stats.get("avg_xga", "n/d")
        agf  = stats.get("avg_goals_scored",   "n/d")
        aga  = stats.get("avg_goals_conceded",  "n/d")
        print(f"  ✅ Salvo  |  forma: {form}  |  xG: {axg}/{axga}  |  gols: {agf}/{aga}")
        return "ok"

    return "error"


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Popula copa_2026_stats via FBref")
    parser.add_argument("--team",  help="Processa apenas um time específico")
    parser.add_argument("--force", action="store_true",
                        help="Reprocessa times já populados (source=fbref)")
    args = parser.parse_args()

    print("=" * 50)
    print("  populate-copa-stats-fbref.py")
    print("  Copa 2026 · xG real via FBref")
    print("=" * 50)

    if args.team:
        teams = [{"team_name": args.team}]
    else:
        print("\n🔍 Carregando times de copa_2026_stats...")
        teams = get_teams(force=args.force)
        if not teams:
            print("✅ Todos os times já foram populados com fonte fbref.")
            print("   Use --force para reprocessar.")
            return
        print(f"📋 {len(teams)} times para processar\n")

    counts = {"ok": 0, "skip": 0, "error": 0}

    for i, row in enumerate(teams, 1):
        tname = row["team_name"] if isinstance(row, dict) else row
        print(f"\n[{i}/{len(teams)}]", end=" ")
        try:
            result = process(tname)
        except KeyboardInterrupt:
            print("\n\n⏸  Interrompido (Ctrl+C).")
            break
        except Exception as e:
            print(f"  ❌ Erro inesperado: {e}")
            result = "error"
        counts[result] = counts.get(result, 0) + 1

    print(f"\n{'=' * 50}")
    print(f"  ✅ {counts['ok']} ok  |  ⚠️  {counts['skip']} sem dados  |  ❌ {counts['error']} erros")
    print("=" * 50)


if __name__ == "__main__":
    main()
