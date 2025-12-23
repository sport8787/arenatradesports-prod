import React, { useEffect, useRef } from 'react';

// Definição das Props que o Hórus precisa ler
interface HorusTerminalProps {
  playerName: string;
  playerMoney: number;
  gameMode: 'Multiplayer' | 'Singleplayer_Trader' | 'EdTech';
  lastAction?: string; // Ex: "Errou a pergunta", "Desistiu"
  difficulty?: 'Hard' | 'Normal';
}

export const HorusTerminal: React.FC<HorusTerminalProps> = ({
  playerName,
  playerMoney,
  gameMode,
  lastAction = "Iniciando sistema",
  difficulty = "Hard"
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current) {
      const baseUrl = 'https://platform.zaia.app/embed/chat/72399';
      
      // Montando o cérebro do Hórus com os dados do jogo
      const contextData = {
        userId: playerName, // Usamos o nome como ID para facilitar
        userData: JSON.stringify({
          name: playerName,
          current_money: playerMoney, // O Hórus vai ler isso para zombar ou vender
          game_mode: gameMode,
          last_action: lastAction,
          difficulty: difficulty
        })
      };

      const encodedCustomData = encodeURIComponent(JSON.stringify(contextData));
      const fullUrl = `${baseUrl}?custom=${encodedCustomData}`;

      // Só atualiza se a URL mudar para não recarregar o chat toda hora à toa
      if (iframeRef.current.src !== fullUrl) {
        iframeRef.current.src = fullUrl;
      }
    }
  }, [playerName, playerMoney, gameMode, lastAction, difficulty]);

  return (
    <div className="w-full h-full relative p-1 bg-black rounded-lg border-2 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]">
      {/* Header Falso para parecer um Terminal */}
      <div className="absolute top-0 left-0 w-full h-8 bg-cyan-900/50 flex items-center px-4 rounded-t-lg">
        <span className="text-cyan-400 text-xs font-mono tracking-widest animate-pulse">
          ● LINK CRIPTOGRAFADO: HÓRUS SYSTEM v4.0
        </span>
      </div>

      {/* O Iframe da Zaia */}
      <iframe
        ref={iframeRef}
        id="horus-iframe"
        title="Horus AI"
        className="w-full h-full pt-8 rounded-lg bg-transparent"
        style={{ border: 'none' }}
        allow="microphone" // Importante para permitir falar por voz se a Zaia suportar
      />
    </div>
  );
};
