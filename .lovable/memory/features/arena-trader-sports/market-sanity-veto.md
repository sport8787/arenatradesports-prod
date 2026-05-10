---
name: Market Sanity Veto + Safety Net
description: analyze-live-matches bloqueia mercados já decididos/expirados em 3 camadas (VETO TEMPORAL, MARKET SANITY VETO, SAFETY NET final pré-insert)
type: feature
---

# MARKET SANITY VETO + SAFETY NET (defense-in-depth)

Em `supabase/functions/analyze-live-matches/index.ts`, três camadas anti-aprovação inválida (todas aplicadas APENAS a verdicts ativos: APROVADO/APROVADO_SITUACIONAL/LABAREDA):

## Camada 1 — VETO TEMPORAL (linha ~563)
- **Over 0.5 HT** → janela 5'≤min≤20' E placar 0x0. Fora disso → AGUARDAR.
- **Over 1.5/2.5/3.5/4.5 FT** → só até minuto 70.

## Camada 2 — MARKET SANITY VETO (linha ~604)
1. **BTTS Sim** → veta se `sh>=1 && sa>=1` OU `min>=75 && (sh=0 || sa=0)`.
2. **BTTS Não** → veta se ambos já marcaram.
3. **Over X.5 FT** → veta se `total >= line+1` (já batido).
4. **Over X.5 HT** → veta se já batido OU `min>40` (1T encerrado).
5. **Under X.5** → veta se `total >= line+1` (já estourado).

## Camada 3 — SAFETY NET (logo antes do INSERT em mycroft_analyses, linha ~861)
Repete TODAS as regras das camadas 1+2 como última defesa caso reanálise, mutação tardia de market ou bug pule as vetos anteriores. Loga `🛑 SAFETY NET → AGUARDAR` com motivo.

**Adicionado após bug CRB x Operário-PR (09/05/2026):** Over 0.5 HT foi APROVADO_SITUACIONAL no min 26' com placar 1x0 (mercado já batido). Vetos das camadas 1+2 não dispararam — causa raiz desconhecida (possível mutação de market após veto). Safety net pré-insert garante bloqueio.

