# Modo Blackjack Ao Vivo — Plano de Implementação

Nova modalidade **separada** do modo simulado existente. Não altera lógica do simulado.

## Arquitetura

Nova rota `/arena-blackjack/ao-vivo` (entrada pelo seletor de modos na `ArenaBlackjack`). Toda lógica em arquivos novos para isolamento total. Reaproveita `src/lib/blackjack/counting-and-trap.ts`, `decision-engine.ts` e `betting-system.ts` já existentes.

### Arquivos novos

```text
src/pages/ArenaBlackjackLive.tsx          # página principal (orquestrador)
src/components/arena-blackjack/live/
  SessionSetup.tsx                        # passo 1: config inicial
  ClassicTable.tsx                        # mesa 7 posições
  InfinityTable.tsx                       # mesa fluxo dinâmico
  CardKeypad.tsx                          # teclado A,2..10,J,Q,K
  CountingPanel.tsx                       # RC/TC + indicador 4 níveis
  DecisionSuggestion.tsx                  # card "Sugestão"
  ShuffleButton.tsx                       # "Embaralhou"
  SessionHistory.tsx                      # tabela + gráfico
  RoundFlowController.tsx                 # máquina de estados da rodada
src/lib/blackjack/live/
  liveSessionMachine.ts                   # FSM: setup → deal → player → others → dealer → resolve
  liveBetSizing.ts                        # Martingale Conservador + override TC≥4
  penetrationUtils.ts                     # 60/75/85% → cálculo decks restantes
  liveTypes.ts                            # tipos compartilhados
```

### Estado da sessão (in-memory + localStorage)

```ts
{
  tableType: 'classic' | 'infinity',
  decks: 4|6|8,
  penetration: 0.60|0.75|0.85,
  baseBet: number,
  bettingSystem: 'martingale'|'kelly'|'hybrid',
  bankroll: { initial, current },
  positions: { 1..7: 'active'|'empty'|'mine' },  // classic only
  count: { running, trueCount, cardsSeen, shuffles: [{roundsBefore}] },
  currentBet: number, redStreak: number,
  history: Round[],
}
```

## Fluxo das rodadas

### Mesa Clássica
`dealer_up → pos1..N → minha_decisão (com sugestão) → cartas extras outras posições → hole_card → resolução`

Posições marcadas como `empty` são puladas. Toggle ativa/desativa sem resetar sessão.

### Mesa Infinity
`minhas_cartas → loop "outros jogadores?" (S/N) → dealer_up → minha_decisão → loop "alguém pediu carta?" → hole_card → resolução`

`RoundFlowController` é uma FSM que emite o próximo prompt; UI reage.

## Contagem Hi-Lo

- Cada carta clicada via `CardKeypad` chama `updateCount()` (já existe). J/Q/K = -1 automaticamente.
- Decks restantes = `decks - cardsSeen/52`, ajustado pela penetração (alerta visual quando atinge limite).
- True Count com 4 faixas: ≤0 vermelho, 1-2 amarelo, 3-4 verde, ≥5 dourado.
- Botão **Embaralhou** zera `running/trueCount/cardsSeen`, registra `shuffles.push({roundsBefore})`, mantém banca e histórico, exibe toast de confirmação.

## Sugestão de decisão

Usa `decision-engine.ts` (estratégia básica) + desvios Illustrious 18 ativados por TC:
- TC≥0: 16 vs 10 → STAND
- TC≥3: 12 vs 3 → STAND, 10 vs 10 → DOUBLE
- TC≥4: 9 vs 2 → DOUBLE
- TC negativo: bloqueia DOUBLE/SPLIT marginais

## Martingale Conservador Ao Vivo

- Base configurada na sessão. RED: `bet += 2`. WIN em recovery: `bet -= 2` até a base.
- Limite configurável de reds (default 4) → pausa + alerta.
- Override: se TC ≥ 4, sugestão aumenta independente de streak.
- Modo Kelly e Híbrido reaproveitam `bankrollAiService` / `hybrid-betting-system` já existentes.

## Histórico

Tabela + gráfico (Recharts já no projeto) de evolução da banca. Métricas: rodadas, G/R/P, banca ini/atual, P&L, # resets, TC médio.

## Integração

- Botão "🔴 Modo Ao Vivo" na `ArenaBlackjack` atual roteando para `/arena-blackjack/ao-vivo`.
- Rota adicionada em `App.tsx` sob `RequireArena`/`RequireSubscription` iguais à arena existente.
- Sem mudanças de banco de dados nesta fase (sessão local). Persistência em DB pode vir depois se desejado.

## Detalhes técnicos

- Sem chamadas a Supabase neste modo (puro client-side).
- Tokens semânticos do design system (sem cores hardcoded).
- `framer-motion` para transições de etapa.
- LocalStorage key `blackjack-live-session-v1` para resumir sessão interrompida.

## Fora de escopo (confirmar se quiser depois)

- Persistir sessões no DB / leaderboard.
- Split/seguros completos no modo ao vivo (versão 1: hit/stand/double/surrender).
- Multi-mãos próprias simultâneas.

Posso seguir com essa estrutura?
