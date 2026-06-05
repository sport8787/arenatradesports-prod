// ─────────────────────────────────────────────────────────────
// DeepSeek provider (OpenAI-compatible)
// Usado como provedor primário em mycroft-punter-anthropic,
// mycroft-punter-sportmonks e analyze-live-matches.
// Em caso de falha, o caller faz fallback para Groq → Gemini.
// ─────────────────────────────────────────────────────────────

export interface DeepseekOpts {
  model?: string;              // default: deepseek-chat (V3)
  temperature?: number;        // default: 0.3
  max_tokens?: number;         // default: 3000
  response_format_json?: boolean; // default: true → { type: "json_object" }
  timeoutMs?: number;          // default: 45_000
}

/**
 * Chama DeepSeek Chat (OpenAI-compatible).
 * Lança erro com a mensagem do upstream quando status != 200.
 * Não faz retry — caller decide se vai para fallback.
 */
export async function callDeepseek(
  systemPrompt: string,
  userPrompt: string,
  opts: DeepseekOpts = {},
): Promise<string> {
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY missing");

  const {
    model = "deepseek-chat",
    temperature = 0.3,
    max_tokens = 3000,
    response_format_json = true,
    timeoutMs = 45_000,
  } = opts;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const r = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens,
        ...(response_format_json ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`DeepSeek ${r.status}: ${errText.slice(0, 300)}`);
    }
    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content || "";
    // Telemetria de custo (cache hits são contabilizados pela DeepSeek)
    const usage = j?.usage || {};
    if (usage.prompt_tokens || usage.completion_tokens) {
      console.log(
        `[DeepSeek] model=${model} in=${usage.prompt_tokens ?? "?"} out=${usage.completion_tokens ?? "?"} cache_hit=${usage.prompt_cache_hit_tokens ?? 0}`,
      );
    }
    return content;
  } finally {
    clearTimeout(t);
  }
}
