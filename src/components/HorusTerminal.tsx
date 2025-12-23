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
    console.log("Hórus Agent ID:", "hjvjhk5x");
    
    const script = document.createElement('script');
    script.src = 'https://elevenlabs.io/convai-widget/index.js';
    script.async = true;
    script.type = 'text/javascript';
    document.body.appendChild(script);

    return () => {
      // Cleanup
    };
  }, []);

  // Teste de sanidade: Código Mínimo
  return (
    <div className="p-10 bg-white">
      <elevenlabs-convai agent-id="hjvjhk5x"></elevenlabs-convai>
    </div>
  );
};
