/**
 * Política de Privacidade — Oráculo Mycroft
 * Conformidade com LGPD (Lei nº 13.709/2018)
 */

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Shield, Database, Lock, Eye, Trash2,
  Mail, FileText, Clock, Server, UserCheck, AlertTriangle,
  CheckCircle, XCircle, Settings, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PrivacyPolicy() {
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
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="font-bold text-lg">Política de Privacidade</h1>
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
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Política de Privacidade</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            O <strong>Oráculo Mycroft</strong> é uma ferramenta de análise estatística,
            probabilística e gestão de risco aplicada a entradas esportivas. Esta política descreve
            como tratamos seus dados pessoais em conformidade com a Lei Geral de Proteção de Dados
            (LGPD — Lei nº 13.709/2018).
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            <Clock className="w-4 h-4 inline mr-1" />
            Última atualização: {lastUpdated}
          </p>
        </motion.div>

        <Card className="mb-8 bg-muted/30">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Navegação Rápida
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <a href="#controlador" className="text-primary hover:underline">1. Controlador</a>
              <a href="#dados-coletados" className="text-primary hover:underline">2. Dados Coletados</a>
              <a href="#finalidade" className="text-primary hover:underline">3. Finalidade</a>
              <a href="#bases-legais" className="text-primary hover:underline">4. Bases Legais</a>
              <a href="#compartilhamento" className="text-primary hover:underline">5. Compartilhamento</a>
              <a href="#armazenamento" className="text-primary hover:underline">6. Armazenamento</a>
              <a href="#seus-direitos" className="text-primary hover:underline">7. Seus Direitos</a>
              <a href="#seguranca" className="text-primary hover:underline">8. Segurança</a>
              <a href="#cookies" className="text-primary hover:underline">9. Cookies</a>
              <a href="#menores" className="text-primary hover:underline">10. Menores</a>
              <a href="#alteracoes" className="text-primary hover:underline">11. Alterações</a>
              <a href="#contato" className="text-primary hover:underline">12. Contato</a>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-8">
          {/* 1. Controlador */}
          <section id="controlador">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-primary" />
                  1. Controlador dos Dados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  O serviço <strong>Oráculo Mycroft</strong> é operado por sua equipe responsável,
                  acessível pelos domínios <code>oraculo-mycroft.com</code> e demais subdomínios
                  oficiais. O usuário pode falar com o encarregado de dados (DPO) pelos canais
                  indicados na seção 12.
                </p>
              </CardContent>
            </Card>
          </section>

          {/* 2. Dados Coletados */}
          <section id="dados-coletados">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  2. Dados Pessoais Coletados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Coletamos apenas o necessário para operar a plataforma de análise:
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Dados de Cadastro</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• E-mail (autenticação)</li>
                      <li>• Nome ou apelido</li>
                      <li>• Telefone (opcional, suporte)</li>
                      <li>• Foto de perfil (opcional)</li>
                    </ul>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Dados de Uso</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Histórico de análises e entradas visualizados</li>
                      <li>• Banca virtual, entradas simuladas, ROI</li>
                      <li>• Preferências (ligas, mercados, filtros)</li>
                      <li>• Logs de acesso, IP, user-agent</li>
                    </ul>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Dados de Pagamento</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Processados pelo Asaas (gateway PCI-DSS)</li>
                      <li>• Não armazenamos número de cartão</li>
                      <li>• Guardamos apenas status, valor e identificador da transação</li>
                    </ul>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Marketing e Analytics</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• UTMs e origem de campanha</li>
                      <li>• Eventos anônimos (PostHog, Meta Pixel, TikTok Pixel)</li>
                      <li>• Tokens push opt-in (notificações)</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* 3. Finalidade */}
          <section id="finalidade">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  3. Finalidade do Tratamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Os dados são utilizados exclusivamente para:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Prover acesso e operar o Oráculo Mycroft (Punter, Trader Sports, Eventos Raros, Ciclos, etc.);</li>
                  <li>Personalizar entradas, filtros e relatórios para o seu perfil;</li>
                  <li>Processar pagamentos, assinaturas, trials e renovações;</li>
                  <li>Enviar notificações operacionais (entradas, GREEN/RED, cash-out) e transacionais (cobrança, confirmação);</li>
                  <li>Melhorar continuamente os algoritmos de análise (sempre com dados agregados/anonimizados);</li>
                  <li>Cumprir obrigações legais, regulatórias e contábeis;</li>
                  <li>Prevenir fraude, abuso e proteger a segurança da plataforma.</li>
                </ul>
              </CardContent>
            </Card>
          </section>

          {/* 4. Bases Legais */}
          <section id="bases-legais">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  4. Bases Legais (LGPD art. 7º e 11)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <ul className="space-y-1 list-disc list-inside">
                  <li><strong>Execução de contrato:</strong> entrega do serviço contratado.</li>
                  <li><strong>Consentimento:</strong> marketing, notificações push, cookies não essenciais.</li>
                  <li><strong>Legítimo interesse:</strong> segurança, prevenção a fraude e melhoria do produto.</li>
                  <li><strong>Cumprimento de obrigação legal:</strong> fiscal, tributária e de combate à lavagem de dinheiro.</li>
                </ul>
              </CardContent>
            </Card>
          </section>

          {/* 5. Compartilhamento */}
          <section id="compartilhamento">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  5. Compartilhamento com Terceiros
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Não vendemos seus dados. Compartilhamos somente o necessário com operadores que
                  viabilizam o serviço, sob contrato de proteção de dados:
                </p>
                <ul className="space-y-1 list-disc list-inside">
                  <li><strong>Supabase / Lovable Cloud</strong> — hospedagem, banco de dados, autenticação;</li>
                  <li><strong>Asaas</strong> — processamento de pagamentos e assinaturas;</li>
                  <li><strong>Resend</strong> — envio de e-mails transacionais;</li>
                  <li><strong>Telegram</strong> — entrega de entradas a usuários que optam pelo canal;</li>
                  <li><strong>ElevenLabs</strong> — síntese de voz do Hórus (texto enviado sem dados pessoais);</li>
                  <li><strong>API-Football, The Odds API, Sportmonks, Futodds, Betfair</strong> — provedores de dados esportivos e odds (não recebem dados pessoais);</li>
                  <li><strong>PostHog, Meta Pixel, TikTok Pixel, Google Analytics</strong> — analytics e atribuição de campanha;</li>
                  <li><strong>Autoridades públicas</strong> — quando exigido por lei ou ordem judicial.</li>
                </ul>
              </CardContent>
            </Card>
          </section>

          {/* 6. Armazenamento */}
          <section id="armazenamento">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-primary" />
                  6. Armazenamento e Retenção
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Os dados ficam armazenados em servidores em nuvem com criptografia em trânsito
                  (TLS 1.2+) e em repouso. A retenção segue o seguinte critério:
                </p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Dados de cadastro: enquanto a conta estiver ativa.</li>
                  <li>Dados de pagamento: 5 anos (obrigação fiscal).</li>
                  <li>Logs de acesso: 6 meses (Marco Civil da Internet, art. 15).</li>
                  <li>Dados de análise/uso: até 24 meses, podendo ser anonimizados após.</li>
                </ul>
              </CardContent>
            </Card>
          </section>

          {/* 7. Direitos */}
          <section id="seus-direitos">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary" />
                  7. Seus Direitos como Titular
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>De acordo com o art. 18 da LGPD, você pode a qualquer momento solicitar:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Confirmação da existência de tratamento;</li>
                  <li>Acesso aos dados tratados;</li>
                  <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
                  <li>Anonimização, bloqueio ou eliminação de dados desnecessários;</li>
                  <li>Portabilidade dos dados;</li>
                  <li>Eliminação dos dados tratados com base em consentimento;</li>
                  <li>Informação sobre entidades com as quais houve compartilhamento;</li>
                  <li>Revogação do consentimento.</li>
                </ul>
                <p className="pt-2">
                  Para exercer qualquer direito, entre em contato pelo e-mail indicado na seção 12.
                  Responderemos em até 15 dias.
                </p>
              </CardContent>
            </Card>
          </section>

          {/* 8. Segurança */}
          <section id="seguranca">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" />
                  8. Segurança da Informação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <ul className="space-y-1 list-disc list-inside">
                  <li>Criptografia em trânsito (HTTPS/TLS) e em repouso;</li>
                  <li>Autenticação JWT com tokens rotativos;</li>
                  <li>Row Level Security (RLS) no banco de dados;</li>
                  <li>Acesso administrativo restrito por papéis (RBAC);</li>
                  <li>Logs de auditoria e monitoramento contínuo;</li>
                  <li>Backups periódicos e plano de recuperação.</li>
                </ul>
                <p className="pt-2">
                  Em caso de incidente de segurança, notificaremos os titulares afetados e a ANPD
                  conforme exigido pela LGPD.
                </p>
              </CardContent>
            </Card>
          </section>

          {/* 9. Cookies */}
          <section id="cookies">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  9. Cookies e Tecnologias Similares
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Utilizamos cookies para:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li><strong>Essenciais:</strong> manter sessão e preferências (não exigem consentimento);</li>
                  <li><strong>Analytics:</strong> entender uso agregado (PostHog, GA);</li>
                  <li><strong>Marketing:</strong> medir conversão de campanhas (Meta Pixel, TikTok Pixel).</li>
                </ul>
                <p>Você pode bloquear cookies não essenciais nas configurações do seu navegador.</p>
              </CardContent>
            </Card>
          </section>

          {/* 10. Menores */}
          <section id="menores">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  10. Restrição a Menores de Idade
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  O Oráculo Mycroft é destinado <strong>exclusivamente a maiores de 18 anos</strong>.
                  Não coletamos intencionalmente dados de menores. Caso identifiquemos uma conta
                  de menor de idade, ela será removida imediatamente.
                </p>
              </CardContent>
            </Card>
          </section>

          {/* 11. Alterações */}
          <section id="alteracoes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  11. Alterações nesta Política
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Podemos atualizar esta política periodicamente. A data de "última atualização" no
                topo desta página será sempre revisada. Alterações materiais serão comunicadas por
                e-mail ou aviso dentro da plataforma.
              </CardContent>
            </Card>
          </section>

          {/* 12. Contato */}
          <section id="contato">
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  12. Contato e Encarregado (DPO)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Para qualquer dúvida ou solicitação relacionada a dados pessoais:</p>
                <ul className="space-y-1">
                  <li>📧 <strong>E-mail:</strong> <a className="text-primary hover:underline" href="mailto:contato@oraculo-mycroft.com">contato@oraculo-mycroft.com</a></li>
                  <li>💬 <strong>WhatsApp suporte:</strong> +55 81 99795-0345</li>
                  <li>🌐 <strong>Site:</strong> <a className="text-primary hover:underline" href="https://oraculo-mycroft.com">oraculo-mycroft.com</a></li>
                </ul>
                <p className="pt-2 text-muted-foreground">
                  Veja também nossos <Link to="/termos" className="text-primary hover:underline">Termos de Uso</Link>.
                </p>
              </CardContent>
            </Card>
          </section>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-10">
          O Oráculo Mycroft é uma ferramenta de análise estatística — não promete nem garante
          lucros. Aposte com responsabilidade. Proibido para menores de 18 anos.
        </p>
      </main>
    </div>
  );
}
