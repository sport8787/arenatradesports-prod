
## Resumo executivo

Migrar Punter + Arena Live (Trader Sports) para **DeepSeek API** (`deepseek-chat` V3). Abaixo está a estimativa de chamadas/tokens/custo para 15 dias, baseada em **dados reais do banco** (últimos 30 dias) + **cadência efetiva de reanálise** das edges atuais.

---

## 1. Como cada arena chama a IA hoje

### Arena Punter (pré-jogo)
- Edges: `mycroft-punter-anthropic` + `mycroft-punter-sportmonks`.
- **1 chamada IA por jogo, por janela de scan** (cron único 11:30 BR — ver memória `Punter Dup Prevention v2`).
- Prompt: ~14–16k tokens input, **max_completion_tokens=3000** (anthropic) ou 1500 (sportmonks).
- Volume real: tabela `punter_analyses` mostra **~5–15 jogos analisados por rodada de scan**, ~1 scan/dia útil.

### Arena Live (Trader Sports)
- Edge: `analyze-live-matches` (motor matemático determinístico) + `borderline-ai-validator` (Groq, ~200 tokens) + `analyze-live-shadow-ai` (Gemini paralelo).
- **MESMO JOGO é reanalisado várias vezes** durante os 90 minutos. Intervalos atuais (`getReanalysisInterval`):
  - AGUARDAR: 5 min (<25'), 3 min (>=25')
  - JOGO_MORTO: 5 min (<60'), 3 min (>=60')
  - CUIDADO: 5 min (<60'), 3 min (>=60')
  - LABAREDA: 2 min sempre
  - APROVADO_EXTRA: 5 min (<60'), 3 min (>=60')
- **Chamadas IA por jogo em 90 min**: tipicamente **18–25 reanálises** (mistura de 5min e 3min). LABAREDA puxa para ~35.
- Volume real (`live_matches`): **20–90 jogos/dia** durante semana europeia, **~14–35 jogos/dia** atualmente.
- Borderline validator: dispara só quando confidence 55–65% e veredito ativo → ~5–10% dos jogos → desprezível (200 tk).
- Shadow AI: roda em paralelo no Gemini (não é DeepSeek a menos que você migre também — **assumi NÃO migrado**).

### Chats (Mycroft Match Chat / Sports Chat / Analyst)
- Dependem do usuário; baseline atual ~50–150 mensagens/dia.

---

## 2. Volumes observados (últimos 30 dias, dados reais)

| Período | live_matches/dia | Live signals/dia | Punter analyses/dia |
|---|---|---|---|
| **Pico (Champions/Euro semifinal/final 21–25 mai)** | 24 → 88 | 9 → 25 | 4–12 |
| **Pós-Euro (26–31 mai)** | 14 → 38 | 3 → 13 | 0–4 |
| **Hoje (4 jun, vazio)** | ~5 | ~2 | ~0 |

---

## 3. Estimativa 15 dias — cenários

### Cenário A — "Quinzena cheia" (Champions+Europa+Brasileirão A/B + amistosos)
- 60 jogos/dia × 20 reanálises = **1.200 calls live/dia**
- Punter: 12 analyses/dia
- Chats: 100 msgs/dia
- **Total: ~1.300 calls/dia → 19.500 calls em 15 dias**

### Cenário B — "Sua janela real (até final de julho)" — Série B + Série C + Copa do Mundo
- Série B: 10 jogos/rodada × 2 rodadas/semana = ~3 jogos/dia
- Série C: 10 jogos/rodada × 2 rodadas/semana = ~3 jogos/dia
- Copa do Mundo (se ativa em junho/julho): 2–4 jogos/dia em fase de grupos, 1–2 em mata-mata
- **~8–12 jogos live/dia × 22 reanálises = ~220 calls live/dia**
- Punter: 8 analyses/dia (mais ligas no whitelist novo)
- Chats: 80 msgs/dia
- **Total: ~310 calls/dia → ~4.650 calls em 15 dias**

### Cenário C — "Conservador" (só copa do mundo + série B fim de semana)
- 5 jogos live/dia × 22 = 110 + Punter 5 + chat 50 = **165/dia → ~2.500 calls em 15 dias**

---

## 4. Tokens e custo DeepSeek (preço atual mai/2026)

Pricing `deepseek-chat` V3:
- Input cache **MISS**: $0.27 / 1M tk
- Input cache **HIT**: $0.07 / 1M tk (system prompt repetido é cacheado)
- Output: $1.10 / 1M tk

Tokens médios por tipo de call:
| Tipo | Input total | Cache hit ratio | Output |
|---|---|---|---|
| Punter (anthropic) | 16.000 | 80% (system fixo) | 3.000 |
| Punter (sportmonks) | 12.000 | 80% | 1.500 |
| Live reanálise IA | 4.000 | 70% | 800 |
| Borderline validator | 1.200 | 50% | 200 |
| Chat (Match/Sports) | 3.500 | 60% | 800 |

### Custo por cenário (15 dias)

**Cenário A — cheio** (~19.500 calls)
- Live (18k): ~72M input tk + 14M output tk → **~$28**
- Punter (180): ~2.9M input + 0.5M output → **~$1.20**
- Chat (1.500): ~5.3M input + 1.2M output → **~$2.30**
- **TOTAL ≈ US$ 32 (R$ 175)**

**Cenário B — sua janela real** (~4.650 calls)
- Live (3.300): ~13M input + 2.6M output → **~$5.20**
- Punter (120): ~1.9M input + 0.36M output → **~$0.80**
- Chat (1.200): ~4.2M input + 0.96M output → **~$1.85**
- **TOTAL ≈ US$ 8 (R$ 44)**

**Cenário C — conservador** (~2.500 calls)
- **TOTAL ≈ US$ 4 (R$ 22)**

---

## 5. Recomendação de carga

Considerando seu calendário até fim de julho (Série B/C + Copa do Mundo):

| Recarga | Cobre |
|---|---|
| **US$ 10 (~R$ 55)** | 15 dias do Cenário B com folga de 20% |
| **US$ 20 (~R$ 110)** | 15 dias mesmo se Copa do Mundo tiver fase de grupos cheia (4 jogos/dia simultâneos) |
| **US$ 50 (~R$ 275)** | Tranquilo até **fim de julho inteiro** (45 dias) no Cenário B, ou 15 dias do Cenário A |

**Sugestão: começar com US$ 20 (~R$ 110) para os 15 dias e monitorar a primeira semana** — se o custo real estiver abaixo, dá pra estender pra cobrir até final de julho com a mesma carga.

---

## 6. Observações técnicas

1. **DeepSeek tem prompt caching automático** (ativado por padrão para system prompts >1024 tk). Como Punter tem system prompt enorme e fixo, ~80% das chamadas serão cache HIT — preço cai de $0.27 → $0.07/M.
2. **DeepSeek-reasoner (R1)** é 3–5× mais caro e mais lento. Não recomendo — `deepseek-chat` (V3) já é superior ao Llama 3.3 70B em raciocínio estruturado JSON.
3. **Rate limits DeepSeek**: 60 RPM tier free, sem limit prática no pago. Suficiente para o cron live (1 batch/min com 5–10 jogos).
4. Se quiser, posso já preparar o código de migração mantendo Groq como fallback para 429/timeouts (igual hoje com Gemini fallback no anthropic).

---

## Próximo passo

Quer que eu prepare o **plano de implementação da migração** (criar `_shared/deepseek.ts`, trocar provider nas 3 edges principais, manter Groq como fallback, adicionar telemetria de custo)? Ou prefere primeiro carregar o crédito e depois migrar?
