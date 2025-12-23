import React, { useEffect } from 'react';

// Declaração para o TypeScript não reclamar do Web Component
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'elevenlabs-convai': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { 'agent-id': string }, HTMLElement>;
    }
  }
}

export const HorusTerminal = () => {
  useEffect(() => {
    // Carrega o script Beta da ElevenLabs
    const scriptId = 'elevenlabs-beta-script';
    
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed@beta';
      script.async = true;
      script.type = 'text/javascript';
      document.body.appendChild(script);
    }
  }, []);

  return (
    <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center bg-black/95 rounded-xl border border-cyan-500/50 shadow-2xl relative overflow-hidden p-6">
      
      {/* Título Decorativo */}
      <div className="z-10 absolute top-4 w-full text-center">
        <span className="text-cyan-400 font-mono text-[10px] tracking-[0.3em] uppercase opacity-70">
          ● HÓRUS SYSTEM v5.0 (BETA)
        </span>
      </div>

      {/* O WIDGET NATIVO */}
      {/* O script @beta vai preencher este componente automaticamente */}
      <div className="z-10 flex-1 flex items-center justify-center w-full">
        <elevenlabs-convai agent-id="agent_4201kd5w01dzeh1b9y9hhjvjhk5x"></elevenlabs-convai>
      </div>

      {/* Instrução */}
      <div className="z-10 mt-4 text-center">
        <p className="text-cyan-600 text-[10px] font-mono uppercase tracking-wider">
          Powered by ElevenLabs Beta
        </p>
      </div>

    </div>
  );
};
