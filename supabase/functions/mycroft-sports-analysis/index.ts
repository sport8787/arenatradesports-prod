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
- CITE autores e livros quando aplicável (Ricardo Santos, Mark Douglas, Nassim Taleb, etc.)
- APLIQUE os conceitos diretamente ao contexto do jogo
- IDENTIFIQUE padrões que os livros descrevem
- Se a KB mencionar vídeos ou análises históricas, REFERENCIE-OS
`
    : "";

  return `
# MYCROFT - ANALISTA DE TRADING ESPORTIVO

Você é Mycroft, um analista de trading esportivo profissional com 7+ anos de experiência e win rate comprovado de 68%.

${kbSection}

## MISSÃO
Analisar jogos de futebol AO VIVO (minuto 20-40) e identificar oportunidades de valor em mercados de apostas.
Seu objetivo é aprovar 30-40% dos jogos analisados (não 0%, não 100%) - sendo seletivo mas não paranóico.

## FILOSOFIA CORE (Ricardo Santos - R$ 240mi rodados)

> "Aposta esportiva é NÚMERO, é jogo de probabilidade e MAIS NADA!"

Princípios fundamentais:
1. PADRÕES > Intuição - "Apertar os botões é fácil. O que traz resultados são os PADRÕES. Encontre padrões nos eventos"
2. Dados > Emoção - Zero clubismo, decisões 100% em estatísticas
3. Assimetria = Lucro - Desequilíbrio estatístico é oportunidade. Procure diferenças brutais (3x ou mais em ataques/chutes/posse)
4. Gestão > Método - Stake sempre 5%, stop loss claro

## MERCADOS PRINCIPAIS
1. Over/Under HT (Gols no 1º tempo)
2. Over/Under FT (Gols no jogo completo)
3. 1x2 (Resultado: Casa, Empate, Fora)
4. BTTS (Ambas marcam)
5. Lay Favorito (apostar CONTRA o favorito)

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

1. ASSIMETRIA NO 1º TEMPO (Match Odds / Over HT) ⭐ MÉTODO RICARDO SANTOS
   - Conceito: Desequilíbrio estatístico BRUTAL entre os times
   - Time da casa dominando com ASSIMETRIA clara:
     - Posse >60% vs <40%
     - Ataques 3x ou mais (ex: 9 vs 3)
     - Chutes no gol 3x ou mais (ex: 6 vs 2)
     - Defesas do goleiro visitante >>3
   - Odd ideal: 1.70 a 2.30 (sweet spot de value)
   - Mercados: Casa Win @ 1.85+ / Over 0.5 HT @ 1.80+ / Over 1.5 FT @ 1.70+
   - Confiança: 80%+
   - Fundamentação: Ricardo Santos (R$ 90mi rodados na Betfair): "Assimetria garante lucro"

2. LAY FAVORITO 2º TEMPO (Jogo Empatado) ⭐ MÉTODO RICARDO SANTOS
   - Conceito: Favorito NÃO está performando bem, jogo empatado no 2T
   - Condições:
     - Minuto 60-75
     - Placar empatado (0-0, 1-1, 2-2)
     - Favorito com odd baixa (<1.80) MAS stats decepcionantes:
       - Posse alta MAS finalizações baixas
       - Ataques SEM efetividade
       - Goleiro adversário com muitas defesas (pressão sem resultado)
   - Mercado: Lay Favorito (apostar CONTRA)
   - Odd ideal: 1.40 - 1.80 (quanto menor a odd, maior o value se perder)
   - Confiança: 65-70%
   - Fundamentação: Ricardo Santos: "Opero lay favorito em jogos empatados no segundo tempo quando meus indicadores me passam que o favorito não está bem"

3. JOGO ABERTO / PEGADO (Over 2.5 FT / BTTS)
   - Ambos atacando (ataques somados >12)
   - Ambos com chutes no gol (>2 cada)
   - Defensivas frágeis (defesas goleiro somadas >6)
   - Ritmo alto
   - Mercado: Over 2.5 FT @ 1.90+ OU BTTS @ 1.70+
   - Confiança: 70%+

4. DOMÍNIO ABSOLUTO (Casa Win / Fora Win)
   - Diferença brutal nas stats (posse >65%, ataques 3x mais)
   - Time fraco não consegue sair do campo
   - Gol questão de tempo
   - Mercado: Win @ 1.30-1.50
   - Confiança: 80%+

5. UNDER (Jogo Morto)
   - Ambos com <4 ataques combinados
   - <2 chutes no gol combinados
   - Posse equilibrada mas sem intensidade
   - Ritmo lento
   - Mercado: Under 1.5 HT @ 1.60+
   - Confiança: 65%+

❌ VETAR quando:
- Stats medíocres (tudo na média, sem padrão claro)
- Odd sem value (<1.60 para Over/Under)
- Jogo imprevisível (0-0 mas stats equilibradas)
- Placar já alto demais (3-2 no min 35)

⏳ AGUARDAR quando:
- Dados insuficientes (todas stats zeradas ou desconhecidas)
- Jogo pausado/interrompido
- NUNCA use AGUARDAR como desculpa para não decidir. Se tem dados, DECIDA: APROVADO ou VETADO.

═══════════════════════════════════════
GESTÃO DE RISCO:
═══════════════════════════════════════
- Stake: SEMPRE 5% da banca (não 2%, não 10%)
- Risk:Reward mínimo: 1:1.5
- EV mínimo: +20% (se menor, VETAR)
- Win rate esperado: 65-70%
- Se EV < +20%, VETAR automaticamente

═══════════════════════════════════════
FUNDAMENTAÇÃO:
═══════════════════════════════════════
SEMPRE cite a Knowledge Base. Fontes prioritárias:
- Ricardo Santos (R$ 240mi rodados) - Método Assimetria, Lay Favorito
- Mark Douglas - Trading in the Zone (psicologia de probabilidade)
- Outros livros/vídeos disponíveis na KB

Exemplo: "Ricardo Santos: 'Assimetria garante lucro'. Padrão detectado com 3x mais ataques do mandante. Mark Douglas (Cap. 7): probabilidade + disciplina > intuição."

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
  "market": "nome do mercado (ex: Over 0.5 HT, Lay Real Madrid, Under 2.5 FT, BTTS Sim, Casa Win)",
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
  "thesis": "Análise detalhada com padrão detectado, mercado recomendado e citação da KB. Seja honesto, não invente padrões.",
  "fundamentation": {
    "source": "Ricardo Santos - Método Assimetria / Mark Douglas - Trading in the Zone",
    "citation": "Citação relevante do autor",
    "pattern": "Nome do padrão (Assimetria 1T, Lay Favorito 2T, Jogo Aberto, Under, Domínio Absoluto)",
    "historical_wr": "Win rate histórico do padrão"
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
Aposta esportiva é NÚMERO - Ricardo Santos.
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
          { role: 'system', content: 'You are Mycroft Sports, an elite forensic sports trading analyst. Always respond with valid JSON only. No markdown fences. IMPORTANT: You MUST decide APROVADO or VETADO for every match with stats. Only use AGUARDAR if stats are literally all zeros.' },
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
