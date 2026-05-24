import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Copy, CheckCircle2, Lock, Zap } from "lucide-react";
import { toast } from "sonner";

interface ChargeResponse {
  charge_id: string;
  invoice_url: string;
  pix_qr_code: string | null;
  pix_payload: string | null;
  value: number;
  reused?: boolean;
}

/**
 * /lobby-preview — lobby bloqueado para leads que ainda não pagaram o Day Pass.
 * Mostra o que estão perdendo + botão para gerar Pix R$ 9,90 via Asaas.
 * Quando webhook atualiza a subscription → useSubscription realtime libera tudo.
 */
export default function LobbyPreview() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { subscription, loading: subLoading } = useSubscription();
  const [generating, setGenerating] = useState(false);
  const [charge, setCharge] = useState<ChargeResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/day-pass", { replace: true });
  }, [user, authLoading, navigate]);

  // Só redireciona quando o webhook confirmar PREMIUM ATIVO (não confunde com trial cortesia).
  useEffect(() => {
    if (subLoading || !subscription) return;
    const isPaidPremium =
      subscription.plan === "premium" &&
      subscription.is_active &&
      (!subscription.subscription_ends_at || new Date(subscription.subscription_ends_at) > new Date());
    if (isPaidPremium) {
      toast.success("Pagamento confirmado! Liberando acesso...");
      setTimeout(() => navigate("/punter", { replace: true }), 800);
    }
  }, [subscription, subLoading, navigate]);


  const generatePix = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke<ChargeResponse>("asaas-create-charge", { body: {} });
      if (error || !data) throw new Error(error?.message || "Falha ao gerar Pix");
      setCharge(data);
      toast.success(data.reused ? "Pix recuperado." : "Pix gerado!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar Pix.");
    } finally {
      setGenerating(false);
    }
  };

  const copyPix = async () => {
    if (!charge?.pix_payload) return;
    await navigator.clipboard.writeText(charge.pix_payload);
    setCopied(true);
    toast.success("Código Pix copiado!");
    setTimeout(() => setCopied(false), 2500);
  };

  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-primary text-sm font-semibold bg-primary/10 px-3 py-1 rounded-full">
            <Lock className="w-3 h-3" /> ACESSO BLOQUEADO
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">Falta 1 passo para liberar o Mycroft por 24h</h1>
          <p className="text-muted-foreground">Olá {user?.user_metadata?.full_name || user?.email}. Sua conta está pronta — agora é só pagar R$ 9,90 via Pix.</p>
        </div>

        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-primary" /> Day Pass · 24h</CardTitle>
            <CardDescription>Você terá acesso completo às mesmas ferramentas que o Trader que saiu de R$ 4.000 para R$ 6.304,23 em 7 dias.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-sm space-y-2">
              <li>✅ Arena Live (ao vivo + cash-out IA)</li>
              <li>✅ Arena Punter (sinais matemáticos pré-jogo)</li>
              <li>✅ Múltiplas otimizadas + Banca Virtual e Real</li>
              <li>✅ Notificações Telegram em tempo real</li>
            </ul>

            {!charge ? (
              <Button onClick={generatePix} disabled={generating} className="w-full h-14 text-lg font-bold">
                {generating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                {generating ? "Gerando Pix..." : "GERAR PIX DE R$ 9,90"}
              </Button>
            ) : (
              <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                {charge.pix_qr_code ? (
                  <div className="flex justify-center">
                    <img src={charge.pix_qr_code} alt="QR Code Pix" className="w-56 h-56 rounded bg-white p-2" />
                  </div>
                ) : null}
                {charge.pix_payload ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Ou copie o código Pix:</p>
                    <div className="flex gap-2">
                      <code className="flex-1 text-xs bg-background border rounded px-2 py-2 break-all">{charge.pix_payload}</code>
                      <Button size="sm" variant="outline" onClick={copyPix}>
                        {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                ) : null}
                {charge.invoice_url ? (
                  <a href={charge.invoice_url} target="_blank" rel="noopener noreferrer" className="block text-center text-sm text-primary hover:underline">
                    Abrir fatura Asaas →
                  </a>
                ) : null}
                <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Aguardando confirmação do Pix... liberação automática.
                </p>
              </div>
            )}

            <p className="text-xs text-center text-muted-foreground">
              Após o pagamento confirmado, seu acesso é liberado automaticamente e você é redirecionado para o painel.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
