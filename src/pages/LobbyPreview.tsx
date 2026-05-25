import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useHorusPunterAudio } from "@/hooks/useHorusPunterAudio";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Copy, CheckCircle2, Unlock, Zap, Volume2, Target, Activity, LineChart, Sparkles } from "lucide-react";
import { toast } from "sonner";
import logoOraculo from "@/assets/logo_oraculo_mycroft.png";

interface ChargeResponse {
  charge_id: string;
  invoice_url: string;
  pix_qr_code: string | null;
  pix_payload: string | null;
  value: number;
  reused?: boolean;
}

const formatCpf = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
};

const isValidCpf = (raw: string) => {
  const cpf = raw.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(cpf[i]) * (10 - i);
  let d1 = (s * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(cpf[i]) * (11 - i);
  let d2 = (s * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(cpf[10]);
};

/**
 * /lobby-preview — lobby de boas-vindas para leads que ainda não pagaram.
 * Áudio do Hórus + tour das arenas. CPF + Pix só são pedidos ao clicar "LIBERAR ARENAS".
 */
export default function LobbyPreview() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { subscription, loading: subLoading } = useSubscription();
  const { playOnce, pendingAudio, playPending } = useHorusPunterAudio();

  const [open, setOpen] = useState(false);
  const [cpf, setCpf] = useState("");
  const [generating, setGenerating] = useState(false);
  const [charge, setCharge] = useState<ChargeResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/day-pass", { replace: true });
  }, [user, authLoading, navigate]);

  // Toca áudio de boas-vindas do Hórus (uma única vez por usuário)
  useEffect(() => {
    if (user) playOnce("apresentacao_horus");
  }, [user, playOnce]);

  // Libera apenas após webhook confirmar PREMIUM ATIVO
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
    if (!isValidCpf(cpf)) {
      toast.error("CPF inválido. Confira os dígitos.");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke<ChargeResponse>("asaas-create-charge", {
        body: { cpfCnpj: cpf.replace(/\D/g, "") },
      });
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

  const arenas = [
    { icon: Target, title: "Arena Punter", desc: "Entradas matemáticos pré-jogo aprovados pelo Mycroft.", badge: null },
    { icon: Activity, title: "Arena Live", desc: "Trade ao vivo, leitura situacional e cash-out por IA.", badge: null },
    { icon: LineChart, title: "Arena Trader Financeiro", desc: "Versão experimental. WIN, WDO e BTC em fase de teste — use por sua conta e risco enquanto refinamos o motor.", badge: "BETA" },
    { icon: Sparkles, title: "Liga Mycroft + Bônus", desc: "Ranking de ROI, recompensas BC e ferramentas avançadas.", badge: null },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Hero boas-vindas */}
        <div className="text-center space-y-3">
          <img src={logoOraculo} alt="Oráculo Mycroft" className="h-16 w-16 mx-auto" />
          <h1 className="text-2xl md:text-3xl font-bold">
            Bem-vindo, {user?.user_metadata?.full_name?.split(" ")[0] || "trader"}.
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Este é o lobby do <strong>Oráculo Mycroft</strong>. O Hórus está te dando as boas-vindas e
            explicando o que você vai encontrar aqui. Quando quiser destravar tudo, clique em <strong>Liberar Arenas</strong>.
          </p>

          {pendingAudio && (
            <Button variant="outline" size="sm" onClick={playPending} className="gap-2">
              <Volume2 className="w-4 h-4" /> Tocar boas-vindas do Hórus
            </Button>
          )}
        </div>

        {/* Tour das arenas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {arenas.map(({ icon: Icon, title, desc, badge }) => (
            <Card key={title} className="border-border/60">
              <CardContent className="p-4 flex gap-3 items-start">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {title}
                    {badge && (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 tracking-wider">
                        {badge}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">{desc}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA principal */}
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" /> Day Pass · 24h por R$ 9,90
            </CardTitle>
            <CardDescription>
              Libere as 4 arenas, entradas, notificações e múltiplas otimizadas por 24h. Pagamento via Pix.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setOpen(true)}
              className="w-full h-14 text-lg font-bold gap-2"
            >
              <Unlock className="w-5 h-5" /> LIBERAR ARENAS
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-3">
              Liberação automática assim que o Pix for confirmado.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Modal CPF + Pix */}
      <Dialog open={open} onOpenChange={(o) => { if (!generating) setOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberar Arenas · R$ 9,90</DialogTitle>
            <DialogDescription>
              {charge
                ? "Pague o Pix abaixo. Seu acesso é liberado automaticamente."
                : "Informe seu CPF para gerar o Pix. Exigido por lei para emissão da cobrança (Asaas)."}
            </DialogDescription>
          </DialogHeader>

          {!charge ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Usado apenas para emitir a cobrança Pix. Não compartilhamos com terceiros.
                </p>
              </div>
              <DialogFooter>
                <Button onClick={generatePix} disabled={generating || cpf.replace(/\D/g, "").length !== 11} className="w-full h-12 font-bold">
                  {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {generating ? "Gerando Pix..." : "GERAR PIX DE R$ 9,90"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              {charge.pix_qr_code && (
                <div className="flex justify-center">
                  <img src={charge.pix_qr_code} alt="QR Code Pix" className="w-56 h-56 rounded bg-white p-2" />
                </div>
              )}
              {charge.pix_payload && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Ou copie o código Pix:</p>
                  <div className="flex gap-2">
                    <code className="flex-1 text-xs bg-background border rounded px-2 py-2 break-all">{charge.pix_payload}</code>
                    <Button size="sm" variant="outline" onClick={copyPix}>
                      {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              )}
              {charge.invoice_url && (
                <a href={charge.invoice_url} target="_blank" rel="noopener noreferrer" className="block text-center text-sm text-primary hover:underline">
                  Abrir fatura Asaas →
                </a>
              )}
              <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Aguardando confirmação do Pix... liberação automática.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
