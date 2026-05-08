
# Plano: Adoção da Futodds API

## 1. Análise comparativa

### Endpoints Futodds vs APIs atuais

| Necessidade hoje | Provedor atual | Endpoint Futodds equivalente | Substitui? |
|---|---|---|---|
| Lista jogos ao vivo | API-Football `/fixtures?live=all` + Sportmonks `livescores/inplay` | `GET /matches-live` | **Sim** (a validar volume de ligas) |
| Stats live detalhadas (xG, chutes, posse, escanteios, ataques) | API-Football `/fixtures/statistics` + `/fixtures/events` | `GET /matches-live-detail` + `/matches-live-events` | **Sim** (a validar campos) |
| Snapshot completo (stats + odds + lineups) | Múltiplas chamadas API-Football | `GET /matches-live-full` | **Sim** — reduz N chamadas |
| Jogos encerrados (settlement) | API-Football `/fixtures?date=` + Sportmonks fallback | `GET /matches-ended` | **Sim** — substitui pipeline de liquidação |
| Pré-live (jogos do dia + odds) | The Odds API `/sports/{key}/odds` | `GET /matches-upcoming` | **Parcial** — depende de cobertura de bookmakers e mercados |
| Correct Score odds/probs | The Odds API + estimativa interna | `GET /matches-cs` | **Sim** — ganho real (CS é caro/limitado em outras APIs) |
| Comparador multi-bookmaker (smart-odds-scanner, sharp money, RLM, steam) | The Odds API (10+ bookmakers) | A validar em `/matches-upcoming` e `/matches-live-full` | **Incerto** |
| Liquidação por player props (anytime scorer, assists) | API-Football `/fixtures/events` | `/matches-live-events` (a validar nomes de jogadores) | **Provável sim** |
| Cards/Cartões por jogador (mycroft-cards-punter) | API-Football events | `/matches-live-events` | **A validar** |

### Sportmonks — comparação direta
A Sportmonks hoje serve para: (a) shadow A/B em `live-provider-compare`, (b) fallback de stats live. A Futodds **substitui as duas funções** se entregar:
- xG live, posse, chutes (incluindo on/off target), escanteios, cartões, ataques perigosos
- Status de partida com `minute` confiável
Se entregar tudo isso, **descontinuamos Sportmonks** (economia + simplificação).

### API-Football — substituição
**NÃO** descontinuar imediatamente. Manter como **fallback** por 30 dias por causa de:
- Cobertura comprovada de player events (gols, assistências, cartões) usada em settlement
- `mycroft-extra-markets`, `mycroft-cards-punter`, `mycroft-players-punter` dependem de eventos detalhados
- Histórico H2H, lineups confirmados, estatísticas de temporada (Level 1) — **provavelmente Futodds NÃO cobre isso** (foco é live + odds)

### The Odds API — substituição
**Provavelmente sim, mas validar.** Pontos críticos:
- Smart Odds Scanner, Sharp Money Detector e Market Manipulation Detector exigem **múltiplos bookmakers por mercado** com snapshots temporais
- Se Futodds expõe ≥5 bookmakers em `/matches-upcoming` com histórico de movimento, substitui
- Caso contrário, manter The Odds API só para esses 3 detectores

## 2. Impacto nos Jogos ao Vivo

### Onde entra Futodds
- `_shared/liveProvider.ts` — adicionar provider `futodds` ao lado de `api_football` e `sportmonks`
- `useLiveMatches`, `live-provider-compare` (admin A/B), `analyze-live`, `eventos-raros-live`
- `mycroft-cards-punter`, `mycroft-players-punter`, `mycroft-extra-markets` — substituir busca de eventos
- Pipelines de liquidação: `punter-settle-results-v3` ganha provider primário Futodds, fallback API-Football

### Ganhos esperados
- **Latência**: 1 chamada `/matches-live-full` vs 3-4 da API-Football
- **Custo**: R$250/mês fixo vs API-Football (Ultra) + The Odds API + Sportmonks (≈ US$ 130-180/mês combinado)
- **Mycroft Punter/Live**: probabilidades CS já calculadas em `/matches-cs` alimentam diretamente o motor Poisson Bivariada
- **Reanálise** (windows 5min/1min) fica mais barata e rápida

### Riscos
- Cobertura de ligas pode ser menor que API-Football (que tem ~1100 ligas) — validar whitelist atual de 70+ ligas
- Plano FREE só permite 100 req/dia → **obrigatório PREMIUM** (10 req/s, ilimitado)
- Sem documentação pública de schema — depende do que retorna na prática
- Player props (anytime scorer/assist) podem não ter granularidade suficiente para liquidação confiável

## 3. Plano de implantação (4 fases)

