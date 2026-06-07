import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { chatCascade } from "../_shared/chatCascade.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabaseAdmin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function loadMemories(userId: string, contextFilter: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  try {
    const { data } = await supabase
      .from("mycroft_memory")
      .select("id, rule_text, category, priority, context, created_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .or(`context.cs.{${contextFilter}},context.cs.{sports}`)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);
    if (!data || data.length === 0) return "";
    const lines = data.map((m: any, i: number) => `${i + 1}. [${m.category}|P${m.priority}] ${m.rule_text}`);
    return `\n━━━ MEMÓRIA PERSISTENTE DO USUÁRIO (${data.length} regras) ━━━\nEstas são instruções que o usuário definiu anteriormente. Você DEVE respeitá-las em TODAS as interações:\n${lines.join("\n")}\n━━━ FIM DA MEMÓRIA ━━━\n`;
  } catch (e) {
    console.error("Memory loading error:", e);
    return "";
  }
}

async function aiExtractRules(query: string, apiKey: string): Promise<{ rules: Array<{ rule_text: string; category: string; priority: number }>; forget_rules: string[]; conflicts: string[] }> {
  try {
    const extractionPrompt = `Analise a mensagem do usuário e determine:
1. Se contém instruções/regras permanentes (ex: "nunca faça X", "sempre priorize Y", "a partir de agora...")
2. Se pede para esquecer/remover alguma regra (ex: "esqueça a regra sobre X", "remova a regra de Y")
3. Se há conflitos potenciais entre as regras detectadas

Retorne APENAS o JSON usando a tool fornecida.

Mensagem do usuário: "${query}"`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: extractionPrompt }],
        temperature: 0.1,
        max_tokens: 500,
        tools: [{
          type: "function",
          function: {
            name: "extract_memory_rules",
            description: "Extract permanent rules, forget requests, and conflicts from user message",
            parameters: {
              type: "object",
              properties: {
                rules: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      rule_text: { type: "string", description: "The rule in clear, concise form" },
                      category: { type: "string", enum: ["risk_management", "indicator_preference", "analysis_rule", "style", "anti_conflict", "rule"] },
                      priority: { type: "number", description: "0=normal, 1=important, 2=critical" }
                    },
                    required: ["rule_text", "category", "priority"]
                  }
                },
                forget_rules: {
                  type: "array",
                  items: { type: "string" },
                  description: "Keywords of rules to deactivate"
                },
                conflicts: {
                  type: "array",
                  items: { type: "string" },
                  description: "Descriptions of detected conflicts"
                }
              },
              required: ["rules", "forget_rules", "conflicts"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_memory_rules" } }
      }),
    });

    if (!response.ok) {
      console.error("AI extraction error:", response.status);
      return { rules: [], forget_rules: [], conflicts: [] };
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      return JSON.parse(toolCall.function.arguments);
    }
    return { rules: [], forget_rules: [], conflicts: [] };
  } catch (e) {
    console.error("AI rule extraction error:", e);
    return { rules: [], forget_rules: [], conflicts: [] };
  }
}

