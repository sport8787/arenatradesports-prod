---
name: Tier A only — REVERTIDO 09/05/2026
description: Restrição de cobertura ao Tier A foi revertida porque deixou o dashboard quase vazio (3/142 jogos). Tier B+C reativados; controle de ruído fica no filtro Telegram (main leagues only).
type: constraint
---

Tier A/B/C agora todos `enabled=true` em `trader_leagues`. Filtro de notificações Telegram restrito a ligas principais permanece (`notify-trader-event`). Próximo passo, se ROI piorar, é restringir o **auto-approve** (não a ingestão) por tier.
