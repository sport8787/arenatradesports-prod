# 🎯 ARENA TRADER — Plano de Evolução

## Estado Atual (v1.0)
- ✅ Dashboard preto/dourado com gráfico de candlesticks SVG
- ✅ 4 ativos (BTC, PETR4, VALE3, ITUB4)
- ✅ Operações Long/Short com volumes fixos (10K-100K)
- ✅ Mycroft Trader via Claude Sonnet (suporte, resistência, veredito forense)
- ✅ Hórus Premium com provocações contextuais
- ✅ Persistência de saldo (500K BC inicial) e histórico de trades
- ✅ Alerta de bankroll (-10%)

---

## 📋 FASE 1 — Experiência de Trading (UX/Visual) ✅

### 1.1 — Stop Loss & Take Profit ✅
- ✅ Permitir definir limites ao abrir posição
- ✅ Fechamento automático quando preço atinge SL/TP
- ✅ Linhas visuais no gráfico (vermelho para SL, verde para TP)
- ✅ Hórus comenta quando SL é acionado vs quando TP é atingido

### 1.2 — Alavancagem (Leverage) ✅
- ✅ Seletor de alavancagem: 1x, 2x, 5x, 10x
- ✅ Multiplicador no cálculo de PnL
- ✅ Alerta visual sobre risco em alavancagens altas
- ✅ Liquidação forçada se PnL negativo exceder margem

### 1.3 — Timeframes & Velocidade de Simulação ✅
- ✅ Seletor de velocidade: 1x, 2x, 5x (intervalo de tick: 3s, 1.5s, 0.6s)
- ✅ Botão Pause/Play para congelar a simulação

### 1.4 — Indicadores Técnicos no Gráfico ✅
- ✅ Média Móvel Simples (SMA 9 / SMA 21) como linhas sobre o gráfico
- ✅ Banda de Bollinger para volatilidade visual
- ✅ RSI em sub-chart abaixo do candlestick
- ✅ Toggle para ligar/desligar cada indicador

---

## 📋 FASE 2 — IA e Narrativa ✅

### 2.1 — Hórus TTS (Voz Real) ✅
- ✅ Integrar ElevenLabs TTS para o Hórus narrar provocações
- ✅ Voz George com stability 0.45, similarity 0.8, speed 1.1
- ✅ Cache de áudio via cacheKey no storage
- ✅ Visualização de waveform durante narração

### 2.2 — Mycroft Trader Detalhado ✅
- ✅ Seção "Detecção de Blefe de Mercado" ao painel
- ✅ Indicador visual de "Volume Real vs Burburinho"
- ✅ Recomendação de aporte fracionado (% da banca ideal por operação)
- ✅ Histórico de previsões do Mycroft (acertou/errou) com toggle

### 2.3 — Eventos Narrativos do Hórus ✅
- ✅ Flash Crash simulado: queda abrupta com narração dramática
- ✅ Pump & Dump: alta artificial seguida de crash
- ✅ "Notícias de última hora" fictícias que impactam preço
- ✅ ~8% chance por tick, cooldown 45s entre eventos

### 2.4 — Alertas Inteligentes por Nível de Estresse ✅
- ✅ Indicador visual de estresse (Baixo/Médio/Crítico) com barra de banca
- ✅ Baixo: cor verde, sem pulsação
- ✅ Médio: cor âmbar, label ATENÇÃO
- ✅ Crítico: cor vermelha, borda pulsante, tela com classe pulse

---

## 📋 FASE 3 — Gamificação e Competição ✅

