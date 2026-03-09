import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import LuxuryCard from '@/components/game/LuxuryCard';
import GoldButton from '@/components/game/GoldButton';
import ApiHealthChecker from '@/components/admin/ApiHealthChecker';
import { 
  Shield, Home, Plus, Copy, Trash2, RefreshCw, 
  Briefcase, Check, X, User, Calendar, Clock
} from 'lucide-react';
import { toast } from 'sonner';

interface FounderCase {
  id: string;
  case_code: string;
  user_id: string | null;
  is_active: boolean;
  activated_at: string | null;
  expires_at: string | null;
  created_at: string;
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'MF-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function AdminFounderCases() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [cases, setCases] = useState<FounderCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expirationDays, setExpirationDays] = useState<number>(365);

  const loadCases = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('founder_cases')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading founder cases:', error);
      toast.error('Erro ao carregar códigos');
    } else {
      setCases(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) {
      loadCases();
    }
  }, [isAdmin]);

  const generateNewCode = async () => {
    setGenerating(true);
    const newCode = generateCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    const { error } = await supabase
      .from('founder_cases')
      .insert({
        case_code: newCode,
        expires_at: expiresAt.toISOString(),
        is_active: true
      });

    if (error) {
      console.error('Error generating code:', error);
      toast.error('Erro ao gerar código');
    } else {
      toast.success(`Código ${newCode} gerado com sucesso!`);
      loadCases();
    }
    setGenerating(false);
  };

  const generateBulkCodes = async (quantity: number) => {
    setGenerating(true);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    const newCodes = Array.from({ length: quantity }, () => ({
      case_code: generateCode(),
      expires_at: expiresAt.toISOString(),
      is_active: true
    }));

    const { error } = await supabase
      .from('founder_cases')
      .insert(newCodes);

    if (error) {
      console.error('Error generating bulk codes:', error);
      toast.error('Erro ao gerar códigos em lote');
    } else {
      toast.success(`${quantity} códigos gerados com sucesso!`);
      loadCases();
    }
    setGenerating(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado!');
  };

  const deactivateCode = async (id: string) => {
    const { error } = await supabase
      .from('founder_cases')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao desativar código');
    } else {
      toast.success('Código desativado');
      loadCases();
    }
  };

  const deleteCode = async (id: string) => {
    const { error } = await supabase
      .from('founder_cases')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir código');
    } else {
      toast.success('Código excluído');
      loadCases();
    }
  };

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

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

  const activeCases = cases.filter(c => c.is_active && !c.user_id);
  const usedCases = cases.filter(c => c.user_id);
  const expiredCases = cases.filter(c => !c.is_active || (c.expires_at && new Date(c.expires_at) < new Date()));

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <Briefcase className="w-8 h-8 text-primary" />
            <h1 className="font-orbitron text-2xl md:text-3xl text-primary">
              Maletas Fundador
            </h1>
          </div>
          <GoldButton onClick={() => navigate('/')} variant="outline" size="sm">
            <Home className="w-4 h-4 mr-2" />
            Início
          </GoldButton>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <LuxuryCard className="text-center p-4">
            <div className="text-3xl font-bold text-primary">{cases.length}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </LuxuryCard>
          <LuxuryCard className="text-center p-4">
            <div className="text-3xl font-bold text-green-500">{activeCases.length}</div>
            <div className="text-sm text-muted-foreground">Disponíveis</div>
          </LuxuryCard>
          <LuxuryCard className="text-center p-4">
            <div className="text-3xl font-bold text-blue-500">{usedCases.length}</div>
            <div className="text-sm text-muted-foreground">Em Uso</div>
          </LuxuryCard>
          <LuxuryCard className="text-center p-4">
            <div className="text-3xl font-bold text-muted-foreground">{expiredCases.length}</div>
            <div className="text-sm text-muted-foreground">Expirados</div>
          </LuxuryCard>
        </div>

        {/* Generate Section */}
        <LuxuryCard className="p-6 space-y-4">
          <h2 className="font-orbitron text-lg text-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Gerar Novos Códigos
          </h2>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Validade (dias):</label>
              <select
                value={expirationDays}
                onChange={(e) => setExpirationDays(Number(e.target.value))}
                className="bg-background border border-border rounded px-3 py-1.5 text-foreground"
              >
                <option value={30}>30 dias</option>
                <option value={90}>90 dias</option>
                <option value={180}>180 dias</option>
                <option value={365}>1 ano</option>
                <option value={730}>2 anos</option>
                <option value={99999}>Sem expiração</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <GoldButton onClick={generateNewCode} disabled={generating}>
              <Plus className="w-4 h-4 mr-2" />
              Gerar 1 Código
            </GoldButton>
            <GoldButton onClick={() => generateBulkCodes(5)} disabled={generating} variant="outline">
              Gerar 5 Códigos
            </GoldButton>
            <GoldButton onClick={() => generateBulkCodes(10)} disabled={generating} variant="outline">
              Gerar 10 Códigos
            </GoldButton>
            <GoldButton onClick={loadCases} disabled={loading} variant="ghost" size="sm">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </GoldButton>
          </div>
        </LuxuryCard>

        {/* Available Codes */}
        <LuxuryCard className="p-6 space-y-4">
          <h2 className="font-orbitron text-lg text-green-500 flex items-center gap-2">
            <Check className="w-5 h-5" />
            Códigos Disponíveis ({activeCases.length})
          </h2>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
            </div>
          ) : activeCases.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhum código disponível. Gere novos códigos acima.
            </p>
          ) : (
            <div className="grid gap-3">
              {activeCases.map((c) => (
                <div 
                  key={c.id} 
                  className="flex flex-wrap items-center justify-between gap-3 p-3 bg-background/50 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3">
                    <code className="font-mono text-lg text-primary bg-primary/10 px-3 py-1 rounded">
                      {c.case_code}
                    </code>
                    {c.expires_at && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Expira: {new Date(c.expires_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyCode(c.case_code)}
                      className="p-2 hover:bg-primary/10 rounded transition-colors"
                      title="Copiar"
                    >
                      <Copy className="w-4 h-4 text-primary" />
                    </button>
                    <button
                      onClick={() => deactivateCode(c.id)}
                      className="p-2 hover:bg-destructive/10 rounded transition-colors"
                      title="Desativar"
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </LuxuryCard>

        {/* Used Codes */}
        <LuxuryCard className="p-6 space-y-4">
          <h2 className="font-orbitron text-lg text-blue-500 flex items-center gap-2">
            <User className="w-5 h-5" />
            Códigos Em Uso ({usedCases.length})
          </h2>
          
          {usedCases.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhum código ativado ainda.
            </p>
          ) : (
            <div className="grid gap-3">
              {usedCases.map((c) => (
                <div 
                  key={c.id} 
                  className="flex flex-wrap items-center justify-between gap-3 p-3 bg-background/50 rounded-lg border border-border"
                >
                  <div className="flex flex-col gap-1">
                    <code className="font-mono text-lg text-blue-500">
                      {c.case_code}
                    </code>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="w-3 h-3" />
                      ID: {c.user_id?.slice(0, 8)}...
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {c.activated_at && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Ativado: {new Date(c.activated_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    <button
                      onClick={() => deactivateCode(c.id)}
                      className="p-2 hover:bg-destructive/10 rounded transition-colors"
                      title="Revogar"
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </LuxuryCard>

        {/* Expired/Inactive Codes */}
        {expiredCases.length > 0 && (
          <LuxuryCard className="p-6 space-y-4 opacity-60">
            <h2 className="font-orbitron text-lg text-muted-foreground flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Expirados/Inativos ({expiredCases.length})
            </h2>
            
            <div className="grid gap-2">
              {expiredCases.slice(0, 5).map((c) => (
                <div 
                  key={c.id} 
                  className="flex items-center justify-between p-2 bg-background/30 rounded border border-border/50"
                >
                  <code className="font-mono text-muted-foreground">
                    {c.case_code}
                  </code>
                  <button
                    onClick={() => deleteCode(c.id)}
                    className="p-1.5 hover:bg-destructive/10 rounded transition-colors"
                    title="Excluir permanentemente"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              ))}
              {expiredCases.length > 5 && (
                <p className="text-sm text-muted-foreground text-center">
                  ... e mais {expiredCases.length - 5} códigos
                </p>
              )}
            </div>
          </LuxuryCard>
        )}
      </div>
    </div>
  );
}
