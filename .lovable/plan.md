# Plano · Preparar app para campanha (Punter + Trader Financeiro Beta)

## Decisões confirmadas com você

1. **Arena Punter:** campanha só liga quando a Punter voltar a gerar sinais (recompra da The Odds API antes do dia 1/jun). Nada a mudar no código por causa disso agora — só lembrete operacional.
2. **Tráfego pago:** vai para `/lp/day-pass.html` (já verificada — **não promete Trader Financeiro**, então não precisa mexer nela).
3. **Trader Financeiro:** virar **Beta** em todos os pontos de entrada e remover a promessa de "produto pronto".

---

## Escopo desta entrega (somente UI/copy — sem mexer em backend)

### A) `/lobby-preview` (LobbyPreview.tsx)
- Trocar o card "Arena Trader Financeiro" para:
  - Título: **"Arena Trader Financeiro · BETA"**
  - Desc: **"Versão experimental. WIN, WDO e BTC em fase de teste — use por sua conta e risco enquanto refinamos o motor."**
  - Badge visual `BETA` (chip discreto no canto do card).

### B) `/lobby` (PunterMenu / cards de arena)
- Onde houver botão/card para `/arena-trader`, adicionar badge **BETA** e tooltip "Em desenvolvimento — funcionalidades podem mudar".

### C) Landing principal (LandingPage.tsx) e `OfertaEspecial.tsx`
- **LandingPage.tsx (linhas 330, 806, 818):** trocar "Bônus: ... Arena Trader Financeiro (WIN/WDO/BTC)" por **"Bônus: ... Arena Trader Financeiro (WIN/WDO/BTC) — Beta"** e ajustar FAQ Elite para deixar claro que o Trader Financeiro está em beta.
- **OfertaEspecial.tsx (linhas 76, 313, 315):** prefixo "Beta" no título e descrição "Versão experimental — mesmo método do esporte sendo calibrado para WIN/WDO/BTC".
- **BonusInclusos.tsx (linhas 53–57, 124):** trocar copy "tem o Mycroft trabalhando com R:R ≥ 1:1.5..." (promessa firme) por "**Beta** — estamos calibrando R:R, stop loss e leitura técnica para WIN/WDO/BTC. Sem garantia de paridade com Trader Sports."
- **Index.tsx (linhas 33–35):** título "Arena Trader Financeiro · Beta", desc "Experimental — WIN, WDO e BTC sendo testados com a lógica do Trader Sports".

### D) Página `/arena-trader` em si
- Já existe banner "🚧 Em desenvolvimento" (linha 812). Reforçar para banner persistente **"BETA · resultados não auditados"** no topo, com aviso de que stats não entram na Liga Mycroft.

---

## Fora de escopo (não vou mexer agora)

- **`/lp/day-pass.html`** — já está limpa, sem promessa de Trader Financeiro. Mantém como está.
- **Recompra The Odds API** — operacional, você executa quando decidir ligar a campanha. Quando rodar, me avise para eu validar com `check-odds-quota` e destravar o cron do Punter.
- **Backend do Trader Financeiro** — nada muda; só mudamos a comunicação.

---

## Resumo das mudanças

| Arquivo | O que muda |
|---|---|
| `src/pages/LobbyPreview.tsx` | Card Trader Financeiro vira "Beta" com chip + desc honesta |
| `src/pages/PunterMenu.tsx` | Badge "BETA" no card/botão Trader Financeiro |
| `src/pages/Index.tsx` | Título/desc Trader Financeiro com sufixo Beta |
| `src/pages/LandingPage.tsx` | 3 menções (linhas 330, 806, 818) — adicionar "Beta" e ajustar FAQ |
| `src/pages/OfertaEspecial.tsx` | 3 menções (76, 313, 315) — copy honesta de Beta |
| `src/components/landing/BonusInclusos.tsx` | Substituir promessa de paridade por aviso Beta |
| `src/pages/ArenaTrader.tsx` | Banner topo permanente "BETA · resultados não auditados" |

Sem migração, sem edge function, sem mudança de schema. Apenas copy + badge `BETA` (componente shadcn `Badge` já existente).

Ao aprovar, executo tudo de uma vez.