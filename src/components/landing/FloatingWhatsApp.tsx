import { MessageCircle } from 'lucide-react';

const WHATSAPP_URL = 'https://wa.me/5534991290648?text=Ol%C3%A1!%20Tenho%20uma%20d%C3%BAvida%20sobre%20o%20Or%C3%A1culo%20Mycroft';

export default function FloatingWhatsApp() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 group"
    >
      <span className="absolute inset-0 rounded-full bg-green-500/40 animate-ping" />
      <span className="relative flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] shadow-xl shadow-green-500/40 hover:scale-110 transition-transform">
        <MessageCircle className="w-7 h-7 text-white" fill="white" />
      </span>
      <span className="hidden md:block absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-[#0a0f1e] text-white text-xs font-semibold px-3 py-2 rounded-lg border border-green-500/30 opacity-0 group-hover:opacity-100 transition pointer-events-none">
        Tirar dúvida no WhatsApp
      </span>
    </a>
  );
}
