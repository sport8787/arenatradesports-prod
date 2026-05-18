
# Método dos Ciclos — Alavancagem de Banca

Nova feature para o usuário alavancar uma fração isolada da banca seguindo o método do Nettuno: 5 ciclos sequenciais, cada um buscando dobrar a stake de trabalho com meta de 5% por entrada e fator redutor de 2,5% após cada green.

## Onde aparece
- Rota compartilhada `/ciclos` (acessível por Trader Sports e Punter)
- Atalho no menu lateral de Arena Trader Sports (`ArenaTraderSports.tsx`)
- Atalho em `PunterFunctions.tsx` / `PunterMenu.tsx`
- Atalho em `PunterBancaVirtual.tsx` (já tem o pattern dos QuickBtn)

## Fluxo do usuário
1. **Setup inicial** — usuário declara a banca total e a fração isolada (sugerido 5–10%; máx 10% como recomenda Nettuno). O sistema cria a "Banca de Ciclo" isolada (não mexe na Virtual nem na Manual).
2. **Painel do ciclo ativo** mostra:
   - Ciclo atual (1–5), stake de trabalho, meta do ciclo (sempre 2x), barra de progresso até a meta
   - Próxima meta de lucro % por entrada (5% → 4,88% → 4,75% → …), valor R$ correspondente
   - Saldo atual da banca de ciclo, nº de entradas no ciclo, P&L acumulado
   - Histórico de entradas (timestamp, jogo opcional, lucro/prejuízo, % meta atingida)
3. **Registrar entrada** — dois caminhos:
   - **Manual**: botões Green (digita lucro real) / Red (digita prejuízo real) / Void
   - **Integrado a Trader Sports**: numa entrada virtual aprovada, botão "Aplicar ao Ciclo" envia o resultado quando liquidar
4. **Transições automáticas**:
   - Atinge 2x stake → fecha ciclo, mostra modal "Saque obrigatório" com valor (100/100/50/100/100 conforme tabela Nettuno) e inicia próximo ciclo com nova stake (100/100/150/200/300 proporcional à banca inicial do usuário)
   - 5º ciclo completo → tela de conclusão (6x banca inicial), oferece reiniciar
5. **Recovery em RED**:
   - RED parcial → cria sub-ciclo de recuperação (meta = voltar à stake de trabalho do ciclo)
   - RED total da stake → modal de reinício, ciclo volta ao zero (mantém histórico)

## Regras fixas (fiéis ao Nettuno)
- Meta inicial: 5% por entrada
- Fator redutor: 2,5% sobre a meta a cada green dentro do mesmo ciclo
- Estrutura dos 5 ciclos proporcional à banca inicial `B`:
  ```
  Ciclo 1: stake B,       meta 2B, saque ao final: B
  Ciclo 2: stake B,       meta 2B, saque: B
  Ciclo 3: stake 1.5B,    meta 3B, saque: 0.5B
  Ciclo 4: stake 2B,      meta 4B, saque: B
  Ciclo 5: stake 3B,      meta 6B, fim do método
  ```
- Bloqueios: mercado Under Limite proibido (alerta UI), recomendação para Match Odds, sempre "a favor do tempo"

## UI / Componentes novos
- `src/pages/Ciclos.tsx` — página principal
- `src/components/ciclos/CycleSetupWizard.tsx` — onboarding (banca total + fração)
- `src/components/ciclos/ActiveCycleCard.tsx` — card grande do ciclo ativo com meta atual
- `src/components/ciclos/RegisterEntryDialog.tsx` — modal Green/Red/Void
- `src/components/ciclos/CycleHistoryTable.tsx` — entradas do ciclo + ciclos passados
- `src/components/ciclos/CycleProgressBar.tsx` — visual dos 5 ciclos (timeline)
- `src/components/ciclos/CycleCompleteDialog.tsx` — modal de saque obrigatório + iniciar próximo
- `src/lib/ciclosMath.ts` — funções puras: `nextTargetPct(green_streak)`, `cycleConfig(initialB, cycleNumber)`, `cycleStatus(...)`
- Atalho na Arena Trader Sports e Punter

## Backend (Lovable Cloud)
Duas tabelas novas (RLS por `user_id`):
- `user_cycles_bankroll` — uma linha por usuário: `total_bankroll`, `isolated_pct`, `initial_bankroll` (B), `current_cycle` (1–5), `current_stake`, `current_balance`, `entries_in_cycle`, `green_streak`, `status` (active/completed/failed)
- `user_cycles_entries` — log de cada entrada: `cycle_number`, `entry_index`, `target_pct`, `target_amount`, `result` (green/red/void), `profit_loss`, `balance_after`, `match_id` (nullable, vínculo com Trader Sports), `created_at`

RPCs/funções:
- `start_cycle_method(total, pct)` — cria a banca de ciclo
- `register_cycle_entry(result, amount, match_id?)` — atualiza estado, avança meta, detecta fechamento de ciclo
- `advance_cycle()` — chamada ao confirmar saque do modal
- `reset_cycle()` — em caso de RED total

## Integração com Trader Sports
- Em `ActivePositions` / cards de sinais aprovados: botão secundário "Vincular ao Ciclo" — quando o virtual_bet liquida, trigger atualiza `user_cycles_entries` com result+profit_loss e dispara `register_cycle_entry` via trigger SQL.

## Fora de escopo (versão 1)
- Marketplace público de ciclos / ranking entre usuários
- Aplicação automática (sem confirmação) de qualquer entrada Trader ao ciclo
- Suporte ao Punter (Banca Manual) além do atalho — pode reusar a mesma `/ciclos`

## Resumo técnico
- 1 migration (2 tabelas + RLS + 3 RPCs + 1 trigger virtual_bets→cycles)
- 1 nova rota + 6 componentes + 1 lib pura
- 3 atalhos de navegação (Trader Sports menu, PunterMenu, PunterBancaVirtual)
- Memória nova: `mem://features/alavancagem/metodo-ciclos`
