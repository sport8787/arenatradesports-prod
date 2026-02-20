import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Cache helpers ──────────────────────────────────────────
function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getCache(cacheKey: string) {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("ai_response_cache")
      .select("id, response_json, hit_count")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (data) {
      await sb.from("ai_response_cache").update({ hit_count: (data.hit_count || 0) + 1 }).eq("id", data.id);
      console.log(`Cache HIT for key ${cacheKey.slice(0, 12)}...`);
      return data.response_json;
    }
  } catch (e) {
    console.warn("Cache read error:", e);
  }
  return null;
}

async function setCache(cacheKey: string, functionName: string, response: any) {
  try {
    const sb = getSupabaseAdmin();
    await sb.from("ai_response_cache").upsert({
      cache_key: cacheKey,
      function_name: functionName,
      response_json: response,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "cache_key" });
    console.log(`Cache SET for key ${cacheKey.slice(0, 12)}...`);
  } catch (e) {
    console.warn("Cache write error:", e);
  }
}

const STREET_ORDER = ["preflop", "flop", "turn", "river"];

const GENERATE_HAND_PROMPT = `Você é Mycroft 2.0, perito forense de poker. Gere uma MÃO COMPLETA para treino multi-street.

O jogador vai tomar decisões street-by-street (Preflop → Flop → Turn → River).

Responda EXATAMENTE no formato JSON:

{
  "hand": {
    "heroCards": "<duas cartas, ex: AhKs>",
    "villainName": "<nome fictício imersivo>",
    "villainProfile": "<breve perfil: TAG/LAG/calling station/maniac/etc + tendências>",
    "positionHero": "<UTG|MP|CO|BTN|SB|BB>",
    "positionVillain": "<posição do vilão>",
    "heroStack": <stack em BB>,
    "villainStack": <stack em BB>,
    "blinds": "<ex: 50/100>",
    "ante": "<ex: 10 ou null>",
    "context": "<contexto narrativo imersivo, 1-2 frases>",
    "boardFlop": "<3 cartas do flop, ex: Qh5s6d>",
    "boardTurn": "<1 carta do turn, ex: 3s>",
    "boardRiver": "<1 carta do river, ex: Jc>"
  },
  "streets": {
    "preflop": {
      "scenarioText": "<descrição da situação preflop>",
      "villainAction": "<ação do vilão preflop, ex: 'abre para 3BB do CO'>",
      "potSize": <pot em BB>,
      "options": ["Fold", "Call", "Raise 3x", "Raise 4x", "All-in"],
      "correctAction": "<ação correta>",
      "correctActionSet": ["<ações aceitáveis, pode ser mais de uma>"],
      "explanation": "<explicação técnica detalhada>",
      "difficulty": <1-10>
    },
    "flop": {
      "scenarioText": "<descrição assumindo ação correta no preflop>",
      "villainAction": "<ação do vilão no flop>",
      "potSize": <pot atualizado>,
      "options": ["Check", "Bet 33%", "Bet 50%", "Bet 75%", "Bet 100%", "All-in"],
      "correctAction": "<ação correta>",
      "correctActionSet": ["<ações aceitáveis>"],
      "explanation": "<explicação técnica>",
      "difficulty": <1-10>
    },
    "turn": {
      "scenarioText": "<descrição assumindo ações corretas anteriores>",
      "villainAction": "<ação do vilão no turn>",
      "potSize": <pot atualizado>,
      "options": ["Check", "Bet 33%", "Bet 50%", "Bet 75%", "Bet 100%", "All-in"],
      "correctAction": "<ação correta>",
      "correctActionSet": ["<ações aceitáveis>"],
      "explanation": "<explicação técnica>",
      "difficulty": <1-10>
    },
    "river": {
      "scenarioText": "<descrição assumindo ações corretas anteriores>",
      "villainAction": "<ação do vilão no river>",
      "potSize": <pot atualizado>,
      "options": ["Check", "Bet 33%", "Bet 50%", "Bet 75%", "Bet 100%", "All-in", "Fold"],
      "correctAction": "<ação correta>",
      "correctActionSet": ["<ações aceitáveis>"],
      "explanation": "<explicação técnica>",
      "difficulty": <1-10>
    }
  }
}

REGRAS:
- A mão deve ser REALISTA e COERENTE street-by-street.
- O pot e stacks devem atualizar corretamente.
- A dificuldade deve escalar: preflop mais fácil, river mais difícil.
- O vilão deve ter um perfil consistente que influencia suas ações.
- Board cards devem criar spots interessantes (draws, paired boards, scare cards).
- Se o cenário base é número {scenarioNumber}, aumente complexidade.
- CADA street deve ter múltiplas ações aceitáveis quando aplicável (partial credit).
- O hand deve terminar antes do river se a ação correta for Fold/All-in (nesse caso, streets subsequentes ficam com correctAction: "N/A").
- Responda APENAS com JSON válido.`;

