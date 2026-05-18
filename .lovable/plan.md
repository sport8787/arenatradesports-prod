# Plano de Migração — Fase 2: Remoção total da API-Football

## Objetivo
Eliminar dependência da API-Football do projeto. Stack final: **Futodds** (placar/odds ao vivo + matches-ended) + **Sportmonks** (stats, H2H, AH, predictions, fallback de liquidação) + **The Odds API** (odds pré-live + fallback final).

Justificativa já validada na auditoria: Futodds cobre placar ao vivo com latência ~30-60s e Sportmonks `/livescores/inplay` com ~10-30s — AF é redundante. Settlement já roda Futodds-first em 70-80% dos casos.

---

## Escopo por bloco

### Bloco 1 — Cards (Punter)
**Arquivo:** `supabase/functions/mycroft-cards-punter/index.ts`
- Substituir `findTeam` + `buscarMediaCartoes` (AF `/teams/search` + `/fixtures` + `/fixtures/statistics`) por `getTeamStatsSM` do `sportmonks-af-adapter.ts`.
- Sportmonks expõe `yellowcards`/`redcards` agregados na temporada via `teams/seasons` includes. Calcular `avg_total_jogo = (homeYC+homeRC+awayYC+awayRC) / matchesPlayed`.
- Qualidade esperada: ~70% da precisão do AF (sem detalhe por jogo, mas média de temporada é mais estável amostralmente).
- Manter lógica de Poisson, edge ≥ 4% e `APROVADO_SITUACIONAL` quando não houver odd.

### Bloco 2 — Players (Punter)
**Arquivo:** `supabase/functions/mycroft-players-punter/index.ts`
- **Desativar permanentemente**: remover cron `punter-prelive-players-1730-brt` e marcar edge como deprecated (mantém arquivo com early-return e log de aviso).
- Atualizar memória `extra-markets.md` removendo seção Players.
- Realocar slot 17:30 BRT: liberar para `mycroft-extra-markets` rodar segunda passada (reanálise vespertina de DC/AH).

### Bloco 3 — Handicap Asiático Pré-live
**Arquivo:** `supabase/functions/handicap-asiatico-prelive/index.ts`
- Trocar chamadas `v3.football.api-sports.io` por helpers do `sportmonks-af-adapter.ts` (`getUpcomingSM`, `getRecentMatchesSM`, `getH2HSM`).
- Adapter já entrega shape AF-compatível, mudança é trivial (search/replace de import + remoção de `API_KEY` guards).

### Bloco 4 — Sinais Alavanca Scanner
**Arquivo:** `supabase/functions/sinais-alavanca-scanner/index.ts`
- Mesma migração do Bloco 3: usar `sportmonks-af-adapter.ts` para H2H + recent matches.
- Manter lógica Under 4.5 intacta.

### Bloco 5 — Settlement (limpeza)
**Arquivos:**
- `supabase/functions/_shared/sportmonks-af-adapter.ts`
- `supabase/functions/punter-settle-results-v3/index.ts`
- `supabase/functions/liquidar-sinais-ao-vivo/index.ts`
- `supabase/functions/settle-bets/index.ts`

Remover o degrau "API-Football" do `resolveFixtureForSettlement`. Nova ordem:
1. Futodds `/matches-ended` (primário, ~70-80%)
2. Sportmonks `getFixtureByTeamsAndDate` (fallback)
3. The Odds API (fallback final)

### Bloco 6 — Live scores (limpeza)
**Arquivos:** `update-live-scores/index.ts`, `fetch-live-matches/index.ts`
- Já usam `liveProvider.ts` (Sportmonks-primário + Futodds-fallback). API-Football já foi removida do `liveProvider`. **Sem trabalho aqui**, apenas confirmar.

### Bloco 7 — Limpeza geral
- Auditar todas as edges (`rg "API_FOOTBALL_KEY|api-sports.io"`) e remover blocos mortos.
- Remover secret `API_FOOTBALL_KEY` ao final.
- Atualizar memórias:
  - `settlement-futodds-first.md` — remover passo AF.
  - `extra-markets.md` — remover Players.
  - `cron-spread-2026-05-18.md` — atualizar slot 17:30.
  - Criar `.lovable/memory/cleanup/api-football-removal-2026-05-18.md`.

---

## Ordem de execução (proposta)
1. **Blocos 3 + 4** (AH + Alavanca) — baixo risco, adapter pronto, ~30min.
2. **Bloco 5** (settlement) — limpa fallback AF, deixa Sportmonks no comando, ~20min.
3. **Bloco 1** (cards via Sportmonks) — média complexidade, requer testar `getTeamStatsSM`, ~45min.
4. **Bloco 2** (desativar players) — trivial, ~10min.
5. **Bloco 7** (limpeza + remover secret) — após validar tudo em produção por 24-48h.

---

## Riscos & mitigações
- **Cards menos precisos**: aceito — média de temporada é suficiente para edge ≥ 4%.
- **Players cego**: aceito — já estava quebrado, retiramos do feed sem perda real.
- **Settlement sem AF**: Sportmonks cobre o gap dos 20-30% que Futodds não resolve; The Odds API segura o que sobrar.
- **AH/Alavanca**: adapter já está em produção em outras pipelines, risco baixo.

---

## Entregáveis
- 4 edges modificadas (cards, players-disable, AH, alavanca).
- 4 edges com cleanup de fallback (settle-v3, liquidar-ao-vivo, settle-bets, adapter).
- 1 cron removido + 1 reaproveitado.
- 1 secret removida.
- 4 memórias atualizadas + 1 nova.

## Quer que eu comece pela ordem proposta (Bloco 3+4 primeiro)?
