import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, RotateCcw, Activity, Trophy, Users, FolderOpen, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import FileImporter from '@/components/arena-poker/FileImporter';
import SessionImportSummary from '@/components/arena-poker/SessionImportSummary';
import HandGrid from '@/components/arena-poker/HandGrid';
import HandAnalysisModal from '@/components/arena-poker/HandAnalysisModal';
import TrainingMode from '@/components/arena-poker/TrainingMode';
import TrendsAlertPanel from '@/components/arena-poker/TrendsAlertPanel';
import StreetContinuationTraining from '@/components/arena-poker/StreetContinuationTraining';
import TournamentAnalysisModal from '@/components/arena-poker/TournamentAnalysisModal';
import VillainProfilesPanel from '@/components/arena-poker/VillainProfilesPanel';
import MycroftPokerChat from '@/components/arena-poker/MycroftPokerChat';
import { parseSessionFile, parseHandHistory, type ParsedHand } from '@/lib/handHistoryParser';
import { detectPlatform } from '@/lib/platformDetector';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Phase = 'import' | 'grid' | 'training' | 'street-training';

const ArenaPoker = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('import');
  const [hands, setHands] = useState<ParsedHand[]>([]);
  const [selectedHand, setSelectedHand] = useState<ParsedHand | null>(null);
  const [trainingContext, setTrainingContext] = useState<string | undefined>();
  const [showTrends, setShowTrends] = useState(false);
  const [showTournament, setShowTournament] = useState(false);
  const [showVillains, setShowVillains] = useState(false);
  const [showMycroftPoker, setShowMycroftPoker] = useState(false);
  const [showKBTournament, setShowKBTournament] = useState(false);
  const [savedFiles, setSavedFiles] = useState<{ id: string; filename: string; hands_count: number; platform: string; created_at: string }[]>([]);
  const [showSavedFiles, setShowSavedFiles] = useState(false);

  useEffect(() => {
    loadSavedFiles();
  }, []);

  const loadSavedFiles = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('uploaded_hand_files')
      .select('id, filename, hands_count, platform, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setSavedFiles(data);
  };

  const saveFileToDatabase = async (content: string, filename: string, handsCount: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Generate hash to prevent duplicates
    const encoder = new TextEncoder();
    const data = encoder.encode(content.trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const fileHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    const platform = detectPlatform(content);
    const players = extractPlayerNames(content);

    const { data: result, error } = await supabase
      .from('uploaded_hand_files')
      .upsert({
        user_id: user.id,
        filename,
        platform,
        raw_content: content,
        hands_count: handsCount,
        players_extracted: players,
        file_hash: fileHash,
      }, { onConflict: 'user_id,file_hash' })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        toast.info('Este arquivo já foi importado anteriormente.');
      } else {
        console.error('Save file error:', error);
      }
    }

    await loadSavedFiles();
    return result?.id || null;
  };

  const extractPlayerNames = (content: string): string[] => {
    const names = new Set<string>();
    const seatMatches = content.matchAll(/Seat \d+: (\S+)/g);
    for (const m of seatMatches) {
      names.add(m[1]);
    }
    return Array.from(names);
  };

  const handleImport = async (content: string) => {
    const parsed = parseSessionFile(content);
    if (parsed.length === 0) {
      const single = parseHandHistory(content);
      if (single) {
        setHands([single]);
        setPhase('grid');
        toast.success(`Sessão Importada: 1 mão detectada`);
        saveFileToDatabase(content, `hand_${Date.now()}.txt`, 1);
        return;
      }
      toast.error('Nenhuma mão detectada. Verifique o formato do arquivo.');
      return;
    }
    setHands(parsed);
    setPhase('grid');
    toast.success(`Sessão Importada: ${parsed.length} mãos detectadas`);
    saveFileToDatabase(content, `session_${Date.now()}.txt`, parsed.length);
  };

  const loadSavedFile = async (fileId: string) => {
    const { data } = await supabase
      .from('uploaded_hand_files')
      .select('raw_content')
      .eq('id', fileId)
      .single();

    if (data?.raw_content) {
      const parsed = parseSessionFile(data.raw_content);
      if (parsed.length > 0) {
        setHands(parsed);
        setPhase('grid');
        setShowSavedFiles(false);
        toast.success(`Sessão carregada: ${parsed.length} mãos`);
      }
    }
  };

  const resetAll = () => {
    setPhase('import');
    setHands([]);
    setSelectedHand(null);
    setTrainingContext(undefined);
    setShowTrends(false);
  };

  const startTraining = (handContext: string) => {
    setSelectedHand(null);
    setTrainingContext(handContext);
    setPhase('training');
  };

  if (phase === 'street-training') {
    return (
      <StreetContinuationTraining
        onBack={() => setPhase('import')}
      />
    );
  }

  if (phase === 'training') {
    return (
      <TrainingMode
        onBack={() => setPhase('grid')}
        handContext={trainingContext}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/lobby')} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[hsl(var(--arena-gold))]" />
              <h1 className="font-mono text-sm font-bold uppercase tracking-[0.15em]">
                <span className="text-[hsl(var(--arena-gold))]">Arena</span>{' '}
                <span className="text-[hsl(var(--arena-cyan))]">Poker</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {phase === 'import' && (
              <>
                {savedFiles.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSavedFiles(!showSavedFiles)}
                    className="font-mono text-xs uppercase tracking-wider border-[hsl(var(--arena-cyan)_/_0.4)] text-[hsl(var(--arena-cyan))] hover:bg-[hsl(var(--arena-cyan)_/_0.1)]"
                  >
                    <FolderOpen className="w-3 h-3 mr-1.5" />
                    Sessões Salvas ({savedFiles.length})
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMycroftPoker(!showMycroftPoker)}
                  className="font-mono text-xs uppercase tracking-wider border-[hsl(var(--arena-cyan)_/_0.4)] text-[hsl(var(--arena-cyan))] hover:bg-[hsl(var(--arena-cyan)_/_0.1)]"
                >
                  <BookOpen className="w-3 h-3 mr-1.5" />
                  KB & Chat
                </Button>
              </>
            )}
            {phase === 'grid' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMycroftPoker(!showMycroftPoker)}
                  className="font-mono text-xs uppercase tracking-wider border-[hsl(var(--arena-cyan)_/_0.4)] text-[hsl(var(--arena-cyan))] hover:bg-[hsl(var(--arena-cyan)_/_0.1)]"
                >
                  <BookOpen className="w-3 h-3 mr-1.5" />
                  KB & Chat
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVillains(true)}
                  className="font-mono text-xs uppercase tracking-wider border-[hsl(var(--arena-cyan)_/_0.4)] text-[hsl(var(--arena-cyan))] hover:bg-[hsl(var(--arena-cyan)_/_0.1)]"
                >
                  <Users className="w-3 h-3 mr-1.5" />
                  Vilões
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTournament(true)}
                  className="font-mono text-xs uppercase tracking-wider border-[hsl(var(--arena-gold)_/_0.4)] text-[hsl(var(--arena-gold))] hover:bg-[hsl(var(--arena-gold)_/_0.1)]"
                >
                  <Trophy className="w-3 h-3 mr-1.5" />
                  Torneio
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowKBTournament(true)}
                  className="font-mono text-xs uppercase tracking-wider border-[hsl(var(--arena-cyan)_/_0.4)] text-[hsl(var(--arena-cyan))] hover:bg-[hsl(var(--arena-cyan)_/_0.1)]"
                >
                  <BookOpen className="w-3 h-3 mr-1.5" />
                  Torneio KB
                </Button>
                {hands.length >= 3 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTrends(true)}
                    className="font-mono text-xs uppercase tracking-wider border-[hsl(var(--arena-cyan)_/_0.4)] text-[hsl(var(--arena-cyan))] hover:bg-[hsl(var(--arena-cyan)_/_0.1)]"
                  >
                    <Activity className="w-3 h-3 mr-1.5" />
                    Tendências
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetAll}
                  className="font-mono text-xs uppercase tracking-wider border-border text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="w-3 h-3 mr-1.5" />
                  Nova Sessão
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-6">
        {phase === 'import' && (
          <div className="space-y-6">
            <FileImporter onImport={handleImport} />

            {/* Saved files list */}
            {showSavedFiles && savedFiles.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
                <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-[hsl(var(--arena-cyan))] mb-3">
                  Sessões Anteriores
                </h3>
                <div className="space-y-2">
                  {savedFiles.map(file => (
                    <div
                      key={file.id}
                      onClick={() => loadSavedFile(file.id)}
                      className="border border-border/50 rounded-lg p-3 cursor-pointer hover:border-[hsl(var(--arena-cyan)_/_0.4)] hover:bg-[hsl(var(--arena-cyan)_/_0.02)] transition-all flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono text-sm text-foreground">{file.filename}</span>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="font-mono text-[10px] text-muted-foreground">{file.hands_count} mãos</span>
                          <span className="font-mono text-[10px] text-[hsl(var(--arena-cyan))]">{file.platform}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {new Date(file.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                      <FolderOpen className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Mycroft Poker KB + Chat */}
            {showMycroftPoker && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
                <MycroftPokerChat />
              </motion.div>
            )}
          </div>
        )}
        {phase === 'grid' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <SessionImportSummary hands={hands} />
            <HandGrid hands={hands} onSelectHand={setSelectedHand} />
            {showMycroftPoker && (
              <MycroftPokerChat />
            )}
          </motion.div>
        )}
      </main>

      {selectedHand && (
        <HandAnalysisModal
          hand={selectedHand}
          onClose={() => setSelectedHand(null)}
          onStartTraining={startTraining}
          onStartStreetTraining={() => {
            setSelectedHand(null);
            setPhase('street-training');
          }}
        />
      )}

      {showTrends && (
        <TrendsAlertPanel
          hands={hands}
          onClose={() => setShowTrends(false)}
        />
      )}

      {showTournament && (
        <TournamentAnalysisModal
          hands={hands}
          onClose={() => setShowTournament(false)}
        />
      )}

      {showVillains && (
        <VillainProfilesPanel
          hands={hands}
          onClose={() => setShowVillains(false)}
        />
      )}

      {showKBTournament && (
        <TournamentAnalysisModal
          hands={hands}
          onClose={() => setShowKBTournament(false)}
          useKB
        />
      )}
    </div>
  );
};

export default ArenaPoker;
