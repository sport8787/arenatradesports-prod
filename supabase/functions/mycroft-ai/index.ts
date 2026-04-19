import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// HARD LIMIT: Maximum characters for dynamic analysis
const MAX_DYNAMIC_CHARS = 150;

// Voice metrics interface (matches client-side)
interface VoiceMetrics {
  responseLatencyMs: number;
  pitchStability: 'stable' | 'unstable' | 'micro-tremors';
  speechRateBPM: number;
  avgPitch: number;
  pitchVariance: number;
  peakAmplitude: number;
  recordingDurationMs: number;
}

function buildSystemPrompt(type: string, body: Record<string, unknown>): string {
  const { questionText, correctAnswer, wrongOptions, userResponse, voiceMetrics } = body;

  if (type === 'verdict') {
    const vm = voiceMetrics as VoiceMetrics | undefined;
    const playerAnswerText = (userResponse as string) || 'Não informada';
    const isCorrect = userResponse === correctAnswer;

    let forensicData = '';
    if (vm && vm.responseLatencyMs > 0) {
      const latencyDesc = vm.responseLatencyMs < 800 ? 'rápida' :
                         vm.responseLatencyMs < 2000 ? 'moderada' : 'hesitante';
      const pitchDesc = vm.pitchStability === 'stable' ? 'estável' :
                       vm.pitchStability === 'micro-tremors' ? 'micro-tremores' : 'instável';
      const speedDesc = vm.speechRateBPM > 180 ? 'acelerada' :
                       vm.speechRateBPM > 100 ? 'normal' : 'lenta';

      forensicData = `
DADOS FORENSES REAIS CAPTURADOS:
- Latência: ${vm.responseLatencyMs}ms (${latencyDesc})
- Pitch: ${pitchDesc} (${vm.avgPitch}Hz, variância ${vm.pitchVariance})
- Velocidade: ${vm.speechRateBPM} palavras/min (${speedDesc})
- Duração: ${Math.round(vm.recordingDurationMs / 1000)}s`;
    }

    return `Você é o Mycroft, IA forense de análise vocal. MÁXIMO ${MAX_DYNAMIC_CHARS} CARACTERES.

${forensicData || 'DADOS: Análise de padrões vocais em andamento.'}

FATO:
- Resposta: "${playerAnswerText}"
- Correto: "${correctAnswer}"
- Resultado: ${isCorrect ? 'ACERTO' : 'ERRO'}

TAREFA: Gere análise técnica CURTA citando os dados capturados.
${vm ? `- CITE os números reais (latência ${vm.responseLatencyMs}ms, pitch ${vm.pitchStability}, ${vm.speechRateBPM} wpm).` : ''}
- Se ERROU: aponte o erro com dado forense.
- Se ACERTOU: confirme com métrica de confiança.

PROIBIDO: Introduções genéricas, apenas análise técnica direta.
Responda em NO MÁXIMO ${MAX_DYNAMIC_CHARS} caracteres.`;

  } else if (type === 'detector') {
    const wrongOptionsText = (wrongOptions as string[])?.join(', ') || 'opções incorretas não fornecidas';
    const voiceAlerts = [
      "Escute a respiração: Mentirosos costumam prender o ar ou suspirar antes de começar a mentira.",
      "Verifique a velocidade: Se ele falou rápido demais, está tentando impedir que vocês pensem.",
      "Alerta de Detalhes: Se ele citou 'um amigo', 'um documentário' ou deu uma data muito específica, provavelmente é uma mentira ensaiada.",
      "Tom de Voz: Se o final da frase ficou agudo (parecendo uma pergunta), ele está inseguro.",
      "Pausas: O silêncio longo antes de responder indica que ele estava criando a história na hora.",
      "Hesitações: Muitos 'hmm', 'tipo', 'então' indicam que o cérebro está fabricando informações.",
      "Volume: Se ele abaixou a voz no meio da explicação, está menos confiante naquela parte.",
    ];
    const randomVoiceAlert = voiceAlerts[Math.floor(Math.random() * voiceAlerts.length)];

    return `Você é uma IA especialista em identificar mentiras através de padrões de fala e lógica argumentativa. O usuário (Desafiante) está ouvindo um áudio do suspeito.

A Pergunta é: "${questionText}"
Opções INCORRETAS (para eliminação): ${wrongOptionsText}

Sua tarefa é gerar um Relatório de Suspeita em 2 partes:

**🎯 ARMADILHA LÓGICA (Fact-Checking):**
Analise as opções erradas fornecidas. Escolha UMA delas e explique por que ela soa falsa ou absurda, ajudando o júri a eliminar opções. Seja específico. (NÃO revele a resposta correta diretamente).

**🔊 ALERTA FORENSE (Análise de Voz):**
${randomVoiceAlert}

Tom de Voz: Seja cético, analítico e frio. Use termos como "Sinais indicam", "Alta probabilidade de fabricação", "Padrão vocal suspeito", "Análise fonética sugere".

Responda de forma direta e técnica, no estilo perito forense. Máximo 80 palavras no total.`;

  } else if (type === 'analytics') {
    return `Você é o Mycroft Analytics, uma IA especialista em análise comportamental e detecção de blefes. Você está ajudando o júri a decidir se o jogador está blefando ou falando a verdade.

A Pergunta é: "${questionText}"

Sua tarefa: Analise esta pergunta e forneça uma análise de risco de blefe em formato JSON com:
1. "riskLevel": número de 0 a 100 representando a probabilidade de blefe (0 = certamente verdade, 100 = certamente blefe)
2. "analysis": uma análise curta e perspicaz (máximo 30 palavras) sobre por que alguém poderia blefar nesta pergunta, considerando a dificuldade e o tipo de conhecimento necessário.

Use um tom analítico e profissional. Responda APENAS com o JSON, sem markdown ou explicações.`;

  } else {
    return `Você é um Roteirista de Atuação e Coach de Mentiras. O usuário precisa gravar um áudio de 30 segundos enganando os amigos sobre uma pergunta de Trivia.

A Pergunta é: "${questionText}"
A Resposta Correta é: "${correctAnswer}"

Sua Missão: Gere um roteiro curto e EXTREMAMENTE NATURAL para ele ler.

Regras de Estilo (Obrigatórias):
- Linguagem Falada: Use termos como "Cara...", "Mano...", "Olha...", "Sério...".
- Imperfeições: Adicione hesitações estratégicas como "(pausa rápida)" ou "hmm..." para parecer que ele está pensando na hora.
- Autoridade Falsa: Mande ele citar fontes vagas ("Vi num documentário esses dias", "Meu tio mora lá").
- Tamanho: Curto o suficiente para ler em 15 segundos.

Exemplo de Saída: "Mano, certeza absoluta que é a letra B. Eu vi um documentário na Netflix sobre isso semana passada... (pausa)... os caras explicavam exatamente esse processo. Pode confiar."

NÃO dê explicações. Dê APENAS o texto para ele atuar.`;
  }
}

