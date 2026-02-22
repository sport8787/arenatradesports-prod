import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface MatchData {
  home: string;
  away: string;
  scoreHome: number;
  scoreAway: number;
  minute: number;
  period: string;
  championship: string;
  match_id?: string;
  stats?: {
    attacks_home?: number;
    attacks_away?: number;
    xG_home?: number;
    xG_away?: number;
    possession_home?: number;
    possession_away?: number;
    shots_home?: number;
    shots_away?: number;
  };
  bankroll?: number;
}

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

function buildPrompt(match: MatchData, knowledgeBase: string): string {
  const stats = match.stats || {};
  
  const kbSection = knowledgeBase
    ? `
═══════════════════════════════════════
BASE DE CONHECIMENTO (KB):
═══════════════════════════════════════
${knowledgeBase}
═══════════════════════════════════════
FIM DA KB
═══════════════════════════════════════

INSTRUÇÃO CRÍTICA: Fundamente TODA análise nos conceitos dos documentos acima.
- CITE autores e livros quando aplicável
- APLIQUE os conceitos diretamente ao contexto do jogo
- IDENTIFIQUE padrões que os livros descrevem
`
    : "";

  return `
Você é o MYCROFT, um analista forense esportivo de elite para trading esportivo ao vivo.

${kbSection}

Analise o jogo abaixo e forneça um veredito completo para o trader.

═══════════════════════════════════════
JOGO AO VIVO:
═══════════════════════════════════════
${match.championship}
${match.home} ${match.scoreHome} x ${match.scoreAway} ${match.away}
Minuto: ${match.minute}' | ${match.period}

═══════════════════════════════════════
ESTATÍSTICAS (últimos 5 min):
═══════════════════════════════════════
Ataques perigosos: ${stats.attacks_home ?? '?'} vs ${stats.attacks_away ?? '?'}
xG: ${stats.xG_home ?? '?'} vs ${stats.xG_away ?? '?'}
Posse: ${stats.possession_home ?? '?'}% vs ${stats.possession_away ?? '?'}%
Chutes ao gol: ${stats.shots_home ?? '?'} vs ${stats.shots_away ?? '?'}

Banca do trader: R$ ${match.bankroll ?? 500}

═══════════════════════════════════════
SUA TAREFA:
═══════════════════════════════════════

Analise o contexto e responda APENAS com um JSON válido (sem markdown, sem explicações fora do JSON):

{
  "verdict": "APROVADO" | "VETADO" | "AGUARDAR",
  "market": "nome do mercado recomendado (ex: Over 0.5 HT, Under 2.5, etc)",
  "odd": 1.50,
  "confidence": 0-100,
  "stats": {
    "attacks_home": ${stats.attacks_home ?? 5},
    "attacks_away": ${stats.attacks_away ?? 3},
    "xG_home": ${stats.xG_home ?? 0.8},
    "xG_away": ${stats.xG_away ?? 0.4},
    "possession_home": ${stats.possession_home ?? 55},
    "possession_away": ${stats.possession_away ?? 45},
    "shots_home": ${stats.shots_home ?? 3},
    "shots_away": ${stats.shots_away ?? 2}
  },
  "thesis": "Explicação detalhada da sua análise (3-5 parágrafos). Inclua: padrão detectado, referência a conceitos da KB ou de trading esportivo, gestão emocional, e citação de autores como Mark Douglas, Nassim Taleb ou conceitos de probabilidade. Fundamente nos documentos da KB quando disponíveis.",
  "risk": {
    "stake_percent": 1-5,
    "stake_value": valor em reais baseado na banca,
    "entry": "descrição da entrada (ex: Over 0.5 HT @ 1.95)",
    "stop": "critério de stop (ex: Sem gol em 15 min)",
    "target": "alvo (ex: Gol antes do intervalo)",
    "rr": "risk:reward ratio (ex: 1:1.95)",
    "ev": "expected value estimado (ex: +35%)"
  },
  "alerts": ["Lista de alertas e riscos identificados"]
}

REGRAS:
- Se o jogo está nos primeiros 10 min, prefira "AGUARDAR"
- Se não há pressão clara de nenhum time, dê "VETADO"
- Confidence deve refletir a qualidade dos dados disponíveis
- Stake nunca deve ser > 5% da banca
- Seja conservador nas odds estimadas
- A thesis deve ser fundamentada e educativa
- Se a KB tiver material relevante, CITE-O na thesis
`.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[MycroftSports] LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { match } = await req.json() as { match: MatchData };
    if (!match) {
      return new Response(
        JSON.stringify({ error: 'Match data required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[MycroftSports] Analyzing: ${match.home} vs ${match.away} (${match.minute}')`);

    // Load KB
    const knowledgeBase = await loadKnowledgeBase();
    const prompt = buildPrompt(match, knowledgeBase);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are Mycroft Sports, an elite forensic sports trading analyst. Always respond with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MycroftSports] AI Gateway error ${response.status}:`, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `AI Gateway error: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || '';

    console.log('[MycroftSports] Raw response:', rawText.substring(0, 200));

    // Parse JSON from response
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(cleaned);

    console.log(`[MycroftSports] Verdict: ${analysis.verdict} | Confidence: ${analysis.confidence}%`);

    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[MycroftSports] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
