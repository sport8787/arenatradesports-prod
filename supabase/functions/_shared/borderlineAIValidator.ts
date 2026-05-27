// Camada 2 — Validador IA Groq (Llama 3.3 70B) para sinais ao vivo BORDERLINE.
// Migrado de Gemini → Groq em 27/05/2026 por exaustão de créditos.
// Acionado SOMENTE quando o motor matemático produz APROVADO/APROVADO_SITUACIONAL/LABAREDA
// com confidence entre BORDERLINE_MIN..BORDERLINE_MAX. Decisão da IA pode CONFIRMAR
// (mantém), VETAR (rebaixa para AGUARDAR) ou ERROR/SKIP (mantém — fail-open).

const GROQ_KEY = Deno.env.get("GROQ_API_KEY") || "";
const MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export const BORDERLINE_MIN = 55;
export const BORDERLINE_MAX = 65;
export const ACTIVE_VERDICTS = ["APROVADO", "APROVADO_SITUACIONAL", "LABAREDA"];

export interface BorderlineInput {
  match_id: string;
  home_team: string;
  away_team: string;
  league?: string | null;
  minute: number;
  score_home: number;
  score_away: number;
  market: string;
  verdict: string;
  confidence: number;
  thesis?: string | null;
  odd?: number | null;
  stats: Record<string, any>;
}

export interface BorderlineDecision {
  decision: "CONFIRMA" | "VETA" | "ERROR" | "SKIP";
  reason: string;
  confidence_adjustment: number; // +N CONFIRMA, -N VETA
  latency_ms: number;
  model: string;
}

export function isBorderline(verdict: string, confidence: number): boolean {
  if (!ACTIVE_VERDICTS.includes(verdict)) return false;
  const c = Number(confidence ?? 0);
  return c >= BORDERLINE_MIN && c <= BORDERLINE_MAX;
}

export async function validateBorderline(
  input: BorderlineInput,
): Promise<BorderlineDecision> {
  const t0 = Date.now();
  if (!GROQ_KEY) {
    return { decision: "ERROR", reason: "GROQ_API_KEY ausente", confidence_adjustment: 0, latency_ms: 0, model: MODEL };
  }

  const s = input.stats || {};
  const xgH = Number(s.xg_home ?? s.xG_home ?? 0);
  const xgA = Number(s.xg_away ?? s.xG_away ?? 0);
  const possH = Number(s.possession_home ?? 0);
  const possA = Number(s.possession_away ?? 0);
  const shots = Number(s.shots_total ?? 0);
  const sot = Number(s.shots_on_target_total ?? s.shots_on_target ?? 0);
  const danger = Number(s.dangerous_attacks_total ?? s.dangerous_attacks ?? 0);
  const corners = Number(s.corners_total ?? 0);

  const prompt = `Você é um VALIDADOR FRIO de sinais de trading esportivo ao vivo. O motor matemático aprovou um sinal mas com confiança BORDERLINE (${input.confidence}%). Sua tarefa: revisar e decidir CONFIRMA ou VETA.

CONTEXTO:
${input.home_team} ${input.score_home} x ${input.score_away} ${input.away_team} — ${input.league ?? "?"} — ${input.minute}'

SINAL PROPOSTO:
- Mercado: ${input.market}
- Veredito: ${input.verdict}
- Confiança matemática: ${input.confidence}%
- Odd: ${input.odd ?? "?"}
- Tese: ${input.thesis ?? "(sem tese)"}

STATS:
- xG: ${xgH.toFixed(2)} x ${xgA.toFixed(2)} (total ${(xgH + xgA).toFixed(2)})
- Posse: ${possH}% x ${possA}%
- Chutes: ${shots} (no gol: ${sot})
- Ataques perigosos: ${danger}
- Escanteios: ${corners}

REGRAS DE DECISÃO:
1. CONFIRMA se as stats SUPORTAM CLARAMENTE a tese e não há contraindicação grave.
2. VETA se houver inconsistência clara: stats fracas demais, momentum oposto, jogo morto, xG zerado em mercado Over, etc.
3. Em dúvida → CONFIRMA (motor matemático tem prioridade).

Responda APENAS em JSON válido:
{"decision":"CONFIRMA"|"VETA","reason":"<até 200 chars em pt-br>","confidence_delta":<inteiro -10..+10>}`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const resp = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY}`,
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_completion_tokens: 200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Você é um validador frio de sinais esportivos. Responda APENAS em JSON válido." },
          { role: "user", content: prompt },
        ],
      }),
    });
    clearTimeout(timer);

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      return {
        decision: "ERROR",
        reason: `HTTP ${resp.status} ${txt.slice(0, 120)}`,
        confidence_adjustment: 0,
        latency_ms: Date.now() - t0,
        model: MODEL,
      };
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = String(raw).match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { /* ignore */ }
      }
    }

    if (!parsed || !["CONFIRMA", "VETA"].includes(parsed.decision)) {
      return {
        decision: "ERROR",
        reason: "Resposta IA inválida",
        confidence_adjustment: 0,
        latency_ms: Date.now() - t0,
        model: MODEL,
      };
    }

    const delta = Math.max(-10, Math.min(10, Number(parsed.confidence_delta ?? 0) | 0));
    return {
      decision: parsed.decision,
      reason: String(parsed.reason ?? "").slice(0, 240),
      confidence_adjustment: delta,
      latency_ms: Date.now() - t0,
      model: MODEL,
    };
  } catch (e) {
    return {
      decision: "ERROR",
      reason: (e as Error).message?.slice(0, 200) || "exception",
      confidence_adjustment: 0,
      latency_ms: Date.now() - t0,
      model: MODEL,
    };
  }
}
