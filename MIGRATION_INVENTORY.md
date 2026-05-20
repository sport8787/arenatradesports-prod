# Migration Inventory — Supabase / Lovable Cloud

> **Status:** 🟡 Espelho **carregado em modo cold-standby** (20/05/2026). Cutover real ainda não executado — app continua apontando para `affquongjlhmusxzohjl`.
> **Última atualização:** 20/05/2026 — Fases A-E concluídas no espelho. Patches de cutover prontos em `/mnt/documents/cutover_frontend_patches.md`.

## 0.1 Execução das Fases A-E (20/05/2026)

| Fase | Escopo | Status | Volumetria |
|---|---|---|---|
| **A** | `user_roles`, `profiles`, `push_subscriptions` | ✅ | 4 / 157 / 4 |
| **B** | Bankrolls (×4) + caps + prefs + checklist + promos | ✅ | 161 ×4, 161 caps, 18+18, 3 codes, 5 redemptions |
| **C** | Transacionais grandes (analyses, signals, bets, logs) | ✅ | `mycroft_analyses` 10.345, `punter_analyses` 1.693, `punter_signals` 366, `bc_rewards_log` 7.437, `edge_function_runs` 4.026, `cron_logs` 5.189, `ai_response_cache` 335, `mycroft_chat_logs` 198, `mycroft_analyses_shadow_af` 1.302 |
| **D** | Storage (4 buckets) | ✅ | 81/81 objects (`audio-cache` 41, `public-assets` 3, `seo-static` 23, `sports-knowledge-base` 14) |
| **E** | Cron + Triggers (SQL gerado, **não aplicado** no espelho ainda) | 🟡 | 62 jobs + 4 triggers em `/mnt/documents/recreate_cron_jobs_dest.sql` e `/mnt/documents/recreate_notification_triggers_dest.sql` |

### Edge functions de migração (deployadas no projeto origem)
- `migrate-auth-to-mirror` (auth.users — ainda **não executada**)
- `migrate-table-to-mirror` + wrapper `run-table-migration`
- `migrate-storage-to-mirror` + wrapper `run-storage-migration`

Todas protegidas por header `X-Migration-Token` (secret `MIGRATION_TOKEN`).

## 0.2 Pendências bloqueantes do cutover real

1. ❌ **Migrar `auth.users` + `auth.identities`** — chamar `migrate-auth-to-mirror`
2. ❌ **Reseed `user_roles`** após auth.users
3. ❌ **Aplicar SQL no espelho:** `recreate_cron_jobs_dest.sql` + `recreate_notification_triggers_dest.sql`
4. ❌ **Re-registrar ~25 secrets** no espelho (lista em §2.6)
5. ❌ **Re-deploy ~80 edge functions** no espelho
6. ❌ **Fix trigger** `calibrate_punter_1x2_verdict` (bug `format()` com `%` sem escape)
7. ❌ **Re-enable USER triggers** nas tabelas Fase C do espelho (foram disabled durante import)
8. ❌ **Habilitar extensões** no espelho: `pg_cron`, `pg_net`, `pgcrypto`, `pg_stat_statements`
9. ❌ **Aplicar patches frontend + vercel.json** — ver `/mnt/documents/cutover_frontend_patches.md`
10. ❌ **Re-registrar Google OAuth callback** no Google Cloud Console
11. ❌ **Atualizar `.env` Lovable Cloud** → novo `VITE_SUPABASE_URL` / project ref / anon key

---

---

## 0. Estado do projeto-espelho (backup)

Projeto Supabase externo criado como cópia fria (não conectado ao app):

| Item | Valor |
|---|---|
| Project ref espelho | `ogpohiugfkvygcejrzfp` |
| URL | `https://ogpohiugfkvygcejrzfp.supabase.co` |
| Senha DB | `#Sport@12167318` |
| Connection string | `postgresql://postgres:%23Sport%4012167318@db.ogpohiugfkvygcejrzfp.supabase.co:5432/postgres` |

