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
    <div className="flex items-center justify-center">
      <elevenlabs-convai 
        agent-id="agent_4201kd5w01dzeh1b9y9hhjvjhk5x"
        action-text="Converse comigo"
        start-text="Iniciar Link de Voz"
        end-text="Encerrar Conexão"
      ></elevenlabs-convai>
    </div>
  );
};
