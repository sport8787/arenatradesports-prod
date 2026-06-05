
# Modo Copa do Mundo 2026 — Oráculo Mycroft

Toggle global que substitui parâmetros do Punter (e regras situacionais do Live) por um conjunto específico de Copa enquanto o torneio estiver ativo (até 19/07/2026).

## 1. Schema (migration)

**`punter_gate_config`** — adicionar colunas:
- `modo_copa boolean DEFAULT false`
- `copa_start_date date`
- `copa_end_date date DEFAULT '2026-07-19'`
- `copa_config jsonb` (thresholds por fase: VE mínimo, confiança, stakes A/B/C, exposição máxima)

**Nova tabela `copa_fixtures`** (cache diário dos jogos da Copa):
- `fixture_id text PK`, `home`, `away`, `commence_time timestamptz`
- `phase text` (`grupos_j1`, `grupos_j2`, `grupos_j3`, `oitavas`, `quartas`, `semi`, `final`, `3lugar`)
- `home_fifa_rank int`, `away_fifa_rank int`, `home_fifa_pts int`, `away_fifa_pts int`
- `home_already_qualified bool`, `away_already_qualified bool`
- `home_eliminated bool`, `away_eliminated bool`
- `injuries jsonb` (lista de desfalques por seleção)
- `xg_last5 jsonb` (xG/xGA médio das últimas 5 oficiais por seleção)
- `updated_at timestamptz`

**Nova tabela `punter_copa_signals`** (histórico isolado):
- mesmas colunas-chave de `punter_signals` + `phase`, `ah_line numeric`, `ve_pct numeric`, `block char(1)`, `copa_badge bool DEFAULT true`
- GRANTs padrão (select authenticated, all service_role) + RLS por user_id

## 2. Edge functions

### `copa-fixtures-sync` (cron diário 09:00 UTC)
- Busca fixtures Copa do Mundo 2026 via API-Football (league_id 1, season 2026) para os próximos 5 dias
- Enriquece com:
  - Ranking FIFA atual (endpoint dedicado API-Football ou cache estático seed)
  - xG últimas 5 oficiais (filtrar `type=International`, excluir amistosos)
  - Desfalques (injuries endpoint)
  - Status de classificação/eliminação calculado a partir da tabela de grupos
- Upsert em `copa_fixtures`

### `mycroft-punter-copa` (cron diário 11:00 UTC, **1× ao dia**)
Pipeline determinístico + IA DeepSeek (cascata DeepSeek → Groq → Gemini, padrão atual):

1. **Carregar** todos `copa_fixtures` com `commence_time` nas próximas 36h
2. **Para cada jogo**, calcular candidato AH:
   - Diff FIFA pts → linha AH alvo (tabela do brief)
   - Odd AH alvo via Futodds (range 1.65–2.30 obrigatório)
   - Poisson bivariado com xG/xGA últimos 5 → prob cobertura AH → VE
3. **Filtros determinísticos** (pré-IA, todos obrigatórios):
   - xG favorito ≥ 1.5 / xGA adversário ≥ 1.2
   - Diff posse esperada ≥ 10pp
   - VE ≥ VE_min da fase (grupos 7%, oitavas 5%, quartas+ 4%)
   - Confiança ≥ 70% grupos / 65% mata-mata
4. **Vetos contextuais** (rejeitam o sinal):
   - `home_already_qualified || away_already_qualified` em `grupos_j3`
   - `home_eliminated || away_eliminated`
   - `injuries.length > 4` por seleção
   - AH ≤ -1.0 em mata-mata
   - Movimento de odd > 20% nas últimas 12h (via `ah_odds_snapshot`)
   - Mercado com prorrogação/pênaltis em mata-mata