const EVALUATE_STREET_PROMPT = `Você é Mycroft 2.0, perito forense de poker. Avalie a decisão do jogador nesta street.

Contexto da mão:
- Hero: {heroCards} ({positionHero})
- Vilão: {villainName} ({villainProfile}) ({positionVillain})
- Board: {boardCards}
- Street: {street}
- Pot: {potSize}BB
- Hero Stack: {heroStack}BB | Vilão Stack: {villainStack}BB
- Histórico de ações: {actionHistory}

Cenário: {scenarioText}
Ação do vilão: {villainAction}
Ação do jogador: {playerAction}
Ação correta: {correctAction}
Ações aceitáveis: {correctActionSet}

Responda EXATAMENTE no formato JSON:

{
  "correto": <true se ação está em correctActionSet, false caso contrário>,
  "nota": <0 a 100>,
  "feedbackHorus": "<provocação curta do Hórus, 1 frase memorável>",
  "bcGanho": <BC ganhos se correto (50-200), 0 se errado>,
  "bcPerdido": <BC perdidos se errado (100-500), 0 se correto>,
  "laudoResumo": {
    "street": "{street}",
    "acaoCorreta": "<ação correta curta>",
    "situacao": "<1 linha: Board + Mão + Pot + Stacks com emojis de naipe>",
    "matematica": "<2-3 bullets com equity/pot odds/SPR separados por \\n>",
    "conclusao": "<1 frase veredito>",
    "analiseCompleta": "<3-6 frases deep-dive>"
  },
  "evDiferenca": "<diferença de EV>",
  "perspectivas": {
    "tag": { "acao": "<>", "raciocinio": "<>", "ev": "<>" },
    "lag": { "acao": "<>", "raciocinio": "<>", "ev": "<>" },
    "gto": { "acao": "<>", "raciocinio": "<>", "ev": "<>" },
    "jogadorEv": "<EV da ação do jogador>",
    "melhorEstilo": "<tag|lag|gto>"
  },
  "nextStreetUpdate": {
    "newPotSize": <pot atualizado após a ação>,
    "newHeroStack": <stack do hero atualizado>,
    "newVillainStack": <stack do vilão atualizado>,
    "handEnded": <true se a mão terminou (fold/all-in showdown), false se continua>
  }
}

REGRAS:
- Crédito parcial: se a ação não é a ideal mas está em correctActionSet, correto=true com nota menor.
- nextStreetUpdate deve calcular corretamente as mudanças de pot/stack.
- handEnded=true se fold ou all-in (showdown imediato).
- Hórus deve ser provocativo mas educativo.
- Responda APENAS com JSON válido.`;

const SUGGEST_PROVOCATION_PROMPT = `Você é Mycroft 2.0 simulando o que um jogador de poker profissional diria para pressionar o oponente.

Contexto:
- Mão do herói: {heroCards}
- Board: {boardCards}
- Street: {street}
- Ação do herói: {heroAction}
- Intenção: {intent}
- Vilão: {villainName} ({villainProfile})

Intenção do jogador:
- "intimidate": Representar força, mostrar confiança
- "induce_call": Armadilha, parecer fraco para induzir call
- "induce_fold": Pressão máxima para forçar fold

Gere 3 frases de provocação que o jogador pode usar, calibradas para a intenção escolhida.

Responda EXATAMENTE no formato JSON:

{
  "suggestions": [
    {
      "text": "<frase exata para o jogador dizer, 1-2 frases>",
      "tone": "<agressivo|sutil|confiante|debochado>",
      "effectiveness": <1-10>
    },
    {
      "text": "<variação alternativa>",
      "tone": "<>",
      "effectiveness": <1-10>
    },
    {
      "text": "<variação mais ousada>",
      "tone": "<>",
      "effectiveness": <1-10>
    }
  ],
  "mycroftTip": "<dica técnica do Mycroft sobre como entregar a provocação de forma convincente, 1 frase>"
}

REGRAS:
- Frases devem soar naturais, como falas de mesa de poker real.
- Devem ser COERENTES com a ação e a intenção (não represente força se está induzindo call).
- Adapte ao perfil do vilão (não provoque um maniac da mesma forma que um nit).
- Responda APENAS com JSON válido.`;

