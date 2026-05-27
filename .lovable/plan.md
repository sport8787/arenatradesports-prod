# Correção do Método dos Ciclos — Metodologia Original

## Diagnóstico do que está errado hoje

A implementação atual de `horus-pilot-ciclos-live` trata o método como "entrada cheia a favor da odd alta (≥2.00)" buscando dobrar a banca em 1 green. Isso **viola a essência do método**, que é o oposto:

- ❌ Hoje: stake = banca inteira (R$200), odd ≥ 2.00, busca 1 green dobrar.
- ✅ Correto: stake ~5% da banca corrente, odd 1.15–1.40, lucro-alvo 5% (decrescente 2,5% por green), 20+ entradas pra dobrar.

Além disso falta: gate de qualificação (mercado, momento, indicadores ao vivo, odd), monitoramento de fechamento no lucro-alvo, RED trigger, estrutura de 5 ciclos com saques, logs dedicados.

## Escopo da correção

### 1. Banco de dados

**Tabela nova `user_cycle_logs`** (logs por entrada do método):
- user_id, cycle_number (1–5), entry_number, stake, entry_odd, target_odd, exit_odd, result (green/red/cancel), profit_loss, signal_id, match_id, timestamp.
- RLS: user vê o próprio; service_role full.

**Ajustes em `user_cycles_bankroll`**:
- Garantir colunas: `entry_number_in_cycle` (int, default 1), `green_streak_in_cycle` (int, default 0), `withdrawn_total` (numeric).
- Tabela de ciclos fixa (1→200, 2→200, 3→150, 4→200, 5→300) com saques após meta.

**RPCs**:
- `cycle_method_register_entry(user_id, entry_data)` — grava log + atualiza estado.
- `cycle_method_on_green(user_id, profit)` — incrementa green_streak, recalcula target%, checa se bateu meta do ciclo → saque + avança ciclo.
- `cycle_method_on_red(user_id, loss)` — reinicia entry_number=1, zera green_streak, mantém ciclo (banca restante vira nova base).

### 2. Edge `horus-pilot-ciclos-live` (reescrever)

**Gate de 4 etapas** antes de aceitar sinal vindo de `mycroft_analyses`:
1. **Mercado**: somente Match Odds (Back/Lay). Rejeita Over/Under, BTTS, Corners, Under Limite.
2. **Momento**: jogo `LIVE` (status 1H/HT/2H/ET), e `minute >= 1`, com pelo menos 1 gol marcado OU mudança de favoritismo (drift de odd ≥ 5% últimos 5min). Lê `live_matches.score` + `pressure_indices`.
3. **Indicadores ao vivo** (via `live_matches.stats` + `pressure_indices`):
   - Pressão ≥ 2 do lado escolhido (dangerous_attacks dominância 2x+).
   - Aceleração gráfica: odd movendo a favor (drift negativo na odd back nos últimos 3min) — usar `live_odds_history` se disponível, senão `mycroft_analyses.odds_trend`.
   - xG do lado ≥ 0.4 nos últimos 10min (proxy: `stats.xG_home/away` >= 0.4 cumulativo OU shots_on_target >= 2 últimos 10min).
4. **Odd**: 1.15 ≤ odd ≤ 1.40 (ideal 1.20–1.35; logar fora-ideal).

**Stake & target dinâmicos** (não mais banca inteira):
- `entry_number = user_cycles_bankroll.entry_number_in_cycle`
- `stake_pct = 5% * (1 - 0.025)^green_streak` → `stake = bankroll_atual * stake_pct / 5%` (na verdade tabela: stake cresce composto pelo lucro acumulado, target% decresce).
- Implementar via helpers em `_shared/ciclosMath.ts` espelhando `src/lib/ciclosMath.ts` (criar `nextTargetPct`, `nextStake`, `targetExitOdd(entryOdd, targetPct)`).
- `target_exit_odd = entry_odd / (1 + target_pct)` (para back: lucro = stake*(odd_entry/odd_exit - 1) ).

**Concorrência**: 1 entrada por vez por usuário (mantém).

### 3. Edge nova `horus-pilot-ciclos-monitor` (cron 1min)

