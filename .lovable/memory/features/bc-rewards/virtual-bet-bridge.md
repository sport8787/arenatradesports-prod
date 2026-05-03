---
name: bc-rewards-virtual-bet-bridge
description: Trigger credita BC por GREEN virtual; vitrine /loja-bc com vale-presente 50/100/200, 30 dias grátis e upgrade Premium; resgate exclusivo assinantes; troféu físico para 1º do ranking de temporada
type: feature
---

## BC Rewards Bridge + Loja BC

### Acúmulo de BC
- Trigger `credit_bc_for_virtual_bet` em `virtual_bets_punter` e `virtual_bets_manual`.
- GREEN credita +50 BC base + bônus por lucro (cap 500/aposta) e loga em `bc_rewards_log`.
- Streak diário auto-claim no boot do Punter via `claim_daily_streak_bonus`.
- **Trial acumula BC normalmente.**

### Resgate (regra de elegibilidade)
- **Apenas assinantes ativos (`isPaid === true`) podem resgatar prêmios.**
- Trial vê vitrine + acumula BC, mas o botão de resgate fica bloqueado com CTA para `/paywall`.
- Banner de aviso explícito em `/loja-bc` distingue Trial vs Assinante.

### Vitrine atual (BlackMarket.tsx) — preços em BC ainda placeholder ("A definir")
1. Vale-Presente R$ 50
2. 30 Dias de Assinatura Grátis (estende plano atual) — badge POPULAR
3. Vale-Presente R$ 100
4. Vale-Presente R$ 200
5. Upgrade para Premium (Tudo Liberado) por 30 dias — badge TOP

❌ Removidos: PIX 50, PIX 1000, GiftCard genérico, Maleta, PS5, iPhone.

### Troféu de Temporada
- Card destacado no topo da loja: 1º colocado no ranking final ganha **troféu físico personalizado** (nome + estatística gravados).
- Datas da temporada a anunciar.

### Assets
- src/assets/prize-giftcard-50.jpg, prize-giftcard-100.jpg, prize-giftcard-200.jpg
- src/assets/prize-sub-30d.jpg, prize-premium-upgrade.jpg, prize-trophy.jpg

### Pendências
- Calibrar economia interna (custo real em BC de cada item).
- Backend de resgate (orders + entrega de gift-card / extensão de assinatura via admin-grant-subscription).
- Definição oficial das datas de temporada para o troféu.
