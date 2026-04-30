## Escopo confirmado

Migrar **somente** as 6 edges de análise **ao vivo** do Oráculo Mycroft:

| Edge | Função hoje | Migração |
|---|---|---|
| `fetch-live-matches` | Lista jogos ao vivo + stats (API-Football `/fixtures?live=all`) | Sportmonks `/livescores/inplay` primário, AF fallback |
| `update-live-scores` | Atualiza placar/minuto/stats a cada 30s | Sportmonks primário, AF fallback |
| `analyze-live-matches` | Orquestra enrichment + chama Mycroft | Aceita stats de qualquer fonte, sem mudança de API direta |
| `mycroft-sports-analysis` | Refetch stats por fixture id antes da IA | Sportmonks primário (via id mapeado), AF fallback |
| `fetch-simulation-matches` | Modo treino (dados sintéticos) | Sem mudança de API real, apenas adapta shape de stats |
| `flashscore-live-stats` | Scrape Firecrawl para xG | **Mantém** — é fonte de enrichment paralelo, não API principal |

**Edges Punter (pré-live), Eventos Raros, settlements, corners, handicap, daily-odds: NÃO mexer nesta fase.** Continuam 100% em API-Football.

## Estratégia: Plano 2 (Sportmonks primário + fallback automático)

```text
┌─────────────────────────────────────────────────────────┐
│ Edge Function (ex: fetch-live-matches)                  │
├─────────────────────────────────────────────────────────┤
│ 1. liveProvider.fetchLive() ──► Sportmonks /inplay      │
│    ├─ sucesso → normaliza → retorna                     │
│    └─ erro/timeout/circuit-open → fallback              │
│ 2. Fallback ──────────────► API-Football /fixtures?live │
│    └─ marca stats.source = 'api-football'               │
└─────────────────────────────────────────────────────────┘
```

Cada fixture normalizado guarda `stats.source` (`sportmonks` | `api-football` | `sofascore-enriched` | `flashscore-enriched`) para auditoria.

## Trabalho a executar

### 1. Camada compartilhada `_shared/sportmonks.ts`
Cliente único Sportmonks v3 (Pro Advanced) com:
- `fetchInplay()` — `/livescores/inplay` com `include=scores;participants;state;league;statistics;xgfixture;periods`
- `fetchFixture(id)` — `/fixtures/{id}` (refetch sob demanda)
- `fetchFixtureStats(id)` — extrai stats normalizadas (poss/shots/attacks/corners/cards/xG)
- Filtro de ligas: mesmo whitelist do `LIGAS_PERMITIDAS` atual (mapeado via tabela `league_id_map` Sportmonks↔API-Football)
- Usa `resilientFetch` (já existente) com `breakerKey: 'sportmonks'`
- Normalizador → mesmo shape do objeto `fixture` que o resto do app já consome

### 2. Camada `_shared/liveProvider.ts` (orquestrador)
- `getLiveMatches(): NormalizedFixture[]` → tenta Sportmonks; em erro/circuit-open chama API-Football wrapper
- `getFixtureStats(id, fallbackId?)` → idem
- Log estruturado: `[liveProvider] source=sportmonks count=14` ou `[liveProvider] FALLBACK to api-football reason=...`
- Persiste `stats.source` em `live_matches.stats`

### 3. Tabela `league_id_map` (migration)
```sql
create table league_id_map (
  api_football_id int primary key,
  sportmonks_id int not null,
  name text,
  enabled bool default true
);
```
Pré-popular via `sportmonks-probe` para as ligas do whitelist atual (Brasileirão, Premier, La Liga, etc.).

### 4. Refator das 6 edges
- **fetch-live-matches** — substitui chamada direta por `liveProvider.getLiveMatches()`. Lógica de filtro de ligas, persistência em `live_matches`, agendados, etc. permanece igual.
- **update-live-scores** — idem; mantém ciclo de 30s, SofaScore enrichment intacto.
- **mycroft-sports-analysis** — `fetchFixtureStats` agora vem do liveProvider; resto do prompt Mycroft inalterado.
- **analyze-live-matches** — só recebe `match` já normalizado; nenhuma chamada de API direta a mudar.
- **fetch-simulation-matches** — apenas alinha shape de stats com novo normalizador.
- **flashscore-live-stats** — sem mudança.

### 5. Botão Admin: A/B Sportmonks vs API-Football
- Novo componente `src/components/admin/LiveProviderCompare.tsx` em `AdminDashboard`
- Botão "Comparar provedores ao vivo" → invoca nova edge `live-provider-compare` (admin only, `verify_jwt=true` + `has_role(admin)`)
- Edge faz as 2 chamadas em paralelo (Sportmonks + API-Football), mostra:
  - Total de jogos por fonte
  - Diff de stats num jogo escolhido (poss, shots, xG, corners)
  - Latência de cada provedor
  - Status do circuit breaker
- **Não** afeta produção — usuários comuns sempre usam Sportmonks (com fallback automático invisível)

### 6. Observabilidade
- Adicionar contadores em `edge_function_runs.metadata`: `{ provider_used: 'sportmonks'|'api-football', fallback_count: n }`
- Painel admin já existente (`AdminEdgeFunctionsStatus`) ganha coluna "Live Provider"

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| ID de fixture difere entre Sportmonks e AF — settlement existente quebra | `live_matches.match_id` continua sendo o ID API-Football (settlements preservados); guardamos `sportmonks_id` em `stats.sm_id` |
| xG/stats com nomes diferentes | Normalizador faz tradução; fallback SofaScore continua ativo |
| Sportmonks fora do ar | Fallback automático para AF via circuit breaker (`resilientFetch` já existente) |
| Liga não mapeada | `league_id_map.enabled=false` → ignora silenciosamente, log de warning |

## Fora de escopo (fica como está, em API-Football)
- Punter pré-live (`mycroft-punter-anthropic`, `plano-favorito-prelive`, `mycroft-punter-analytic`, etc.)
- Settlements (`settle-bets`, `punter-settle-results-v3`)
- Corners (`mycroft-corners-*`)
- Eventos Raros, handicap asiático, daily-odds, evaluate-cashout
- Widget key, Sportradar diag

Se depois você confirmar que quer migrar Punter pré-live também, fazemos numa segunda fase reutilizando `_shared/sportmonks.ts`.

## Confirmações antes de executar
- Esse escopo de **6 edges + botão admin A/B** está correto?
- Pode prosseguir com o Plano 2 (Sportmonks primário, fallback AF transparente para o usuário final)?