Para cada `virtual_bets` com `via_horus_ciclos=true` e `status='pending'`:
- Buscar odd ao vivo do match (Futodds/Sportmonks/The Odds via `_shared/sportmonks-af-adapter`).
- Se `current_odd <= target_exit_odd` → fecha GREEN PARCIAL: marca `status='green'`, `exit_odd=current_odd`, `profit = stake*(entry_odd/current_odd - 1)`.
- Se cenário RED (gol contra, virada de favoritismo, pressão invertida, ou odd subiu >15% acima da entry_odd) → fecha RED imediato: `status='red'`, `loss = stake*(current_odd/entry_odd)*(stake_factor)` (cash-out parcial; simplificação: registra `loss = stake * loss_pct` calculado pela razão de odds).
- Se FT sem trigger → liquida pelo placar normal (trigger existente já faz isso, mas precisa respeitar exit_odd).

### 4. Trigger `trg_horus_pilot_autobind_trader`

Ajustar pra usar **profit_loss real do log** (`exit_odd` vs `entry_odd`) em vez de `stake*(odd-1)` cheio. Chamar `cycle_method_on_green/on_red` que já gravam em `user_cycle_logs` e tratam saque/avanço/reinício de ciclo.

### 5. Notificações

Edge `notify-cycle-event` (ou ampliar `notify-trader-event`) para enviar push + Telegram:
- "🟢 Ciclo N concluído! Saque R$ X. Acumulado R$ Y."
- "🔴 Ciclo N reiniciado após RED. Banca restante R$ Z."
- "⚠️ Entrada rejeitada: gate falhou em <etapa>."

### 6. UI (`src/pages/Ciclos.tsx` + `src/components/punter/` cycles)

Painel dedicado **dentro do Arena Trader Sports** (mover/duplicar link, remover do Punter):
- Card "Ciclo Atual: N/5" + barra de progresso (banca / meta).
- Tabela "Histórico de Entradas do ciclo": data, mercado, odd entrada, odd saída, target%, lucro/prejuízo, resultado.
- Resumo de saques: total sacado + banca disponível pro ciclo atual.
- Indicador do gate ao vivo (próxima entrada elegível? mostra quais etapas passaram).

### 7. Remoção do vínculo com Punter

- Remover botões/atalhos em `PunterMenu`, `PunterBancaVirtual` que apontam pra `/punter/ciclos`.
- Mover rota para `/arena-trader-sports/ciclos` (manter `/punter/ciclos` como redirect pra compatibilidade).
- Atualizar memória `mem://features/alavancagem/horus-pilota`.

## Arquivos a tocar

```
supabase/migrations/<novo>.sql            (user_cycle_logs + RPCs + colunas)
supabase/functions/horus-pilot-ciclos-live/index.ts      (reescrever gate+stake)
supabase/functions/horus-pilot-ciclos-monitor/index.ts   (criar)
supabase/functions/_shared/ciclosMath.ts                 (criar)
src/lib/ciclosMath.ts                                    (adicionar nextStake/targetExitOdd)
src/pages/Ciclos.tsx                                     (UI revisada)
src/components/punter/* → remover atalhos de ciclos
src/App.tsx                                              (rota nova)
```

## Validação após implementar

1. Inserir bankroll teste + simular `mycroft_analyses` APROVADO match-odds com odd 1.25 num jogo com gol e pressão → confirmar entrada com stake 5%.
2. Atualizar odd ao vivo pra 1.19 → monitor deve fechar GREEN.
3. RPC deve registrar log, incrementar green_streak, recalcular target.
4. Simular 22 greens consecutivos → bate meta R$400, dispara saque, avança Ciclo 2.
5. Simular RED → reinicia entry_number, mantém ciclo.

## Aprovação

Confirmar antes de implementar:
- (a) Apaga totalmente o comportamento atual de "entrada cheia odd 2.00"? **Sim** (incompatível).
- (b) Remover link do Punter ou só duplicar no Arena Trader? Recomendo **remover do Punter** + redirect.
- (c) Notificações por Telegram herdam config já existente do usuário (`telegram_user_settings`)? Assumindo **sim**.
