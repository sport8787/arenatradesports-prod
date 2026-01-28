// Claude Jury Edge Function - AI Jury powered by Claude Sonnet 4
// Calls Claude API server-side to keep API key secure
// Each juror has a distinct personality and voting logic

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Types
type JurorProfile = "conservador" | "agressivo" | "neutro";
type VoteDecision = "CLARO" | "BLEFE";

interface JuryVoteRequest {
  question: string;
  playerAnswer: string;
  correctAnswer: string;
  transcription: string;
  mycroftAnalysis: {
    stressScore: number;
    microExpressions: string[];
    gazeDeviation: string;
    vocalHesitation: number;
    confidenceTone: string;
    vocalJitter: number;
    facialTension: number;
    combinedScore: number;
    // NEW: Speech fluency metrics (FREE)
    silentPeriods?: number;
    longestPause?: number;
    fillerWordsCount?: number;
    speechContinuity?: number;
  };
}

interface JuryVote {
  juror: string;
  profile: JurorProfile;
  vote: VoteDecision;
  confidence: number;
  reasoning: string;
  processingTimeMs?: number;
}

interface JuryVerdict {
  votes: JuryVote[];
  convicted: boolean;
  unanimous: boolean;
  totalProcessingTimeMs: number;
  costEstimate: number;
}

// Config
const ANTHROPIC_CONFIG = {
  model: "claude-sonnet-4-20250514",
  maxTokens: 300,
  temperature: 0.7,
};

const JUROR_NAMES: Record<JurorProfile, string> = {
  conservador: "O Prudente",
  agressivo: "O Tubarão",
  neutro: "O Quant",
};

// Juror personality prompts
const JUROR_PROFILES: Record<JurorProfile, string> = {
  conservador: `
Você é **O Prudente**, um jurado CONSERVADOR especializado em análise forense.

**Sua Filosofia:**
- "Dúvida razoável beneficia o réu, mas dados não mentem."
- Você valoriza EVIDÊNCIAS CONCRETAS e COERÊNCIA LÓGICA
- Você desconfia de respostas com alto stress ou inconsistências
- Você vota BLEFE se detectar sinais de nervosismo excessivo ou contradições
- Você vota CLARO apenas se CONVENCIDO por lógica sólida + baixo stress biométrico

**Critérios de Decisão:**
- Stress Score > 70 = SUSPEITO (a menos que resposta seja obviamente correta)
- Micro-expressões de MEDO ou RAIVA = RED FLAG
- Desvio de olhar significativo = DESCONFIANÇA
- Hesitações vocais (>3) = IMPROVISO
- Jitter vocal alto (>2.0) = INSTABILIDADE

**Perfil de Risco:** BAIXA TOLERÂNCIA a blefes.
Você prefere flagrar 10 inocentes do que deixar 1 mentiroso passar.
  `.trim(),

  agressivo: `
Você é **O Tubarão**, um jurado AGRESSIVO que valoriza CORAGEM e CONVICÇÃO.

**Sua Filosofia:**
- "Se você acertou, defenda. Se você errou, assuma."
- Você valoriza CONVICÇÃO e DETERMINAÇÃO na resposta
- Você IGNORA stress moderado se a justificativa for forte
- Você vota BLEFE apenas se houver CONTRADIÇÃO ÓBVIA ou colapso total
- Você vota CLARO se perceber confiança e consistência narrativa

**Critérios de Decisão:**
- Resposta CORRETA + stress < 80 = PROVAVELMENTE CLARO
- Resposta ERRADA = analise justificativa (pode ter sido lapso mental)
- Micro-expressões de SURPRESA = pode ser genuína descoberta
- Hesitações vocais moderadas (2-3) = NORMAL sob pressão
- Jitter alto mas narrativa coerente = nervosismo situacional (não blefe)

**Perfil de Risco:** ALTA TOLERÂNCIA a sinais de stress.
Você acredita que nervosismo ≠ mentira. Pressão é natural.
  `.trim(),

  neutro: `
Você é **O Quant**, um jurado NEUTRO que analisa OBJETIVAMENTE os dados.

**Sua Filosofia:**
- "Números não têm emoção. Eu também não."
- Você considera stress score, micro-expressões, desvio de olhar e lógica IGUALMENTE
- Você usa um MODELO BAYESIANO mental para calcular probabilidade de blefe
- Você vota BLEFE se dados apontarem >60% probabilidade de mentira
- Você vota CLARO se dados apontarem <40% probabilidade de mentira
- Entre 40-60% você decide por CONTEXTO (dificuldade da pergunta)

**Critérios de Decisão (Modelo):**
- Base Rate (resposta correta): -20 pontos suspicion
- Base Rate (resposta errada): +30 pontos suspicion
- Stress Score > 60: +15 pontos
- Micro-expressões (cada): +10 pontos
- Desvio de olhar: +15 pontos
- Hesitações vocais: +5 pontos cada
- Jitter alto (>2.0): +20 pontos
- TOTAL > 60 = BLEFE | TOTAL < 40 = CLARO

**Perfil de Risco:** ANALÍTICO, segue os dados rigorosamente.
Você não tem "intuição", apenas matemática.
  `.trim(),
};