function buildUserMessage(type: string, body: Record<string, unknown>): string {
  const { userResponse, correctAnswer } = body;
  if (type === 'verdict') {
    return `Análise forense (máx ${MAX_DYNAMIC_CHARS} chars). Resposta: "${userResponse}", Correto: "${correctAnswer}". Use os dados reais capturados.`;
  } else if (type === 'detector') {
    return 'Analise o suspeito e me dê uma eliminação + dica de pressão.';
  } else if (type === 'analytics') {
    return 'Analise o risco de blefe desta pergunta.';
  }
  return 'Me dê uma sugestão de blefe convincente.';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { questionText, type, voiceMetrics } = body;

    if (!questionText) {
      throw new Error('Missing questionText');
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log(`Generating Mycroft ${type || 'bluff'} via Lovable AI for:`, questionText);
    console.log(`💸 MAX_DYNAMIC_CHARS limit: ${MAX_DYNAMIC_CHARS}`);

    if (voiceMetrics) {
      console.log('🎙️ Voice Forensics Data:', voiceMetrics);
    }

    const systemPrompt = buildSystemPrompt(type || 'bluff', body);
    const userMessage = buildUserMessage(type || 'bluff', body);

    const maxTokens = type === 'verdict' ? 60 : 300;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: type === 'analytics' ? 0.7 : 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      if (response.status === 429) {
        throw new Error('Rate limit excedido, tente novamente em alguns segundos.');
      }
      if (response.status === 402) {
        throw new Error('Créditos insuficientes no workspace Lovable AI.');
      }
      throw new Error(`Lovable AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    console.log('Mycroft (Lovable AI) response:', content);

    if (type === 'verdict') {
      let finalContent = content || '';
      if (finalContent.length > MAX_DYNAMIC_CHARS) {
        console.warn(`⚠️ Verdict exceeded ${MAX_DYNAMIC_CHARS} chars (${finalContent.length}), truncating...`);
        const truncated = finalContent.substring(0, MAX_DYNAMIC_CHARS);
        const lastPeriod = truncated.lastIndexOf('.');
        finalContent = lastPeriod > 50 ? truncated.substring(0, lastPeriod + 1) : truncated + '...';
      }

      console.log(`💸 Créditos Estimados para análise dinâmica: ${finalContent.length} caracteres`);

      return new Response(JSON.stringify({
        verdict: finalContent,
        charCount: finalContent.length,
        withinLimit: finalContent.length <= MAX_DYNAMIC_CHARS
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (type === 'analytics') {
      try {
        const parsed = JSON.parse(content);
        return new Response(JSON.stringify({
          riskLevel: parsed.riskLevel || 50,
          analysis: parsed.analysis || 'Análise indisponível'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({
          riskLevel: 50,
          analysis: content || 'Análise indisponível'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (type === 'detector') {
      return new Response(JSON.stringify({ analysis: content }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ suggestion: content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in mycroft-ai function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
