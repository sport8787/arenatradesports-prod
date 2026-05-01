import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Upload, Trash2, FileText, Brain, ChevronDown, ChevronUp, Loader2, FileUp, BookOpen, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import { extractTextFromPdf } from '@/services/pdfExtractService';
import HorusTTSPlayer from '@/components/chat/HorusTTSPlayer';
import MycroftChatGate from '@/components/mycroft/MycroftChatGate';
import { useSubscription } from '@/hooks/useSubscription';
import { useAdmin } from '@/hooks/useAdmin';

interface MarketData {
  asset?: string;
  symbol?: string;
  timeframe?: string;
  price?: number;
  sma9?: number | null;
  sma21?: number | null;
  rsi?: number | null;
  bollingerUpper?: number | null;
  bollingerLower?: number | null;
  volume?: number;
  change24h?: number;
  isLive?: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface MycroftAnalystChatProps {
  marketData?: MarketData;
}

export default function MycroftAnalystChat({ marketData }: MycroftAnalystChatProps) {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [kbFiles, setKbFiles] = useState<string[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isPaid, subscription } = useSubscription();
  const { isAdmin } = useAdmin();
  const canUseChat = isAdmin || (isPaid && subscription?.plan === 'premium');

  // Load KB file list
  useEffect(() => {
    loadKBFiles();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadKBFiles = async () => {
    try {
      const { data, error } = await supabase.storage.from('knowledge-base').list('', { limit: 50 });
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

        // Auto-convert PDF to TXT
        if (ext === 'pdf') {
          toast({ title: `📄 Convertendo ${file.name} para texto...` });
          try {
            const text = await extractTextFromPdf(file);
            if (!text || text.trim().length < 50) {
              toast({ title: `⚠️ ${file.name}: PDF sem texto extraível (escaneado?). Tente um PDF com texto selecionável.`, variant: 'destructive' });
              continue;
            }
            uploadFile = new Blob([text], { type: 'text/plain' });
            uploadName = file.name.replace(/\.pdf$/i, '.txt');
            toast({ title: `✅ ${file.name} convertido (${(text.length / 1024).toFixed(0)}KB de texto)` });
          } catch (pdfErr) {
            console.error('PDF conversion error:', pdfErr);
            toast({ title: `❌ Erro ao converter ${file.name}. Tente converter manualmente.`, variant: 'destructive' });
            continue;
          }
        }

        const { error } = await supabase.storage
          .from('knowledge-base')
          .upload(uploadName, uploadFile, { upsert: true });

        if (error) throw error;
        uploaded++;
      } catch (err) {
        console.error(`Upload error for ${file.name}:`, err);
        toast({ title: `❌ Erro ao enviar ${file.name}`, variant: 'destructive' });
      }
    }

    if (uploaded > 0) {
      toast({ title: `📚 ${uploaded} arquivo(s) adicionado(s) à Knowledge Base` });
      await loadKBFiles();
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteFile = async (fileName: string) => {
    try {
      const { error } = await supabase.storage.from('knowledge-base').remove([fileName]);
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
      const { data, error } = await supabase.functions.invoke('mycroft-analyst-chat', {
        body: {
          query: userMsg.content,
          marketData,
          conversationHistory: messages.slice(-10),
          userId: session?.user?.id || null,
        },
      });

      if (error) throw error;

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data?.response || '⚠️ Sem resposta do Mycroft.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Erro ao conectar com o Mycroft Analyst. Tente novamente.',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    'Analise esse setup',
    'Qual a confluência?',
    'Posso entrar agora?',
    'Explique o RSI atual',
  ];

  return (
    <div className="bg-[#0a0a0a] border border-amber-900/40 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-amber-400" />
          <span className="font-orbitron text-xs font-bold text-amber-400 uppercase tracking-wider">
            Mycroft Analyst
          </span>
          {!canUseChat && <Lock className="w-3 h-3 text-amber-400/50" />}
          {kbFiles.length > 0 && (
            <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-bold">
              {kbFiles.length} docs
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <a
            href="/mycroft-memory"
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Memória do Mycroft"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400/60 hover:text-amber-400" />
          </a>
          {expanded ? <ChevronUp className="w-4 h-4 text-amber-400/60" /> : <ChevronDown className="w-4 h-4 text-amber-400/60" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {!canUseChat ? (
              <MycroftChatGate variant="inline" title="Chat com Mycroft Analyst é Premium">
                <></>
              </MycroftChatGate>
            ) : (
              <>
            {/* Knowledge Base Manager */}
            <div className="px-4 py-2 border-t border-amber-900/20">
              <button
                onClick={() => setShowUpload(!showUpload)}
                className="flex items-center gap-1.5 text-[10px] text-amber-400/70 hover:text-amber-400 transition-colors"
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
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                      >
                        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                        Upload (.txt, .md, .csv, .pdf)
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
                      💡 Envie seus PDFs de cursos e livros de trade. O sistema converte automaticamente para texto (.txt) antes de armazenar. O Mycroft usará como referência nas análises.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Chat Messages */}
            <div className="h-[300px] overflow-y-auto px-4 py-2 space-y-3 border-t border-amber-900/20">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Brain className="w-8 h-8 text-amber-400/20 mb-2" />
                  <p className="text-xs text-white/30">Faça sua pergunta ao Mycroft Analyst</p>
                  <p className="text-[10px] text-white/20 mt-1">Ele usa dados de mercado em tempo real + sua Knowledge Base</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                    msg.role === 'user'
                      ? 'bg-amber-500/20 text-amber-100'
                      : 'bg-white/5 text-white/80'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <>
                        <div className="prose prose-sm prose-invert max-w-none [&_p]:text-xs [&_p]:text-white/80 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_li]:text-xs [&_strong]:text-amber-400 [&_code]:text-amber-300 [&_code]:bg-amber-500/10 [&_code]:px-1 [&_code]:rounded">
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
                    <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                    <span className="text-[10px] text-amber-400/60">Mycroft analisando...</span>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Quick Prompts */}
            {messages.length === 0 && (
              <div className="px-4 py-2 flex flex-wrap gap-1.5">
                {quickPrompts.map(p => (
                  <button
                    key={p}
                    onClick={() => { setInput(p); }}
                    className="text-[9px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400/70 hover:bg-amber-500/20 hover:text-amber-400 transition-colors border border-amber-500/10"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="px-4 py-3 border-t border-amber-900/20 flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Pergunte ao Mycroft Analyst..."
                className="flex-1 bg-white/5 border border-amber-900/20 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="p-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-30"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