function buildJuryPrompt(request: JuryVoteRequest, jurorProfile: JurorProfile): string {
  const profile = JUROR_PROFILES[jurorProfile];
  const isCorrect = request.playerAnswer === request.correctAnswer;
  
  const microExpDisplay = request.mycroftAnalysis.microExpressions.length > 0
    ? request.mycroftAnalysis.microExpressions.join(", ")
    : "Nenhuma detectada";
  
  return `
${profile}

═══════════════════════════════════════════════════════
CONTEXTO DA RODADA:
═══════════════════════════════════════════════════════

**Pergunta:** "${request.question}"
**Resposta do Jogador:** "${request.playerAnswer}"
**Resposta Correta:** "${request.correctAnswer}"
**A resposta está CORRETA?** ${isCorrect ? "✅ SIM" : "❌ NÃO"}

═══════════════════════════════════════════════════════
JUSTIFICATIVA DO JOGADOR (áudio transcrito):
═══════════════════════════════════════════════════════

"${request.transcription}"

═══════════════════════════════════════════════════════
ANÁLISE MYCROFT 2.0 (Biometria Forense):
═══════════════════════════════════════════════════════

📊 **Stress Score Combinado:** ${request.mycroftAnalysis.stressScore}/100
   ${request.mycroftAnalysis.stressScore > 70 ? '⚠️ ALTO' : request.mycroftAnalysis.stressScore > 40 ? '🟡 MODERADO' : '🟢 BAIXO'}

😐 **Micro-expressões Faciais:** ${microExpDisplay}
   ${request.mycroftAnalysis.microExpressions.length > 2 ? '⚠️ MÚLTIPLAS' : request.mycroftAnalysis.microExpressions.length > 0 ? '🟡 PRESENTE' : '🟢 NENHUMA'}

👁️ **Desvio do Olhar:** ${request.mycroftAnalysis.gazeDeviation}
   ${request.mycroftAnalysis.gazeDeviation !== 'straight' ? '⚠️ DESVIADO' : '🟢 DIRETO'}

🎙️ **Hesitações Vocais:** ${request.mycroftAnalysis.vocalHesitation}x
   ${request.mycroftAnalysis.vocalHesitation > 3 ? '⚠️ EXCESSIVAS' : request.mycroftAnalysis.vocalHesitation > 1 ? '🟡 MODERADAS' : '🟢 MÍNIMAS'}

🔊 **Tom de Confiança:** ${request.mycroftAnalysis.confidenceTone}
   ${request.mycroftAnalysis.confidenceTone === 'low' ? '⚠️ BAIXO' : request.mycroftAnalysis.confidenceTone === 'medium' ? '🟡 MÉDIO' : '🟢 ALTO'}

📈 **Jitter Vocal:** ${request.mycroftAnalysis.vocalJitter.toFixed(2)}%
   ${request.mycroftAnalysis.vocalJitter > 2.0 ? '⚠️ INSTÁVEL' : request.mycroftAnalysis.vocalJitter > 1.0 ? '🟡 MODERADO' : '🟢 ESTÁVEL'}

😬 **Tensão Facial:** ${request.mycroftAnalysis.facialTension}/100
   ${request.mycroftAnalysis.facialTension > 60 ? '⚠️ ALTA' : request.mycroftAnalysis.facialTension > 30 ? '🟡 MODERADA' : '🟢 BAIXA'}

🎤 **Fluência da Fala (métricas gratuitas):**
   - Pausas longas (>1s): ${request.mycroftAnalysis.silentPeriods ?? 0}x ${(request.mycroftAnalysis.silentPeriods ?? 0) > 2 ? '⚠️ MUITAS' : (request.mycroftAnalysis.silentPeriods ?? 0) > 0 ? '🟡 ALGUMAS' : '🟢 NENHUMA'}
   - Maior pausa: ${((request.mycroftAnalysis.longestPause ?? 0) / 1000).toFixed(1)}s
   - Hesitações ("uhm/ahh"): ${request.mycroftAnalysis.fillerWordsCount ?? 0}x ${(request.mycroftAnalysis.fillerWordsCount ?? 0) > 3 ? '⚠️ EXCESSIVAS' : (request.mycroftAnalysis.fillerWordsCount ?? 0) > 1 ? '🟡 MODERADAS' : '🟢 MÍNIMAS'}
   - Score de fluência: ${request.mycroftAnalysis.speechContinuity ?? 80}/100 ${(request.mycroftAnalysis.speechContinuity ?? 80) < 50 ? '⚠️ BAIXA' : (request.mycroftAnalysis.speechContinuity ?? 80) < 70 ? '🟡 MODERADA' : '🟢 ALTA'}

🎯 **Score Final Mycroft:** ${request.mycroftAnalysis.combinedScore}/100
   ${request.mycroftAnalysis.combinedScore > 65 ? '🔴 ZONA BLEFE' : request.mycroftAnalysis.combinedScore > 35 ? '🟡 ZONA MISTA' : '🟢 ZONA VERDADE'}

═══════════════════════════════════════════════════════
SUA TAREFA:
═══════════════════════════════════════════════════════

Analise todos os dados acima considerando SEU perfil (${jurorProfile.toUpperCase()}) e responda:

1. **A resposta está tecnicamente CORRETA?** ${isCorrect ? "SIM" : "NÃO"}
2. **A justificativa é COERENTE com a resposta?**
3. **Os dados biométricos indicam VERDADE ou BLEFE?**
4. **Considerando SEU perfil de jurado, você ACREDITA no jogador?**

**IMPORTANTE:**
- Se você é CONSERVADOR: seja rigoroso, desconfie de stress alto
- Se você é AGRESSIVO: seja generoso, valorize convicção
- Se você é NEUTRO: seja matemático, calcule probabilidades

═══════════════════════════════════════════════════════
FORMATO DE RESPOSTA (OBRIGATÓRIO):
═══════════════════════════════════════════════════════

Responda APENAS com um objeto JSON válido (sem markdown, sem explicações):

{
  "voto": "CLARO" ou "BLEFE",
  "confianca": 0-100,
  "razao": "Uma frase curta (máx 120 chars) explicando seu voto"
}

**Exemplo válido:**
{\"voto\": \"BLEFE\", \"confianca\": 75, \"razao\": \"Stress alto (85/100) com 3 micro-expressões de medo apesar da resposta correta.\"}

Agora vote com base em SEUS critérios de ${jurorProfile.toUpperCase()}.
  `.trim();
}

