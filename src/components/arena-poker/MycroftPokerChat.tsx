import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Upload, Trash2, FileText, Brain, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import { extractTextFromPdf } from '@/services/pdfExtractService';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface MycroftPokerChatProps {
  handContext?: string;
}

export default function MycroftPokerChat({ handContext }: MycroftPokerChatProps) {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [kbFiles, setKbFiles] = useState<string[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadKBFiles();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadKBFiles = async () => {
    try {
      const { data, error } = await supabase.storage.from('poker-knowledge-base').list('', { limit: 50 });
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
          .from('poker-knowledge-base')
          .upload(uploadName, uploadFile, { upsert: true });

        if (error) throw error;
        uploaded++;
      } catch (err) {
        console.error(`Upload error for ${file.name}:`, err);
        toast({ title: `❌ Erro ao enviar ${file.name}`, variant: 'destructive' });
      }
    }

    if (uploaded > 0) {
      toast({ title: `📚 ${uploaded} arquivo(s) adicionado(s) à Knowledge Base Poker` });
      await loadKBFiles();
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteFile = async (fileName: string) => {
    try {
      const { error } = await supabase.storage.from('poker-knowledge-base').remove([fileName]);
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
      const { data, error } = await supabase.functions.invoke('mycroft-poker-chat', {
        body: {
          query: userMsg.content,
          handContext,
          conversationHistory: messages.slice(-10),
        },
      });

      if (error) throw error;

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data?.response || '⚠️ Sem resposta do Mycroft Poker.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Erro ao conectar com o Mycroft Poker. Tente novamente.',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    'Analise minha última mão',
    'Como jogar AKo OOP?',
    'Devo 3-bet aqui?',
    'Explique pot odds',
  ];

  return (
    <div className="bg-black/80 border border-[hsl(var(--arena-cyan)_/_0.3)] rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-[hsl(var(--arena-cyan))]" />
          <span className="font-mono text-xs font-bold text-[hsl(var(--arena-cyan))] uppercase tracking-[0.15em]">
            Mycroft Poker
          </span>
          {kbFiles.length > 0 && (
            <span className="text-[9px] bg-[hsl(var(--arena-cyan)_/_0.2)] text-[hsl(var(--arena-cyan))] px-1.5 py-0.5 rounded-full font-bold">
              {kbFiles.length} docs
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-[hsl(var(--arena-cyan)_/_0.6)]" /> : <ChevronDown className="w-4 h-4 text-[hsl(var(--arena-cyan)_/_0.6)]" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Knowledge Base Manager */}
            <div className="px-4 py-2 border-t border-[hsl(var(--arena-cyan)_/_0.15)]">
              <button
                onClick={() => setShowUpload(!showUpload)}
                className="flex items-center gap-1.5 text-[10px] text-[hsl(var(--arena-cyan)_/_0.7)] hover:text-[hsl(var(--arena-cyan))] transition-colors"
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
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--arena-cyan)_/_0.1)] border border-[hsl(var(--arena-cyan)_/_0.2)] text-[hsl(var(--arena-cyan))] text-[10px] hover:bg-[hsl(var(--arena-cyan)_/_0.2)] transition-colors disabled:opacity-50"
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
                      💡 Envie seus PDFs de livros e cursos de poker. O sistema converte automaticamente para texto (.txt) antes de armazenar. O Mycroft usará como referência nas análises.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Chat Messages */}
            <div className="h-[300px] overflow-y-auto px-4 py-2 space-y-3 border-t border-[hsl(var(--arena-cyan)_/_0.15)]">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Brain className="w-8 h-8 text-[hsl(var(--arena-cyan)_/_0.2)] mb-2" />
                  <p className="text-xs text-white/30">Faça sua pergunta ao Mycroft Poker</p>
                  <p className="text-[10px] text-white/20 mt-1">Ele usa sua Knowledge Base + contexto da mão analisada</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                    msg.role === 'user'
                      ? 'bg-[hsl(var(--arena-gold)_/_0.15)] text-[hsl(var(--arena-gold))]'
                      : 'bg-white/5 text-white/80'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm prose-invert max-w-none [&_p]:text-xs [&_p]:text-white/80 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_li]:text-xs [&_strong]:text-[hsl(var(--arena-cyan))] [&_code]:text-[hsl(var(--arena-cyan))] [&_code]:bg-[hsl(var(--arena-cyan)_/_0.1)] [&_code]:px-1 [&_code]:rounded">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Loader2 className="w-3 h-3 text-[hsl(var(--arena-cyan))] animate-spin" />
                    <span className="text-[10px] text-[hsl(var(--arena-cyan)_/_0.6)]">Mycroft analisando...</span>
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
                    onClick={() => setInput(p)}
                    className="text-[9px] px-2 py-1 rounded-full bg-[hsl(var(--arena-cyan)_/_0.1)] text-[hsl(var(--arena-cyan)_/_0.7)] hover:bg-[hsl(var(--arena-cyan)_/_0.2)] hover:text-[hsl(var(--arena-cyan))] transition-colors border border-[hsl(var(--arena-cyan)_/_0.1)]"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="px-4 py-3 border-t border-[hsl(var(--arena-cyan)_/_0.15)] flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Pergunte ao Mycroft Poker..."
                className="flex-1 bg-white/5 border border-[hsl(var(--arena-cyan)_/_0.2)] rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-white/30 focus:outline-none focus:border-[hsl(var(--arena-cyan)_/_0.4)]"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="p-2 rounded-lg bg-[hsl(var(--arena-cyan)_/_0.2)] text-[hsl(var(--arena-cyan))] hover:bg-[hsl(var(--arena-cyan)_/_0.3)] transition-colors disabled:opacity-30"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
