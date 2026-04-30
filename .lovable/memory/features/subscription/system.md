---
name: subscription-system
description: Planos trial/starter/base/premium com allowed_arenas, webhook Kiwify auto-ativa, RequireArena bloqueia rotas por feature, página admin /admin/assinaturas
type: feature
---
## Sistema de Assinaturas + Kiwify (atualizado 30/04/2026)

### Planos suportados (validação em DB)
- `trial` — todas as arenas
- `starter` — só `arena_live`
- `base` — `arena_live + arena_punter`
- `premium` — todas

Override `hasAccess: true` REMOVIDO. Agora `hasAccess` exige admin OU trial ativo OU subscription paga ativa (não vencida).

### Tabelas
- `user_subscriptions`: nova coluna `allowed_arenas TEXT[]`, `payment_provider`, `external_order_id`, `payment_amount`, `notes`. Política admin pode tudo.
- `purchase_events`: auditoria de webhooks Kiwify (raw_payload jsonb, processed bool, etc).

### Edge Functions
- `kiwify-webhook` (verify_jwt=false) — recebe POST da Kiwify, mapeia produto→plano via PRODUCT_MAP (substring match: "starter"/"base"/"punter"/"premium"/"full"), procura user por email, faz upsert em user_subscriptions com 30 dias. Aceita secret opcional `KIWIFY_WEBHOOK_SECRET` via `?token=` ou header `x-kiwify-signature`.
  URL: `https://affquongjlhmusxzohjl.supabase.co/functions/v1/kiwify-webhook`
- `admin-grant-subscription` — ativação manual por admin via `/admin/assinaturas`. Usa PLAN_ARENAS default ou arenas custom.

### Frontend
- `useSubscription` exporta `hasArena(arena)`, `allowedArenas`, `isPaid` ativo (não vencido).
- `<RequireArena arena="..." arenaLabel="...">` — wrapper que bloqueia rota mostrando "Seu plano só dá direito a X. Caso deseje usar essa função, faça upgrade." com botão para /paywall.
- Em App.tsx, todas as rotas /punter/*, /punter/multiplas (multiplas), /punter/banca-virtual (banca_virtual), /punter/betfair-real (banca_real) ficam dentro de RequireArena.
- Página `/admin/assinaturas` mostra eventos Kiwify recebidos + form para grant manual + lookup de user.

### Caso Lucineide (28/04/2026)
- user_id: 0f05674a-0683-4417-8128-8771df21d205
- Plano: starter, validade até 27/05/2026, allowed_arenas=['arena_live'], provider=kiwify, ativada manualmente via migration.
