---
name: AI Provider Routing
description: Política definitiva de provedores de IA por edge function — Groq (Llama 3.3 70B) é o provider de produção no Punter; Gemini segue em Trader/chats.
type: preference
---

# Política de Providers de IA (18/Mai/2026)

**Atualização (18/05/2026):** Punter migrado para **Groq** (`llama-3.3-70b-versatile` via `https://api.groq.com/openai/v1/chat/completions` + `GROQ_API_KEY`). Gemini segue em uso para Trader, chats e SEO. Lovable AI Gateway permanece descontinuado.

## Mapa por edge (real)
| Edge | Provider | Modelo |
|---|---|---|
| **mycroft-punter-anthropic** | **Groq** | **llama-3.3-70b-versatile** (max 3000 tk, JSON mode) |
| **mycroft-punter-sportmonks** | **Groq** | **llama-3.3-70b-versatile** (fallback 8b-instant, max 1500 tk) |
| analyze-live-matches (fallback) | Groq | llama-3.x |
| mycroft-analyst-chat | Groq | llama-3.x |
| mycroft-match-chat | Groq | llama-3.x |
| mycroft-sports-chat | Groq | llama-3.x |
| arena-trader-* | Gemini direto | gemini-2.5-flash |
| mycroft-corners-* | Gemini direto | gemini-2.5-flash |
| arena-poker-* + mycroft-poker-chat | Gemini direto | gemini-2.5-flash |
| analyze-real-bets / claude-jury / parse-bet-screenshot | Gemini direto | gemini-2.5-flash |
| SEO (seo-rodada-*) | Gemini direto | gemini-2.5-flash |

## Botão de teste admin
- `/punter` tem botão admin-only **"ANALISAR (GROQ · SPORTMONKS)"** que dispara `mycroft-punter-sportmonks` para validar a saída da Groq vs motor automático.
- Label visível deixa explícito que está usando Groq Llama 3.3 70B + dados Sportmonks Pro.

## Why
- Plano pago Gemini elimina rate limits do Free tier (continua usando em Trader).
- Groq tem latência muito baixa (~1-2s) e custo competitivo para JSON estruturado do Punter.
- OpenAI foi descontinuada (insufficient_quota) — não voltar sem aprovação explícita.

## Como aplicar em novas edges
- **Punter / análises de apostas (1X2, OU, BTTS, AH)** → **Groq** (`llama-3.3-70b-versatile`, JSON mode, max_completion_tokens 1500-3000).
- **Trader / chats / SEO** → Gemini direto (`gemini-2.5-flash`).
- **NUNCA** usar `LOVABLE_API_KEY` / `ai.gateway.lovable.dev`.
- Fallback Groq recomendado em 429/503: `llama-3.1-8b-instant`.
