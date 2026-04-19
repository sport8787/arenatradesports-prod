import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, CheckCircle2, Gift } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function LeadCaptureForm() {
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const { error: insertError } = await (supabase as any).from('landing_leads').insert({
        email: email.trim().toLowerCase(),
        whatsapp: whatsapp.trim() || null,
        source: 'landing_hero',
      });
      if (insertError && !insertError.message?.includes('duplicate')) {
        throw insertError;
      }
      // Track Meta Pixel Lead event
      if (typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq('track', 'Lead', { content_name: 'Free Telegram Signals' });
      }
      setSuccess(true);
    } catch (err: any) {
      setError('Não foi possível salvar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/40 rounded-xl p-6 text-center"
      >
        <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
        <p className="font-bold text-white mb-1">Cadastro confirmado! 🎉</p>
        <p className="text-sm text-gray-300 mb-4">
          Entre no grupo VIP do Telegram para receber seus 3 sinais grátis.
        </p>
        <a
          href="https://t.me/oraculo_mycroft"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#229ED9] text-white font-bold rounded-lg hover:bg-[#1a8bc4] transition"
        >
          ENTRAR NO GRUPO VIP →
        </a>
      </motion.div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-[#1a1f36] to-[#0f1729] border border-yellow-500/30 rounded-xl p-6 shadow-xl">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="w-5 h-5 text-yellow-400" />
        <p className="font-bold text-white">Receba 3 sinais grátis no Telegram</p>
      </div>
      <p className="text-sm text-gray-400 mb-4">
        Sem compromisso. Veja a qualidade das análises antes de assinar.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="Seu melhor e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 bg-[#0a0f1e] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none transition"
        />
        <input
          type="tel"
          placeholder="WhatsApp (opcional)"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          className="w-full px-4 py-3 bg-[#0a0f1e] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none transition"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition shadow-lg shadow-yellow-500/25 disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          {loading ? 'Enviando...' : (<>RECEBER SINAIS GRÁTIS <Send className="w-4 h-4" /></>)}
        </button>
      </form>
      <p className="text-xs text-gray-500 mt-3 text-center">🔒 Seus dados são privados. Sem spam.</p>
    </div>
  );
}
