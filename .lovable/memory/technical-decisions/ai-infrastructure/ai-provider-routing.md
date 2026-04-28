---
name: AI Provider Routing
description: Política definitiva de provedores de IA por edge function — Gemini direto vs OpenAI direto, sem Lovable Gateway
type: preference
---

# Política de Providers de IA (28/Abr/2026)

Plano pago Gemini ativo. Lovable AI Gateway **descontinuado** em todas as edges.

## Regra geral
- **Default**: Gemini direto (`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`) com `gemini-2.5-flash` e `GEMINI_API_KEY`.
- **Exceção — Arena Punter**: OpenAI direto (`https://api.openai.com/v1/chat/completions`) com `gpt-5-mini` e `OPENAI_API_KEY`.

## Mapa por edge
| Edge | Provider | Modelo |
|---|---|---|
| arena-trader-* (analyze, jury, season) | Gemini direto / OpenAI direto (jury) | gemini-2.5-flash / gpt-5-mini |
| mycroft-sports-analysis | Gemini direto | gemini-2.5-flash |
| mycroft-sports-chat | Gemini direto | gemini-2.5-flash |
| mycroft-match-chat | Gemini direto | gemini-2.5-flash |
| mycroft-analyst-chat | Gemini direto | gemini-2.5-flash |
| mycroft-corners-analyzer | Gemini direto | gemini-2.5-flash |
| mycroft-ai | Gemini direto | gemini-2.5-flash |
| arena-poker-* (12 edges) | Gemini direto | gemini-2.5-flash |
| mycroft-poker-chat | Gemini direto | gemini-2.5-flash |
| analyze-real-bets | Gemini direto | gemini-2.5-flash |
| claude-jury | Gemini direto | gemini-2.5-flash |
| parse-bet-screenshot | Gemini direto (vision) | gemini-2.5-flash |
| n8n-webhook | Gemini direto | gemini-1.5-flash |
| **mycroft-punter-analysis** | **OpenAI direto** | **gpt-5-mini** |
| **mycroft-punter-anthropic** | **OpenAI direto** | **gpt-5-mini** |
| **mycroft-corners-punter** | Gemini direto (mantido) | gemini-2.5-flash |

## Why
- Plano pago Gemini elimina rate limits do Free tier
- OpenAI já estava configurada e dá segunda fonte de IA para evitar SPOF
- Punter usa OpenAI para diversificação e por preferência do usuário (28/04/2026)

## Como aplicar em novas edges
- IA para Trader Sports / análises gerais / chats Mycroft → **Gemini direto**
- IA para Punter (análises de mercados, sinais, backtest) → **OpenAI direto** (gpt-5-mini)
- **NUNCA** mais usar `LOVABLE_API_KEY` ou `ai.gateway.lovable.dev`