function parseClaudeResponse(
  response: string,
  profile: JurorProfile,
  processingTime: number
): JuryVote {
  try {
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    
    if (!parsed.voto || parsed.confianca === undefined || !parsed.razao) {
      throw new Error('Missing required fields');
    }
    
    if (parsed.voto !== 'CLARO' && parsed.voto !== 'BLEFE') {
      throw new Error('Invalid vote decision');
    }
    
    return {
      juror: JUROR_NAMES[profile],
      profile,
      vote: parsed.voto as VoteDecision,
      confidence: Math.min(100, Math.max(0, parsed.confianca)),
      reasoning: String(parsed.razao).substring(0, 200),
      processingTimeMs: processingTime,
    };
  } catch (error) {
    console.error('[ClaudeJury] Error parsing response:', error);
    console.error('[ClaudeJury] Raw response:', response);
    
    return {
      juror: JUROR_NAMES[profile],
      profile,
      vote: Math.random() > 0.5 ? 'CLARO' : 'BLEFE',
      confidence: 50,
      reasoning: 'Análise indisponível (fallback)',
      processingTimeMs: processingTime,
    };
  }
}

async function getJurorVote(
  request: JuryVoteRequest,
  jurorProfile: JurorProfile,
  apiKey: string
): Promise<JuryVote> {
  const startTime = Date.now();
  
  try {
    const prompt = buildJuryPrompt(request, jurorProfile);
    
    console.log(`[ClaudeJury] Calling ${jurorProfile} juror...`);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_CONFIG.model,
        max_tokens: ANTHROPIC_CONFIG.maxTokens,
        temperature: ANTHROPIC_CONFIG.temperature,
        messages: [{
          role: "user",
          content: prompt,
        }],
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ClaudeJury] API error ${response.status}:`, errorText);
      throw new Error(`Claude API error: ${response.status}`);
    }
    
    const data = await response.json();
    const processingTime = Date.now() - startTime;
    
    const responseText = data.content
      ?.filter((block: any) => block.type === 'text')
      ?.map((block: any) => block.text)
      ?.join('\n') || '';
    
    console.log(`[ClaudeJury] ${jurorProfile} responded in ${processingTime}ms`);
    
    return parseClaudeResponse(responseText, jurorProfile, processingTime);
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[ClaudeJury] Error getting ${jurorProfile} vote:`, error);
    
    return {
      juror: JUROR_NAMES[jurorProfile],
      profile: jurorProfile,
      vote: Math.random() > 0.5 ? 'CLARO' : 'BLEFE',
      confidence: 50,
      reasoning: 'Erro na API (fallback aleatório)',
      processingTimeMs: processingTime,
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const apiKey = Deno.env.get('VITE_ANTHROPIC_API_KEY');
    
    if (!apiKey) {
      console.error('[ClaudeJury] ANTHROPIC_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const body = await req.json();
    const { type, request } = body;
    
    if (type === 'validate') {
      // Simple validation - just check if key starts with sk-ant-
      const isValid = apiKey.startsWith('sk-ant-') && apiKey.length > 20;
      return new Response(
        JSON.stringify({ valid: isValid }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (type === 'verdict') {
      const startTime = Date.now();
      
      console.log('[ClaudeJury] ═══════════════════════════════════════');
      console.log('[ClaudeJury] Starting jury deliberation...');
      console.log('[ClaudeJury] Question:', request.question);
      console.log('[ClaudeJury] Mycroft Score:', request.mycroftAnalysis?.combinedScore);
      console.log('[ClaudeJury] ═══════════════════════════════════════');
      
      // Call all 3 jurors in parallel
      const [voteConservador, voteAgressivo, voteNeutro] = await Promise.all([
        getJurorVote(request, 'conservador', apiKey),
        getJurorVote(request, 'agressivo', apiKey),
        getJurorVote(request, 'neutro', apiKey),
      ]);
      
      const votes = [voteConservador, voteAgressivo, voteNeutro];
      const totalProcessingTimeMs = Date.now() - startTime;
      
      // Calculate verdict
      const claroCount = votes.filter(v => v.vote === 'CLARO').length;
      const convicted = claroCount >= 2;
      const unanimous = claroCount === 0 || claroCount === 3;
      
      // Estimate cost (Claude Sonnet 4 pricing)
      const estimatedCost = 3 * 0.015 * 5.5; // ~R$0.25 per call
      
      console.log('[ClaudeJury] ═══════════════════════════════════════');
      console.log('[ClaudeJury] VERDICT:');
      votes.forEach(v => {
        console.log(`[ClaudeJury]   ${v.juror}: ${v.vote} (${v.confidence}%)`);
      });
      console.log(`[ClaudeJury] Result: ${convicted ? '✅ CLEARED' : '❌ CAUGHT'} (${claroCount}/3 CLARO)`);
      console.log(`[ClaudeJury] Total time: ${totalProcessingTimeMs}ms`);
      console.log('[ClaudeJury] ═══════════════════════════════════════');
      
      const verdict: JuryVerdict = {
        votes,
        convicted,
        unanimous,
        totalProcessingTimeMs,
        costEstimate: Math.round(estimatedCost * 100) / 100,
      };
      
      return new Response(
        JSON.stringify(verdict),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Invalid request type' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[ClaudeJury] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
