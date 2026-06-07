// ─────────────────────────────────────────────────────────────
// Chat cascade: DeepSeek → Groq → (opcional) Gemini
// Para chats conversacionais (texto livre, não JSON forçado).
// Usado nos 3 chats Mycroft (sports/match/analyst).
// ─────────────────────────────────────────────────────────────

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCascadeOpts {
  messages: ChatMsg[];
  temperature?: number;
  max_tokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ChatCascadeResult {
  text: string;
  provider: "deepseek" | "groq";
  model: string;
  ms: number;
}

async function callDeepseekChat(opts: ChatCascadeOpts): Promise<ChatCascadeResult> {
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY missing");
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 60_000);
  // chain user-provided signal
  if (opts.signal) opts.signal.addEventListener("abort", () => ctrl.abort());

  try {
    const r = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: opts.temperature ?? 0.6,
        max_tokens: opts.max_tokens ?? 2000,
        messages: opts.messages,
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`DeepSeek ${r.status}: ${errText.slice(0, 300)}`);
    }
    const j = await r.json();
    const text = (j?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) throw new Error("DeepSeek empty content");
    const usage = j?.usage || {};
    console.log(`[chatCascade/deepseek] in=${usage.prompt_tokens ?? "?"} out=${usage.completion_tokens ?? "?"} ms=${Date.now() - t0}`);
    return { text, provider: "deepseek", model: "deepseek-chat", ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

async function callGroqChat(opts: ChatCascadeOpts, model = "llama-3.3-70b-versatile"): Promise<ChatCascadeResult> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) throw new Error("GROQ_API_KEY missing");
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 60_000);
  if (opts.signal) opts.signal.addEventListener("abort", () => ctrl.abort());

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: opts.temperature ?? 0.6,
        max_tokens: opts.max_tokens ?? 2000,
        messages: opts.messages,
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`Groq ${r.status}: ${errText.slice(0, 300)}`);
    }
    const j = await r.json();
    const text = (j?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) throw new Error("Groq empty content");
    console.log(`[chatCascade/groq] model=${model} ms=${Date.now() - t0}`);
    return { text, provider: "groq", model, ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cascata DeepSeek → Groq 70B → Groq 8B.
 * Lança erro só se TODOS falharem.
 * `status` é exposto via lastStatus para os callers que querem mapear 429/402.
 */
export async function chatCascade(opts: ChatCascadeOpts): Promise<ChatCascadeResult> {
  const errors: string[] = [];

  // 1) DeepSeek (primário)
  try {
    return await callDeepseekChat(opts);
  } catch (e) {
    const msg = (e as Error).message;
    errors.push(`deepseek: ${msg}`);
    console.warn(`[chatCascade] DeepSeek falhou, fallback Groq 70B. ${msg}`);
  }

  // 2) Groq llama-3.3-70b-versatile
  try {
    return await callGroqChat(opts, "llama-3.3-70b-versatile");
  } catch (e) {
    const msg = (e as Error).message;
    errors.push(`groq-70b: ${msg}`);
    console.warn(`[chatCascade] Groq 70B falhou, fallback Groq 8B. ${msg}`);
  }

  // 3) Groq llama-3.1-8b-instant
  try {
    return await callGroqChat(opts, "llama-3.1-8b-instant");
  } catch (e) {
    errors.push(`groq-8b: ${(e as Error).message}`);
  }

  throw new Error(`chatCascade: todos providers falharam → ${errors.join(" | ")}`);
}
