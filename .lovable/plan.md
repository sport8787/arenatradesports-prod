
# Plano revisado — Futodds como provedor primário ao vivo

## O que mudou após ler a documentação

A API do Futodds é **muito mais completa** do que o painel inicial sugeria. Os endpoints reais incluem:

**Pré-jogo / encerrados**
- `GET /matches-upcoming` — agenda
- `GET /matches-upcoming-detail` — detalhes completos
- `GET /matches-ended` — resultados (liquidação)
- `GET /matches-cs` — placares finais

**Ao vivo (genérico)**
- `GET /matches-live` — listagem
- `GET /matches-live-full` — completo + otimizado
- `GET /matches-live-detail` — detalhes
- `GET /matches-live-events` — eventos (gols, cartões…)

**Ao vivo Betfair (o jogo virou)**
- `GET /matches-betfair-upcoming` — pré-live com odds Betfair
- `GET /matches-betfair-live` — placar + `pressure_indices` (home/away/total) + stats por janela `last5min/10/15/20min` + ataques, ataques perigosos, chutes no/fora gol, escanteios, posse
- `GET /matches-betfair-live-compact` — lista enxuta para mapear `event_id`
- `GET /matches-betfair-live-markets` — lista de mercados disponíveis
- `GET /matches-betfair-live-odds` — **odds reais da Betfair Exchange (back e lay, preço + volume, last_price_traded, total_matched) por runner**

**Base URL:** `https://csv.futodds.com/functions/v1/`
**Auth:** `Authorization: Bearer <FUTODDS_API_KEY>` (ou `X-API-Key`)
**Plano Premium:** R$ 250/mês, 10 req/s, ilimitado, cache 30s Redis no lado deles.

## Impacto direto nos problemas atuais

| Problema hoje | Como o Futodds resolve |
|---|---|
| Odd estimada (`estimateLiveOdd.ts`) com erro grande | Substituída por **odd real Betfair Exchange** (back/lay) com volume — fim das estimativas |
| xG/SofaScore enrichment frágil para pressão | `pressure_indices` + janelas 5/10/15/20min nativos no `/matches-betfair-live` |
| Sportmonks + API-Football fallback complexo | 1 provedor primário cobre placar, stats, pressão, eventos, odds |
| The Odds API só para snapshots | `/matches-betfair-upcoming` e `/matches-upcoming-detail` cobrem pré-live |
| Liquidação dependente de 2 fontes | `/matches-ended` + `/matches-cs` resolvem |

## Decisão estratégica

Conforme sua orientação: **Futodds passa a ser o provedor PADRÃO para tudo ao vivo agora**. API-Football e Sportmonks ficam como fallback de segurança por 30 dias e depois são desligados (se métricas confirmarem cobertura). The Odds API é desligada após Fase 2.

## Fases revisadas

### Fase 1 — Provider Futodds + smoke test (1 dia)
1. Criar `supabase/functions/_shared/futoddsProvider.ts` espelhando a API de `liveProvider.ts` (`getLiveMatches`, `getFixtureStats`).
2. Atualizar `futodds-probe` para também testar `/matches-betfair-live`, `/matches-betfair-live-compact`, `/matches-betfair-live-odds` (já valida endpoints reais com base URL `csv.futodds.com`).
3. Rodar probe via `/admin/dashboard` para confirmar:
   - Cobertura de ligas brasileiras + europeias whitelistadas
   - Quantos jogos `is_betfair=true` aparecem em horário típico
   - Latência das 7 chamadas-chave

### Fase 2 — Promover Futodds a primário (2 dias)
1. Setar `LIVE_PROVIDER_PRIMARY=futodds` (env).
2. `liveProvider.ts`: ordem de tentativa passa a ser **Futodds → Sportmonks → API-Football** (mantém os 2 como fallback).
3. Adapter no `futoddsProvider.ts` converte resposta Futodds para o shape "API-Football compatível" já consumido por `update-live-scores`, `analyze-live`, etc. (mapeia `pressure_indices`, `last5min_stats`, ataques, posse, escanteios, chutes).
4. Migrar `useLiveMatches.ts` (frontend) para consumir os campos novos `pressure_indices` e `last5min_stats` via mesma view de DB.
5. Gráfico de pressão (`MatchPressureChart`, `MatchPressureModal`) passa a usar `pressure_indices` real do Futodds em vez de derivar de ataques.
6. Placar ao vivo (`live_matches.score_home/away/minute/period`) alimentado pelo Futodds em `update-live-scores`.

