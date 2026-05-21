import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';

interface Props {
  onCTA?: () => void;
}

export default function StickyMobileCTA({ onCTA }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 p-3 bg-[#0a0f1e]/95 backdrop-blur-md border-t border-yellow-500/30 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.5)]">
      <a
        href="#planos"
        onClick={() => onCTA?.()}
        className="w-full py-3.5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold rounded-lg shadow-lg shadow-yellow-500/30 inline-flex items-center justify-center gap-2"
      >
        CRIAR MINHA CONTA AGORA
        <ArrowRight className="w-4 h-4" />
      </a>
    </div>
  );
}
