import { motion } from 'framer-motion';
import resultado7d from '@/assets/prints-reais/resultado-punter-7d.png';
import greensPunter from '@/assets/prints-reais/greens-punter.png';
import greensLive from '@/assets/prints-reais/greens-arena-live.png';
import analisePunter1 from '@/assets/prints-reais/analise-punter-1.png';
import analisePunter2 from '@/assets/prints-reais/analise-punter-2.png';
import aprovadoMancity from '@/assets/prints-reais/aprovado-mancity.png';
import aprovadoGoias from '@/assets/prints-reais/aprovado-goias.png';
import sinalAprovadoLive from '@/assets/prints-reais/sinal-aprovado-live.png';

interface PrintItem {
  src: string;
  alt: string;
  badge: string;
  title: string;
  desc: string;
  wide?: boolean;
}

const PRINTS: PrintItem[] = [
  {
    src: resultado7d,
    alt: 'Performance consolidada do Punter — 7 dias: ROI +25.6%, Win Rate 67.9%',
    badge: '📊 PERFORMANCE 7 DIAS (REAL)',
    title: '+25,6% de ROI · 67,9% de Win Rate · 115 entradas',
    desc: 'Painel real de performance consolidada do Arena Punter (IA + Plano Favorito + Eventos Raros). 81 entradas decididos, 55 GREENs. Retorno hipotético de +20,77u sobre 1u por entrada — é o que aconteceria se você seguisse cada entrada com 1% da banca.',
    wide: true,
  },
  {
    src: greensPunter,
    alt: 'Lista de GREENs do Arena Punter: 71 greens em 7 dias',
    badge: '✅ 71 GREENS EM 7 DIAS',
    title: 'Histórico de acertos auditado',
    desc: 'A tela "Greens" do Arena Punter mostra um por um cada entrada vencedor — com liga, mercado, odd e data. Nada de print de WhatsApp duvidoso: é a sua própria conta mostrando o resultado.',
  },
  {
    src: greensLive,
    alt: 'GREENs do Arena Trader Sports ao vivo: Libertadores, Under 2.5, Over 2.5',
    badge: '⚡ GREENS AO VIVO',
    title: 'Entradas ao vivo que viraram retorno',
    desc: 'Arena Trader Sports captura jogos durante a bola rolando: Libertadores, Under/Over 2.5 com confiança 72–90%. Mostra a entrada exata, a odd capturada e o resultado final do jogo.',
  },
  {
    src: analisePunter1,
    alt: 'Entrada pré-jogo Goiás x Vila Nova: Over 2.5 com edge +15.5%',
    badge: '🎯 ASSET SCORE + EDGE',
    title: 'Como a IA pontua cada entrada',
    desc: 'Cada entrada traz Asset Score (0–100), barras de Probabilidade, Edge, Stats, Padrão e Liquidez. Aqui: Goiás x Vila Nova, Over 2.5 @ 2.32, edge +15,5%, stake sugerido 3% da banca (R$ 132,80). Sem palpite — é matemática.',
  },
  {
    src: analisePunter2,
    alt: 'Entrada moderado Santos x Bragantino: Over 2.5 com edge +10%',
    badge: '🛡️ SINAL MODERADO',
    title: 'A IA também te avisa quando aliviar',
    desc: 'Quando o edge cai, a IA reduz o stake para 2% e marca como "Entrada Moderado". Você não entra forte em jogo duvidoso — proteção de banca automática, sem você precisar pensar.',
  },
  {
    src: aprovadoMancity,
    alt: 'Manchester City x Brentford ao vivo: Over 2.5 APROVADO com 5/5 critérios',
    badge: '🔥 APROVADO AO VIVO (5/5)',
    title: 'Leitura ao vivo com gráfico de pressão',
    desc: 'Man City 3x0 Brentford: o gráfico de pressão ao vivo (azul = casa, vermelho = fora) mostra dominância absoluta. 5 de 5 critérios batidos → status APROVADO. Você entra com o jogo já decidido a seu favor.',
  },
  {
    src: aprovadoGoias,
    alt: 'Goiás x Vila Nova ao vivo 0x0 no intervalo: Over 1.5 aprovado situacional',
    badge: '💡 APROVADO SITUACIONAL',
    title: 'Reconhece oportunidade rara',
    desc: 'Goiás x Vila Nova 0x0 no intervalo, odd Over 1.5 a 9,64. A IA detectou critérios fortes mesmo no placar zerado — entrada situacional raro, com odd absurdamente inflada que o mercado não viu.',
  },
  {
    src: sinalAprovadoLive,
    alt: 'Junior x Sporting Cristal 3x2: entrada aprovada Over 2.5 @ 1.85',
    badge: '🎯 ENTRADA EXATA',
    title: 'Você sabe exatamente quando operar',
    desc: 'Junior 3x2 Sporting Cristal ao vivo. A IA aprovou entrada em Over 2.5 @ 1.85 com força do entrada 72%. Mostra a odd no momento da entrada — não promessa, número exato que você teria conseguido na Betfair.',
  },
];