const GENERATE_SCRIPT_PROMPT = `Você é Mycroft 2.0, coach de poker e especialista em table talk. O jogador precisa gravar uma provocação de mesa e pediu sua ajuda para montar um ROTEIRO DETALHADO.

Contexto da mão:
- Mão do herói: {heroCards}
- Board: {boardCards}
- Street: {street}
- Ação do herói: {heroAction}
- Vilão: {villainName} ({villainProfile})

INTENÇÃO ESCOLHIDA: {intent}
- "intimidate" = Amedrontar: representar força máxima, fazer o vilão duvidar da própria mão
- "induce_call" = Induzir Call: parecer fraco/inseguro para que o vilão pague, armadilha clássica
- "induce_fold" = Induzir Fold: pressão psicológica máxima para forçar o fold

Gere um ROTEIRO COMPLETO e DETALHADO que o jogador deve seguir ao gravar sua provocação. O roteiro deve incluir:

1. **Abertura** — como iniciar a fala (tom de voz, postura, olhar)
2. **Corpo** — a frase principal adaptada à intenção, com pausas dramáticas marcadas entre parênteses
3. **Fechamento** — como finalizar (gesto, expressão, silêncio)
4. **Dicas de atuação** — como modular voz, onde olhar, que expressão facial fazer

Responda EXATAMENTE no formato JSON:

{
  "script": "<roteiro completo com marcações de pausa e tom, pronto para o jogador ler e atuar, máximo 200 palavras>"
}

REGRAS:
- O roteiro deve ser NATURAL, como se fosse uma fala real de mesa.
- Use marcações como (pausa), (olhe nos olhos), (sorria de canto), (abaixe a voz).
- Adapte ao perfil do vilão — se ele é TAG, provoque diferente de um calling station.
- A provocação deve ser COERENTE com a intenção escolhida.
- Responda APENAS com JSON válido.`;

async function callGeminiAI(prompt: string, maxRetries = 3) {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
      console.log(`Retry attempt ${attempt + 1} after ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );

      if (response.status === 429) {
        lastError = new Error("RATE_LIMITED");
        console.warn(`Gemini 429 on attempt ${attempt + 1}/${maxRetries}`);
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        console.error(`Gemini API error [${response.status}]:`, body);
        throw new Error(`AI_ERROR_${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("No content in Gemini response");

      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      return JSON.parse(cleaned);
    } catch (e) {
      if (e instanceof Error && e.message === "RATE_LIMITED") {
        lastError = e;
        continue;
      }
      throw e;
    }
  }

  throw lastError || new Error("RATE_LIMITED");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "generate_hand") {
      const { scenarioNumber, difficulty } = body;
      const prompt = GENERATE_HAND_PROMPT
        .replace("{scenarioNumber}", String(scenarioNumber || 1));
      const result = await callGeminiAI(prompt);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "evaluate_street") {
      const { heroCards, positionHero, villainName, villainProfile, positionVillain,
              boardCards, street, potSize, heroStack, villainStack, actionHistory,
              scenarioText, villainAction, playerAction, correctAction, correctActionSet } = body;
      
      // Cache key based on all decision parameters
      const evalCacheInput = `eval:${heroCards}:${boardCards}:${street}:${playerAction}:${correctAction}:${potSize}:${villainAction}`;
      const evalCacheKey = await sha256(evalCacheInput);
      const cachedEval = await getCache(evalCacheKey);
      if (cachedEval) {
        return new Response(JSON.stringify(cachedEval), {
          headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" },
        });
      }

      const prompt = EVALUATE_STREET_PROMPT
        .replace("{heroCards}", heroCards)
        .replace("{positionHero}", positionHero)
        .replace("{villainName}", villainName)
        .replace("{villainProfile}", villainProfile || "unknown")
        .replace("{positionVillain}", positionVillain)
        .replace("{boardCards}", boardCards || "N/A")
        .replace("{street}", street)
        .replace("{potSize}", String(potSize))
        .replace("{heroStack}", String(heroStack))
        .replace("{villainStack}", String(villainStack))
        .replace("{actionHistory}", JSON.stringify(actionHistory || []))
        .replace("{scenarioText}", scenarioText)
        .replace("{villainAction}", villainAction)
        .replace("{playerAction}", playerAction)
        .replace("{correctAction}", correctAction)
        .replace("{correctActionSet}", JSON.stringify(correctActionSet || [correctAction]));

      const result = await callGeminiAI(prompt);
      setCache(evalCacheKey, "street-evaluate", result);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" },
      });
    }

    if (action === "suggest_provocation") {
      const { heroCards, boardCards, street, heroAction, intent, villainName, villainProfile } = body;
      
      const prompt = SUGGEST_PROVOCATION_PROMPT
        .replace("{heroCards}", heroCards)
        .replace("{boardCards}", boardCards || "N/A")
        .replace("{street}", street)
        .replace("{heroAction}", heroAction)
        .replace("{intent}", intent)
        .replace("{villainName}", villainName)
        .replace("{villainProfile}", villainProfile || "unknown");

      const result = await callGeminiAI(prompt);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate_provocation_script") {
      const { heroCards, boardCards, street, heroAction, intent, villainName, villainProfile } = body;
      
      const prompt = GENERATE_SCRIPT_PROMPT
        .replace("{heroCards}", heroCards)
        .replace("{boardCards}", boardCards || "N/A")
        .replace("{street}", street)
        .replace("{heroAction}", heroAction)
        .replace("{intent}", intent)
        .replace("{villainName}", villainName)
        .replace("{villainProfile}", villainProfile || "unknown");

      const result = await callGeminiAI(prompt);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("arena-poker-street-training error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg === "RATE_LIMITED" ? 429 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
