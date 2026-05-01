import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Upload, Trash2, FileText, Brain, ChevronDown, ChevronUp, Loader2, X, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import { extractTextFromPdf } from '@/services/pdfExtractService';
import { useNavigate } from 'react-router-dom';
import HorusTTSPlayer from '@/components/chat/HorusTTSPlayer';
import MycroftChatGate from '@/components/mycroft/MycroftChatGate';
import { useSubscription } from '@/hooks/useSubscription';
import { useAdmin } from '@/hooks/useAdmin';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface MycroftSportsChatProps {
  matchContext?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function MycroftSportsChat({ matchContext, isOpen, onClose }: MycroftSportsChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [kbFiles, setKbFiles] = useState<string[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { isPaid, subscription } = useSubscription();
  const { isAdmin } = useAdmin();
  const canUseChat = isAdmin || (isPaid && subscription?.plan === 'premium');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) loadKBFiles();
  }, [isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadKBFiles = async () => {
    try {
      const { data, error } = await supabase.storage.from('sports-knowledge-base').list('', { limit: 50 });
      if (!error && data) {
        setKbFiles(data.map(f => f.name).filter(n => n.length > 0));
      }
    } catch (e) {
      console.error('Error loading KB files:', e);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    let uploaded = 0;

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (!['txt', 'md', 'csv', 'pdf'].includes(ext || '')) {
        toast({ title: `❌ ${file.name}: formato não suportado. Use .txt, .md, .csv ou .pdf`, variant: 'destructive' });
        continue;
      }

      try {
        let uploadFile: File | Blob = file;
        let uploadName = file.name;

        if (ext === 'pdf') {
          toast({ title: `📄 Convertendo ${file.name} para texto...` });
          try {
            const text = await extractTextFromPdf(file);
            if (!text || text.trim().length < 50) {
              toast({ title: `⚠️ ${file.name}: PDF sem texto extraível.`, variant: 'destructive' });
              continue;
            }
            uploadFile = new Blob([text], { type: 'text/plain' });
            uploadName = file.name.replace(/\.pdf$/i, '.txt');
            toast({ title: `✅ ${file.name} convertido (${(text.length / 1024).toFixed(0)}KB)` });
          } catch (pdfErr) {
            console.error('PDF conversion error:', pdfErr);
            toast({ title: `❌ Erro ao converter ${file.name}`, variant: 'destructive' });
            continue;
          }
        }

        const { error } = await supabase.storage
          .from('sports-knowledge-base')
          .upload(uploadName, uploadFile, { upsert: true });

        if (error) throw error;
        uploaded++;
      } catch (err) {
        console.error(`Upload error for ${file.name}:`, err);
        toast({ title: `❌ Erro ao enviar ${file.name}`, variant: 'destructive' });
      }
    }

    if (uploaded > 0) {
      toast({ title: `📚 ${uploaded} arquivo(s) adicionado(s) à KB Sports` });
      await loadKBFiles();
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteFile = async (fileName: string) => {
    try {
      const { error } = await supabase.storage.from('sports-knowledge-base').remove([fileName]);
      if (error) throw error;
      toast({ title: `🗑️ ${fileName} removido` });
      await loadKBFiles();
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '🔒 Sua sessão expirou. Faça login novamente para falar com o Mycroft.',
          timestamp: Date.now(),
        }]);
        setIsLoading(false);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2min client timeout

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mycroft-sports-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            query: userMsg.content,
            matchContext,
            conversationHistory: messages.slice(-10),
            userId: session.user.id,
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      const raw = await response.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON */ }

      if (!response.ok) {
        let friendly = `⚠️ Erro ${response.status} ao conectar com o Mycroft.`;
        if (response.status === 401) friendly = '🔒 Sessão inválida. Faça login novamente.';
        else if (response.status === 429) friendly = '⏳ Limite de requisições atingido. Aguarde alguns segundos.';
        else if (response.status === 402) friendly = '💳 Créditos de IA esgotados. Adicione saldo em Settings → Cloud & AI.';
        else if (response.status >= 500) friendly = '⚠️ Mycroft está indisponível no momento. Tente novamente em instantes.';
        const detail = data?.error || data?.response;
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: detail ? `${friendly}\n\n_Detalhe: ${detail}_` : friendly,
          timestamp: Date.now(),
        }]);
        return;
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data?.response || '⚠️ Sem resposta do Mycroft Sports.',
        timestamp: Date.now(),
      }]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const isAbort = err?.name === 'AbortError';
      const isNetwork = err?.message?.toLowerCase?.().includes('failed to fetch');
      let msg = '⚠️ Erro ao conectar com o Mycroft Sports. Tente novamente.';
      if (isAbort) msg = '⏱️ Tempo limite excedido (2min). A análise pode estar muito longa — tente uma pergunta mais curta.';
      else if (isNetwork) msg = '📡 Sem conexão com o servidor. Verifique sua internet.';
      else if (err?.message) msg += `\n\n_${err.message}_`;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: msg,
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const [learningFromKB, setLearningFromKB] = useState(false);

  const learnFromKB = async () => {
    if (learningFromKB || isLoading) return;
    if (kbFiles.length === 0) {
      toast({ title: '📚 Nenhum arquivo na KB. Envie documentos primeiro.', variant: 'destructive' });
      return;
    }
    setLearningFromKB(true);
    const learningPrompt = `INSTRUÇÃO ESPECIAL: Leia TODOS os documentos da Knowledge Base com atenção máxima. Para cada documento:

1. Identifique os conceitos-chave, estratégias, regras e princípios do autor
2. Extraia as lições mais importantes para trading esportivo
3. Crie regras permanentes baseadas nesses ensinamentos

Para cada regra extraída, use o formato:
"A partir de agora, [regra baseada no conteúdo do livro/documento]. Fonte: [nome do arquivo/autor]"

Priorize:
- Gestão de risco e banca
- Controle emocional e psicologia
- Critérios de entrada e saída
- Análise de value e probabilidades
- Disciplina operacional

Ao final, liste todas as regras criadas como um resumo organizado por categoria.`;
    
    setInput('');
    const userMsg: ChatMessage = { role: 'user', content: '📚 Aprender da Knowledge Base', timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '🔒 Sua sessão expirou. Faça login novamente.',
          timestamp: Date.now(),
        }]);
        setIsLoading(false);
        setLearningFromKB(false);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 3min for learning

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mycroft-sports-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            query: learningPrompt,
            conversationHistory: [],
            userId: session.user.id,
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.response || `Erro ${response.status}`);
      }
      
      const data = await response.json();
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data?.response || '⚠️ Sem resposta do Mycroft.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      toast({ title: '🧠 Mycroft aprendeu com a Knowledge Base!' });
    } catch (err) {
      console.error('KB Learning error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Erro ao processar a Knowledge Base. Os documentos podem ser muito grandes. Tente novamente.',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
      setLearningFromKB(false);
    }
  };

  const quickPrompts = [
    'Onde tem value agora?',
    'Analise o Over 0.5 HT',
    'Gestão de banca 2%',
    'O que é xG?',
    'Quando entrar ao vivo?',
    'Explique stake sizing',
  ];

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-[#0a0a0a] border border-[#FFD700]/30 rounded-xl overflow-hidden shadow-2xl shadow-[#FFD700]/10 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#FFD700]/20 bg-[#111]">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#FFD700]" />
            <span className="font-mono text-sm font-bold text-[#FFD700] uppercase tracking-wider">
              Mycroft Sports
            </span>
            {kbFiles.length > 0 && (
              <span className="text-[9px] bg-[#FFD700]/15 text-[#FFD700] px-1.5 py-0.5 rounded-full font-bold">
                {kbFiles.length} docs
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onClose(); window.location.href = '/mycroft-memory'; }}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              title="Memória do Mycroft"
            >
              <BookOpen className="w-4 h-4 text-[#FFD700]/60 hover:text-[#FFD700]" />
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors">
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>
        </div>

        {!canUseChat ? (
          <div className="p-4">
            <MycroftChatGate variant="panel" title="Chat com Mycroft Sports é Premium">
              <></>
            </MycroftChatGate>
          </div>
        ) : (
        <>

        {/* Knowledge Base Manager */}
        <div className="px-4 py-2 border-b border-[#FFD700]/10">
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-1.5 text-[10px] text-[#FFD700]/70 hover:text-[#FFD700] transition-colors"
          >
            <FileText className="w-3 h-3" />
            Knowledge Base ({kbFiles.length} arquivos)
          </button>

          <AnimatePresence>
            {showUpload && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-2 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.csv,.pdf"
                    multiple
                    onChange={handleUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/20 text-[#FFD700] text-[10px] hover:bg-[#FFD700]/20 transition-colors disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    Upload (.txt, .md, .csv, .pdf)
                  </button>
                  <button
                    onClick={learnFromKB}
                    disabled={learningFromKB || isLoading || kbFiles.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    title="Mycroft lê todos os documentos e cria regras permanentes"
                  >
                    {learningFromKB ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                    Aprender da KB
                  </button>
                </div>

                {kbFiles.length > 0 && (
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {kbFiles.map(f => (
                      <div key={f} className="flex items-center justify-between text-[10px] py-1 px-2 rounded bg-white/5">
                        <span className="text-white/60 truncate flex-1">{f}</span>
                        <button onClick={() => deleteFile(f)} className="text-red-400/60 hover:text-red-400 ml-2">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-[9px] text-white/30">
                  💡 Envie livros e materiais sobre trading esportivo (Mark Douglas, Nassim Taleb, etc). O Mycroft usará como referência nas análises.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[250px] max-h-[400px]">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <Brain className="w-10 h-10 text-[#FFD700]/20 mb-3" />
              <p className="text-xs text-white/40 font-medium">Pergunte ao Mycroft Sports</p>
              <p className="text-[10px] text-white/20 mt-1">Ele usa sua Knowledge Base + contexto dos jogos ao vivo</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                msg.role === 'user'
                  ? 'bg-[#FFD700]/15 text-[#FFD700]'
                  : 'bg-white/5 text-white/80'
              }`}>
                {msg.role === 'assistant' ? (
                  <>
                    <div className="prose prose-sm prose-invert max-w-none [&_p]:text-xs [&_p]:text-white/80 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_li]:text-xs [&_strong]:text-[#FFD700] [&_code]:text-[#FFD700] [&_code]:bg-[#FFD700]/10 [&_code]:px-1 [&_code]:rounded">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    {msg.content.includes('[HÓRUS]') && (
                      <HorusTTSPlayer text={msg.content} />
                    )}
                  </>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/5 rounded-lg px-3 py-2 flex items-center gap-2">
                <Loader2 className="w-3 h-3 text-[#FFD700] animate-spin" />
                <span className="text-[10px] text-[#FFD700]/60">Mycroft analisando...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Quick Prompts */}
        {messages.length === 0 && (
          <div className="px-4 py-2 flex flex-wrap gap-1.5 border-t border-[#FFD700]/10">
            {quickPrompts.map(p => (
              <button
                key={p}
                onClick={() => setInput(p)}
                className="text-[9px] px-2 py-1 rounded-full bg-[#FFD700]/10 text-[#FFD700]/70 hover:bg-[#FFD700]/20 hover:text-[#FFD700] transition-colors border border-[#FFD700]/10"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-[#FFD700]/20 flex items-center gap-2 bg-[#111]">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Pergunte ao Mycroft Sports..."
            className="flex-1 bg-white/5 border border-[#FFD700]/20 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-[#FFD700]/40"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="p-2 rounded-lg bg-[#FFD700]/20 text-[#FFD700] hover:bg-[#FFD700]/30 transition-colors disabled:opacity-30"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        </>
        )}
      </div>
    </motion.div>
  );
}
