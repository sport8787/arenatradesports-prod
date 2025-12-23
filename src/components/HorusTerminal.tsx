import React from 'react';

export const HorusTerminal = () => {
  // URL direta do Agente Hórus fornecida
  const agentUrl = "https://elevenlabs.io/app/talk-to?agent_id=agent_4201kd5w01dzeh1b9y9hhjvjhk5x&branch_id=agtbrch_7201kd5w05g3ep5vqwxvtv6c5604"; 

  return (
    <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center bg-black/95 rounded-xl border border-cyan-500/50 shadow-2xl relative overflow-hidden p-1">
      
      {/* Header Visual do Terminal */}
      <div className="w-full flex justify-between items-center bg-cyan-950/30 px-4 py-2 border-b border-cyan-900 mb-1">
        <span className="text-cyan-400 font-mono text-[10px] tracking-[0.2em] uppercase opacity-90">
          ● HÓRUS_V4.0 :: CONEXÃO SEGURA
        </span>
        <div className="flex gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
        </div>
      </div>

      {/* O Iframe Mágico */}
      <div className="w-full flex-1 relative bg-black rounded-lg overflow-hidden">
        <iframe 
          src={agentUrl}
          className="w-full h-full border-0 absolute inset-0"
          allow="microphone" 
          title="Hórus Voice Interface"
        />
      </div>

      {/* Footer Decorativo */}
      <div className="w-full text-center py-1">
         <p className="text-cyan-900 text-[8px] font-mono">PROTOCOLO DE VOZ ATIVO // NÃO MINTA</p>
      </div>
    </div>
  );
};
