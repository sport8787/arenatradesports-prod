---
name: bc-rewards-virtual-bet-bridge
description: Trigger credita BC por GREEN virtual com multiplicador por plano (free/starter/basic 1.0x, base 1.5x, premium 2.0x); resgate exclusivo assinantes; prêmios premium-only; badge 👑 Premium no leaderboard
type: feature
---

## BC Rewards Bridge + Liga Mycroft

### Acúmulo de BC (com multiplicador por plano)
- Trigger `credit_bc_for_virtual_bet` em `virtual_bets_punter` e `virtual_bets_manual`.
- GREEN credita +50 BC base + bônus por lucro (cap 500 antes do multiplicador).
- **Multiplicador por plano** (lido de `user_subscriptions.plan` + `is_active`):
  - free / trial / starter / basic: **1.0x**
  - base: **1.5x**
  - premium: **2.0x**
- Loga em `bc_rewards_log` com colunas `multiplier` e `plan_at_credit` para auditoria.
- Streak diário auto-claim no boot do Punter via `claim_daily_streak_bonus`.

### Resgate (regra de elegibilidade)
- **Apenas assinantes ativos (`isPaid === true`) podem resgatar.**
- Free/trial vê vitrine + acumula BC, mas botão de resgate fica bloqueado com CTA para `/paywall`.
- Prêmios marcados `premiumOnly: true` exigem plano Premium (badge "👑 PREMIUM ONLY" no card).
- Banner de aviso explícito em `/loja-bc` distingue Free/Trial vs Assinante.

### Vitrine (BlackMarket.tsx)
1. Vale-Presente R$ 50 — qualquer assinante
2. 30 Dias de Assinatura Grátis — POPULAR
3. Vale-Presente R$ 100 — qualquer assinante
4. Vale-Presente R$ 200 — **PREMIUM ONLY**
5. Upgrade para Premium 30 dias — TOP

### Leaderboard (liga_mycroft_leaderboard)
- View inclui `plan` + `plan_active` por user (LEFT JOIN user_subscriptions).
- `LigaMycroftLeaderboard.tsx` exibe badge "👑 PREMIUM" (gradiente dourado) ou "BASE" (azul) ao lado do nome.
- Custo zero de espaço, prova social de assinantes ativos.

### Troféu de Temporada
- Card destacado: 1º colocado no ranking final ganha troféu físico personalizado.

### Pendências
- Calibrar economia interna (custo real em BC de cada item).
- Backend de resgate (orders + entrega + bloqueio premiumOnly server-side).
- Definição oficial das datas de temporada para o troféu.
