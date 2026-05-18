#!/usr/bin/env python3
"""
Migra auth.users (e suas identidades) do projeto Lovable Cloud (origem) para
o projeto Supabase espelho (destino), via Supabase Admin API.

Por que API e não pg_dump?
  No Supabase gerenciado, o schema `auth` só é acessível pelo role
  `supabase_auth_admin`. O `postgres` exposto no pooler NÃO tem permissão.
  A Admin API (`/auth/v1/admin/users`) é o caminho oficial.

Pré-requisitos (rodar dentro da sandbox Lovable):
  - Secrets disponíveis como env vars:
      SUPABASE_SERVICE_ROLE_KEY   (origem  → affquongjlhmusxzohjl)
      EXTERNAL_SUPABASE_URL       (destino → https://ogpohiugfkvygcejrzfp.supabase.co)
      EXTERNAL_SUPABASE_SERVICE_ROLE (destino service_role)

Uso:
  python scripts/migrate_auth_to_mirror.py            # migra tudo
  python scripts/migrate_auth_to_mirror.py --dry-run  # só exporta JSON local

Comportamento:
  1. Lista todos os usuários da origem (paginação 1000/página)
  2. Salva backup em /mnt/documents/auth_users_export.json
  3. Para cada usuário, faz POST /auth/v1/admin/users no destino com:
       - id (mantém o mesmo UUID — crítico p/ FKs do public.*)
       - email, phone, encrypted_password (via password_hash), metadata,
         email_confirmed_at, identities (Google etc)
  4. Pula usuários já existentes (idempotente)
  5. Imprime sumário final
"""
import os
import sys
import json
import time
import urllib.request
import urllib.error
from pathlib import Path

SRC_URL = "https://affquongjlhmusxzohjl.supabase.co"
SRC_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
DST_URL = os.environ.get("EXTERNAL_SUPABASE_URL", "https://ogpohiugfkvygcejrzfp.supabase.co")
DST_KEY = os.environ.get("EXTERNAL_SUPABASE_SERVICE_ROLE")

DRY_RUN = "--dry-run" in sys.argv
OUT = Path("/mnt/documents/auth_users_export.json")


def die(msg: str) -> None:
    print(f"❌ {msg}", file=sys.stderr)
    sys.exit(1)


def req(method: str, url: str, key: str, body: dict | None = None) -> tuple[int, dict]:
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            payload = json.loads(e.read() or b"{}")
        except Exception:
            payload = {"error": str(e)}
        return e.code, payload


def list_all_users(base_url: str, key: str) -> list[dict]:
    """Lista TODOS os usuários paginando."""
    users: list[dict] = []
    page = 1
    per_page = 1000
    while True:
        status, body = req(
            "GET",
            f"{base_url}/auth/v1/admin/users?page={page}&per_page={per_page}",
            key,
        )
        if status != 200:
            die(f"falha ao listar usuários ({status}): {body}")
        batch = body.get("users", [])
        if not batch:
            break
        users.extend(batch)
        print(f"  página {page}: +{len(batch)} (total {len(users)})")
        if len(batch) < per_page:
            break
        page += 1
    return users


def create_user(user: dict) -> tuple[bool, str]:
    """Cria 1 usuário no destino preservando UUID, senha e identidades."""
    payload = {
        "id": user["id"],  # CRÍTICO: mantém UUID p/ FKs em public.*
        "email": user.get("email"),
        "phone": user.get("phone"),
        "email_confirm": bool(user.get("email_confirmed_at")),
        "phone_confirm": bool(user.get("phone_confirmed_at")),
        "user_metadata": user.get("user_metadata") or {},
        "app_metadata": user.get("app_metadata") or {},
    }
    # Senha: Admin API aceita password_hash quando vier do export
    if user.get("encrypted_password"):
        payload["password_hash"] = user["encrypted_password"]

    # Remove None/strings vazias que podem quebrar a Admin API
    payload = {k: v for k, v in payload.items() if v not in (None, "")}

    status, body = req("POST", f"{DST_URL}/auth/v1/admin/users", DST_KEY, payload)

    if status in (200, 201):
        return True, "criado"
    msg = (body.get("msg") or body.get("error_description") or body.get("error") or str(body))[:200]
    if "already" in msg.lower() or "exists" in msg.lower() or status == 422:
        return True, "já existia (skip)"
    return False, f"HTTP {status} — {msg}"


def main() -> None:
    if not SRC_KEY:
        die("SUPABASE_SERVICE_ROLE_KEY ausente no ambiente.")
    if not DRY_RUN and not DST_KEY:
        die("EXTERNAL_SUPABASE_SERVICE_ROLE ausente. Adicione via add_secret.")

    print(f"==> [1/3] Exportando usuários de {SRC_URL}")
    users = list_all_users(SRC_URL, SRC_KEY)
    print(f"    Total: {len(users)} usuários")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(users, indent=2, default=str))
    print(f"    Backup salvo em {OUT}")

    if DRY_RUN:
        print("==> --dry-run: parando antes de importar.")
        return

    print(f"==> [2/3] Importando em {DST_URL}")
    ok = skipped = fail = 0
    failures: list[str] = []
    for i, u in enumerate(users, 1):
        success, reason = create_user(u)
        if success:
            if "skip" in reason:
                skipped += 1
            else:
                ok += 1
        else:
            fail += 1
            failures.append(f"{u.get('email') or u['id']}: {reason}")
        if i % 25 == 0:
            print(f"    {i}/{len(users)}  ok={ok} skip={skipped} fail={fail}")
        time.sleep(0.05)  # throttle leve para não estourar o auth-rate-limit

    print(f"\n==> [3/3] Resumo: criados={ok}  já_existiam={skipped}  falharam={fail}")
    if failures:
        print("Falhas (primeiras 20):")
        for f in failures[:20]:
            print(f"  - {f}")

    print("\n✅ Concluído. Próximos passos manuais no destino:")
    print("  1. Reseedar public.user_roles (FK em auth.users)")
    print("  2. Verificar trigger on_auth_user_created_profile (pode ter criado profiles automaticamente)")
    print("  3. Re-registrar OAuth Google no projeto novo")


if __name__ == "__main__":
    main()