async function processMemoryActions(userId: string, extraction: { rules: Array<{ rule_text: string; category: string; priority: number }>; forget_rules: string[]; conflicts: string[] }): Promise<void> {
  const supabase = getSupabaseAdmin();

  for (const rule of extraction.rules) {
    try {
      await supabase.from("mycroft_memory").insert({
        user_id: userId,
        mycroft_type: "analyst",
        rule_text: rule.rule_text.substring(0, 2000),
        category: rule.category,
        priority: rule.priority,
        context: ["analyst", "sports"],
      });
      console.log(`🧠 Analyst rule saved: [${rule.category}|P${rule.priority}] ${rule.rule_text.substring(0, 100)}`);
    } catch (e) {
      console.error("Rule save error:", e);
    }
  }

  for (const keyword of extraction.forget_rules) {
    try {
      const { data: matches } = await supabase
        .from("mycroft_memory")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .ilike("rule_text", `%${keyword}%`)
        .limit(5);
      if (matches && matches.length > 0) {
        await supabase.from("mycroft_memory").update({ is_active: false }).in("id", matches.map((m: any) => m.id));
        console.log(`🗑️ Deactivated ${matches.length} analyst rules matching "${keyword}"`);
      }
    } catch (e) {
      console.error("Forget rule error:", e);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, marketData, conversationHistory, userId } = await req.json();
    if (!query) throw new Error("Missing query");

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY"); // mantido para aiExtractRules (tool calling)
    const DEEPSEEK_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    if (!DEEPSEEK_KEY && !GROQ_API_KEY) throw new Error("Nenhum provider IA configurado (DEEPSEEK_API_KEY/GROQ_API_KEY)");

    const supabase = getSupabaseAdmin();

    // Load KB, memory, and recent punter analyses in parallel
    const [knowledgeBaseContent, memoryContent, punterContext] = await Promise.all([
      (async () => {
        try {
          const { data: files } = await supabase.storage.from("knowledge-base").list("", { limit: 50 });
          if (!files || files.length === 0) return "";
          const contents: string[] = [];
          for (const file of files) {
            if (!file.name || file.name.length === 0) continue;
            try {
              const ext = file.name.split('.').pop()?.toLowerCase();
              if (ext === 'pdf') { contents.push(`\n━━━ ${file.name} (PDF) ━━━\n[PDF detectado. Converta para .txt.]`); continue; }
              if (!['txt', 'md', 'csv'].includes(ext || '')) continue;
              const { data: fileData } = await supabase.storage.from("knowledge-base").download(file.name);
              if (!fileData) continue;
              contents.push(`\n━━━ ${file.name} ━━━\n${(await fileData.text()).substring(0, 50000)}`);
            } catch (e) { console.error(`Error reading ${file.name}:`, e); }
          }
          return contents.join("\n\n");
        } catch (e) { console.error("KB loading error:", e); return ""; }
      })(),
      userId ? loadMemories(userId, "analyst") : Promise.resolve(""),
      (async () => {
        try {
          const { data: analyses } = await supabase
            .from("punter_analyses")
            .select("home_team, away_team, league, market, bookmaker, odd, fair_odd, implied_probability, estimated_probability, value_percentage, verdict, confidence, stake_percentage, thesis, analysis, risk_factors, commence_time, created_at")
            .order("created_at", { ascending: false })
            .limit(30);
          if (!analyses || analyses.length === 0) return "";
          const approved = analyses.filter((a: any) => a.verdict === "APROVADO");
          const vetoed = analyses.filter((a: any) => a.verdict === "VETADO");
          let ctx = `\n━━━ ANÁLISES RECENTES DA ARENA PUNTER (${analyses.length} jogos) ━━━\n`;
          if (approved.length > 0) {
            ctx += `\n✅ APROVADOS (${approved.length}):\n`;
            for (const a of approved) {
              ctx += `• ${a.home_team} vs ${a.away_team} (${a.league}) | ${a.market} @ ${a.odd} (${a.bookmaker}) | Value: ${a.value_percentage}% | Confiança: ${a.confidence}% | Stake: ${a.stake_percentage}%\n  Tese: ${(a.thesis || '').substring(0, 200)}\n`;
            }
          }
          if (vetoed.length > 0) {
            ctx += `\n❌ VETADOS (${vetoed.length}):\n`;
            for (const v of vetoed.slice(0, 10)) {
              ctx += `• ${v.home_team} vs ${v.away_team} (${v.league}) | ${v.market || 'N/A'} | Tese: ${(v.thesis || '').substring(0, 150)}\n`;
            }
          }
          // Check for corner/card markets specifically
          const cornerAnalyses = analyses.filter((a: any) => a.market?.toLowerCase().includes('escanteio') || a.market?.toLowerCase().includes('corner'));
          const cardAnalyses = analyses.filter((a: any) => a.market?.toLowerCase().includes('cartão') || a.market?.toLowerCase().includes('cartões') || a.market?.toLowerCase().includes('card'));
          if (cornerAnalyses.length > 0) {
            ctx += `\n🏁 ESCANTEIOS ANALISADOS (${cornerAnalyses.length}):\n`;
            for (const c of cornerAnalyses) {
              ctx += `• ${c.home_team} vs ${c.away_team}: ${c.market} @ ${c.odd} | Value: ${c.value_percentage}% | ${c.verdict}\n`;
            }
          }
          if (cardAnalyses.length > 0) {
            ctx += `\n🟨 CARTÕES ANALISADOS (${cardAnalyses.length}):\n`;
            for (const c of cardAnalyses) {
              ctx += `• ${c.home_team} vs ${c.away_team}: ${c.market} @ ${c.odd} | Value: ${c.value_percentage}% | ${c.verdict}\n`;
            }
          }
          ctx += `━━━ FIM ANÁLISES PUNTER ━━━\n`;
          return ctx;
        } catch (e) {
          console.error("Punter analyses loading error:", e);
          return "";
        }
      })(),
    ]);

    let marketContext = "";
    if (marketData) {
      marketContext = `━━━ DADOS DE MERCADO ━━━\nAtivo: ${marketData.asset || "N/A"} (${marketData.symbol || "N/A"})\nTimeframe: ${marketData.timeframe || "N/A"}\nPreço: ${marketData.price?.toLocaleString() || "N/A"}\nSMA 9: ${marketData.sma9 ?? "N/A"} | SMA 21: ${marketData.sma21 ?? "N/A"}\nRSI: ${marketData.rsi ?? "N/A"}\nBollinger: ${marketData.bollingerUpper ?? "N/A"} / ${marketData.bollingerLower ?? "N/A"}\nVolume: ${marketData.volume ?? "N/A"} | Var 24h: ${marketData.change24h?.toFixed(2) ?? "N/A"}%\nModo: ${marketData.isLive ? "LIVE" : "SIMULADO"}\n━━━━━━━━━━━━━━━━━━━━━`;
    }

    const systemPrompt = `━━━ IDENTIDADE ━━━
Você é MYCROFT TRADER, analista de trading esportivo e financeiro com acesso à Knowledge Base completa, incluindo estratégias validadas no mercado. Perito forense — técnico, preciso, frio e calculista.

${memoryContent}

━━━ METODOLOGIA DE TRADING ESPORTIVO (Estratégias Validadas no Mercado) ━━━

📘 Domínio de Mercado
- O mercado é eficiente, mas DEMORA a ajustar odds após eventos-chave. O trader deve entrar IMEDIATAMENTE após gols em times favoritos.
- Exemplo: odd 1.30 → gol aos 30' → nova odd justa ~1.15. A janela de oportunidade é curta.
- Explore a ineficiência temporal do mercado — entre antes que a odd se ajuste.

📘 Punter vs Trader
- Punter: seleciona os MELHORES JOGOS (pré-jogo). Foco em value betting e análise estatística pré-match.
- Trader: seleciona os MELHORES MOMENTOS dentro do jogo. Foco em timing e leitura de fluxo ao vivo.
- NÃO abrir todas as "portas" — ser SELETIVO. Qualidade > quantidade.
- Adapte sua análise ao contexto do usuário (Punter ou Trader).

📘 Análise e Controle
- Times que DOMINAM (posse, finalizações, escanteios) raramente veem a odd subir. Recomendar BACK nesses cenários.
- Controle de jogo = pressão sustentada = gol iminente estatisticamente.
- Exemplo: Argentina vs Venezuela: odd caiu de 1.52 para 1.45 ANTES do gol — o mercado já precificava o domínio.
- Use indicadores de controle (posse >60%, finalizações 3:1, escanteios dominantes) para confirmar teses.

Use esses princípios para gerar recomendações precisas, adaptadas ao contexto do usuário.

━━━ BASE DE CONHECIMENTO ━━━
Livros de referência: Japanese Candlestick Charting (Nison), Trading in the Zone (Douglas), Reminiscences of a Stock Operator (Livermore).
${knowledgeBaseContent ? `━━━ DOCUMENTOS ━━━\n${knowledgeBaseContent}\n━━━ FIM ━━━` : "Nenhum documento carregado. Use conhecimento geral dos livros e estratégias validadas no mercado."}

${marketContext}

${punterContext}

━━━ MEMÓRIA PERSISTENTE ━━━
Quando o usuário der uma instrução permanente (ex: "nunca mais faça X", "sempre priorize Y"), você DEVE:
1. Confirmar: "✅ Regra memorizada. Será aplicada em todas as próximas interações."
2. Aplicar imediatamente.

Quando o usuário pedir para esquecer uma regra, confirme: "🗑️ Regra removida."
Se detectar conflito entre regras, avise: "⚠️ Conflito detectado entre regras."

━━━ DIRETRIZES OBRIGATÓRIAS ━━━
1. TIMEFRAME É CRÍTICO - 1min ≠ 15min ≠ 1h ≠ 1d
2. CONFLUÊNCIA ≥ 3 fatores (score 0-10)
3. R:R ≥ 1:1.5 obrigatório
4. CITE FONTES dos livros e de estratégias validadas no mercado
5. COMPLIANCE CVM - "Confluência de compra", não "Compre"
6. Formato: 📊 ANÁLISE → 📈 SITUAÇÃO → 🔍 TÉCNICA → 📖 FUNDAMENTAÇÃO → ⚖️ GESTÃO DE RISCO → ⚠️ AVISOS

TOM: Técnico, direto, bullet points, números e percentuais.`;

    const messages: { role: string; content: string }[] = [];
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-10)) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    messages.push({ role: "user", content: query });

    // DeepSeek-first cascade (DeepSeek → Groq 70B → Groq 8B)
    let content = "";
    try {
      const result = await chatCascade({
        messages: [{ role: "system", content: systemPrompt }, ...messages] as any,
        temperature: 0.6,
        max_tokens: 2000,
        timeoutMs: 90_000,
      });
      content = result.text || "Sem resposta.";
      console.log(`[MycroftAnalystChat] ok via ${result.provider}/${result.model} in ${result.ms}ms`);
    } catch (e) {
      const msg = (e as Error).message;
      console.error("[MycroftAnalystChat] cascade failed:", msg);
      const status = /429/.test(msg) ? 429 : /402/.test(msg) ? 402 : 500;
      const userMsg = status === 429
        ? "⚠️ Limite de requisições. Tente novamente."
        : status === 402
        ? "⚠️ Créditos insuficientes."
        : "⚠️ Mycroft Analyst temporariamente indisponível.";
      return new Response(JSON.stringify({ error: "AI error", response: userMsg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    // AI-based memory extraction in background
    if (userId) {
      (async () => {
        try {
          const extraction = await aiExtractRules(query, GROQ_API_KEY);
          if (extraction.rules.length > 0 || extraction.forget_rules.length > 0) {
            await processMemoryActions(userId, extraction);
          }
        } catch (e) {
          console.error("Memory processing bg error:", e);
        }
      })();
    }

    return new Response(JSON.stringify({ response: content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Mycroft Analyst Chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", response: "⚠️ Mycroft Analyst temporariamente indisponível." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
