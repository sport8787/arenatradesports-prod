## Análise — Arena Trader Sports (Live)

### O que está bom hoje
- Provedor primário Futodds entregando placar, stats, pressão, last5/10/15/20 min, odds Betfair real e xG.
- Reanálise multi-mercado a cada 3 min (mercados complementares).
- Janelas de reanálise por minuto (0–10', 10–25', 25'+).
- Status dinâmicos (LABAREDA, CUIDADO, JOGO MORTO).
- Veto temporal por mercado, gráfico de pressão corrigido, indicador xG indisponível.

### Melhorias propostas (UX + acerto)

1. **Painel "Saúde do Sinal" em tempo real no card**
   - Mostrar 3 indicadores compactos atualizados a cada 30s: Pressão (Δ último 5min), xG flow (xG/min últimos 10min), Momentum (chutes+ataques perigosos últimos 5min).
   - Cor verde/amarelo/vermelho automática baseada em thresholds Futodds.
   - Reduz necessidade de abrir detalhe para entender se a tese ainda vale.

2. **"Cash-Out Inteligente" usando pressure_indices da Futodds**
   - Hoje já temos regras de cashout, mas o `pressure_total` Futodds é mais preciso que o que calculávamos.
   - Recomendar SAIR AGORA quando: pressão do lado contrário > 65 por 3 min seguidos, ou quando `last5min_stats` mostra inversão clara (ex.: visitante tendo 3x mais ataques perigosos que mandante numa entrada Back Casa).

3. **Detecção precoce de "jogo virando"**
   - Comparar `last10min` vs `last20min` Futodds. Se inversão >40% no momentum → alerta "ATENÇÃO: jogo virando" antes do gol acontecer.
   - Notificação push + som já existem (criticalAlertSound), só plugar.

4. **Filtros de Liga e Mercado mais visíveis**
   - Hoje tudo aparece misturado. Adicionar chips de filtro rápido no topo (Brasileirão / Europa / Sul-América / Outros) e por mercado (Over/Under/BTTS/Escanteios/Resultado).
   - Persistir preferência por usuário.

5. **"Replay da entrada"**
   - Ao clicar num sinal aprovado, mostrar timeline com snapshots a cada 5min: como estavam stats no momento da aprovação vs agora. Ajuda usuário entender se o Mycroft acertou a leitura.

6. **Métrica de calibração visível**
   - Card pequeno "Acerto últimas 50 entradas: 62% / ROI: +8.4%" no topo do dashboard. Já temos os dados em `mycroft_analyses` + settlement.

7. **Modo "Foco"**
   - Toggle que esconde jogos com score < 70 e só mostra LABAREDA/APROVADO FORTE. Reduz ruído cognitivo.

8. **Auto-veto baseado em `xg_unavailable`**
   - Já marcamos quando xG some. Próximo passo: degradar score em -10pp automaticamente em vez de apenas avisar, e nunca emitir LABAREDA sem xG.

---

## Análise — Arena Punter (Pré-Live) + Futodds

Hoje Punter usa principalmente API-Football + The Odds API. Futodds é live-first, mas tem endpoints pré-jogo úteis (`/matches-betfair-live-compact` traz event_ids futuros, e existe `futodds-upcoming-cache`).

### O que Futodds pode agregar no Punter

1. **Odds Betfair Exchange reais (back/lay + volume) pré-jogo**
   - Hoje usamos preço médio de bookmakers. Exchange Betfair = preço justo de mercado (sem margem).
   - **Impacto direto:** cálculo de Edge fica honesto. Sinais com edge ≥4% calculado contra preço Exchange são MUITO mais confiáveis do que contra Pinnacle/Bet365.
   - Implementação: já temos `getFutoddsBetfairOdds(eventId)`. Plugar no `mycroft-punter-anthropic` para sobrescrever odd de referência quando disponível.

2. **CLV Real (Closing Line Value) automatizado**
   - Capturar odd Futodds Exchange no momento da emissão do sinal e novamente 5min antes do início.
   - Se odd fechou MENOR que a aprovada → confirmação que Mycroft pegou valor (positive CLV).
   - Métrica de qualidade objetiva por pick — feedback loop para calibrar prompts.

3. **Steam moves & Sharp money (já temos `sharp-money-detector`)**
   - Cruzar movimento de odds Exchange Futodds com odds tradicionais. Quando Exchange cai mas bookmakers ainda não ajustaram → janela de valor que dura minutos.
   - Hoje detector roda só com Odds API. Adicionar Futodds como segunda fonte aumenta precisão e reduz falsos positivos.

4. **Pré-aviso de "jogo morto" antes mesmo de começar**
   - Endpoint Futodds traz competition_name. Cruzar com calendário: se jogo é último da rodada de time já rebaixado/campeão → degradar score automaticamente.
   - Reduz aprovações em jogos sem motivação (problema clássico Punter).

5. **Validação de escalação/lesões via eventos pré-jogo**
   - `getFutoddsLiveEvents` antes do apito → confirma escalações. Se titular chave fora vs análise feita 3h antes → marcar sinal como REVISAR.

6. **Liquidação mais rápida e barata**
   - Hoje liquidação usa API-Football (cota limitada). Futodds `/matches-ended` pode liquidar Punter sem consumir cota, deixando API-Football só para stats detalhados.

7. **Mercado de Escanteios pré-live mais preciso**
   - Futodds tem corners por janela e xG. Já usamos para live. Pré-live: comparar média histórica do time com últimos 5 jogos pelos dados Futodds → ajusta projeção de escanteios sem depender só de FBref.

### Priorização recomendada (por ROI esperado)

| # | Item | Esforço | Impacto |
|---|------|--------|--------|
| 1 | Edge real via Betfair Exchange (Punter) | Baixo | Alto |
| 2 | Cash-Out Inteligente via pressure_indices (Trader) | Médio | Alto |
| 3 | CLV automatizado (Punter) | Médio | Alto |
| 4 | Painel "Saúde do Sinal" no card (Trader) | Médio | Médio |
| 5 | Liquidação Punter via Futodds | Baixo | Médio (economia de cota) |
| 6 | Steam/Sharp com 2 fontes (Punter) | Médio | Médio |
| 7 | Detecção "jogo virando" (Trader) | Baixo | Médio |
| 8 | Modo Foco + filtros (Trader) | Baixo | Médio (UX) |

### Detalhes técnicos
- Itens 1, 3, 5, 6 reaproveitam `_shared/futoddsProvider.ts` já existente.
- Itens 2, 4, 7 reaproveitam `_futodds_stats.last5min/last10min` já persistidos em `live_matches`.
- Nenhuma mudança de schema crítica; apenas 1 tabela nova `punter_clv_log` para CLV (opcional).
- Riscos: rate-limit Futodds em pré-live se chamarmos `/matches-betfair-live-odds` por jogo. Mitigar com cache 60s no `futodds-upcoming-cache`.

### Próximo passo sugerido
Começar pelo **#1 (Edge real Exchange no Punter)** — é o que mais muda a qualidade percebida dos sinais sem mexer em UI. Depois **#2 (Cash-Out Inteligente)** para Trader Sports.

Me diga quais itens quer priorizar e eu monto plano de implementação detalhado de cada um.