### Já replicado (18/05/2026)
- ✅ **Schema `public` completo:** 120 tabelas, 83 funções, 64 triggers, enum `app_role`, índices, constraints, RLS — backup em `/mnt/documents/oraculo_schema_public.sql` (392 KB)
- ✅ **Seed de configuração v1** (`/mnt/documents/oraculo_seed.sql`):
  - `mycroft_planos` (12), `trader_leagues` (128), `mycroft_rules` (9),
  - `league_id_map` (24), `eventos_raros_config` (3), `under_cashout_thresholds` (0 — vazia na origem)
- ✅ **Seed de configuração v2** (`/mnt/documents/oraculo_seed_v2.sql`):
  - `mycroft_config` (14), `cron_settings` (5), `mycroft_memory` (45),
  - `horus_audio_inventory` (30), `liga_mycroft_seed_users` (15), `mycroft_rules_history` (32)
  - ❌ `user_roles` (0) — FK em `auth.users`, refazer no cutover após migrar usuários

### Pendente para o cutover real (D-Day)
1. **`auth.users` + `auth.identities`** — exportar via Supabase admin API do projeto origem
2. **Dados de usuário (tabelas grandes):**
   `profiles`, `user_subscriptions`, `user_bankroll`, `sports_bankroll`, `manual_bankroll`, `bc_monthly_caps`, `virtual_bets`, `virtual_bets_manual`, `bets_history`, `imported_bets`, `punter_signals`, `punter_sinais`, `punter_analyses`, `push_subscriptions`, `mycroft_chat_logs`, `user_preferences`, `user_activation_checklist`, `promo_redemptions`
3. **Reseed `user_roles`** depois que `auth.users` estiver populado
4. **Storage buckets** (`seo-static`, áudios Hórus, avatares) — copiar via Supabase Storage API ou rclone
5. **Secrets das edge functions** — re-registrar manualmente (ver §2.6)
6. **Recriar cron jobs `pg_cron`** — não vem no `pg_dump --schema-only`; recriar à mão atualizando URL `affquongjlhmusxzohjl` → `ogpohiugfkvygcejrzfp`
7. **Atualizar triggers de notificação** (`notify_aprovado_broadcast`, `notify_punter_signal_aprovado`, `notify_punter_signal_settled`, `notify_bet_settled`) — substituir URL hardcoded
8. **Habilitar extensões** no destino: `pg_cron`, `pg_net`, `pgcrypto`, `pg_stat_statements`
9. **Atualizar hardcodes no frontend** (3 arquivos listados em §4.1) + `vercel.json` rewrites
10. **Reapontar Google OAuth callback URL** no Google Cloud Console

## Por que este documento existe

A reavaliação concluiu que migrar para Supabase próprio agora **não resolve** os problemas de performance (que eram índices faltantes + instância pequena, já corrigidos) e adiciona custo + risco. Mas se um dia for necessário (ex: sair da Lovable, precisar de read replicas/PITR/branching), este inventário é o checklist de cutover.

---

## 1. Identificadores do projeto atual

| Item | Valor |
|---|---|
| Supabase project ref | `affquongjlhmusxzohjl` |
| URL base API | `https://affquongjlhmusxzohjl.supabase.co` |
| Anon key | armazenada em `.env` como `VITE_SUPABASE_PUBLISHABLE_KEY` |
| Lovable project ID | `25501c55-375f-4d36-b20a-3599cb4bc73a` |

## 2. Inventário de recursos a migrar

