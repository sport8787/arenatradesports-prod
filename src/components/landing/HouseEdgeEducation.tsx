/**
 * Bloco educativo + Sorte vs Estratégia + Comunicado importante.
 * Usado no fim das LPs (Landing principal e Oferta Especial).
 */
export default function HouseEdgeEducation() {
  return (
    <>
      {/* COMO FUNCIONA A MATEMÁTICA DA CASA */}
      <section className="py-16 px-6 bg-[#0a0f1e]">
        <div className="container mx-auto max-w-3xl text-slate-200">
          <h2 className="text-2xl md:text-3xl font-bold text-yellow-400 mb-4 text-center">
            Se você quer investir em futebol de forma profissional, precisa entender como tudo funciona
          </h2>
          <p className="text-lg text-center text-slate-300 mb-6">
            Você já se perguntou por que a exchange esportiva quase sempre vence?
          </p>
          <p className="leading-relaxed mb-4">
            A resposta está na <b>própria estrutura do mercado</b>: cada partida tem odds precificadas
            com uma <b>margem matemática embutida a favor da casa</b> (a famosa <i>overround</i> ou{' '}
            <i>juice</i>). Se você somar as probabilidades implícitas das odds de um jogo, o total
            ultrapassa 100% — esse excesso é o margem garantida da casa no longo prazo,
            independentemente de quem ganhe a partida.
          </p>
          <p className="leading-relaxed mb-4">
            Por isso as casas <b>induzem o operador a montar múltiplas</b> com 4, 6, 10 seleções:
            a cada perninha adicionada, a margem da casa se acumula exponencialmente. Uma múltipla
            de 8 jogos pode ter <b>mais de 40% de vantagem matemática para a casa</b>. É o produto
            mais rentável da operação delas — e o mais destrutivo para a banca do operador.
          </p>
          <p className="leading-relaxed">
            Se seu objetivo é parar de perder, você precisa <b>deixar de ser operador impulsivo</b>,
            abandonar "estratégias infalíveis" e palpites de tipster, e passar a operar com{' '}
            <b>análise de dados reais + probabilidade + gestão de risco</b>. Isso não muda o
            resultado de uma partida específica, mas permite identificar quando a odd está{' '}
            <b>mal precificada a seu favor</b> (edge positivo) — e é nesse ponto que o retorno
            consistente acontece.
          </p>
        </div>
      </section>

      {/* A REALIDADE SOBRE A CONSISTÊNCIA */}
      <section className="py-16 px-6 bg-[#0f1729]">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-white mb-10">
            A Realidade Sobre a Consistência:{' '}
            <span className="text-yellow-400">Onde o Amador Erra e o Profissional Performa</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-5">
            <div className="bg-[#0a0f1e] border border-red-500/30 rounded-2xl p-6">
              <div className="text-3xl mb-3">❌</div>
              <h3 className="text-lg font-bold text-red-300 mb-2">O amador</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Entrada no time do coração, persegue prejuízo (martingale), entra em múltiplas
                grandes, segue tipster do Telegram, não anota nada e não mede ROI. Resultado: 95%
                quebra em até 6 meses.
              </p>
            </div>
            <div className="bg-[#0a0f1e] border border-emerald-500/30 rounded-2xl p-6">
              <div className="text-3xl mb-3">✅</div>
              <h3 className="text-lg font-bold text-emerald-300 mb-2">O profissional</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Opera 1 entrada por vez, com stake calculado por Kelly, em odds onde a IA
                identificou <b className="text-white">edge ≥3%</b>. Anota tudo, mede CLV (Closing
                Line Value) e aceita que <b className="text-white">perder 45% das vezes ainda é
                retorno</b> se o edge for real.
              </p>
            </div>
            <div className="bg-[#0a0f1e] border border-yellow-500/30 rounded-2xl p-6">
              <div className="text-3xl mb-3">🧮</div>
              <h3 className="text-lg font-bold text-yellow-300 mb-2">A matemática</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Consistência não é "acertar muito". É <b className="text-white">acertar com
                vantagem matemática</b> repetidas vezes, em volume, com gestão de banca correta.
                O Mycroft te entrega exatamente esses 3 pilares automatizados.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SORTE VS ESTRATÉGIA */}
      <section className="py-16 px-6 bg-gradient-to-br from-yellow-500/5 via-fuchsia-500/5 to-transparent">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Sorte vs. Estratégia:{' '}
            <span className="text-yellow-400">em qual lado você quer estar?</span>
          </h2>
          <p className="text-slate-300 text-lg leading-relaxed">
            Operador comum entrada na sorte e culpa o juiz quando perde. <b>Trader esportivo</b>{' '}
            opera estratégia, mede o resultado e ajusta o processo. Os dois apertam o mesmo botão
            — mas só um deles fecha o mês no positivo.
          </p>
          <a
            href="https://wa.me/5534991290648?text=Ol%C3%A1!%20Quero%20come%C3%A7ar%20a%20operar%20com%20estrat%C3%A9gia%20baseada%20em%20dados."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-6 bg-[#25D366] hover:bg-[#1ebe57] text-white font-bold px-7 py-4 rounded-xl shadow-lg shadow-green-500/30 transition"
          >
            💬 Quero estar do lado da estratégia
          </a>
        </div>
      </section>
    </>
  );
}

export function ComunicadoImportante() {
  return (
    <section className="py-12 px-6 bg-[#0a0f1e]">
      <div className="container mx-auto max-w-3xl border-2 border-yellow-500/40 rounded-2xl p-8 bg-yellow-500/[0.04]">
        <h2 className="text-2xl font-bold text-yellow-400 text-center mb-4">
          ⚠️ COMUNICADO IMPORTANTE ⚠️
        </h2>
        <p className="text-center font-semibold text-white mb-2">
          Este site tem caráter educativo.
        </p>
        <p className="text-center text-slate-300 mb-6">
          Nenhuma ferramenta pode garantir vitórias ou resultados constantes.
          <br />
          Use estas informações para melhorar seu desempenho e aumentar suas chances.
        </p>
        <p className="text-slate-300 leading-relaxed">
          O <b className="text-white">Oráculo Mycroft</b> é um conjunto de sistemas de análise
          estatística, probabilística e de gestão de risco aplicado a entradas esportivas —{' '}
          <b className="text-white">não é uma promessa nem uma garantia de ganhos</b>. A união do
          seu <b>bom-senso</b> com a <b>experiência de saber interpretar os dados</b> fornecidos
          pelos nossos sistemas é o que definirá o seu sucesso. Opere com responsabilidade.
          Conteúdo educacional para maiores de 18 anos.
        </p>
      </div>
    </section>
  );
}
