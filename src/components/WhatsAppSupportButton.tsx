import { MessageCircle } from 'lucide-react';

const WHATSAPP_URL = 'https://wa.me/5581997950345?text=Preciso%20de%20ajuda%20com%20o%20Or%C3%A1culo%20Mycroft';

interface WhatsAppSupportButtonProps {
  variant?: 'icon' | 'full';
  className?: string;
}

export default function WhatsAppSupportButton({ variant = 'icon', className = '' }: WhatsAppSupportButtonProps) {
  if (variant === 'full') {
    return (
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2.5 border border-border rounded-lg bg-card p-3 hover:bg-muted/30 transition-colors group ${className}`}
      >
        <MessageCircle className="w-4 h-4 text-green-500" />
        <div className="text-left">
          <p className="font-mono text-xs font-semibold text-foreground">Suporte via WhatsApp</p>
          <p className="font-mono text-[10px] text-muted-foreground">Dúvidas, bugs ou sugestões</p>
        </div>
      </a>
    );
  }

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`p-2 rounded-lg hover:bg-muted/30 transition-colors ${className}`}
      title="Suporte via WhatsApp"
    >
      <MessageCircle className="w-5 h-5 text-green-500" />
    </a>
  );
}
