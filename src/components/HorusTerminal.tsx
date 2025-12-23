import React from 'react';
import { ExternalLink, Mic } from 'lucide-react';

export const HorusTerminal = () => {
  const agentUrl = "https://elevenlabs.io/app/talk-to?agent_id=agent_4201kd5w01dzeh1b9y9hhjvjhk5x&branch_id=agtbrch_7201kd5w05g3ep5vqwxvtv6c5604";

  const openHorusWindow = () => {
    // Abre uma janela estilo "Pop-up" centralizada
    const width = 450;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    
    window.open(
      agentUrl,
      'HorusTerminal',
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes`
    );
  };

  return (
    <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center bg-black/95 rounded-xl border border-cyan-500/50 shadow-2xl relative overflow-hidden p-6">
      
      {/* Background Grid Tech */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.05)_1px,transparent_1px)] bg-[size:30px_30px]"></div>

      <div className="z-10 text-center space-y-6">
        
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white tracking-widest">HÓRUS SYSTEM</h2>
          <p className="text-cyan-500 text-xs font-mono uppercase">Canal de voz encriptado</p>
        </div>

        {/* O BOTÃO QUE RESOLVE TUDO */}
        <button 
          onClick={openHorusWindow}
          className="group relative px-8 py-4 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 rounded-lg transition-all duration-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center gap-3 mx-auto"
        >
          <div className="absolute inset-0 bg-cyan-400/10 blur-xl rounded-lg group-hover:opacity-75 transition-opacity opacity-0"></div>
          <Mic className="w-6 h-6 text-cyan-400 animate-pulse" />
          <span className="text-cyan-100 font-mono font-bold tracking-wider">
            ABRIR COMUNICADOR
          </span>
          <ExternalLink className="w-4 h-4 text-cyan-600 group-hover:text-cyan-400 ml-2" />
        </button>

        <p className="text-gray-500 text-[10px] max-w-[200px] mx-auto">
          * Uma janela segura será aberta para iniciar a negociação.
        </p>
      </div>
    </div>
  );
};
