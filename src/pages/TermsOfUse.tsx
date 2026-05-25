/**
 * Termos de Uso — Oráculo Mycroft
 */

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, FileText, Clock, ShieldCheck, AlertTriangle,
  CreditCard, Ban, Scale, RefreshCw, Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TermsOfUse() {
  const lastUpdated = '25 de Maio de 2026';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h1 className="font-bold text-lg">Termos de Uso</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center p-4 rounded-full bg-primary/10 border border-primary/30 mb-4">
            <Scale className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Termos de Uso</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Estes Termos regulam o uso do <strong>Oráculo Mycroft</strong>, uma ferramenta de
            análise estatística, probabilística e gestão de risco aplicada a apostas esportivas.
            Ao criar uma conta ou utilizar qualquer funcionalidade, você concorda integralmente
            com o disposto abaixo.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            <Clock className="w-4 h-4 inline mr-1" />
            Última atualização: {lastUpdated}
          </p>
        </motion.div>

        {/* Aviso obrigatório */}
        <Card className="mb-8 border-yellow-500/40 bg-yellow-500/[0.04]">
          <CardContent className="pt-6">
            <h2 className="text-lg font-bold text-yellow-400 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Aviso Importante
            </h2>
            <p className="text-sm text-muted-foreground">
              O Oráculo Mycroft tem <strong>caráter educativo e analítico</strong>. Nenhuma
              ferramenta de análise garante vitórias ou lucros constantes. Resultados passados não
              representam promessa de resultados futuros. O serviço é destinado exclusivamente a
              <strong> maiores de 18 anos</strong>. Aposte com responsabilidade.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-8">
          {/* 1. Objeto */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> 1. Objeto do Serviço
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                O Oráculo Mycroft disponibiliza painéis, sinais, análises automatizadas, simulação
                de banca virtual, conteúdo educativo e ferramentas de gestão de risco voltadas ao
                mercado de apostas esportivas. O serviço <strong>não opera apostas</strong> em nome
                do usuário e não é uma casa de apostas.
              </p>
            </CardContent>
          </Card>

          {/* 2. Cadastro */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" /> 2. Cadastro e Conta
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ul className="space-y-1 list-disc list-inside">
                <li>Necessário ter 18 anos ou mais e plena capacidade civil.</li>
                <li>O usuário é responsável pela veracidade dos dados informados.</li>
                <li>A conta é pessoal e intransferível. Não é permitido compartilhar senha, sinais ou conteúdo pago.</li>
                <li>O usuário deve manter senha segura e notificar imediatamente qualquer acesso não autorizado.</li>
              </ul>
            </CardContent>
          </Card>

          {/* 3. Planos e pagamentos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" /> 3. Planos, Trials e Pagamentos
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ul className="space-y-1 list-disc list-inside">
                <li>Disponibilizamos planos gratuitos, trials, day-pass e assinaturas recorrentes.</li>
                <li>Pagamentos são processados pelo <strong>Asaas</strong> (cartão, Pix, boleto). Não armazenamos dados de cartão.</li>
                <li>Assinaturas recorrentes são renovadas automaticamente até cancelamento pelo próprio usuário no painel.</li>
                <li>Trials e day-pass têm prazo determinado e podem ser convertidos em planos pagos por meio de upsell automático.</li>
                <li>Valores, condições e benefícios de cada plano são exibidos no momento da contratação.</li>
              </ul>
            </CardContent>
          </Card>

          {/* 4. Reembolso */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-primary" /> 4. Direito de Arrependimento e Reembolso
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Em conformidade com o art. 49 do Código de Defesa do Consumidor, o usuário pode
                solicitar o cancelamento com reembolso integral em até <strong>7 (sete) dias</strong>
                da contratação, desde que a utilização do serviço tenha sido inferior a 25% do
                período contratado. Para day-pass e ofertas promocionais, oferecemos reembolso em
                até <strong>24h</strong> conforme comunicado nas LPs. Solicitações devem ser feitas
                pelos canais da seção 12.
              </p>
            </CardContent>
          </Card>

          {/* 5. Uso aceitável */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-destructive" /> 5. Uso Aceitável
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>É vedado ao usuário:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Revender, redistribuir ou expor publicamente sinais e conteúdos do Mycroft;</li>
                <li>Realizar engenharia reversa, scraping em massa ou tentativas de quebra de segurança;</li>
                <li>Utilizar bots, automações não autorizadas ou múltiplas contas para burlar limites;</li>
                <li>Promover apostas a menores de idade ou em jurisdições em que sejam ilegais;</li>
                <li>Praticar fraude, lavagem de dinheiro ou utilizar meios de pagamento de terceiros sem autorização;</li>
                <li>Inserir conteúdo ofensivo, ilegal ou que viole direitos de terceiros.</li>
              </ul>
              <p className="pt-2">
                O descumprimento poderá resultar em suspensão ou encerramento imediato da conta,
                sem reembolso, sem prejuízo das medidas legais cabíveis.
              </p>
            </CardContent>
          </Card>

          {/* 6. Propriedade intelectual */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" /> 6. Propriedade Intelectual
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Marca, logotipos, textos, código-fonte, algoritmos, modelos de IA, prompts, áudios do
              Hórus, layouts e demais elementos do Oráculo Mycroft são protegidos por direitos
              autorais e demais leis aplicáveis. A assinatura concede ao usuário licença
              <strong> não exclusiva, pessoal e intransferível</strong> de uso, restrita à finalidade
              do serviço.
            </CardContent>
          </Card>

          {/* 7. Limitação de responsabilidade */}
          <Card className="border-yellow-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" /> 7. Limitação de Responsabilidade
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Os sinais, análises e indicações do Oráculo Mycroft são <strong>opinativos e
                probabilísticos</strong>. O usuário é o <strong>único responsável</strong> por suas
                decisões financeiras e pelo capital efetivamente apostado em casas de apostas.
              </p>
              <p>
                Na máxima extensão permitida pela legislação, o Oráculo Mycroft não responde por:
              </p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Perdas, prejuízos, lucros cessantes ou frustração de expectativa decorrentes de apostas;</li>
                <li>Indisponibilidade temporária por manutenção, falha de terceiros (Supabase, Asaas, provedores de odds, casas de apostas, internet do usuário);</li>
                <li>Erros, inconsistências ou atrasos em dados fornecidos por APIs de terceiros (API-Football, The Odds API, Sportmonks, Futodds, Betfair etc.);</li>
                <li>Decisões da casa de apostas (limitação de conta, cancelamento, anulação de mercado).</li>
              </ul>
            </CardContent>
          </Card>

          {/* 8. Cancelamento e suspensão */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-primary" /> 8. Cancelamento e Encerramento
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                O usuário pode cancelar sua assinatura a qualquer momento pelo painel ou pelos
                canais de suporte; o acesso permanecerá ativo até o fim do ciclo já pago.
              </p>
              <p>
                O Oráculo Mycroft pode suspender ou encerrar contas que violem estes Termos,
                apresentem indícios de fraude ou que coloquem em risco a segurança da plataforma.
              </p>
            </CardContent>
          </Card>

          {/* 9. Alterações */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-primary" /> 9. Alterações nos Termos
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Estes Termos podem ser atualizados periodicamente. A versão vigente estará sempre
              disponível nesta página, com a data de atualização. Alterações materiais serão
              comunicadas por e-mail ou aviso na plataforma. O uso continuado após a publicação
              implica concordância.
            </CardContent>
          </Card>

          {/* 10. Privacidade */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" /> 10. Privacidade e Proteção de Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              O tratamento de dados pessoais é descrito na nossa{' '}
              <Link to="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link>,
              que integra estes Termos para todos os efeitos.
            </CardContent>
          </Card>

          {/* 11. Lei e foro */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-primary" /> 11. Legislação e Foro
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o
              foro do domicílio do usuário consumidor para dirimir quaisquer controvérsias.
            </CardContent>
          </Card>

          {/* 12. Contato */}
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" /> 12. Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>📧 <strong>E-mail:</strong> <a className="text-primary hover:underline" href="mailto:contato@oraculo-mycroft.com">contato@oraculo-mycroft.com</a></p>
              <p>💬 <strong>WhatsApp suporte:</strong> +55 81 99795-0345</p>
              <p>🌐 <strong>Site:</strong> <a className="text-primary hover:underline" href="https://oraculo-mycroft.com">oraculo-mycroft.com</a></p>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-10">
          "O Mycroft não torce. Ele calcula." — Aposte com responsabilidade. Proibido para menores de 18 anos.
        </p>
      </main>
    </div>
  );
}
