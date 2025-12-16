import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { questionText, correctAnswer, type, wrongOptions } = await req.json();

    if (!questionText) {
      throw new Error('Missing questionText');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    console.log(`Generating Mycroft ${type || 'bluff'} for:`, questionText);

    let systemPrompt: string;
    
    if (type === 'detector') {
      const { wrongOptions } = await req.json().catch(() => ({}));
      const wrongOptionsText = wrongOptions?.join(', ') || 'opções incorretas não fornecidas';
      
      systemPrompt = `Você é uma IA especialista em detecção de mentiras e linguagem corporal do FBI. Sua missão é ajudar o júri a pressionar o suspeito, mas SEM dar a resposta final.

A Pergunta é: "${questionText}"
Opções INCORRETAS (para eliminação): ${wrongOptionsText}

Sua resposta DEVE ter exatamente 2 partes curtas:

**ELIMINAÇÃO:** Escolha UMA das opções incorretas fornecidas e diga que ela é certamente errada. (Ex: "Meus dados indicam que [opção] certamente NÃO é a resposta.")

**DICA DE PRESSÃO:** Dê UMA dica psicológica para o júri observar no jogador AGORA. Escolha aleatoriamente entre:
- Olhar: "Se ele olhou para a direita superior ao responder, está criando uma imagem (mentindo)."
- Voz: "Peça para ele repetir a resposta. Se o tom de voz subir, é insegurança."
- Detalhes: "Pergunte o PORQUÊ. Mentirosos costumam dar detalhes excessivos para compensar."
- Defensiva: "Acuse-o de mentir e veja a reação. A raiva imediata é sinal de culpa."
- Corpo: "Observe as mãos. Gestos excessivos ou esconder as mãos indica nervosismo."

REGRA DE OURO: JAMAIS revele qual é a opção correta. Mantenha o mistério.

Responda de forma direta, no estilo FBI/analista comportamental.`;
    } else if (type === 'analytics') {
      systemPrompt = `Você é o Mycroft Analytics, uma IA especialista em análise comportamental e detecção de blefes. Você está ajudando o júri a decidir se o jogador está blefando ou falando a verdade.

A Pergunta é: "${questionText}"

Sua tarefa: Analise esta pergunta e forneça uma análise de risco de blefe em formato JSON com:
1. "riskLevel": número de 0 a 100 representando a probabilidade de blefe (0 = certamente verdade, 100 = certamente blefe)
2. "analysis": uma análise curta e perspicaz (máximo 30 palavras) sobre por que alguém poderia blefar nesta pergunta, considerando a dificuldade e o tipo de conhecimento necessário.

Use um tom analítico e profissional. Responda APENAS com o JSON, sem markdown ou explicações.`;
    } else {
      systemPrompt = `Você é o Mycroft, uma IA especialista em blefe e manipulação psicológica. O usuário precisa mentir sobre uma pergunta de trivia. A Pergunta é: "${questionText}". A Resposta Correta é: "${correctAnswer}". Sua tarefa: Crie uma mentira curta, criativa e muito convincente (máximo 20 palavras) que pareça a resposta certa, mas esteja errada. Use um tom confiante e levemente arrogante. Responda apenas com a sugestão de blefe, sem explicações adicionais.`;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: type === 'detector' 
            ? 'Analise o suspeito e me dê uma eliminação + dica de pressão.'
            : type === 'analytics' 
              ? 'Analise o risco de blefe desta pergunta.' 
              : 'Me dê uma sugestão de blefe convincente.' 
          }
        ],
        max_tokens: 150,
        temperature: type === 'analytics' ? 0.7 : 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    console.log('Mycroft response:', content);

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
        // Fallback if JSON parsing fails
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