export default function ProvaRealPrints({ onCTA }: { onCTA?: () => void }) {
  return (
    <section className="py-16 sm:py-24 px-4 bg-gradient-to-b from-[#0a0f1e] via-[#0f1729] to-[#0a0f1e]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full text-xs uppercase tracking-widest text-red-400 mb-4">
            🔥 Prova real — sem vídeo de venda
          </span>
          <h2 className="text-3xl sm:text-5xl font-black mb-4 leading-tight">
            Não é promessa.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
              É o sistema funcionando.
            </span>
          </h2>
          <p className="text-base sm:text-lg text-gray-300 max-w-2xl mx-auto">
            Cansamos de VSL bonitinha e copy emocional. Abaixo estão <b>prints reais</b> do Oráculo Mycroft —
            performance auditada, entradas aprovados e entradas ao vivo. Veja com seus olhos o que cada tela significa.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {PRINTS.map((p, i) => (
            <motion.figure
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: (i % 2) * 0.1 }}
              className={`${p.wide ? 'sm:col-span-2' : ''} group relative bg-[#0f1729] border border-yellow-500/20 hover:border-yellow-500/50 rounded-2xl overflow-hidden shadow-xl shadow-black/40 transition-all`}
            >
              <div className="relative bg-black">
                <img
                  src={p.src}
                  alt={p.alt}
                  loading="lazy"
                  className="w-full h-auto object-contain max-h-[460px] mx-auto"
                />
                <div className="absolute top-3 left-3">
                  <span className="inline-block px-3 py-1 bg-[#0a0f1e]/90 backdrop-blur border border-yellow-500/40 rounded-full text-[10px] sm:text-xs font-bold text-yellow-300 tracking-wide">
                    {p.badge}
                  </span>
                </div>
              </div>
              <figcaption className="p-5 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2 leading-snug">{p.title}</h3>
                <p className="text-sm text-gray-300 leading-relaxed">{p.desc}</p>
              </figcaption>
            </motion.figure>
          ))}
        </div>

        <p className="text-center text-xs text-gray-500 mt-8 max-w-2xl mx-auto">
          ⚠️ Entradas envolvem risco. Resultados passados não garantem resultados futuros. Opere com responsabilidade — proibido para menores de 18 anos.
        </p>

        {onCTA && (
          <div className="text-center mt-10">
            <button
              onClick={onCTA}
              className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-black text-base rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition shadow-xl shadow-yellow-500/40"
            >
              QUERO TESTAR O ORÁCULO AGORA →
            </button>
            <p className="text-xs text-gray-400 mt-3">7 dias grátis · Sem cartão · Cancele em 2 cliques</p>
          </div>
        )}
      </div>
    </section>
  );
}
