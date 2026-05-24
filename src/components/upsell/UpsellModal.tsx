import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Copy, CheckCircle2, Zap } from "lucide-react";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import type { UpsellTrigger } from "@/hooks/useDayPassUpsell";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  trigger: NonNullable<UpsellTrigger>;
}

interface SubResponse {
  subscription_id?: string;
  charge_id?: string;
  invoice_url?: string;
  pix_qr_code?: string | null;
  pix_payload?: string | null;
  value?: number;
  reused?: boolean;
  already_active?: boolean;
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
  let d1 = (s * 10) % 11; if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(cpf[i]) * (11 - i);
  let d2 = (s * 10) % 11; if (d2 === 10) d2 = 0;
  return d2 === parseInt(cpf[10]);
};

const HEADLINE: Record<NonNullable<UpsellTrigger>, string> = {
  green: "Continue vendo o Oráculo trabalhar",
  "4h": "Garanta acesso contínuo",
  "1h": "ÚLTIMA HORA — não perca o ritmo",
};

export function UpsellModal({ open, onOpenChange, trigger }: Props) {
  const [cpf, setCpf] = useState("");
  const [generating, setGenerating] = useState(false);
  const [resp, setResp] = useState<SubResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) track.custom("upsell_modal_viewed", { trigger });
  }, [open, trigger]);

  const submit = async () => {
    if (generating) return;
    if (!isValidCpf(cpf)) { toast.error("CPF inválido."); return; }
    setGenerating(true);
    track.custom("upsell_cpf_submitted", { trigger });
    try {
      const { data, error } = await supabase.functions.invoke<SubResponse>("asaas-create-subscription", {
        body: { cpfCnpj: cpf.replace(/\D/g, ""), triggerSource: trigger },
      });
      if (error || !data) throw new Error(error?.message || "Falha ao gerar assinatura");
      if (data.already_active) {
        toast.success("Assinatura já está ativa!");
        onOpenChange(false);
        return;
      }
      setResp(data);
      track.custom("upsell_pix_generated", { trigger });
      toast.success(data.reused ? "Pix recuperado." : "Pix da assinatura gerado!");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar Pix.");
    } finally {
      setGenerating(false);
    }
  };

  const copyPix = async () => {
    if (!resp?.pix_payload) return;
    await navigator.clipboard.writeText(resp.pix_payload);
    setCopied(true);
    toast.success("Código Pix copiado!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!generating) onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            {HEADLINE[trigger]} — R$ 47/mês
          </DialogTitle>
          <DialogDescription>
            {resp
              ? "Pague o Pix abaixo. Sua assinatura é ativada automaticamente após a confirmação. Cobranças mensais via Pix, cancele quando quiser."
              : "Informe seu CPF para gerar o Pix recorrente da assinatura. R$ 47/mês — cancele quando quiser, sem fidelidade."}
          </DialogDescription>
        </DialogHeader>

        {!resp ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="upsell-cpf">CPF</Label>
              <Input
                id="upsell-cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                Cobrança Pix mensal automática pela Asaas. Cancele a qualquer momento via WhatsApp.
              </p>
            </div>
            <DialogFooter>
              <Button
                onClick={submit}
                disabled={generating || cpf.replace(/\D/g, "").length !== 11}
                className="w-full h-12 font-bold"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {generating ? "Gerando Pix..." : "ASSINAR R$ 47/MÊS"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {resp.pix_qr_code && (
              <div className="flex justify-center">
                <img src={resp.pix_qr_code} alt="QR Code Pix" className="w-56 h-56 rounded bg-white p-2" />
              </div>
            )}
            {resp.pix_payload && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Ou copie o código Pix:</p>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs bg-background border rounded px-2 py-2 break-all">{resp.pix_payload}</code>
                  <Button size="sm" variant="outline" onClick={copyPix}>
                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}
            {resp.invoice_url && (
              <a href={resp.invoice_url} target="_blank" rel="noopener noreferrer" className="block text-center text-sm text-primary hover:underline">
                Abrir fatura Asaas →
              </a>
            )}
            <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Aguardando confirmação do Pix... assinatura ativada automaticamente.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
