import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, CheckCircle2, Gift, Download, BookOpen } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

const EBOOK_URL = 'https://affquongjlhmusxzohjl.supabase.co/storage/v1/object/public/public-assets/ebooks/apostas-de-valor.pdf';

const leadSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome (mín. 2 letras)').max(80, 'Nome muito longo'),
  whatsapp: z
    .string()
    .trim()
    .refine((v) => v.replace(/\D/g, '').length >= 10 && v.replace(/\D/g, '').length <= 13, {
      message: 'WhatsApp inválido (com DDD, ex: 81 99999-9999)',
    }),
});

function formatWhatsapp(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function LeadCaptureForm() {
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = leadSchema.safeParse({ name, whatsapp });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados inválidos');
      return;
    }

    setLoading(true);
    try {
      const { error: insertError } = await (supabase as any).from('landing_leads').insert({
        name: parsed.data.name,
        whatsapp: parsed.data.whatsapp.replace(/\D/g, ''),
        source: 'landing_hero',
      });
      if (insertError && !insertError.message?.includes('duplicate')) {
        throw insertError;
      }
      if (typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq('track', 'Lead', { content_name: '10 Sinais + E-book Apostas de Valor' });
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
        <p className="font-bold text-white mb-1">Cadastro confirmado, {name.split(' ')[0]}! 🎉</p>
        <p className="text-sm text-gray-300 mb-4">
          Baixe agora seu e-book exclusivo e entre no grupo VIP do Telegram para receber seus 10 sinais grátis.
        </p>
        <div className="flex flex-col gap-2">
          <a
            href={EBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition shadow-lg shadow-yellow-500/25"
          >
            <Download className="w-4 h-4" /> BAIXAR E-BOOK GRÁTIS
          </a>
          <a
            href="https://t.me/oraculo_mycroft"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#229ED9] text-white font-bold rounded-lg hover:bg-[#1a8bc4] transition"
          >
            ENTRAR NO GRUPO VIP →
          </a>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-[#1a1f36] to-[#0f1729] border border-yellow-500/30 rounded-xl p-6 shadow-xl">
      <div className="flex items-center gap-2 mb-2">
        <Gift className="w-5 h-5 text-yellow-400" />
        <p className="font-bold text-white">10 sinais grátis + E-book exclusivo</p>
      </div>
      <p className="text-xs text-yellow-400/90 mb-3 flex items-center gap-1.5">
        <BookOpen className="w-3.5 h-3.5" /> "Apostas de Valor: Como Encontrar Edge Matemático"
      </p>
      <p className="text-sm text-gray-400 mb-4">
        Sem compromisso. Veja a qualidade das análises antes de assinar.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          required
          maxLength={80}
          placeholder="Seu nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 bg-[#0a0f1e] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none transition"
        />
        <input
          type="tel"
          required
          inputMode="numeric"
          placeholder="WhatsApp com DDD"
          value={whatsapp}
          onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))}
          className="w-full px-4 py-3 bg-[#0a0f1e] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none transition"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition shadow-lg shadow-yellow-500/25 disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          {loading ? 'Enviando...' : (<>QUERO MEUS 10 SINAIS + E-BOOK <Send className="w-4 h-4" /></>)}
        </button>
      </form>
      <p className="text-xs text-gray-500 mt-3 text-center">🔒 Seus dados são privados. Sem spam.</p>
    </div>
  );
}
