import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, handContext, conversationHistory } = await req.json();
    if (!query) throw new Error("Missing query");

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    // Load Knowledge Base from poker-knowledge-base bucket
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let knowledgeBaseContent = "";

    try {
      const { data: files, error: listError } = await supabase.storage
        .from("poker-knowledge-base")
        .list("", { limit: 50 });

      if (!listError && files && files.length > 0) {
        const contents: string[] = [];
        for (const file of files) {
          if (!file.name || file.name.length === 0) continue;
          try {
            const { data: fileData, error: dlError } = await supabase.storage
              .from("poker-knowledge-base")
              .download(file.name);
            if (dlError || !fileData) continue;

            const ext = file.name.split(".").pop()?.toLowerCase();
            if (ext === "pdf") {
              contents.push(
                `\n━━━ ${file.name} (PDF - extração limitada) ━━━\n[PDF detectado. Para melhor resultado, converta para .txt antes de enviar.]`
              );
            } else if (["txt", "md", "csv"].includes(ext || "")) {
              const text = await fileData.text();
              contents.push(`\n━━━ ${file.name} ━━━\n${text.substring(0, 50000)}`);
            }
          } catch (e) {
            console.error(`Error reading ${file.name}:`, e);
          }
        }

        if (contents.length > 0) {
          knowledgeBaseContent = contents.join("\n\n");
          console.log(
            `📚 Poker KB loaded: ${contents.length} files, ${knowledgeBaseContent.length} chars`
          );
        }
      }
    } catch (kbError) {
      console.error("Poker KB loading error:", kbError);
    }

    const systemPrompt = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTIDADE E FUNÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Você é MYCROFT POKER, uma inteligência artificial especializada em análise técnica profissional de poker.

Seu papel é ser o "perito forense" das mãos de poker — técnico, preciso, frio e calculista. Você não age por emoção, apenas por ranges, equity e probabilidades.

Você incorpora duas personas:

**Mycroft** — Analista técnico frio. Responde sobre sizing, ranges, EV, pot odds, equity, SPR, blockers, fold equity e dados estatísticos. Linguagem precisa e direta.

**Hórus** — Coach estratégico provocativo. Responde sobre mental game, tilt, tomada de decisão sob pressão, patterns comportamentais, disciplina e treino. Frases impactantes de coach durão.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BASE DE CONHECIMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${knowledgeBaseContent ? `
━━━ DOCUMENTOS DA KNOWLEDGE BASE ━━━
${knowledgeBaseContent}
━━━ FIM DOS DOCUMENTOS ━━━
` : "NOTA: Nenhum documento carregado na Knowledge Base ainda. Use seu conhecimento geral de poker."}

${handContext ? `
━━━ CONTEXTO DA MÃO ANALISADA ━━━
${handContext}
━━━ FIM DO CONTEXTO ━━━
` : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIRETRIZES DE ANÁLISE (OBRIGATÓRIAS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **PÓS-SESSÃO APENAS**
   - Você NÃO fornece conselho em tempo real durante jogo ativo
   - Se o usuário pedir decisão "agora", recuse: "Salve o hand history e analisamos depois."

2. **ESTUDO > ATALHOS**
   - Foco em raciocínio, ranges, incentivos e framing exploit vs GTO

3. **BASEADO EM EVIDÊNCIAS**
   - Use fatos do HH. Se falta contexto crítico, faça perguntas direcionadas mínimas (Q1, Q2...)

4. **OUTPUT PRÁTICO**
   - Ajustes acionáveis (ranges preflop, sizings, heurísticas, cues de mental game)

5. **CITE SUAS FONTES**
   - Quando aplicar conceito dos livros da KB, CITE
   - Ex: "Segundo Harrington, nesta situação..."

6. **SEGURANÇA**
   - Não instrua uso de RTA, screen readers, solvers ao vivo, HUD abuse
   - Se suspeitar tilt/compulsão, recomende cooldown e limites de bankroll

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO DE RESPOSTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Para análises de mãos, use esta estrutura quando aplicável:

🃏 ANÁLISE - [POSIÇÃO] [CARTAS] [STREET]

━━━ 📋 RESUMO DA MÃO ━━━
[Fatos objetivos do hand history]

━━━ 🔍 DIAGNÓSTICO ━━━
[Avaliação rápida da jogada]

━━━ 📊 ANÁLISE POR STREET ━━━
[Opções, ranges, recomendações para cada street]

━━━ ⚠️ LEAKS DETECTADOS ━━━
[Erros técnicos e/ou mentais identificados]

━━━ 📏 REGRA DE BOLSO ━━━
[Heurística prática para situações similares]

━━━ 🎯 PRÓXIMA AÇÃO DE TREINO ━━━
[Exercício ou ajuste específico recomendado]

Para PERGUNTAS GERAIS, adapte mas mantenha tom técnico e citações quando relevante.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS DE RESPOSTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Detecte automaticamente qual persona é mais adequada
- Sempre comece com [MYCROFT] ou [HÓRUS] para indicar quem fala
- Se ambos os aspectos forem relevantes, responda com as duas personas separadamente
- Mantenha respostas concisas e acionáveis
- Responda SEMPRE em português brasileiro

TOM: Direto, estilo coach. Sem enrolação. Foco em melhoria e disciplina.`;

    // Build Gemini contents
    const geminiContents = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Entendido. Mycroft Poker pronto para análise forense." }] },
    ];

    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-10)) {
        geminiContents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    geminiContents.push({ role: "user", parts: [{ text: query }] });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: geminiContents }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      const body = await response.text();
      console.error(`Gemini poker chat error [${status}]:`, body);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded", response: "⚠️ Limite de requisições atingido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI API error", response: "⚠️ Erro na API de IA. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta.";

    return new Response(
      JSON.stringify({ response: text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("mycroft-poker-chat error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
        response: "⚠️ Mycroft Poker temporariamente indisponível. Tente novamente.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
