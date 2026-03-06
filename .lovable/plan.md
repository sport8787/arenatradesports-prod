# Plano de Melhorias — Arena Punter

## 1. 🏟️ Página de Widgets API-Football (`/punter/widgets`)

A API-Football oferece widgets prontos (JS embed) que podem ser integrados diretamente. Não consomem requests da API — usam a mesma `API_FOOTBALL_KEY`.

### Widgets disponíveis:
- **getGames** — Agenda de jogos ao vivo e futuros (Live Scores)
- **getGame** — Detalhes de uma partida (eventos, lineups, stats)
- **getStandings** — Classificação da liga
- **getHead to Head** — H2H visual entre dois times
- **getTeam** — Perfil do time (elenco, stats da temporada, lesões)
- **getPlayer** — Perfil do jogador

### Implementação:
- Criar página `/punter/widgets` com tabs para cada widget
- Embed via `<script src="https://widgets.api-sports.io/3.1.0/widget.js">` + config tags
- Usar a `API_FOOTBALL_KEY` no atributo `data-key`
- Adicionar botão "Widgets" no header da Arena Punter
- Tema dark para combinar com o design do app

---

## 2. 📊 Dados da API-Football NÃO utilizados atualmente

A edge function `mycroft-punter-analysis` já usa bastante, mas existem endpoints/dados disponíveis no plano Pro que **não estão sendo explorados**:

### Endpoints não usados:
| Endpoint | O que fornece | Uso potencial |
|----------|--------------|---------------|
| `/predictions` | Previsão de vencedor, over/under, score com 6 algoritmos | Cruzar com a análise do Mycroft para validação cruzada |
| `/odds` (pre-match) | Odds de múltiplas casas em tempo real | Comparar spreads entre casas para detectar linha fora do mercado |
| `/odds/live` | Odds ao vivo (in-play) | Futuro: alertas de entrada em jogos ao vivo |
| `/players/squads` | Elenco atual com posições e fotos | Exibir na página de Widgets |
| `/transfers` | Transferências recentes | Contexto para análise (time reforçado/enfraquecido) |
| `/coaches` | Técnico atual e histórico | Contexto de estilo de jogo |
| `/trophies` | Títulos do time/jogador | Contexto competitivo |
| `/fixtures/events` | Eventos detalhados (gols, cartões, substituições) | Enriquecer análise pós-jogo |

### Dados dentro de endpoints JÁ usados mas NÃO explorados:
| Dado | Endpoint atual | Status |
|------|---------------|--------|
| `goals.for.minute` / `goals.against.minute` | `/teams/statistics` | ✅ Coletado mas **não formatado** no prompt (só citado na season stats sem detalhe por minuto) |
| `penalty.scored/missed` | `/teams/statistics` | ❌ Não coletado |
| `lineups` (formações mais usadas) | `/teams/statistics` | ⚠️ Campo `avg_possession` mapeia para `lineups[0].formation` erroneamente |
| `cards.yellow/red` por minuto | `/teams/statistics` | ❌ Não coletado |
| `biggest.streak` (wins/draws/loses) | `/teams/statistics` | ❌ Não coletado |
| `xG` dos últimos jogos (não só do último) | `/fixtures/statistics` | ⚠️ Só coleta do último jogo |

---

## 3. 🧠 Teste Comparativo: Gemini vs Anthropic (Claude)

### Objetivo:
Testar se Claude Sonnet produz análises superiores em precisão e consistência.

### Plano de implementação:
1. Criar flag `ai_provider` na edge function (`gemini` | `anthropic`)
2. Quando `anthropic`: chamar `https://api.anthropic.com/v1/messages` com Claude Sonnet
3. Usar **exatamente o mesmo prompt** para ambos
4. Salvar o `analyzed_by` no `punter_analyses` (já existe a coluna)
5. Após ~50 análises de cada, comparar:
   - Taxa de aprovação
   - Precisão dos vereditos (green rate)
   - Consistência (mesmo jogo analisado 2x dá mesmo resultado?)
   - Qualidade da tese (subjetivo)

### Requisitos:
- Secret `ANTHROPIC_API_KEY` (ou usar `VITE_ANTHROPIC_API_KEY` que já existe)
- Modelo recomendado: `claude-sonnet-4-20250514` (já usado no `mycroft-ai`)

---

## 4. 🔧 Melhorias técnicas pendentes

### 4.1 Bug: Campo `avg_possession` mapeado errado
```typescript
// ATUAL (linha 443):
avg_possession: seasonStats.lineups?.[0]?.formation || null,
// CORRETO: Isso retorna a FORMAÇÃO, não posse de bola
// A API-Football não tem avg_possession em /teams/statistics
// Renomear para `preferred_formation`
```

### 4.2 Enriquecer prompt com dados por minuto de gols
Os dados `goals.for.minute` já são coletados mas não formatados no prompt. Adicionar:
- Períodos de maior pressão ofensiva (ex: "70% dos gols entre 60-90min")
- Padrão defensivo (minutos onde mais sofre gols)

### 4.3 Adicionar endpoint `/predictions`
Cruzar a previsão da API-Football com a análise do Mycroft:
- Se ambos concordam → boost de confiança (+5-10%)
- Se divergem → flag de risco

### 4.4 Coletar penalidades e streaks
- `penalty.scored.percentage` — indica eficiência em momentos decisivos
- `biggest.streak.wins/loses` — indica momentum

---

## 5. 📋 Roadmap de execução sugerido

| Prioridade | Tarefa | Esforço |
|-----------|--------|---------|
| 🔴 Alta | Página de Widgets (embed API-Football) | Médio |
| 🔴 Alta | Corrigir bug avg_possession → preferred_formation | Baixo |
| 🟡 Média | Integrar endpoint `/predictions` no prompt | Médio |
| 🟡 Média | Adicionar dados de gols por minuto ao prompt | Baixo |
| 🟡 Média | Teste A/B Gemini vs Claude | Médio |
| 🟢 Baixa | Coletar penalties e streaks | Baixo |
| 🟢 Baixa | Endpoint `/coaches` para contexto | Baixo |
| 🟢 Baixa | Odds in-play para alertas futuros | Alto |