### 2.1 Schema
- **~120+ tabelas** (audit completo via `\d` no psql).
- **Tabelas grandes (>10k rows):** `mycroft_analyses` (53k, 71MB), `edge_function_runs` (33k), `scheduled_games` (30k), `ai_response_cache` (13k), `mycroft_analyses_shadow_af` (12k), `cron_logs` (12k), `edge_function_errors` (11k).
- **Tipos custom:** `app_role` enum.
- **Triggers:** `notify_aprovado_broadcast`, `notify_punter_signal_aprovado`, `notify_punter_signal_settled`, `propagate_mycroft_result_to_shadow`, `trg_auto_settle_shadow_af`, `prevent_conflicting_punter_markets`, `credit_bc_for_virtual_bet`, `notify_bet_settled`, `validate_subscription_plan`, `validate_landing_lead`, `update_rank_on_coins_change`, `update_planos_timestamp`, `update_updated_at_column` (genérico), `handle_new_user*` (4 variantes).
- **Funções (~50+):** ver `<db-functions>` no system prompt; principais: `has_role`, `expire_trials`, `claim_mycroft_analysis_jobs`, `refresh_punter_quarantine`, `recompute_punter_buckets`, `settle_mycroft_shadow_af`, `compare_providers_divergences`, RPCs de bankroll (`deduct_bankroll`, `deduct_manual_bankroll`), RPCs de saldos (`increment_*_balance`, `spend_nt_balance`, `claim_daily_nt_bonus`).

### 2.2 Edge Functions (~80)
Listar com:
```bash
ls supabase/functions/ | grep -v _shared
```
**Críticas (rodam em cron ou afetam produção):**
- `cron-live-matches` (cron 1m)
- `fetch-live-matches`, `update-live-scores`, `update-live-odds`, `analyze-live-matches`
- `evaluate-cashout`, `cashout-telegram-alert`
- `process-mycroft-queue`
- `punter-steam-monitor` (cron 1m)
- `eventos-raros-prelive` (cron 09h/15h), `eventos-raros-live` (cron 3m)
- `seo-rodada-brasileirao`, `seo-publish-rodada` (cron 06h UTC)
- `expire-trials` (cron 00:05 UTC)
- `trial-expiry-notify` (cron 13h UTC)
- `reconcile-shadow-results` (cron 12h UTC)
- `daily-recap` email (cron 13h UTC)
- `notify-trader-event`
- `mycroft-punter-anthropic`, `mycroft-punter-analytic` (Sherlock)

### 2.3 Cron jobs (pg_cron)
```sql
SELECT jobname, schedule, command FROM cron.job;
```
**Cuidado:** TODOS os jobs têm a URL `https://affquongjlhmusxzohjl.supabase.co/functions/v1/...` hardcoded no SQL e o `apikey` (anon) também hardcoded. **Cada job precisa ser recriado no projeto novo com nova URL + nova anon key.**

### 2.4 Storage buckets
- `seo-static` (público — HTMLs gerados de rodadas)
- buckets de áudio (Hórus TTS / ElevenLabs cache)
- avatares / uploads de usuário (se houver)
```sql
SELECT id, name, public FROM storage.buckets;
```

### 2.5 Auth
- **Provedores ativos:** Email/Password, Google (Lovable Cloud Managed OAuth)
- **Configs:** `auto_confirm_email = true`
- **Migração de senhas:** exportar via Supabase admin API (`auth.users` com `encrypted_password`) — funciona, mas frágil. **Usuários OAuth:** identidades vinculadas em `auth.identities` precisam ser reexportadas e o cliente OAuth re-registrado no novo projeto.

