---
name: subscription-system
description: Planos starter/base/premium com matriz de arenas explícita, trial libera tudo por cortesia, sem limite mensal de posições
type: feature
---
## Sistema de Assinaturas (atualizado 01/05/2026)

### Matriz de planos (canônica — usada em Paywall.tsx, OfertaEspecial.tsx, RequireArena, useSubscription)
- `trial` — todas arenas (cortesia, comunicado em Paywall e RequireArena)
- `starter` (R$ 99,90/mês) — `arena_live` apenas
- `base` (R$ 149,90/mês, "MAIS ESCOLHIDO") — `arena_live + arena_punter`
- `premium` (R$ 199,90/mês, "TUDO LIBERADO") — todas arenas + chat Mycroft em cada jogo

OfertaEspecial = mesma matriz com 50% OFF (49,95 / 74,95 / 99,95).

Cada card de plano lista explicitamente "Está incluso" (✓ verde) e "Não está incluso" (✗ riscado) para evitar confusão. Banner azul informa que o trial libera tudo por cortesia e o acesso restringe ao plano após o trial.

### Removido (01/05/2026)
- ❌ "Até 50 posições/mês" — copy inventada, sem enforcement no DB; removida de Paywall e OfertaEspecial.
- ❌ Nomes "Professional" e "Enterprise" no checkout — agora alinhados ao DB (Starter/Base/Premium).
- ❌ mockMatches Brasil x Argentina em ArenaTraderSports — bloco morto removido.

### RequireArena
Mensagem agora inclui rodapé: "Lembrete: durante o trial todas as arenas ficam liberadas por cortesia. Após o trial, o acesso passa a respeitar o plano contratado."

### Tabelas
- `user_subscriptions`: `allowed_arenas TEXT[]`, `payment_provider`, `external_order_id`, `payment_amount`, `notes`. Override `hasAccess: true` REMOVIDO — exige admin OU trial ativo OU pago não vencido.
- `purchase_events`: auditoria webhooks Kiwify.

### Edge Functions
- `kiwify-webhook` (verify_jwt=false) — PRODUCT_MAP por substring (starter/base/punter/premium/full). URL: `https://affquongjlhmusxzohjl.supabase.co/functions/v1/kiwify-webhook`
- `admin-grant-subscription` — ativação manual em `/admin/assinaturas`.

### Frontend
- `useSubscription`: `hasArena()`, `allowedArenas`, `isPaid`.
- `<RequireArena arena=… arenaLabel=…>` wrapper bloqueia rotas em App.tsx.
- `PunterMenuHeroStatus` no /menu: sinais hoje + ROI 24h + Green/Red 24h (lê `punter_signals`, sem mock).
