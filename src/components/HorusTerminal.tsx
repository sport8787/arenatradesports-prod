import React, { useEffect } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'elevenlabs-convai': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { 'agent-id': string }, HTMLElement>;
    }
  }
}

export const HorusTerminal = () => {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://elevenlabs.io/convai-widget/index.js';
    script.async = true;
    script.type = 'text/javascript';
    document.body.appendChild(script);

    return () => {
      // Cleanup
    };
  }, []);

  return (
    <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center bg-black/95 rounded-xl border border-cyan-500/50 shadow-2xl relative overflow-hidden p-6">
      
      {/* Título do Terminal */}
      <div className="z-10 absolute top-4 w-full text-center">
        <span className="text-cyan-400 font-mono text-[10px] tracking-[0.3em] uppercase opacity-70">
          INTERFACE DE VOZ
        </span>
      </div>

      {/* O "BOTÃO" (Container do Widget) */}
      <div className="z-10 relative group cursor-pointer">
        {/* Efeito de Glow atrás do botão */}
        <div className="absolute inset-0 bg-cyan-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 rounded-full"></div>
        
        {/* Anel de pulso animado */}
        <div className="absolute inset-0 w-32 h-32 rounded-full border-2 border-cyan-400 animate-ping opacity-30"></div>
        <div className="absolute inset-0 w-32 h-32 rounded-full border border-cyan-500/50 animate-pulse"></div>
        
        {/* Moldura circular para o Widget */}
        <div className="w-32 h-32 rounded-full border-2 border-cyan-500/50 flex items-center justify-center bg-black overflow-hidden relative shadow-[0_0_20px_rgba(6,182,212,0.4)] group-hover:border-cyan-400 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all duration-300">
          
          {/* O Widget da ElevenLabs preenchendo o círculo */}
          <elevenlabs-convai 
            agent-id="hjvjhk5x"
            style={{ width: '120%', height: '120%', marginTop: '10px' }}
          ></elevenlabs-convai>
          
        </div>
      </div>

      {/* Instrução de Ação */}
      <div className="z-10 mt-6 text-center space-y-2">
        <p className="text-white font-bold text-sm">
          Falar com Hórus
        </p>
        <p className="text-cyan-600 text-[10px] font-mono uppercase tracking-wider">
          Clique na esfera para conectar
        </p>
      </div>
    </div>
  );
};
