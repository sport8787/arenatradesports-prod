---
name: AI Provider Routing
description: Política definitiva de provedores de IA por edge function — Gemini direto em todo o sistema (Punter revertido em 29/04/2026)
type: preference
---

# Política de Providers de IA (29/Abr/2026)

Plano pago Gemini ativo. Lovable AI Gateway **descontinuado** em todas as edges.
**Atualização (29/04/2026):** Arena Punter revertida de OpenAI para Gemini direto após esgotamento da quota OpenAI (`insufficient_quota` HTTP 429). Gemini agora é universal.

## Regra geral
- **Default (universal)**: Gemini direto (`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`) com `gemini-2.5-flash` e `GEMINI_API_KEY`.
- OpenAI direto fica como **opção futura** caso quota seja recarregada — hoje não é usada em produção.

## Mapa por edge
| Edge | Provider | Modelo |
|---|---|---|
| arena-trader-* | Gemini direto | gemini-2.5-flash |
| mycroft-sports-* / match / analyst chats | Gemini direto | gemini-2.5-flash |
| mycroft-corners-* | Gemini direto | gemini-2.5-flash |
| arena-poker-* + mycroft-poker-chat | Gemini direto | gemini-2.5-flash |
| analyze-real-bets / claude-jury / parse-bet-screenshot | Gemini direto | gemini-2.5-flash |
| n8n-webhook | Gemini direto | gemini-1.5-flash |
| **mycroft-punter-analysis** | **Gemini direto** | **gemini-2.5-flash** |
| **mycroft-punter-anthropic** | **Gemini direto** | **gemini-2.5-flash** |

## Why
- Plano pago Gemini elimina rate limits do Free tier.
- OpenAI account ficou sem créditos (29/04/2026) → quebrou a Arena Punter.
- Unificar em Gemini reduz SPOF de billing e simplifica fallback.

## Como aplicar em novas edges
- IA para qualquer fluxo (Trader, Punter, chats, análises) → **Gemini direto**.
- **NUNCA** mais usar `LOVABLE_API_KEY` ou `ai.gateway.lovable.dev`.
- Se reativar OpenAI no futuro, atualizar este arquivo.
