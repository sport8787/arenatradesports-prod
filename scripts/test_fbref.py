"""Teste rápido: valida acesso ao FBref e extração de match logs."""
import re
import sys
import time
import cloudscraper
import pandas as pd
from bs4 import BeautifulSoup

scraper = cloudscraper.create_scraper(
    browser={"browser": "chrome", "platform": "windows", "mobile": False}
)
FBREF_BASE = "https://fbref.com"


def search(team):
    url = f"{FBREF_BASE}/search/search.fcgi"
    resp = scraper.get(url, params={"search": team}, timeout=20)
    print(f"  status={resp.status_code}  len={len(resp.text)}")
    soup = BeautifulSoup(resp.text, "html.parser")
    results = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        m = re.search(r"/en/squads/([a-f0-9]{8})/", href)
        if m:
            results.append((m.group(1), a.get_text(strip=True), href))
    return results


def get_shooting(squad_id):
    url = f"{FBREF_BASE}/en/squads/{squad_id}/matchlogs/all_comps/shooting/"
    resp = scraper.get(url, timeout=25)
    print(f"  shooting status={resp.status_code}  len={len(resp.text)}")
    soup = BeautifulSoup(resp.text, "html.parser")
    table = soup.find("table", {"id": re.compile(r"matchlogs")})
    if not table:
        print("  Tabela não encontrada — IDs disponíveis:")
        for t in soup.find_all("table"):
            print(f"    id={t.get('id', 'sem-id')}")
        return None
    try:
        df = pd.read_html(str(table))[0]
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = [" ".join(str(c) for c in col if "Unnamed" not in str(c)).strip() for col in df.columns]
        print(f"  Colunas: {list(df.columns[:15])}")
        print(f"  Linhas: {len(df)}")
        return df
    except Exception as e:
        print(f"  Erro ao parsear: {e}")
        return None


if __name__ == "__main__":
    team = sys.argv[1] if len(sys.argv) > 1 else "Brazil"
    print(f"\n=== Testando: {team} ===")

    print("\n1) Buscando squad...")
    results = search(team)
    if not results:
        print("  Nenhum squad encontrado — tentando acesso direto...")
        # Fallback: acesso direto para Brazil
        squad_id = "07f4a8be"
        squad_name = "Brazil (hardcoded)"
    else:
        for sid, name, href in results[:5]:
            print(f"  {sid} | {name} | {href}")
        squad_id, squad_name = results[0][0], results[0][1]

    print(f"\n2) Buscando match logs para {squad_name} ({squad_id})...")
    time.sleep(3)
    df = get_shooting(squad_id)

    if df is not None:
        # Mostra primeiras 5 linhas
        print("\n  Primeiras linhas:")
        print(df.head(5).to_string())
        print("\n  ✅ FBref acessível e dados extraídos!")
    else:
        print("  ❌ Falha ao extrair dados")
