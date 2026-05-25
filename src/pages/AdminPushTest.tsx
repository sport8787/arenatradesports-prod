import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { CheckCircle2, Circle, Loader2, AlertTriangle, Smartphone, Globe } from "lucide-react";

type StepStatus = "pending" | "running" | "done" | "error";

interface Step {
  id: number;
  title: string;
  description: string;
  status: StepStatus;
  detail?: string;
}

export default function AdminPushTest() {
  const { toast } = useToast();
  const { requestPush, isSupported, permission } = usePushNotifications();
  const [userId, setUserId] = useState<string | null>(null);
  const [subCount, setSubCount] = useState<number>(0);
  const [isPublishedHost, setIsPublishedHost] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  const [steps, setSteps] = useState<Step[]>([
    { id: 1, title: "Permitir notificações", description: "Solicita permissão e registra a subscription deste dispositivo.", status: "pending" },
    { id: 2, title: "Push de teste (app aberto)", description: "Envia um push agora — você deve ver uma notificação na tela em segundos.", status: "pending" },
    { id: 3, title: "Push em segundo plano", description: "Aguarde 10s e volte para a home do celular ou troque de aba. O push deve chegar mesmo com app fechado.", status: "pending" },
    { id: 4, title: "Simular GREEN real", description: "Cria uma entrada-teste e marca como GREEN — o trigger do banco dispara o push automaticamente.", status: "pending" },
  ]);

  useEffect(() => {
    setIsInIframe((() => { try { return window.self !== window.top; } catch { return true; } })());
    setIsPublishedHost(!window.location.hostname.includes("id-preview--") && !window.location.hostname.includes("lovableproject.com"));
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id || null;
      setUserId(uid);
      if (uid) refreshSubCount(uid);
    });
  }, []);

  const refreshSubCount = async (uid: string) => {
    const { count } = await supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", uid);
    setSubCount(count || 0);
  };

  const updateStep = (id: number, patch: Partial<Step>) =>
    setSteps((s) => s.map((st) => (st.id === id ? { ...st, ...patch } : st)));

  // Step 1
  const runStep1 = async () => {
    updateStep(1, { status: "running" });
    if (!isSupported) {
      updateStep(1, { status: "error", detail: "Navegador não suporta Web Push (ou está em iframe). Abra no domínio publicado." });
      return;
    }
    const ok = await requestPush();
    if (!ok) {
      updateStep(1, { status: "error", detail: `Permissão: ${permission}. Se foi negada, libere nas configurações do navegador.` });
      return;
    }
    if (userId) await refreshSubCount(userId);
    updateStep(1, { status: "done", detail: "Subscription registrada neste dispositivo." });
  };

  // Step 2
  const runStep2 = async () => {
    if (!userId) return;
    updateStep(2, { status: "running" });
    const { data, error } = await supabase.functions.invoke("send-web-push", {
      body: {
        user_ids: [userId],
        payload: {
          title: "🧪 Teste 1/3 — App Aberto",
          body: "Se você está vendo isso, o push funciona com o app na frente!",
          tag: "push-test-foreground",
          url: "/admin/push-test",
        },
      },
    });
    if (error) { updateStep(2, { status: "error", detail: error.message }); return; }
    updateStep(2, { status: "done", detail: `Enviado: ${data?.sent ?? 0} | Falhas: ${data?.failed ?? 0}` });
  };

  // Step 3 - delayed push
  const runStep3 = async () => {
    if (!userId) return;
    updateStep(3, { status: "running", detail: "Você tem 10 segundos: minimize o navegador ou troque de aba AGORA!" });
    toast({ title: "⏱️ Minimize o app!", description: "Você tem 10 segundos para fechar/minimizar." });
    await new Promise((r) => setTimeout(r, 10_000));
    const { data, error } = await supabase.functions.invoke("send-web-push", {
      body: {
        user_ids: [userId],
        payload: {
          title: "🔔 Teste 2/3 — Background",
          body: "Push recebido com app fechado/minimizado! O Service Worker funciona.",
          tag: "push-test-background",
          url: "/admin/push-test",
        },
      },
    });
    if (error) { updateStep(3, { status: "error", detail: error.message }); return; }
    updateStep(3, { status: "done", detail: `Enviado: ${data?.sent ?? 0}. Volte ao app — a notificação deve estar visível.` });
  };

  // Step 4 - real GREEN trigger
  const runStep4 = async () => {
    if (!userId) return;
    updateStep(4, { status: "running" });
    // Insere entrada pendente
    const matchId = `push-test-${Date.now()}`;
    const { data: bet, error: insertErr } = await supabase
      .from("bets_history")
      .insert({
        user_id: userId,
        match_id: matchId,
        market: "🧪 Teste GREEN automático",
        odd: 1.85,
        stake: 10,
        source: "manual",
        result: null,
      })
      .select()
      .single();
    if (insertErr) { updateStep(4, { status: "error", detail: insertErr.message }); return; }

    await new Promise((r) => setTimeout(r, 500));

    // Atualiza para GREEN — dispara trigger
    const { error: updateErr } = await supabase
      .from("bets_history")
      .update({ result: "won", profit_loss: 8.5, resulted_at: new Date().toISOString() })
      .eq("id", bet.id);
    if (updateErr) { updateStep(4, { status: "error", detail: updateErr.message }); return; }

    updateStep(4, { status: "done", detail: "Entrada marcada como GREEN. O trigger SQL chamou send-web-push automaticamente." });
  };

  const StepIcon = ({ status }: { status: StepStatus }) => {
    if (status === "done") return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (status === "running") return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
    if (status === "error") return <AlertTriangle className="w-5 h-5 text-destructive" />;
    return <Circle className="w-5 h-5 text-muted-foreground" />;
  };

  const runners = [runStep1, runStep2, runStep3, runStep4];

  return (
    <div className="container max-w-3xl py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">🔔 Teste Guiado de Notificações Push</h1>
        <p className="text-sm text-muted-foreground mt-1">Valide GREEN/RED e APROVADO em tempo real, com app aberto e fechado.</p>
      </div>

      {/* Diagnóstico */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Smartphone className="w-4 h-4" /> Diagnóstico do dispositivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Web Push suportado</span>
            <Badge variant={isSupported ? "default" : "destructive"}>{isSupported ? "Sim" : "Não"}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Permissão atual</span>
            <Badge variant={permission === "granted" ? "default" : "secondary"}>{permission}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Subscriptions registradas</span>
            <Badge variant="outline">{subCount}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Domínio publicado (HTTPS real)</span>
            <Badge variant={isPublishedHost ? "default" : "destructive"}>{isPublishedHost ? "Sim" : "Não"}</Badge>
          </div>
          {(isInIframe || !isPublishedHost) && (
            <div className="mt-3 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs flex gap-2">
              <Globe className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Web Push não funciona aqui.</strong> Abra esta página no domínio publicado:
                <div className="mt-1 font-mono">https://arenatradesports.lovable.app/admin/push-test</div>
                <div className="mt-1">ou em outro domínio próprio (HTTPS, fora de iframe).</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Passos */}
      {steps.map((step, idx) => {
        const prevDone = idx === 0 || steps[idx - 1].status === "done";
        const disabled = !prevDone || step.status === "running" || (step.id !== 1 && (!userId || subCount === 0));
        return (
          <Card key={step.id} className={step.status === "done" ? "border-green-500/40" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <StepIcon status={step.status} />
                <div className="flex-1">
                  <div className="font-semibold">Passo {step.id}: {step.title}</div>
                  <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                  {step.detail && (
                    <p className={`text-xs mt-2 ${step.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>{step.detail}</p>
                  )}
                  <Button size="sm" className="mt-3" onClick={runners[idx]} disabled={disabled}>
                    {step.status === "running" ? "Executando..." : step.status === "done" ? "Refazer" : "Executar"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card className="bg-muted/30">
        <CardContent className="pt-6 text-xs text-muted-foreground space-y-1">
          <p><strong>📱 No celular:</strong> permita instalar como atalho na tela inicial (Android/Chrome) para máxima confiabilidade.</p>
          <p><strong>🍎 iPhone:</strong> Web Push só funciona quando o site é adicionado à tela inicial (Safari → Compartilhar → Adicionar à Tela de Início) e iOS 16.4+.</p>
          <p><strong>🔒 Permissão negada?</strong> Vá nas configurações do site no navegador → Notificações → Permitir.</p>
        </CardContent>
      </Card>
    </div>
  );
}