### Fase 0 — Discovery (1-2 dias, ANTES de assinar)
1. Pedir ao usuário **acesso temporário** ou trial à API key PREMIUM
2. Criar edge function `futodds-probe` (similar a `sportmonks-probe`) que chama todos os 7 endpoints e retorna schema bruto + amostras
3. Validar campos críticos:
   - xG em `/matches-live-detail`
   - Lista de bookmakers em `/matches-upcoming`
   - Eventos de jogador em `/matches-live-events` (gols, assistências, cartões)
   - Cobertura de ligas Brasileirão, Libertadores, Premier League, La Liga, MLS, etc.
4. **Decisão go/no-go** baseada no relatório de probe

### Fase 1 — Integração shadow (3-4 dias)
1. Adicionar `FUTODDS_API_KEY` aos secrets do Lovable Cloud
2. Criar `supabase/functions/_shared/futoddsProvider.ts` com mappers para o formato canônico já usado em `liveProvider.ts`
3. Estender `live-provider-compare` para incluir Futodds (3-way A/B: AF vs SM vs Futodds)
4. Painel admin: aba "Shadow Futodds vs API-Football" (similar à `ShadowAfApprovedTab`) — comparar approval rate, divergência de stats, settlement agreement em 7 dias
5. **Sem impacto em produção** nesta fase

### Fase 2 — Promoção a primário live (2-3 dias)
1. `LIVE_PROVIDER_PRIMARY=futodds` (env var) com fallback automático para API-Football
2. Migrar `useLiveMatches` e `analyze-live` para consumir Futodds
3. Migrar `punter-settle-results-v3` para usar `/matches-ended` como primária (API-Football vira fallback)
4. Manter cron de reconciliação shadow rodando 7 dias
5. Monitorar: edge function logs, settlement agreement, divergência xG

### Fase 3 — Substituição The Odds API + Sportmonks (3-4 dias)
1. Migrar `smart-odds-scanner`, `sharp-money-detector`, `market-manipulation-detector` para `/matches-upcoming` e `/matches-live-full` (se cobertura de bookmakers for adequada)
2. Migrar consumidores de Sportmonks (`live-provider-compare`, fallback de stats) — depois **remover `SPORTMONKS_API_KEY`**
3. Avaliar manter The Odds API só para `check-odds-quota` e mercados não cobertos
4. Atualizar memory: nova entrada `mem://technical-decisions/external-apis/futodds-primary-provider`

### Fase 4 — Otimização (contínuo)
1. Cache em `cached_odds_games` alimentado por `/matches-upcoming` (substitui cron atual de The Odds)
2. Reduzir frequência de polling: 1 chamada `/matches-live-full` a cada 60s cobre dashboard inteiro
3. Endpoint `/matches-cs` alimenta diretamente o motor de LAY GOLEADA / Eventos Raros

## 4. Recomendação de decisão

**Assinar o PREMIUM (R$250/mês) condicionado ao resultado da Fase 0 (probe).**

| Condição na probe | Ação |
|---|---|
| Cobre ≥80% das ligas atuais + xG live + ≥5 bookmakers + eventos de jogador | Assinar e seguir Fase 1-3. Economia líquida estimada: R$ 400-600/mês |
| Cobre live mas sem player events confiáveis | Assinar mesmo assim, manter API-Football só para `mycroft-players-punter` |
| Cobertura de ligas <50% ou sem xG | **Não assinar** — manter stack atual |

## 5. Detalhes técnicos

### Arquivos novos
- `supabase/functions/futodds-probe/index.ts` — discovery (Fase 0)
- `supabase/functions/_shared/futoddsProvider.ts` — adapter
- `src/components/admin/FutoddsCompare.tsx` — painel A/B (Fase 1)

### Arquivos a editar (Fase 2-3)
- `supabase/functions/_shared/liveProvider.ts` — adicionar `futodds` como source
- `supabase/functions/analyze-live/index.ts`
- `supabase/functions/punter-settle-results-v3/index.ts`
- `supabase/functions/mycroft-extra-markets/index.ts`
- `supabase/functions/mycroft-players-punter/index.ts`
- `supabase/functions/mycroft-cards-punter/index.ts`
- `supabase/functions/smart-odds-scanner/index.ts`
- `supabase/functions/sharp-money-detector/index.ts`
- `supabase/functions/market-manipulation-detector/index.ts`
- `src/hooks/useLiveMatches.ts`

### Secrets necessárias
- `FUTODDS_API_KEY` (Bearer token mostrado em `/api-keys`)
- `LIVE_PROVIDER_PRIMARY` (env var: `futodds` | `api_football` | `sportmonks`)

### Migration
Tabela `futodds_probe_log` para auditar Fase 0 + tabela `futodds_shadow_comparison` para Fase 1 (similar ao shadow Sportmonks-AF já existente).

## Resumo executivo

- **Sportmonks**: substituível 100%
- **API-Football**: manter como fallback nos próximos 30 dias; possível remoção se Futodds cobrir player events
- **The Odds API**: substituível se Futodds expuser ≥5 bookmakers com snapshots; senão manter
- **Sequência crítica**: probe → shadow A/B → promoção gradual → desativação dos antigos
- **Não assinar antes de validar a probe** — risco de cobertura insuficiente de ligas/xG
