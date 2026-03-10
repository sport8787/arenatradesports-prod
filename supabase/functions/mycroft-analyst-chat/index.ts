import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabaseAdmin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function loadMemories(userId: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  try {
    const { data } = await supabase
      .from("mycroft_memory")
      .select("instruction, category, created_at")
      .eq("user_id", userId)
      .eq("mycroft_type", "analyst")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(50);
    if (!data || data.length === 0) return "";
    const lines = data.map((m: any, i: number) => `${i + 1}. [${m.category}] ${m.instruction}`);
    return `\n━━━ MEMÓRIA PERSISTENTE DO USUÁRIO (${data.length} regras) ━━━\nEstas são instruções que o usuário definiu anteriormente. Você DEVE respeitá-las em TODAS as interações:\n${lines.join("\n")}\n━━━ FIM DA MEMÓRIA ━━━\n`;
  } catch (e) {
    console.error("Memory loading error:", e);
    return "";
  }
}

async function detectAndSaveMemory(userId: string, query: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const instructionPatterns = [
    /nunca\s+(?:mais\s+)?(?:faça|faz|sugira|recomende|aprove)/i,
    /sempre\s+(?:priorize|faça|considere|lembre|use)/i,
    /a\s+partir\s+de\s+agora/i,
    /regra:\s*/i,
    /(?:isso|isto)\s+(?:jamais|nunca)\s+pode\s+acontecer/i,
    /(?:não|nao)\s+(?:quero|aceito)\s+(?:mais|que)/i,
    /(?:lembre|memorize|grave|salve)\s+(?:que|isso|isto|esta regra)/i,
    /(?:minha|nova)\s+(?:regra|diretriz|instrução)/i,
    /(?:deve|deveria)\s+sempre/i,
  ];
  if (!instructionPatterns.some(p => p.test(query))) return;

  let category = "rule";
  const lq = query.toLowerCase();
  if (/gestão|banca|stake|risk|risco|stop/i.test(lq)) category = "risk_management";
  else if (/indicador|sma|rsi|bollinger|timeframe/i.test(lq)) category = "indicator_preference";
  else if (/confluência|setup|entrada/i.test(lq)) category = "analysis_rule";
  else if (/tom|estilo|formato|respond/i.test(lq)) category = "style";

  try {
    await supabase.from("mycroft_memory").insert({
      user_id: userId,
      mycroft_type: "analyst",
      instruction: query.substring(0, 2000),
      category,
    });
    console.log(`🧠 Analyst memory saved: [${category}] ${query.substring(0, 100)}...`);
  } catch (e) {
    console.error("Memory save error:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, marketData, conversationHistory, userId } = await req.json();
    if (!query) throw new Error("Missing query");

    const ANTHROPIC_API_KEY = Deno.env.get("VITE_ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC API KEY not configured");

    const supabase = getSupabaseAdmin();

    // Load KB and memory in parallel
    const [knowledgeBaseContent, memoryContent] = await Promise.all([
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
      userId ? loadMemories(userId) : Promise.resolve(""),
    ]);

    let marketContext = "";
    if (marketData) {
      marketContext = `━━━ DADOS DE MERCADO ━━━\nAtivo: ${marketData.asset || "N/A"} (${marketData.symbol || "N/A"})\nTimeframe: ${marketData.timeframe || "N/A"}\nPreço: ${marketData.price?.toLocaleString() || "N/A"}\nSMA 9: ${marketData.sma9 ?? "N/A"} | SMA 21: ${marketData.sma21 ?? "N/A"}\nRSI: ${marketData.rsi ?? "N/A"}\nBollinger: ${marketData.bollingerUpper ?? "N/A"} / ${marketData.bollingerLower ?? "N/A"}\nVolume: ${marketData.volume ?? "N/A"} | Var 24h: ${marketData.change24h?.toFixed(2) ?? "N/A"}%\nModo: ${marketData.isLive ? "LIVE" : "SIMULADO"}\n━━━━━━━━━━━━━━━━━━━━━`;
    }

    const systemPrompt = `━━━ IDENTIDADE ━━━
Você é MYCROFT TRADER, IA especializada em análise técnica profissional de mercados financeiros. Perito forense — técnico, preciso, frio e calculista.

${memoryContent}

━━━ BASE DE CONHECIMENTO ━━━
Livros de referência: Japanese Candlestick Charting (Nison), Trading in the Zone (Douglas), Reminiscences of a Stock Operator (Livermore).
${knowledgeBaseContent ? `━━━ DOCUMENTOS ━━━\n${knowledgeBaseContent}\n━━━ FIM ━━━` : "Nenhum documento carregado. Use conhecimento geral dos livros."}

${marketContext}

━━━ MEMÓRIA PERSISTENTE ━━━
Quando o usuário der uma instrução permanente (ex: "nunca mais faça X", "sempre priorize Y"), você DEVE:
1. Confirmar: "✅ Regra memorizada. Será aplicada em todas as próximas interações."
2. Aplicar imediatamente.

━━━ DIRETRIZES OBRIGATÓRIAS ━━━
1. TIMEFRAME É CRÍTICO - 1min ≠ 15min ≠ 1h ≠ 1d
2. CONFLUÊNCIA ≥ 3 fatores (score 0-10)
3. R:R ≥ 1:1.5 obrigatório
4. CITE FONTES dos livros
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

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000, system: systemPrompt, messages, temperature: 0.6 }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text?.trim();

    // Save memory in background
    if (userId) {
      detectAndSaveMemory(userId, query).catch(e => console.error("Memory save bg error:", e));
    }

    return new Response(JSON.stringify({ response: content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Mycroft Analyst Chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", response: "⚠️ Mycroft Analyst temporariamente indisponível." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
