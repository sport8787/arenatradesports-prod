import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";

/**
 * /day-pass — landing de captura do Day Pass R$ 9,90 (sandbox Asaas).
 * Cria conta, marca subscription como plan='preview' (sem acesso) e
 * redireciona para /lobby-preview onde o usuário gera o Pix.
 */
export default function DayPassSignup() {
  const navigate = useNavigate();
  const { signUp, user } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate("/lobby-preview", { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!name.trim() || !email.trim() || password.length < 6) {
      toast.error("Preencha nome, e-mail e uma senha de pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      // username de fallback: parte antes do @
      const username = email.trim().toLowerCase().split("@")[0].replace(/[^a-z0-9]/g, "").slice(0, 20) || "trader";
      const { data, error } = await signUp(email.trim().toLowerCase(), password, username, name.trim());
      if (error) {
        toast.error(error.message || "Não foi possível criar a conta.");
        return;
      }
      const newUser = data?.user;
      if (newUser) {
        // Downgrade atômico via edge function (service role) — sobrescreve o trial do trigger.
        // Tem que terminar ANTES de navegar para evitar race com useSubscription.hasAccess=true.
        try {
          await supabase.functions.invoke("day-pass-mark-preview", { body: {} });
        } catch (e) {
          console.warn("[DayPassSignup] mark-preview falhou:", e);
        }
      }
      toast.success("Conta criada! Agora libere seu Day Pass.");
      navigate("/lobby-preview", { replace: true });
    } catch (err: any) {
      toast.error(err?.message || "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary/30">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-primary text-sm font-semibold">
            <Zap className="w-4 h-4" /> ACESSO 24h · R$ 9,90
          </div>
          <CardTitle className="text-2xl">Conheça o Oráculo Mycroft agora</CardTitle>
          <CardDescription>
            Cadastro em 30 segundos. Você entra na plataforma e libera as arenas quando quiser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" autoComplete="name" required />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" required />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" required minLength={6} />
            </div>
            <Button type="submit" className="w-full h-12 text-base font-bold" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {loading ? "Criando conta..." : "ACESSAR O ORÁCULO MYCROFT →"}
            </Button>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
              <ShieldCheck className="w-3 h-3" /> Sem cartão. Sem cobrança automática.
            </div>
            <p className="text-center text-xs text-muted-foreground pt-2">
              Já tem conta? <Link to="/auth" className="text-primary hover:underline">Entrar</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