### 3.1 — Sistema de Conquistas (Achievements) ✅
- ✅ "Primeira Operação" — Abrir primeira posição
- ✅ "Sangue Frio" — Fechar com lucro após PnL negativo de -5K
- ✅ "Lobo de Wall Street" — Acumular 1M BC
- ✅ "Sardinha Sobrevivente" — Recuperar após perder 50% da banca
- ✅ "Triple Kill" — 3 trades lucrativos em sequência
- ✅ "Rei da Alavancagem" — Lucrar com 10x leverage
- ✅ "Diversificado" — Operar em todos os 4 ativos
- ✅ "Mestre do Short" — 3 shorts lucrativos
- ✅ "Mãos de Diamante" — 20 trades sem zerar
- ✅ "O Retorno" — Lucrar 50K após estar no negativo

### 3.2 — Ranking Arena Trader ✅
- ✅ Página /arena-trader/rankings com Top 50 traders
- ✅ Métricas: Win Rate, Saldo, Total P&L
- ✅ Filtros por Saldo, Win Rate, P&L
- ✅ Visual com medalhas para Top 3

### 3.3 — Desafios Diários do Hórus ✅
- ✅ "Desafio Sniper": 3 trades com lucro em sequência
- ✅ "Desafio Sobrevivência": Não perder >5% da banca em 10 trades
- ✅ "Trader Ativo": Realizar 5 operações
- ✅ Barras de progresso visual + recompensas em BC

---

## 📋 FASE 4 — Dados Reais e Social ✅

### 4.1 — Preços Reais (API CoinGecko + Brapi) ✅
- ✅ Edge function fetch-live-prices busca BTC via CoinGecko (BRL) e PETR4/VALE3/ITUB4 via Brapi
- ✅ Polling automático a cada 60s com hook useLivePrices
- ✅ Indicador LIVE/SIMULADO no AssetSelector
- ✅ Preço sobe → ciano; preço desce → vermelho neon
- ✅ Variação 24h exibida por ativo
- ✅ Candles gerados a partir do preço real como seed
- ✅ Preço real passado ao Mycroft Trader para análise

### 4.2 — Múltiplas Posições Simultâneas ✅
- ✅ Abrir posições em ativos diferentes simultaneamente
- ✅ Dashboard de portfolio com PnL consolidado (PortfolioPanel)
- ✅ Fechar posições individualmente via botão X
- ✅ TraderBalanceHeader mostra PnL total de todas posições
- ✅ Auto-close SL/TP/Liquidação em todas as posições

### 4.3 — Replay de Sessão ✅
- ✅ Salvar snapshots de cada trade no banco (trader_session_snapshots)
- ✅ SessionReplayPanel com histórico expandível
- ✅ Análise do Mycroft embutida em cada trade passado
- ✅ Métricas de win rate e PnL total da sessão

### 4.4 — Social Feed ✅
- ✅ Feed de trades públicos com realtime (trader_social_feed)
- ✅ Botão "Compartilhar último trade" no dashboard
- ✅ Sistema de likes e contagem de cópias
- ✅ "Copy Trade" simplificado — seleciona ativo e tipo automaticamente
- ✅ SocialFeedPanel com subscription realtime para novos trades

---

## 🔧 Melhorias Técnicas Pendentes

| Item | Prioridade |
|------|-----------|
| Volume bars abaixo do candlestick | Alta |
| Responsividade mobile | Alta |
| Label "Paper Trading / Simulação" | Alta |
| Migrar SVG para canvas (performance) | Média |
| Persistir histórico individual no DB | Média |
| Animação de confetti no lucro grande | Baixa |

---

## Ordem de Implementação Sugerida
1. **Fase 1.1** (Stop Loss/Take Profit) — Mecânica essencial
2. **Fase 1.4** (Indicadores SMA/Bollinger) — Visual profissional
3. **Fase 2.1** (Hórus TTS) — Imersão narrativa
4. **Fase 2.3** (Eventos narrativos) — Engajamento
5. **Fase 3.1** (Achievements) — Retenção
6. **Fase 1.2** (Alavancagem) — Complexidade progressiva
7. **Fase 3.2** (Rankings) — Competição
8. **Fase 4.1** (Preços reais) — Credibilidade