### 2.6 Secrets das Edge Functions
- `GEMINI_API_KEY`
- `OPENAI_API_KEY` (se ainda em uso)
- `API_FOOTBALL_KEY`
- `THE_ODDS_API_KEY`
- `FUTODDS_API_KEY`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_TRADER_CHAT_ID`
- `RESEND_API_KEY`
- `ELEVENLABS_API_KEY`
- `POSTHOG_API_KEY`
- `STRIPE_*` (se ativo)
- `BETFAIR_*`
- `SUPABASE_SERVICE_ROLE_KEY` (regenera no projeto novo)
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (web push)

---

## 3. Dependências externas que apontam para o backend atual

| Sistema | O que aponta para `affquongjlhmusxzohjl.supabase.co` |
|---|---|
| **Telegram bots** | Webhooks recebem callbacks (verificar se há) |
| **Resend** | Domínio configurado para envio (não aponta pra DB, mas usa from) |
| **PostHog** | Eventos enviados do front — não afeta migração |
| **Vercel rewrites** | `vercel.json` tem rewrites para storage público (`seo-static`) — **REESCREVER** |
| **Domínios customizados** | `oraculo-mycroft.com`, `arenatradesports.lovable.app`, `futebol.blefadormilionario.com.br` — DNS inalterado, mas Vercel config muda |
| **Browser Push (VAPID)** | Subscriptions salvas em DB ficam válidas se VAPID keys forem mantidas |
| **Realtime** | Front conecta em `affquongjlhmusxzohjl.supabase.co/realtime` — atualizar via `client.ts` |
| **Auth callbacks Google** | URLs de callback registradas no Google Cloud Console — REGISTRAR novas |

---

## 4. Hardcodes no código

### 4.1 Frontend (3 arquivos)
- `src/components/punter/SettledBetsDebugPanel.tsx`
- `src/components/punter/EbookWelcomeCard.tsx`
- `src/components/landing/SocialProofSection.tsx`

### 4.2 Triggers SQL (no banco)
URLs hardcoded em **todas** as triggers que chamam `net.http_post` para edge functions:
- `notify_aprovado_broadcast`
- `notify_punter_signal_aprovado`
- `notify_punter_signal_settled`
- `notify_bet_settled`

Action: ao migrar, substituir `'https://affquongjlhmusxzohjl.supabase.co'` por `'https://<NEW_REF>.supabase.co'` em **todas** essas funções.

### 4.3 Edge Functions
Procurar com:
```bash
rg 'affquongjlhmusxzohjl' supabase/functions
```

---

## 5. Sequência de cutover (se for migrar)

1. **D-7:** Aprovisionar instância nova no tamanho correto (≥8GB). Anunciar janela de manutenção.
2. **D-3:** Exportar schema (`pg_dump --schema-only`), revisar, aplicar no destino.
3. **D-1:** Carregar todos os secrets no projeto novo. Redeploy de **todas** as edge functions. Testar cada cron job manualmente (sem schedular ainda).
4. **D-Day (janela 4-8h, idealmente domingo de madrugada SEM jogos importantes):**
   - Pausar todos os crons no projeto antigo.
   - `pg_dump --data-only` do antigo → restore no novo.
   - Migrar storage buckets (rclone ou script Supabase Storage API).
   - Migrar `auth.users` + `auth.identities`.
   - Atualizar `src/integrations/supabase/client.ts` + `.env`.
   - Atualizar URLs em triggers SQL.
   - Reapontar Google OAuth callback URL.
   - Atualizar `vercel.json` rewrites para nova URL de storage.
   - Schedular crons no projeto novo.
   - Smoke test: login, fetch de jogos ao vivo, análise punter, push notification.
5. **D+1:** Manter projeto antigo como readonly por 7 dias para fallback.

## 6. Riscos conhecidos

- **Realtime subscribers em sessões abertas vão perder conexão** — mitigação: deploy em horário de baixo tráfego.
- **Tokens JWT continuam válidos** se você reusar o mesmo JWT secret. **Mudar = todos os usuários precisam relogar.**
- **Cron `pg_cron` no destino não tem migração automática** — recriar à mão.
- **`pg_net` (extensão usada pelos triggers de notificação)** precisa estar habilitada no destino.

---

## 7. Manutenção deste documento

Atualizar sempre que:
- Adicionar nova edge function
- Adicionar novo cron job
- Adicionar novo secret
- Mudar provedor externo (Telegram, Resend, etc.)
