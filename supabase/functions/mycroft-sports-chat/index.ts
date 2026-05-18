import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function loadKnowledgeBase(): Promise<string> {
  const supabase = getSupabaseAdmin();
  const contents: string[] = [];
  try {
    const { data: files } = await supabase.storage.from("sports-knowledge-base").list("", { limit: 50 });
    if (files) {
      for (const file of files) {
        if (!file.name || file.name.length === 0) continue;
        try {
          const ext = file.name.split(".").pop()?.toLowerCase();
          if (!["txt", "md", "csv"].includes(ext || "")) continue;
          const { data: fileData } = await supabase.storage.from("sports-knowledge-base").download(file.name);
          if (!fileData) continue;
          const text = await fileData.text();
          contents.push(`\n━━━ ${file.name} ━━━\n${text.substring(0, 80000)}`);
        } catch (e) {
          console.error(`Error reading ${file.name}:`, e);
        }
      }
    }
  } catch (e) {
    console.error("Sports KB loading error:", e);
  }
  console.log(`📚 Sports KB loaded: ${contents.length} files, ${contents.join("").length} chars`);
  return contents.join("\n\n");
}

async function loadMemories(userId: string, contextFilter: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  try {
    const { data } = await supabase
      .from("mycroft_memory")
      .select("id, rule_text, category, priority, context, created_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .contains("context", [contextFilter])
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

async function aiExtractRules(query: string, aiResponse: string, apiKey: string): Promise<{ rules: Array<{ rule_text: string; category: string; priority: number }>; forget_rules: string[]; conflicts: string[] }> {
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
                      category: { type: "string", enum: ["risk_management", "market_preference", "analysis_rule", "style", "anti_conflict", "rule"] },
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

async function processMemoryActions(userId: string, extraction: { rules: Array<{ rule_text: string; category: string; priority: number }>; forget_rules: string[]; conflicts: string[] }): Promise<string> {
  const supabase = getSupabaseAdmin();
  const feedback: string[] = [];

  // Save new rules
  for (const rule of extraction.rules) {
    try {
      await supabase.from("mycroft_memory").insert({
        user_id: userId,
        mycroft_type: "sports",
        rule_text: rule.rule_text.substring(0, 2000),
        category: rule.category,
        priority: rule.priority,
        context: ["sports"],
      });
      feedback.push(`✅ Regra memorizada: "${rule.rule_text.substring(0, 80)}..."`);
      console.log(`🧠 Rule saved: [${rule.category}|P${rule.priority}] ${rule.rule_text.substring(0, 100)}`);
    } catch (e) {
      console.error("Rule save error:", e);
    }
  }

  // Deactivate forgotten rules
  for (const keyword of extraction.forget_rules) {
    try {
      const { data: matches } = await supabase
        .from("mycroft_memory")
        .select("id, rule_text")
        .eq("user_id", userId)
        .eq("is_active", true)
        .ilike("rule_text", `%${keyword}%`)
        .limit(5);
      if (matches && matches.length > 0) {
        const ids = matches.map((m: any) => m.id);
        await supabase.from("mycroft_memory").update({ is_active: false }).in("id", ids);
        feedback.push(`🗑️ Regra(s) removida(s) contendo "${keyword}" (${matches.length} regra(s))`);
        console.log(`🗑️ Deactivated ${matches.length} rules matching "${keyword}"`);
      }
    } catch (e) {
      console.error("Forget rule error:", e);
    }
  }

  // Report conflicts
  for (const conflict of extraction.conflicts) {
    feedback.push(`⚠️ Conflito detectado: ${conflict}`);
  }

  return feedback.join("\n");
}

function getPeriodLabel(m: any): string {
  const min = Number(m.minute) || 0;
  const status = (m.status || "").toLowerCase();
  const period = (m.period || "").toLowerCase();
  if (status === "halftime" || period.includes("ht") || period.includes("intervalo")) return "INTERVALO (HT)";
  if (min > 0 && min <= 45) return `1º TEMPO (${min}')`;
  if (min > 45 && min < 90) return `2º TEMPO (${min}')`;
  if (min >= 90) return `FIM/ACRÉSCIMOS (${min}')`;
  return `Min: ${min || "-"}`;
}

function formatLiveMatchStats(m: any): string {
  const stats = m.stats || {};
  const total = (m.score_home ?? 0) + (m.score_away ?? 0);
  const lines = [
    `• ${m.home_team} ${m.score_home ?? 0} x ${m.score_away ?? 0} ${m.away_team} [Total HT/FT: ${total} gols]`,
    `  Liga: ${m.championship} | ${getPeriodLabel(m)} | Status: ${m.status}`,
  ];
  
  if (stats.possession_home || stats.possession_away) {
    lines.push(`  Posse: ${stats.possession_home || 0}% x ${stats.possession_away || 0}%`);
  }
  if (stats.attacks_home || stats.attacks_away) {
    lines.push(`  Ataques Perigosos: ${stats.attacks_home || 0} x ${stats.attacks_away || 0}`);
  }
  if (stats.shots_total_home || stats.shots_total_away) {
    lines.push(`  Chutes (Total): ${stats.shots_total_home || 0} x ${stats.shots_total_away || 0}`);
  }
  if (stats.shots_on_target_home || stats.shots_on_target_away) {
    lines.push(`  Chutes no Gol: ${stats.shots_on_target_home || 0} x ${stats.shots_on_target_away || 0}`);
  }
  if (stats.corners_home || stats.corners_away) {
    lines.push(`  Escanteios: ${stats.corners_home || 0} x ${stats.corners_away || 0}`);
  }
  if (stats.cards_home || stats.cards_away) {
    lines.push(`  Cartões: ${stats.cards_home || 0} x ${stats.cards_away || 0}`);
  }
  if (stats.xG_home != null) {
    lines.push(`  xG: ${stats.xG_home} x ${stats.xG_away}`);
  }
  
  return lines.join("\n");
}

async function lookupMatchContext(query: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const parts: string[] = [];
  const queryLower = query.toLowerCase();

  try {
    // ALWAYS fetch all live matches - the AI needs this context for ANY sports question
    const { data: live } = await supabase
      .from("live_matches")
      .select("*, mycroft_analyses(*)")
      .in("status", ["live", "halftime", "1H", "2H", "HT"])
      .order("updated_at", { ascending: false })
      .limit(200);

    if (live && live.length > 0) {
      // Find matches specifically mentioned in the query
      const mentionedMatches = live.filter((m: any) => {
        const home = m.home_team?.toLowerCase() || "";
        const away = m.away_team?.toLowerCase() || "";
        const homeWords = home.split(/\s+/).filter((w: string) => w.length >= 3);
        const awayWords = away.split(/\s+/).filter((w: string) => w.length >= 3);
        return homeWords.some((w: string) => queryLower.includes(w)) ||
               awayWords.some((w: string) => queryLower.includes(w));
      });

      // If specific matches are mentioned, show them first with full detail
      if (mentionedMatches.length > 0) {
        parts.push(`━━━ JOGOS MENCIONADOS (PRIORIDADE) ━━━`);
        for (const m of mentionedMatches) {
          parts.push(formatLiveMatchStats(m));
          const analysis = m.mycroft_analyses;
          if (analysis) {
            parts.push(`  📊 Análise Mycroft: Veredito=${analysis.verdict} | Mercado=${analysis.market} | Odd=${analysis.odd} | Confiança=${analysis.confidence}%`);
            if (analysis.thesis) parts.push(`  Tese: ${analysis.thesis.substring(0, 300)}`);
          }
        }
      }


      // Agrupar por período (ajuda IA a filtrar perguntas tipo "jogos no 1T")
      const firstHalf = live.filter((m: any) => { const min = Number(m.minute)||0; return min > 0 && min <= 45 && (m.status||"").toLowerCase() !== "halftime"; });
      const halftime = live.filter((m: any) => { const min = Number(m.minute)||0; const st=(m.status||"").toLowerCase(); return st === "halftime" || (m.period||"").toLowerCase().includes("ht") || (min>=45 && min<=46 && st!=="live"); });
      const secondHalf = live.filter((m: any) => { const min = Number(m.minute)||0; return min > 45 && (m.status||"").toLowerCase() !== "halftime"; });

      parts.push(`\n━━━ TODOS OS JOGOS AO VIVO (${live.length} partidas) ━━━`);
      parts.push(`📊 Distribuição: 1º Tempo=${firstHalf.length} | Intervalo=${halftime.length} | 2º Tempo=${secondHalf.length}`);

      if (firstHalf.length > 0) {
        parts.push(`\n🟡 JOGOS NO 1º TEMPO (${firstHalf.length}):`);
        for (const m of firstHalf) {
          parts.push(formatLiveMatchStats(m));
          const analysis = m.mycroft_analyses;
          if (analysis) parts.push(`  📊 Mycroft: ${analysis.verdict} | ${analysis.market} | Odd ${analysis.odd} | ${analysis.confidence}%`);
        }
      }
      if (halftime.length > 0) {
        parts.push(`\n🟠 JOGOS NO INTERVALO (${halftime.length}):`);
        for (const m of halftime) {
          parts.push(formatLiveMatchStats(m));
          const analysis = m.mycroft_analyses;
          if (analysis) parts.push(`  📊 Mycroft: ${analysis.verdict} | ${analysis.market} | Odd ${analysis.odd} | ${analysis.confidence}%`);
        }
      }
      if (secondHalf.length > 0) {
        parts.push(`\n🟢 JOGOS NO 2º TEMPO (${secondHalf.length}):`);
        for (const m of secondHalf) {
          parts.push(formatLiveMatchStats(m));
          const analysis = m.mycroft_analyses;
          if (analysis) parts.push(`  📊 Mycroft: ${analysis.verdict} | ${analysis.market} | Odd ${analysis.odd} | ${analysis.confidence}%`);
        }
      }
    }

    // Scheduled games - only if specifically asked or team name matches
    const { data: scheduled } = await supabase.from("scheduled_games").select("*").order("match_datetime", { ascending: true }).limit(50);
    const matchedScheduled = (scheduled || []).filter((g: any) => {
      const home = g.home_team?.toLowerCase() || "";
      const away = g.away_team?.toLowerCase() || "";
      const league = g.league_name?.toLowerCase() || "";
      return queryLower.split(/\s+/).some((w: string) => w.length >= 3 && (home.includes(w) || away.includes(w) || league.includes(w)));
    });
    if (matchedScheduled.length > 0) {
      parts.push("\n━━━ JOGOS AGENDADOS ━━━");
      for (const g of matchedScheduled.slice(0, 5)) {
        parts.push(`• ${g.home_team} vs ${g.away_team} | Liga: ${g.league_name} | Data: ${g.match_date} ${g.match_time}`);
      }
    }

    // Punter analyses - only if team name matches
    const { data: punterAnalyses } = await supabase.from("punter_analyses").select("*").order("created_at", { ascending: false }).limit(30);
    const matchedPunter = (punterAnalyses || []).filter((a: any) => {
      const home = a.home_team?.toLowerCase() || "";
      const away = a.away_team?.toLowerCase() || "";
      return queryLower.split(/\s+/).some((w: string) => w.length >= 3 && (home.includes(w) || away.includes(w)));
    });
    if (matchedPunter.length > 0) {
      parts.push("\n━━━ ANÁLISES PRÉ-JOGO (PUNTER) ━━━");
      for (const a of matchedPunter.slice(0, 3)) {
        parts.push(`• ${a.home_team} vs ${a.away_team} | Mercado: ${a.market} | Odd: ${a.odd} | Veredito: ${a.verdict} | Value: ${a.value_percentage}%`);
      }
    }
  } catch (e) {
    console.error("Match lookup error:", e);
  }

  return parts.length === 0 ? "" : "\n" + parts.join("\n") + "\n";
}

async function syncAnalysisToDashboard(aiResponse: string, query: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Try to extract JSON analysis block from the AI response
  const jsonMatch = aiResponse.match(/\{[\s\S]*?"verdict"\s*:\s*"(APROVADO|VETADO|AGUARDAR)"[\s\S]*?\}/);
  if (!jsonMatch) return;

  let analysis: any;
  try {
    analysis = JSON.parse(jsonMatch[0]);
  } catch {
    // Try to find a cleaner JSON block
    const codeBlockMatch = aiResponse.match(/```(?:json)?\s*(\{[\s\S]*?"verdict"[\s\S]*?\})\s*```/);
    if (!codeBlockMatch) return;
    try {
      analysis = JSON.parse(codeBlockMatch[1]);
    } catch {
      return;
    }
  }

  const verdict = analysis.verdict;
  if (!verdict || !["APROVADO", "VETADO", "AGUARDAR"].includes(verdict)) return;

  // Try to identify which match this analysis refers to
  const queryLower = query.toLowerCase();
  const responseLower = aiResponse.toLowerCase();

  const { data: liveMatches } = await supabase
    .from("live_matches")
    .select("id, match_id, home_team, away_team")
    .in("status", ["live", "halftime", "scheduled"])
    .limit(50);

  if (!liveMatches || liveMatches.length === 0) return;

  // Find the match by team name in query or response
  const targetMatch = liveMatches.find((m: any) => {
    const home = m.home_team?.toLowerCase() || "";
    const away = m.away_team?.toLowerCase() || "";
    const homeWords = home.split(/\s+/).filter((w: string) => w.length >= 3);
    const awayWords = away.split(/\s+/).filter((w: string) => w.length >= 3);
    return homeWords.some((w: string) => queryLower.includes(w) || responseLower.includes(w)) ||
           awayWords.some((w: string) => queryLower.includes(w) || responseLower.includes(w));
  });

  if (!targetMatch) {
    console.log("⚠️ Analysis sync: could not match to a live game");
    return;
  }

  // Save to mycroft_analyses
  const { data: inserted } = await supabase.from("mycroft_analyses").insert({
    match_id: targetMatch.match_id,
    verdict: verdict,
    market: analysis.market || "Análise Chat",
    thesis: analysis.thesis || "",
    odd: analysis.odd || null,
    confidence: analysis.confidence || null,
    fundamentation: analysis.fundamentation ? { text: analysis.fundamentation } : null,
    risk_management: analysis.risk_management ? { text: analysis.risk_management } : null,
    alerts: analysis.alerts ? (Array.isArray(analysis.alerts) ? analysis.alerts : [analysis.alerts]) : null,
  }).select("id").single();

  if (inserted) {
    // Update live_matches status and link to analysis
    await supabase.from("live_matches").update({
      mycroft_status: verdict,
      mycroft_analysis_id: inserted.id,
      updated_at: new Date().toISOString(),
    }).eq("id", targetMatch.id);

    console.log(`✅ Analysis synced to dashboard: ${targetMatch.home_team} vs ${targetMatch.away_team} → ${verdict} (analysis ${inserted.id})`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, matchContext, conversationHistory, userId } = await req.json();
    if (!query) throw new Error("Missing query");

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

    // Load KB, match data, and persistent memory in parallel
    const [knowledgeBaseContent, autoMatchContext, memoryContent] = await Promise.all([
      loadKnowledgeBase(),
      lookupMatchContext(query),
      userId ? loadMemories(userId, "sports") : Promise.resolve(""),
    ]);

    const combinedMatchContext = [matchContext, autoMatchContext].filter(Boolean).join("\n");

    const systemPrompt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTIDADE E FUNÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Você é MYCROFT SPORTS, inteligência artificial especializada em análise forense de trading esportivo ao vivo.

Você incorpora duas personas:

**Mycroft** — Analista forense frio. Responde sobre odds, value bets, xG, estatísticas ao vivo, padrões de jogo, gestão de banca, expected value, stake sizing e probabilidades.

**Hórus** — Coach de trading provocativo. Responde sobre controle emocional, tilt, disciplina de banca, FOMO, overtrading e mentalidade de trader.

${memoryContent}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BASE DE CONHECIMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${knowledgeBaseContent ? `━━━ DOCUMENTOS ━━━\n${knowledgeBaseContent}\n━━━ FIM ━━━\n\nINSTRUÇÃO CRÍTICA: Fundamente TODA análise nos documentos acima. CITE autores e livros.` : "Nenhum documento na KB. Use conhecimento geral de trading esportivo."}

${combinedMatchContext ? `━━━ DADOS DE JOGOS ━━━\n${combinedMatchContext}\n━━━ FIM ━━━\nUse esses dados reais para fundamentar sua análise.` : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MEMÓRIA PERSISTENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quando o usuário der uma instrução permanente (ex: "nunca mais faça X", "sempre priorize Y", "a partir de agora..."), você DEVE:
1. Confirmar que entendeu e que a regra será memorizada
2. Informar: "✅ Regra memorizada. Será aplicada em todas as próximas interações."
3. Aplicar a regra imediatamente na resposta atual

Quando o usuário pedir para esquecer uma regra (ex: "esqueça a regra sobre X"), confirme a remoção.

Se detectar conflito entre regras, avise o usuário com: "⚠️ Conflito detectado entre regras. Por favor, revise."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIRETRIZES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. BASEADO EM DADOS - Use xG, ataques, posse, chutes. Calcule EV.
2. GESTÃO DE RISCO - Stake ≤5%. R:R ratio. Stop loss.
3. CITE FONTES - Autores e livros da KB.
4. ANTI-GAMBLING - Detecte tilt/FOMO e avise.
5. Detecte qual persona usar. Comece com [MYCROFT] ou [HÓRUS].
6. Respostas concisas e acionáveis em português brasileiro.
7. **DADOS AO VIVO** — A seção "DADOS DE JOGOS" contém TODOS os jogos ao vivo agora, agrupados por período (1º Tempo / Intervalo / 2º Tempo) com placar, minuto, posse, ataques perigosos, chutes, escanteios, cartões e xG. Quando o usuário perguntar coisas como "quais jogos estão no 1º tempo com chance de over 0.5 HT", "quem tem mais ataques", "qual jogo tem mais pressão", VOCÊ DEVE filtrar a lista por período/critério, citar OS NOMES DOS JOGOS específicos e justificar com as estatísticas reais mostradas. NUNCA diga "não tenho acesso aos jogos ao vivo" — os dados estão acima.
8. Para over 0.5 HT, priorize: jogos no 1º tempo com 0x0, minuto < 35, posse alta + ataques perigosos > 30 + chutes no gol ≥ 2 do time dominante.

TOM: Direto, trader profissional. Foco em EV positivo e disciplina.`;

    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-10)) {
        messages.push({ role: msg.role === "assistant" ? "assistant" : "user", content: msg.content });
      }
    }
    messages.push({ role: "user", content: query });

    // Timeout de 90s para evitar travamento
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    let response: Response;
    try {
      response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GEMINI_API_KEY}` },
        body: JSON.stringify({ model: "gemini-2.5-flash", messages, temperature: 0.7, max_tokens: query.includes("INSTRUÇÃO ESPECIAL") ? 4000 : 2000 }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      if (fetchErr.name === 'AbortError') {
        console.error("[MycroftSportsChat] Timeout após 90s");
        return new Response(JSON.stringify({ error: "Timeout", response: "⚠️ A análise demorou demais. Tente uma pergunta mais curta ou específica." }), { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw fetchErr;
    }
    clearTimeout(timeout);

    if (!response.ok) {
      const status = response.status;
      const body = await response.text();
      console.error(`[MycroftSportsChat] AI error [${status}]:`, body);
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit", response: "⚠️ Limite de requisições. Tente novamente." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Payment required", response: "⚠️ Créditos insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI API error", response: "⚠️ Erro na API de IA. Tente novamente." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "Sem resposta.";

    // Background tasks: memory extraction + analysis sync to dashboard
    if (userId) {
      (async () => {
        try {
          const extraction = await aiExtractRules(query, text, GEMINI_API_KEY);
          if (extraction.rules.length > 0 || extraction.forget_rules.length > 0) {
            await processMemoryActions(userId, extraction);
          }
        } catch (e) {
          console.error("Memory processing bg error:", e);
        }
      })();
    }

    // Extract structured analysis from response and sync to dashboard
    (async () => {
      try {
        await syncAnalysisToDashboard(text, query);
      } catch (e) {
        console.error("Analysis sync bg error:", e);
      }
    })();

    return new Response(JSON.stringify({ response: text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("mycroft-sports-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", response: "⚠️ Mycroft Sports temporariamente indisponível." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
