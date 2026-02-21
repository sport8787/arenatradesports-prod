

# Arena Trader: Analise do Documento vs Estado Atual e Plano de Implementacao

## O Que Ja Existe (e Supera o Documento)

O projeto atual ja possui funcionalidades que o documento especifica para fases avancadas:
- Dados de mercado reais (CoinGecko + Brapi) -- o documento sugeria isso apenas na Fase 4 (semana 14+)
- Mycroft Trader com auditoria forense via Claude Sonnet
- Mini Contratos (WIN/WDO) com zonas de milhar
- Sistema de achievements e rankings
- Alertas Telegram automaticos
- Grafico de candlestick com indicadores tecnicos reais

## O Que o Documento Traz de NOVO e Viavel

O documento descreve um **modo de jogo completamente diferente** do que ja existe. O Arena Trader atual e um **simulador de trading livre** (o jogador opera quando quer). O documento propoe um **Modo Temporada** -- um jogo baseado em **cenarios com perguntas A/B/C/D**, juri de IA, e ofertas "deal or no deal" do Horus.

Ambos os modos podem coexistir, tal como a Arena Poker ja tem o "Modo Treino" separado do modo principal.

---

## Plano de Implementacao: "Modo Temporada" (Season Mode)

### FASE 1 -- Fundacao (Implementar Agora)

**1. Tabelas de Base de Dados**

Criar as seguintes tabelas:

- `arena_trader_seasons` -- Sessoes de temporada (user_id, season_number, status, current_day, current_bankroll, initial_bankroll, started_at, ended_at, total_rounds, correct_answers, jury_convinced, offers_received, offers_accepted, tilt_warnings, ignored_warnings, all_in_moments)
- `arena_trader_scenarios` -- Cenarios de mercado pre-configurados (title, description, option_a/b/c/d, correct_option, explanation, common_mistake, bankroll_multiplier_win/loss, difficulty, category)
- `arena_trader_rounds` -- Rodadas individuais (session_id, day, scenario_id, chosen_option, is_correct, transcription, jury_votes JSONB, jury_convinced_count, bankroll_before/after, mycroft_analysis JSONB, tilt_detected, time_to_choose)
- `horus_trader_offers` -- Ofertas deal-or-no-deal (session_id, trigger_type, offered_bankroll, accepted, next_round_result)

**2. Seed de Cenarios (10 cenarios iniciais)**

Criar 10 cenarios de mercado educacionais cobrindo:
- Euforia pos-noticia (BTC ETF aprovado)
- Crash repentino (Flash Crash)
- Lateralizacao (mercado sem direcao)
- FOMO em alta
- Revenge trading apos perda
- Cenarios especificos de Mini Contratos (milhar, correlacao)

Cada cenario tem 4 opcoes, 1 correta, e explicacao pedagogica.

**3. Edge Function: `arena-trader-season`**

Nova funcao backend que gerencia:
- Iniciar temporada (criar sessao, debitar 300 NT)
- Buscar proximo cenario (aleatorio por dificuldade/dia)
- Submeter resposta (calcular resultado, atualizar banca)
- Verificar triggers de oferta Horus

**4. Edge Function: `arena-trader-jury`**

Juri de 3 IAs que avaliam a justificativa do jogador:
- Conservador ("O Prudente") -- valoriza preservacao de capital
- Agressivo ("O Tubarao") -- valoriza coragem e oportunidade
- Neutro ("O Quant") -- valoriza logica e dados

Utiliza Claude Sonnet para gerar votos CLARO/BLEFE com justificativa.

**5. Tela do Modo Temporada (Frontend)**

Nova rota `/arena-trader/season` com:
- Seletor entre "Trading Livre" (atual) e "Modo Temporada" (novo)
- Tela de cenario com timer de 30 segundos
- 4 botoes de opcao (A/B/C/D)
- Gravacao de audio para justificativa (reutilizar AudioRecorder existente)
- Animacao de deliberacao do juri (3 avatares)
- Tela de resultado com feedback do Horus
- Header mostrando Dia X/30 e banca atual

---

### FASE 2 -- Mecanicas Avancadas (Implementacao Seguinte)

**6. Oferta Horus (Deal or No Deal)**

Triggers automaticos:
- Banca dobrou (20k+ BC)
- Sequencia 5+ vitorias
- Ultima rodada (Dia 30)
- Tilt detectado

Modal dramatico com opcao de aceitar (sair com lucro) ou recusar (arriscar).

**7. Tilt Detection (Mycroft)**

Algoritmo que monitoriza:
- Loss streak (2+ perdas seguidas)
- Position size crescente apos perda (revenge trading)
- Tempo de decisao a diminuir (impulsividade)
- Tom de voz ansioso (via analise de audio existente)

Score >= 50 = tilt detectado, Horus intervem.

**8. Analise Fim de Temporada**

Relatorio completo com:
- Performance (ROI, dias sobrevividos, win rate)
- Analise comportamental (position sizing, tilt moments, ofertas recusadas)
- Replay de momentos criticos ("Se tivesse aceitado no Dia 8...")
- Recomendacoes para proxima temporada

---

### O Que NAO Faz Sentido Implementar (Incompativel com Tech Stack)

- **Redis/MongoDB/Kafka** -- O projeto usa Lovable Cloud (PostgreSQL). JSONB cobre todos os casos de dados nao-estruturados.
- **React Native** -- O projeto e web (React + Vite). Ja funciona em mobile via responsive design.
- **Node.js + Express separado** -- Edge Functions do Lovable Cloud cobrem tudo.
- **Socket.io/WebSocket** -- Realtime do Lovable Cloud substitui isto.
- **AWS S3** -- Storage do Lovable Cloud ja armazena audios.

---

## Resumo de Prioridades

| Prioridade | Feature | Complexidade |
|---|---|---|
| 1 | Tabelas DB (seasons, scenarios, rounds, offers) | Media |
| 2 | Seed 10 cenarios educacionais | Baixa |
| 3 | Edge Function season management | Alta |
| 4 | Edge Function jury IA (3 perfis) | Media |
| 5 | Frontend Modo Temporada (cenario + timer + opcoes) | Alta |
| 6 | Oferta Horus (deal or no deal) | Media |
| 7 | Tilt Detection | Media |
| 8 | Analise fim de temporada | Media |

## Detalhes Tecnicos

- **Custo de API estimado**: Cada rodada usa ~3 chamadas Claude (1 por jurado) + 1 para Horus feedback = ~4 chamadas. Uma temporada de 30 dias = ~120 chamadas Claude por jogador.
- **Banca inicial**: 10.000 BC (conforme documento, diferente dos 500k TC do modo livre)
- **Custo por temporada**: 300 NT (debito automatico ao iniciar)
- **Cenarios**: Armazenados em tabela PostgreSQL, com dificuldade progressiva (dias 1-10 facil, 11-20 medio, 21-30 dificil)

