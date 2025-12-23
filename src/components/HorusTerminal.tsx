import React, { useEffect } from 'react';

// Declaração para o TypeScript aceitar a tag personalizada
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'elevenlabs-convai': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { 'agent-id': string }, HTMLElement>;
    }
  }
}

export const HorusTerminal = () => {
  useEffect(() => {
    // Script oficial da ElevenLabs
    const script = document.createElement('script');
    script.src = 'https://elevenlabs.io/convai-widget/index.js';
    script.async = true;
    script.type = 'text/javascript';
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black/95 rounded-lg border-2 border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.4)] relative overflow-hidden p-6">
      
      {/* Grid de fundo decorativo */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.1)_1px,transparent_1px)] bg-[size:20px_20px] opacity-20"></div>

      {/* Header */}
      <div className="z-10 w-full flex justify-between items-center mb-8 border-b border-cyan-800 pb-2">
        <span className="text-cyan-400 font-mono text-sm tracking-[0.2em] uppercase">
          ⚡ Conexão Neural: Hórus
        </span>
        <div className="flex gap-2">
           <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"/>
           <span className="text-red-500 text-xs font-bold">AO VIVO</span>
        </div>
      </div>

      {/* O Widget da ElevenLabs */}
      <div className="z-10 transform scale-125">
        <elevenlabs-convai agent-id="hjvjhk5x"></elevenlabs-convai>
      </div>

      {/* Footer com instruções */}
      <div className="z-10 mt-8 text-center">
        <p className="text-cyan-600 text-xs font-mono mb-2">
          "Pressione para falar. A mentira tem pernas curtas."
        </p>
      </div>
    </div>
  );
};
