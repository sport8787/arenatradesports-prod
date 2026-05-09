---
name: Market Sanity Veto
description: analyze-live-matches bloqueia mercados com estado já decidido (BTTS Sim com 1x1, Over X.5 já batido, Under estourado, Over X.5 HT após 40')
type: feature
---

# MARKET SANITY VETO

Em `supabase/functions/analyze-live-matches/index.ts` (após VETO TEMPORAL, mesmo bloco) aplica-se a verdicts ativos (APROVADO/APROVADO_SITUACIONAL/LABAREDA):

1. **BTTS Sim** → VETAR se `score_home>=1 AND score_away>=1` (mercado já decidido) OU `minute>=75 AND (sh=0 OR sa=0)`.
2. **BTTS Não** → VETAR se ambos já marcaram (já perdeu).
3. **Over X.5 FT** → VETAR se `total_goals >= line+1` (sem valor, odd≈1.0). Linha extraída via regex `over\s*(\d)\.?5`.
4. **Over X.5 HT** → VETAR se já batido OU `minute>40` (janela do 1T encerrada).
5. **Under X.5** → VETAR se `total_goals >= line+1` (já estourado).

Auditoria 14d antes do fix: 41 BTTS aprovados com 1x1+, 51 Over 1.5 FT já batido, 22 Over 2.5, 18 Over X.5 FT após 70'. Causa raiz: AI retornava mercado coerente com leitura geral mas sem consultar o estado atual do placar.