5. **Anti-correlação**: nunca emitir Over 2.5 + BTTS no mesmo jogo (escolhe maior VE)
6. **Mercados secundários por fase** (rodam só se AH for vetado por odd/range):
   - Grupos j1/j2: Over 2.5, Over 1.5 HT, Vitória favorito
   - Grupos j3: Under 2.5 (ambos classificados/eliminados), Back necessidade
   - Mata-mata: BTTS oitavas/quartas equilibradas, Under 3.5 semi/final, Back 90min
7. **IA (DeepSeek)** valida narrativa e gera justificativa pt-br
8. **Stake** conforme bloco + fase (Bloco A 1.5/2%, B 2/3%, C 3/4%)
9. **Exposição máxima por rodada**: soma de stakes ≤ 8% — se exceder, mantém os de maior VE
10. Persiste em `punter_copa_signals`, envia Telegram com badge "🏆 COPA 2026"

### `analyze-live-matches` (já existe — adicionar branch)
- Se `modo_copa=true` E fixture é da Copa → aplica regras S-COPA-1…4 no lugar das S1–S4 padrão
- AH ao vivo (-0.5 favorito 20–45' / +0.5 zebra 55'+) com cancelamento se adversário marca

## 3. Frontend

- **`/admin/copa-mode`**: toggle ON/OFF + datas + visualização dos thresholds + contagem de sinais Copa hoje
- **Badge "🏆 COPA 2026"** em `SignalCard` quando `copa_badge=true`
- **Tab "Copa"** em `/punter` com histórico isolado (lê `punter_copa_signals`)
- **Filtro** no `LigaMycroft` para separar ROI Copa vs ROI Global

## 4. Cron & calibração

```sql
-- 09:00 UTC: sync fixtures + enriquecimento
select cron.schedule('copa-fixtures-sync', '0 9 * * *', ...);
-- 11:00 UTC: análise única do dia
select cron.schedule('mycroft-punter-copa', '0 11 * * *', ...);
-- Auto-desativa após 19/07
select cron.schedule('copa-auto-disable', '0 0 20 7 *',
  $$ update punter_gate_config set modo_copa=false $$);
```

**Calibração progressiva** (dentro de `copa-fixtures-sync`):
- Após j1 de cada seleção: salva `xg_copa` em `copa_fixtures`
- Após j2: passa a usar `xg_copa` com peso 2 vs histórico pré-Copa peso 1
- Eliminatórias: peso 3 sobre amistosos

## 5. Fontes de dados extras

- **FIFA ranking**: seed inicial via JSON estático (atualizar manualmente após cada janela FIFA) + endpoint API-Football `/teams/statistics` quando disponível
- **xG seleções**: API-Football `/fixtures/statistics` filtrado `type IN ('World Cup Qualification','Friendlies','Nations League','International')` — amistosos peso 0,3
- **Desfalques**: API-Football `/injuries?team={id}&season=2026`
- **Sportmonks**: usar endpoint `/teams/national` se o trial for renovado; senão pular (não-bloqueante)
- **Futodds**: já integrado, fornece AH live e movimento de odds

## 6. Detalhes técnicos

- Edge `mycroft-punter-copa` reusa `_shared/deepseekProvider.ts` (cascata já implementada)
- Time guard 110s, batches de 5 jogos (igual Punter padrão)
- Logs em `cron_logs` com `tipo='copa_punter'` + `detalhes` JSON (jogos vistos/aprovados/vetados por razão)
- Telegram via canal existente, prefixo `🏆 COPA` no título
- Memory: criar `mem://features/arena-punter/modo-copa-2026` após implementação

## 7. Ordem de implementação

1. Migration (schema + GRANTs + RLS)
2. `copa-fixtures-sync` + seed FIFA ranking
3. `mycroft-punter-copa` (pipeline determinístico + IA)
4. Cron jobs + auto-disable
5. Branch live em `analyze-live-matches` (regras S-COPA)
6. UI admin `/admin/copa-mode` + badge + tab Copa
7. Teste end-to-end com fixtures mockados (modo dry-run via flag)
