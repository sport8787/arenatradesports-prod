# Migration Inventory — Supabase / Lovable Cloud

> **Status:** ❄️ Não migrar agora. Este documento existe como **seguro** para o dia em que a migração for inevitável.  
> **Última atualização:** 10/05/2026 — após hardening pós-crash.

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
