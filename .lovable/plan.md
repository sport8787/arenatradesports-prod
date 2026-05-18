## Sinais Alavanca — Under 4.5 (juros compostos)

Nova aba dedicada a sinais Under 4.5 (alta probabilidade, odd baixa 1.10–1.20) para o usuário aplicar juros compostos com uma fração reservada da banca real.

### O que será construído

1. **Página `/sinais-alavanca`** (atalhos em `/punter` e `/arena-trader-sports`)
   - 2 seções: **Ao Vivo** e **Pré-Live (hoje/amanhã)**
   - Cada card mostra: confronto, liga, horário/minuto, odd Under 4.5 atual, score de probabilidade, motivos da aprovação
   - Banner explicativo no topo: "Reserve 5–10% da sua banca real. Reinvista a cada green: 100 → 110 → 121…" (sem sugerir valor absoluto)
   - Calculadora simples de juros compostos (input: stake inicial + número de greens previstos → projeção)

2. **Motor de seleção Under 4.5** (compartilhado live + prelive)
   - **Critérios de aprovação** (todos opcionais, score ponderado, threshold mínimo 70):
     - Média de gols H2H ≤ 2.8 (peso 25)
     - Média de gols casa+fora últimos 5/10 jogos ≤ 2.8 (peso 25)
     - % de jogos Under 4.5 do confronto direto ≥ 85% (peso 20)
     - Odd Under 4.5 entre 1.06 e 1.25 (peso 10) — fora dessa faixa = descarta
     - Liga com média de gols/jogo ≤ 2.7 (peso 10)
     - Ao vivo: minuto ≥ 60 e gols totais ≤ 2 (peso adicional 20, com odd ≥ 1.04)
   - **Vetos automáticos**:
     - Já marcou 4+ gols → descarta
     - Minuto ≥ 30 com 3 gols → descarta (risco real de 5º gol)
     - Times com média ofensiva > 2.0 gols ambos os lados
     - xG total esperado > 3.2

3. **Backend**
   - Edge function `sinais-alavanca-scanner` (uma só, com modo `live` ou `prelive`)
   - Cron: prelive 2x/dia (07h e 13h UTC), live a cada 3 min
   - Tabela `sinais_alavanca` (id, match_id, match_name, league, kickoff, mode, score, odd_under45, criteria jsonb, status, settled_result, created_at)
   - RLS: leitura pública para autenticados, escrita só service_role
   - Liquidação automática via trigger ligando ao settlement existente (resultado final ≤ 4 gols = GREEN)

4. **Histórico/performance** dentro da própria aba
   - Card de stats: total sinais 30d, % green, odd média, ROI teórico com compostagem

### Detalhes técnicos

- Arquivos novos:
  - `src/pages/SinaisAlavanca.tsx`
  - `src/components/sinais-alavanca/AlavancaCard.tsx`
  - `src/components/sinais-alavanca/CompoundCalculator.tsx`
  - `supabase/functions/sinais-alavanca-scanner/index.ts`
  - migração: tabela `sinais_alavanca` + cron + RLS
- Arquivos editados:
  - `src/App.tsx` (rota)
  - `src/pages/PunterMenu.tsx` e `src/pages/ArenaTraderSports.tsx` (atalhos)
- Fontes de dados: API-Football (estatísticas H2H + média gols + last 5/10), `arena_odds` (odd Under 4.5), `live_matches` (estado live)
- Reutiliza padrão de `eventos_raros_prelive`/`live` (mesmo formato de scanner + persistência)
- Liquidação reaproveita `settle-bets` (ou trigger próprio se necessário) lendo `total_goals` ≤ 4

### Comunicação ao usuário

A aba deixa claro:
- "Não é garantia — é alta probabilidade. Defina um teto (ex.: 5–10% da banca real)."
- "Pare após 2 reds consecutivos — juros compostos amplificam perdas também."
- Sem sugerir valor absoluto de entrada.

Posso seguir e implementar?