### Fase 3 — Odds Betfair reais (CONCLUÍDA)
1. ✅ Edge `futodds-live-odds` (plural) recebe `event_id` e devolve back/lay/last_price_traded por mercado.
2. ✅ Cashout (`evaluate-cashout`) agora resolve `event_id` Betfair via `/matches-betfair-live-compact` (cache 60s) e busca `last_price_traded` em `/matches-betfair-live-odds` (cache 15s). Cadeia: **Betfair Exchange real → Futodds odds_live agregadas → estimador Poisson**. `odd_fonte` passa a registrar `betfair_exchange | futodds_live | estimada`.
3. ✅ `OddsComparator.tsx` consulta Futodds e injeta a linha "Betfair Exchange (LIVE)" no topo da tabela, com refresh de 30s.
4. ⏭️ Eventos Raros (LAY GOLEADA/2x2/1x3/3x1) — próximo: trocar estimativas pelas back/lay reais do `/matches-betfair-live-odds`.

### Fase 4 — Aposentar fontes redundantes (3 dias, gradual)
1. **The Odds API** → desligar após confirmar `/matches-betfair-upcoming` cobre odds pré-live (manter `check-odds-quota` apenas para monitoramento).
2. **Sportmonks** → manter shadow 14 dias, depois desligar `SPORTMONKS_API_KEY` se Futodds tiver ≥95% paridade.
3. **API-Football** → permanece **somente como fallback** para ligas que o Futodds não cobre (ex: amistosos obscuros) e para `/fixtures/events` na liquidação Punter (até validar `/matches-live-events` + `/matches-ended`).
4. **SofaScore enrichment** → manter por mais 14 dias e desligar se `pressure_indices` + janelas Futodds substituírem com qualidade igual ou superior.

### Fase 5 — Otimização (contínua)
- Cache local em `cached_odds_games` alimentado por `/matches-upcoming` (1 chamada / 60s).
- Reduzir polling live de 30s → 15s (Premium permite 10 req/s).
- Painel admin "Futodds Health" com latência, taxa de erro, ligas cobertas.

## Arquivos a criar
- `supabase/functions/_shared/futoddsProvider.ts` — adapter Futodds → shape compat
- `supabase/functions/futodds-live-odds/index.ts` — proxy odds Betfair reais
- `src/components/admin/FutoddsHealth.tsx` — painel de saúde

## Arquivos a editar
- `supabase/functions/_shared/liveProvider.ts` — adicionar Futodds como 1º provedor
- `supabase/functions/update-live-scores/index.ts` — consumir `pressure_indices` + janelas
- `supabase/functions/analyze-live/index.ts` — usar pressão real
- `supabase/functions/punter-settle-results-v3/index.ts` — usar `/matches-ended`
- `supabase/functions/futodds-probe/index.ts` — incluir endpoints Betfair
- `src/lib/estimateLiveOdd.ts` — DEPRECAR (substituir por fetch Futodds odds)
- `src/components/dashboard/OddsComparator.tsx` — odds reais Betfair
- `src/components/dashboard/MatchPressureChart.tsx` + `MatchPressureModal.tsx` — `pressure_indices`
- `src/components/dashboard/ActivePositions.tsx` — cashout com `last_price_traded`
- `src/hooks/useLiveMatches.ts` — expor novos campos
- `src/hooks/useLivePrices.ts` — fonte Betfair real

## O que NÃO precisamos mais

- **The Odds API** — substituída por `/matches-betfair-upcoming` + `/matches-betfair-live-odds`
- **Sportmonks** — substituída por `/matches-live-full` + `/matches-betfair-live`
- **SofaScore live enrichment** — substituído por `pressure_indices` + janelas nativas
- **`estimateLiveOdd.ts`** — substituído por odds Betfair reais

API-Football permanece **apenas como cinto de segurança** para ligas raras nos primeiros 30 dias.

## Riscos e mitigações
- **Cobertura Betfair < 100%**: nem todo jogo whitelistado terá `is_betfair=true`. Mitigação: para esses, usar `/matches-live-full` (sem odds Betfair, mas com stats) e cair em odd estimada apenas como último recurso.
- **Cache 30s nas odds**: pode não ser ideal para cashout em janelas críticas. Mitigação: marcar timestamp da odd e exibir "atrasada Xs" no UI.
- **Plano FREE atual (100 req/dia)**: não suporta produção. Necessário **assinar Premium R$250/mês ANTES da Fase 2**.

## Próximo passo

Você confirma esta direção e podemos começar pela **Fase 1**: rodar o probe ajustado (com base URL correta `csv.futodds.com` e endpoints Betfair) para mapear cobertura real antes de qualquer mudança no código de produção. Já com a `FUTODDS_API_KEY` que você cadastrou, rodo o probe e te trago o relatório de cobertura/latência para decidirmos se pulamos direto para Fase 2.
