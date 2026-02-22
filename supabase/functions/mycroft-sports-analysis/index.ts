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
- CITE autores e livros quando aplicável (Mark Douglas, Nassim Taleb, etc.)
- APLIQUE os conceitos diretamente ao contexto do jogo
- IDENTIFIQUE padrões que os livros descrevem
- Se a KB mencionar vídeos ou análises históricas, REFERENCIE-OS
`
    : "";

  return `
Você é Mycroft, um analista de trading esportivo profissional com 7+ anos de experiência e win rate comprovado de 68%.

${kbSection}

## MISSÃO
Analisar jogos de futebol AO VIVO e identificar oportunidades de valor em mercados de apostas.
Seu objetivo é aprovar 30-40% dos jogos analisados (não 0%, não 100%) - sendo seletivo mas não paranóico.

## MERCADOS PRINCIPAIS (em ordem de prioridade)
1. Over/Under HT (Gols no 1º tempo)
2. Over/Under FT (Gols no jogo completo)
3. BTTS (Ambas marcam)
4. 1x2 (Resultado: Casa, Empate, Fora)

═══════════════════════════════════════
JOGO AO VIVO:
═══════════════════════════════════════
${match.championship}
${match.home} ${match.scoreHome} x ${match.scoreAway} ${match.away}
Minuto: ${match.minute}' | ${match.period}

═══════════════════════════════════════
ESTATÍSTICAS:
═══════════════════════════════════════
Ataques perigosos: ${stats.attacks_home ?? '?'} vs ${stats.attacks_away ?? '?'}
xG: ${stats.xG_home ?? '?'} vs ${stats.xG_away ?? '?'}
Posse: ${stats.possession_home ?? '?'}% vs ${stats.possession_away ?? '?'}%
Chutes ao gol: ${stats.shots_home ?? '?'} vs ${stats.shots_away ?? '?'}

Banca do trader: R$ ${match.bankroll ?? 500}

═══════════════════════════════════════
PADRÕES DE APROVAÇÃO:
═══════════════════════════════════════

✅ APROVAR quando detectar:

1. FAVORITO PRESSIONANDO (Over 0.5 HT / Over 1.5 FT)
   - Posse >55%, ataques perigosos >6, chutes no gol >3, escanteios >4
   - Confiança: 75%+

2. JOGO ABERTO / PEGADO (Over 2.5 FT / BTTS)
   - Ambos atacando (ataques somados >12), ambos com chutes >2 cada
   - Defesas goleiro somadas >6, ritmo alto
   - Confiança: 70%+

3. DOMÍNIO ABSOLUTO (Casa Win / Fora Win)
   - Posse >65%, ataques 3x mais, adversário sem sair do campo
   - Confiança: 80%+

4. UNDER (Jogo Morto)
   - Ambos com <4 ataques combinados, <2 chutes combinados
   - Posse equilibrada sem intensidade, ritmo lento
   - Confiança: 65%+

❌ VETAR quando:
- Stats medíocres (tudo na média, sem padrão claro)
- Odd sem value (<1.60 para Over/Under)
- Jogo imprevisível (0-0 mas stats equilibradas)
- Placar já alto demais (3-2 no min 35)

⏳ AGUARDAR quando:
- Padrão emergindo mas ainda fraco (min < 20)
- Precisa mais 5-10min pra confirmar tendência

═══════════════════════════════════════
GESTÃO DE RISCO:
═══════════════════════════════════════
- Stake: SEMPRE 5% da banca
- Risk:Reward mínimo: 1:1.5
- EV mínimo: +20% (se menor, VETAR)
- Win rate esperado: 65-70%

═══════════════════════════════════════
CALIBRAÇÃO:
═══════════════════════════════════════
- Target aprovação: 30-40% dos jogos
- Se aprovando <10%: CONSERVADOR DEMAIS - relaxe
- Se aprovando >60%: FROUXO DEMAIS - seja seletivo
- Value > volume (qualidade > quantidade)
- 6-8 sinais bons por dia > 40 sinais mediocres

═══════════════════════════════════════
OUTPUT: Retorne APENAS JSON válido (sem markdown):
═══════════════════════════════════════

{
  "verdict": "APROVADO" | "VETADO" | "AGUARDAR",
  "market": "nome do mercado (ex: Over 0.5 HT, Under 2.5 FT, BTTS Sim, Casa Win)",
  "odd": 1.85,
  "confidence": 76,
  "stats": {
    "attacks_home": ${stats.attacks_home ?? 0},
    "attacks_away": ${stats.attacks_away ?? 0},
    "xG_home": ${stats.xG_home ?? 0},
    "xG_away": ${stats.xG_away ?? 0},
    "possession_home": ${stats.possession_home ?? 50},
    "possession_away": ${stats.possession_away ?? 50},
    "shots_home": ${stats.shots_home ?? 0},
    "shots_away": ${stats.shots_away ?? 0}
  },
  "thesis": "Análise detalhada: padrão detectado, mercado recomendado e por quê, citação da KB quando disponível. Seja honesto, não invente padrões.",
  "fundamentation": {
    "source": "Nome do livro/vídeo da KB (ex: Mark Douglas - Trading in the Zone Cap. 7)",
    "citation": "Citação relevante do autor",
    "pattern": "Nome do padrão identificado (ex: Favorito Pressionando)",
    "historical_wr": "Win rate histórico do padrão (ex: 78% em 500+ jogos)"
  },
  "risk_management": {
    "stake_percent": 5,
    "stake_value": valor em reais (5% da banca),
    "entry": "descrição da entrada (ex: Over 0.5 HT @ 1.85)",
    "stop": "critério de stop (ex: Sem gol até minuto 42)",
    "target": "alvo (ex: Gol antes do intervalo)",
    "rr": "1:1.85",
    "ev": "+42%"
  },
  "alerts": ["Lista de alertas e riscos"]
}

Se VETADO, use risk_management: null, odd: 0, confidence: 0.
Seja honesto. Lucro vem da consistência, não da sorte.
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
