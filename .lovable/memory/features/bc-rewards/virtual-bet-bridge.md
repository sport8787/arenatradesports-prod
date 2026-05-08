---
name: bc-rewards-virtual-bet-bridge
description: Trigger credita BC por GREEN virtual com base reduzida por faixa de odd, multiplicador por plano (free 1.0x / base 1.1x / premium 1.3x); bloqueia BC e bet em jogos pós-kickoff (anti-trapaça); resgate exclusivo assinantes; streak diário cap 20 BC
type: feature
---

## BC Rewards Bridge + Liga Mycroft

### Acúmulo de BC (com multiplicador por plano)
- Trigger `credit_bc_for_virtual_bet` em `virtual_bets_punter` e `virtual_bets_manual`.
- **Anti-trapaça:** crédito é IGNORADO se `commence_time IS NULL` ou `created_at >= commence_time` (aposta criada após o kickoff).
- BC base por faixa de odd (reduzido para forçar ~20 dias até 2.000 BC):
  - odd ≥ 4.00 → 25 BC
  - odd ≥ 3.00 → 18 BC
  - odd ≥ 2.30 → 12 BC
  - odd ≥ 1.90 → 8 BC
  - odd ≥ 1.60 → 5 BC
  - default → 3 BC
- Bônus por lucro proporcional: cap 10 BC.
- **Multiplicador por plano** (lido de `user_subscriptions.plan` + `is_active`):
  - free / trial / starter / basic: **1.0x**
  - base: **1.1x**
  - premium: **1.3x**
- Loga em `bc_rewards_log` com colunas `multiplier` e `plan_at_credit` para auditoria.
- Streak diário auto-claim no boot do Punter via `claim_daily_streak_bonus` — **cap fixo 20 BC/dia** (sem escalonamento por dias consecutivos).

### Anti-trapaça pós-kickoff
- **Frontend (`useManualBankroll.placeBet`)**: bloqueia inserção em `virtual_bets_manual` quando `commence_time <= now`.
- **Frontend (`SignalsFeed`)**: cards APROVADO somem da lista após o kickoff; só permanecem como "AO VIVO" (sem CTA de aposta).
- **Backend (trigger `credit_bc_for_virtual_bet`)**: garantia final — não credita BC nem mesmo se a aposta entrar de outra forma.

### Resgate (regra de elegibilidade)
- **Apenas assinantes ativos (`isPaid === true`) podem resgatar.**
- Free/trial vê vitrine + acumula BC, mas botão de resgate fica bloqueado com CTA para `/paywall`.
- Prêmios marcados `premiumOnly: true` exigem plano Premium (badge "👑 PREMIUM ONLY" no card).

### Vitrine (BlackMarket.tsx)
- Mais barato: Vale-Presente R$ 50 = 2.000 BC.
- Demais: 3k / 4k / 7k / 9k / 11k BC.

### Leaderboard (liga_mycroft_leaderboard)
- View com `plan` + `plan_active`; badge 👑 PREMIUM ou BASE no `LigaMycroftLeaderboard.tsx`.
- Hórus forçado em rank=1.

### Pendências
- Calibrar economia interna por item.
- Backend de resgate (orders + entrega + bloqueio premiumOnly server-side).
- Definição oficial das datas de temporada para o troféu.
