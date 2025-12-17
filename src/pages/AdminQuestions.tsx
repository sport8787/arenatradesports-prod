import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import LuxuryCard from '@/components/game/LuxuryCard';
import GoldButton from '@/components/game/GoldButton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { 
  Shield, Home, Plus, Upload, Trash2, Edit, Search, 
  AlertTriangle, CheckCircle, Loader2, X, Copy, FileText
} from 'lucide-react';

type AnswerOption = 'A' | 'B' | 'C' | 'D';
type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

interface Question {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: AnswerOption;
  category: string;
  difficulty: DifficultyLevel;
  created_at: string;
}

interface DuplicateGroup {
  text: string;
  questions: Question[];
}

const EMPTY_QUESTION: Omit<Question, 'id' | 'created_at'> = {
  question_text: '',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  correct_option: 'A',
  category: 'Geral',
  difficulty: 'Medium',
};

export default function AdminQuestions() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  const [editingQuestion, setEditingQuestion] = useState<Omit<Question, 'id' | 'created_at'> & { id?: string }>(EMPTY_QUESTION);
  const [deletingQuestion, setDeletingQuestion] = useState<Question | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [importData, setImportData] = useState<string>('');
  const [importPreview, setImportPreview] = useState<Omit<Question, 'id' | 'created_at'>[]>([]);

  // Load questions
  useEffect(() => {
    if (isAdmin) {
      loadQuestions();
    }
  }, [isAdmin]);

  // Filter questions
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredQuestions(questions);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredQuestions(
        questions.filter(q => 
          q.question_text.toLowerCase().includes(term) ||
          q.category.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, questions]);

  const loadQuestions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro ao carregar perguntas', variant: 'destructive' });
    } else {
      setQuestions(data as Question[]);
    }
    setLoading(false);
  };

  const detectDuplicates = () => {
    const textMap = new Map<string, Question[]>();
    
    questions.forEach(q => {
      const normalizedText = q.question_text.trim().toLowerCase().replace(/\s+/g, ' ');
      const existing = textMap.get(normalizedText) || [];
      existing.push(q);
      textMap.set(normalizedText, existing);
    });

    const dupes: DuplicateGroup[] = [];
    textMap.forEach((qs, text) => {
      if (qs.length > 1) {
        dupes.push({ text, questions: qs });
      }
    });

    setDuplicates(dupes);
    setShowDuplicatesModal(true);
  };

  const removeDuplicate = async (questionId: string) => {
    const { error } = await supabase.from('questions').delete().eq('id', questionId);
    
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Duplicata removida' });
      await loadQuestions();
      // Update duplicates list
      setDuplicates(prev => 
        prev.map(group => ({
          ...group,
          questions: group.questions.filter(q => q.id !== questionId)
        })).filter(group => group.questions.length > 1)
      );
    }
  };

  const removeAllDuplicates = async () => {
    let removed = 0;
    
    for (const group of duplicates) {
      // Keep the first one, delete the rest
      const toDelete = group.questions.slice(1);
      for (const q of toDelete) {
        const { error } = await supabase.from('questions').delete().eq('id', q.id);
        if (!error) removed++;
      }
    }

    toast({ title: `${removed} duplicatas removidas` });
    await loadQuestions();
    setDuplicates([]);
    setShowDuplicatesModal(false);
  };

  const openEditModal = (question?: Question) => {
    if (question) {
      setEditingQuestion({
        id: question.id,
        question_text: question.question_text,
        option_a: question.option_a,
        option_b: question.option_b,
        option_c: question.option_c,
        option_d: question.option_d,
        correct_option: question.correct_option,
        category: question.category,
        difficulty: question.difficulty,
      });
    } else {
      setEditingQuestion({ ...EMPTY_QUESTION });
    }
    setShowEditModal(true);
  };

  const saveQuestion = async () => {
    if (!editingQuestion.question_text.trim()) {
      toast({ title: 'Texto da pergunta é obrigatório', variant: 'destructive' });
      return;
    }

    setSaving(true);

    const payload = {
      question_text: editingQuestion.question_text.trim(),
      option_a: editingQuestion.option_a.trim(),
      option_b: editingQuestion.option_b.trim(),
      option_c: editingQuestion.option_c.trim(),
      option_d: editingQuestion.option_d.trim(),
      correct_option: editingQuestion.correct_option,
      category: editingQuestion.category.trim() || 'Geral',
      difficulty: editingQuestion.difficulty,
    };

    if (editingQuestion.id) {
      const { error } = await supabase
        .from('questions')
        .update(payload)
        .eq('id', editingQuestion.id);

      if (error) {
        toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Pergunta atualizada' });
        setShowEditModal(false);
        await loadQuestions();
      }
    } else {
      const { error } = await supabase.from('questions').insert(payload);

      if (error) {
        toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Pergunta criada' });
        setShowEditModal(false);
        await loadQuestions();
      }
    }

    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!deletingQuestion) return;

    const { error } = await supabase.from('questions').delete().eq('id', deletingQuestion.id);

    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Pergunta excluída' });
      await loadQuestions();
    }

    setShowDeleteModal(false);
    setDeletingQuestion(null);
  };

  const parseCSV = (csv: string): Omit<Question, 'id' | 'created_at'>[] => {
    const lines = csv.trim().split('\n');
    const result: Omit<Question, 'id' | 'created_at'>[] = [];

    // Skip header if present
    const startIndex = lines[0]?.toLowerCase().includes('question') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV considering quoted values
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      if (values.length >= 6) {
        result.push({
          question_text: values[0] || '',
          option_a: values[1] || '',
          option_b: values[2] || '',
          option_c: values[3] || '',
          option_d: values[4] || '',
          correct_option: (['A', 'B', 'C', 'D'].includes(values[5]?.toUpperCase()) 
            ? values[5].toUpperCase() 
            : 'A') as AnswerOption,
          category: values[6] || 'Geral',
          difficulty: (['Easy', 'Medium', 'Hard'].includes(values[7]) 
            ? values[7] 
            : 'Medium') as DifficultyLevel,
        });
      }
    }

    return result;
  };

  const handleImportChange = (value: string) => {
    setImportData(value);
    if (value.trim()) {
      const parsed = parseCSV(value);
      setImportPreview(parsed);
    } else {
      setImportPreview([]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleImportChange(text);
    };
    reader.readAsText(file);
  };

  const importQuestions = async () => {
    if (importPreview.length === 0) {
      toast({ title: 'Nenhuma pergunta para importar', variant: 'destructive' });
      return;
    }

    setSaving(true);
    let imported = 0;
    let errors = 0;

    for (const q of importPreview) {
      const { error } = await supabase.from('questions').insert(q);
      if (error) {
        errors++;
      } else {
        imported++;
      }
    }

    toast({ 
      title: `Importação concluída`, 
      description: `${imported} importadas, ${errors} erros` 
    });

    setShowImportModal(false);
    setImportData('');
    setImportPreview([]);
    await loadQuestions();
    setSaving(false);
  };

  // Auth/Admin loading state
  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <LuxuryCard className="max-w-md text-center space-y-4">
          <Shield className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="font-orbitron text-2xl text-primary">Acesso Restrito</h1>
          <p className="text-muted-foreground">Você precisa estar logado para acessar esta página.</p>
          <GoldButton onClick={() => navigate('/auth')} className="w-full">
            Fazer Login
          </GoldButton>
        </LuxuryCard>
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <LuxuryCard className="max-w-md text-center space-y-4">
          <Shield className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="font-orbitron text-2xl text-primary">Acesso Negado</h1>
          <p className="text-muted-foreground">Você não tem permissão de administrador.</p>
          <GoldButton onClick={() => navigate('/')} className="w-full">
            <Home className="w-4 h-4 mr-2" />
            Voltar ao Início
          </GoldButton>
        </LuxuryCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="font-orbitron text-3xl text-primary flex items-center gap-3">
              <Shield className="w-8 h-8" />
              Painel Admin
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerenciamento do Banco de Perguntas ({questions.length} perguntas)
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/')}>
            <Home className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>

        {/* Actions Bar */}
        <LuxuryCard className="flex flex-wrap gap-3 items-center">
          <GoldButton onClick={() => openEditModal()} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Nova Pergunta
          </GoldButton>
          
          <Button variant="secondary" onClick={() => setShowImportModal(true)} size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Importar CSV
          </Button>

          <Button 
            variant="outline" 
            onClick={detectDuplicates} 
            size="sm"
            className="border-amber-600/50 text-amber-500 hover:bg-amber-900/20"
          >
            <Copy className="w-4 h-4 mr-2" />
            Detectar Duplicatas
          </Button>

          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pergunta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-secondary"
              />
            </div>
          </div>
        </LuxuryCard>

        {/* Questions List */}
        <LuxuryCard className="p-0 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchTerm ? 'Nenhuma pergunta encontrada' : 'Nenhuma pergunta cadastrada'}
            </div>
          ) : (
            <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
              {filteredQuestions.map((q, idx) => (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="p-4 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground line-clamp-2">
                        {q.question_text}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2 text-xs">
                        <span className="px-2 py-0.5 rounded bg-primary/20 text-primary">
                          {q.category}
                        </span>
                        <span className={`px-2 py-0.5 rounded ${
                          q.difficulty === 'Easy' ? 'bg-green-500/20 text-green-400' :
                          q.difficulty === 'Hard' ? 'bg-red-500/20 text-red-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {q.difficulty}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400">
                          Resposta: {q.correct_option}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => openEditModal(q)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeletingQuestion(q);
                          setShowDeleteModal(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </LuxuryCard>
      </div>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion.id ? 'Editar Pergunta' : 'Nova Pergunta'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Pergunta</label>
              <Textarea
                value={editingQuestion.question_text}
                onChange={(e) => setEditingQuestion(prev => ({ ...prev, question_text: e.target.value }))}
                placeholder="Texto da pergunta..."
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Opção A</label>
                <Input
                  value={editingQuestion.option_a}
                  onChange={(e) => setEditingQuestion(prev => ({ ...prev, option_a: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Opção B</label>
                <Input
                  value={editingQuestion.option_b}
                  onChange={(e) => setEditingQuestion(prev => ({ ...prev, option_b: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Opção C</label>
                <Input
                  value={editingQuestion.option_c}
                  onChange={(e) => setEditingQuestion(prev => ({ ...prev, option_c: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Opção D</label>
                <Input
                  value={editingQuestion.option_d}
                  onChange={(e) => setEditingQuestion(prev => ({ ...prev, option_d: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Resposta Correta</label>
                <Select
                  value={editingQuestion.correct_option}
                  onValueChange={(v) => setEditingQuestion(prev => ({ ...prev, correct_option: v as AnswerOption }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                    <SelectItem value="D">D</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <Input
                  value={editingQuestion.category}
                  onChange={(e) => setEditingQuestion(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="Ex: História"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Dificuldade</label>
                <Select
                  value={editingQuestion.difficulty}
                  onValueChange={(v) => setEditingQuestion(prev => ({ ...prev, difficulty: v as DifficultyLevel }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Easy">Fácil</SelectItem>
                    <SelectItem value="Medium">Médio</SelectItem>
                    <SelectItem value="Hard">Difícil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <GoldButton onClick={saveQuestion} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar
            </GoldButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta pergunta? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          
          {deletingQuestion && (
            <div className="p-3 bg-secondary rounded-lg text-sm">
              {deletingQuestion.question_text}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicates Modal */}
      <Dialog open={showDuplicatesModal} onOpenChange={setShowDuplicatesModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Perguntas Duplicadas ({duplicates.length} grupos)
            </DialogTitle>
            <DialogDescription>
              Perguntas com o mesmo texto detectadas. Você pode remover individualmente ou todas de uma vez.
            </DialogDescription>
          </DialogHeader>
          
          {duplicates.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma duplicata encontrada!</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {duplicates.map((group, idx) => (
                <div key={idx} className="border border-border rounded-lg p-4">
                  <p className="font-medium mb-2 line-clamp-2">{group.questions[0].question_text}</p>
                  <div className="space-y-2">
                    {group.questions.map((q, qIdx) => (
                      <div key={q.id} className="flex items-center justify-between text-sm bg-secondary/50 p-2 rounded">
                        <span className="text-muted-foreground">
                          {qIdx === 0 ? '✓ Manter' : `#${qIdx + 1} - ${q.category}`}
                        </span>
                        {qIdx > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => removeDuplicate(q.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicatesModal(false)}>
              Fechar
            </Button>
            {duplicates.length > 0 && (
              <Button variant="destructive" onClick={removeAllDuplicates}>
                <Trash2 className="w-4 h-4 mr-2" />
                Remover Todas Duplicatas
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Importar Perguntas via CSV
            </DialogTitle>
            <DialogDescription>
              Formato: pergunta,opção_a,opção_b,opção_c,opção_d,resposta(A/B/C/D),categoria,dificuldade
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <input
                type="file"
                accept=".csv,.txt"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                Selecionar Arquivo CSV
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground">ou cole diretamente</div>

            <Textarea
              value={importData}
              onChange={(e) => handleImportChange(e.target.value)}
              placeholder="Cole os dados CSV aqui..."
              className="min-h-[150px] font-mono text-sm"
            />

            {importPreview.length > 0 && (
              <div className="border border-border rounded-lg p-4">
                <p className="font-medium mb-2">
                  Preview: {importPreview.length} perguntas detectadas
                </p>
                <div className="max-h-[200px] overflow-y-auto space-y-2 text-sm">
                  {importPreview.slice(0, 5).map((q, idx) => (
                    <div key={idx} className="bg-secondary/50 p-2 rounded">
                      <p className="line-clamp-1">{q.question_text}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Resposta: {q.correct_option} | {q.category} | {q.difficulty}
                      </p>
                    </div>
                  ))}
                  {importPreview.length > 5 && (
                    <p className="text-muted-foreground text-center">
                      ...e mais {importPreview.length - 5} perguntas
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowImportModal(false);
              setImportData('');
              setImportPreview([]);
            }}>
              Cancelar
            </Button>
            <GoldButton onClick={importQuestions} disabled={saving || importPreview.length === 0}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Importar {importPreview.length} Perguntas
            </GoldButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
