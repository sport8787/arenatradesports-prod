/**
 * Página de Política de Privacidade - LGPD
 * Detalhes completos sobre tratamento de dados de voz e informações pessoais
 */

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Shield, Mic, Database, Lock, Eye, Trash2, 
  Mail, FileText, Clock, Server, UserCheck, AlertTriangle,
  CheckCircle, XCircle, Settings, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PrivacyPolicy() {
  const lastUpdated = "24 de Janeiro de 2026";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
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
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center p-4 rounded-full bg-primary/10 border border-primary/30 mb-4">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Política de Privacidade
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            O BLEFADOR está comprometido com a proteção dos seus dados pessoais 
            em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            <Clock className="w-4 h-4 inline mr-1" />
            Última atualização: {lastUpdated}
          </p>
        </motion.div>

        {/* Quick Navigation */}
        <Card className="mb-8 bg-muted/30">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Navegação Rápida
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <a href="#dados-coletados" className="text-primary hover:underline">1. Dados Coletados</a>
              <a href="#dados-voz" className="text-primary hover:underline">2. Dados de Voz</a>
              <a href="#finalidade" className="text-primary hover:underline">3. Finalidade</a>
              <a href="#armazenamento" className="text-primary hover:underline">4. Armazenamento</a>
              <a href="#compartilhamento" className="text-primary hover:underline">5. Compartilhamento</a>
              <a href="#seus-direitos" className="text-primary hover:underline">6. Seus Direitos</a>
              <a href="#seguranca" className="text-primary hover:underline">7. Segurança</a>
              <a href="#cookies" className="text-primary hover:underline">8. Cookies</a>
              <a href="#contato" className="text-primary hover:underline">9. Contato</a>
            </div>
          </CardContent>
        </Card>

        {/* Content Sections */}
        <div className="space-y-8">
          {/* Section 1: Dados Coletados */}
          <section id="dados-coletados">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  1. Dados Pessoais Coletados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Coletamos diferentes tipos de dados dependendo da sua interação com o jogo:
                </p>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-success" />
                      Dados de Cadastro
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• E-mail (para autenticação)</li>
                      <li>• Nome de usuário/apelido</li>
                      <li>• Foto de perfil (opcional)</li>
                    </ul>
                  </div>
                  
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-primary" />
                      Dados de Jogo
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Pontuação e estatísticas</li>
                      <li>• Histórico de partidas</li>
                      <li>• Conquistas e ranking</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-primary" />
                    Modo Convidado
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Se você jogar como convidado, apenas um identificador de sessão temporário 
                    é armazenado localmente no seu dispositivo. Nenhum dado pessoal é enviado 
                    aos nossos servidores.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Section 2: Dados de Voz (CRITICAL SECTION) */}
          <section id="dados-voz">
            <Card className="border-primary/50">
              <CardHeader className="bg-primary/5">
                <CardTitle className="flex items-center gap-2">
                  <Mic className="w-5 h-5 text-primary" />
                  2. Tratamento de Dados de Voz (Mycroft)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="bg-muted/30 rounded-lg p-4 border-l-4 border-primary">
                  <p className="font-medium">
                    Esta seção detalha especificamente o tratamento de dados de voz 
                    pelo sistema Mycroft, nosso analista comportamental baseado em IA.
                  </p>
                </div>

                {/* O que é coletado */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-primary" />
                    2.1 O Que é Analisado
                  </h4>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="bg-muted/20 rounded-lg p-3">
                      <p className="text-sm font-medium mb-1">Métricas Acústicas</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        <li>• Frequência fundamental (pitch)</li>
                        <li>• Variação de pitch (jitter)</li>
                        <li>• Variação de amplitude (shimmer)</li>
                        <li>• Relação harmônicos-ruído (HNR)</li>
                      </ul>
                    </div>
                    <div className="bg-muted/20 rounded-lg p-3">
                      <p className="text-sm font-medium mb-1">Padrões de Fala</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        <li>• Taxa de fala (palavras por minuto)</li>
                        <li>• Pausas e hesitações</li>
                        <li>• Latência de resposta</li>
                        <li>• Fluência e ritmo</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Como funciona */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Server className="w-4 h-4 text-primary" />
                    2.2 Ciclo de Vida dos Dados de Voz
                  </h4>
                  
                  <div className="space-y-4">
                    {/* Durante o jogo */}
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                        <span className="text-success font-bold text-sm">1</span>
                      </div>
                      <div>
                        <p className="font-medium">Durante a Partida</p>
                        <p className="text-sm text-muted-foreground">
                          O áudio é capturado e processado <strong>localmente no seu dispositivo</strong> 
                          usando a Web Audio API. A análise inicial ocorre no navegador sem enviar 
                          o áudio bruto para servidores externos.
                        </p>
                      </div>
                    </div>

                    {/* Análise IA */}
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-primary font-bold text-sm">2</span>
                      </div>
                      <div>
                        <p className="font-medium">Análise por IA</p>
                        <p className="text-sm text-muted-foreground">
                          <strong>Apenas as métricas numéricas</strong> (pitch, jitter, shimmer, etc.) 
                          são enviadas ao nosso backend para análise pelo Mycroft. O conteúdo verbal 
                          (o que você disse) <strong>não é transcrito nem armazenado</strong>.
                        </p>
                      </div>
                    </div>

                    {/* Após o jogo */}
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
                        <span className="text-destructive font-bold text-sm">3</span>
                      </div>
                      <div>
                        <p className="font-medium">Após a Partida</p>
                        <p className="text-sm text-muted-foreground">
                          O arquivo de áudio bruto é <strong>automaticamente deletado</strong> do seu 
                          dispositivo e nunca é armazenado em nossos servidores. Apenas métricas 
                          <strong> anonimizadas</strong> são retidas para fins estatísticos.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* O que NÃO fazemos */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-destructive" />
                    2.3 O Que NÃO Fazemos
                  </h4>
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                        <span><strong>NÃO</strong> usamos sua voz para identificação biométrica civil</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                        <span><strong>NÃO</strong> realizamos diagnósticos médicos ou psicológicos</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                        <span><strong>NÃO</strong> vendemos ou compartilhamos dados de voz com terceiros</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                        <span><strong>NÃO</strong> usamos dados de voz para publicidade direcionada</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                        <span><strong>NÃO</strong> armazenamos gravações de voz sem consentimento explícito</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <Separator />

                {/* Consentimento */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    2.4 Consentimento e Controle
                  </h4>
                  <div className="space-y-3">
                    <div className="bg-success/10 border border-success/30 rounded-lg p-4">
                      <p className="text-sm">
                        <strong>O Mycroft é opcional.</strong> Você pode jogar O BLEFADOR 
                        normalmente sem ativar a análise de voz. Quando a análise é desativada, 
                        nenhum dado de áudio é capturado ou processado.
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Seu consentimento é armazenado localmente no seu dispositivo e pode ser 
                      alterado a qualquer momento através do botão "Mycroft" no cabeçalho do jogo 
                      ou nas configurações de privacidade.
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Armazenamento opcional */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    2.5 Armazenamento Opcional para Treinamento
                  </h4>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      Se você desejar contribuir para a evolução do Mycroft, pode optar por 
                      autorizar o armazenamento criptografado de suas gravações. Isso é 
                      <strong> completamente opcional</strong> e requer consentimento adicional.
                    </p>
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium mb-1">Se você autorizar:</p>
                      <ul className="space-y-0.5">
                        <li>• Gravações são criptografadas com AES-256</li>
                        <li>• Dados são pseudonimizados (ID aleatório, sem link com sua conta)</li>
                        <li>• Usados apenas para treinar modelos de detecção de convicção</li>
                        <li>• Você pode solicitar exclusão a qualquer momento</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Section 3: Finalidade */}
          <section id="finalidade">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  3. Finalidade do Tratamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Seus dados são tratados para as seguintes finalidades específicas:
                </p>
                
                <div className="grid gap-3">
                  <div className="flex gap-3 items-start">
                    <CheckCircle className="w-5 h-5 text-success mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Execução do Contrato de Serviço</p>
                      <p className="text-sm text-muted-foreground">
                        Permitir que você jogue O BLEFADOR, salvar seu progresso, 
                        e fornecer funcionalidades do jogo.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 items-start">
                    <CheckCircle className="w-5 h-5 text-success mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Melhoria da Experiência</p>
                      <p className="text-sm text-muted-foreground">
                        Análise de dados agregados e anonimizados para melhorar 
                        o balanceamento e diversão do jogo.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 items-start">
                    <CheckCircle className="w-5 h-5 text-success mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Segurança e Prevenção de Fraudes</p>
                      <p className="text-sm text-muted-foreground">
                        Detecção de comportamentos fraudulentos e proteção 
                        da integridade do jogo.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 items-start">
                    <CheckCircle className="w-5 h-5 text-success mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Comunicação (com consentimento)</p>
                      <p className="text-sm text-muted-foreground">
                        Envio de atualizações sobre o jogo, novos recursos, 
                        e informações relevantes.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Section 4: Armazenamento */}
          <section id="armazenamento">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-primary" />
                  4. Armazenamento e Retenção
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Dados de Conta</h4>
                    <p className="text-sm text-muted-foreground">
                      Mantidos enquanto sua conta estiver ativa. Após exclusão da conta, 
                      dados são removidos em até 30 dias.
                    </p>
                  </div>
                  
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Dados de Jogo</h4>
                    <p className="text-sm text-muted-foreground">
                      Estatísticas e rankings são mantidos indefinidamente em formato 
                      agregado. Histórico detalhado por 12 meses.
                    </p>
                  </div>
                  
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Métricas de Voz</h4>
                    <p className="text-sm text-muted-foreground">
                      Métricas anonimizadas são retidas por 24 meses para 
                      fins estatísticos e de melhoria do algoritmo.
                    </p>
                  </div>
                  
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Gravações de Voz</h4>
                    <p className="text-sm text-muted-foreground">
                      Se autorizadas, mantidas por até 36 meses para treinamento. 
                      Podem ser excluídas a qualquer momento mediante solicitação.
                    </p>
                  </div>
                </div>

                <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-4 h-4 text-primary" />
                    <p className="font-medium">Localização dos Servidores</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Nossos dados são armazenados em servidores seguros localizados 
                    nos Estados Unidos, em conformidade com padrões internacionais 
                    de segurança (SOC 2, ISO 27001).
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Section 5: Compartilhamento */}
          <section id="compartilhamento">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  5. Compartilhamento de Dados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Não vendemos seus dados pessoais. Compartilhamos dados apenas nas 
                  seguintes circunstâncias:
                </p>
                
                <div className="space-y-3">
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h4 className="font-semibold mb-1">Provedores de Serviço</h4>
                    <p className="text-sm text-muted-foreground">
                      Parceiros que nos ajudam a operar o jogo (hospedagem, autenticação, 
                      processamento de pagamentos). Todos assinam acordos de proteção de dados.
                    </p>
                  </div>
                  
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h4 className="font-semibold mb-1">Obrigações Legais</h4>
                    <p className="text-sm text-muted-foreground">
                      Quando exigido por lei, ordem judicial, ou para proteger 
                      direitos, propriedade ou segurança.
                    </p>
                  </div>
                  
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h4 className="font-semibold mb-1">Com Seu Consentimento</h4>
                    <p className="text-sm text-muted-foreground">
                      Para qualquer outra finalidade, solicitaremos seu 
                      consentimento expresso previamente.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Section 6: Seus Direitos */}
          <section id="seus-direitos">
            <Card className="border-success/50">
              <CardHeader className="bg-success/5">
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-success" />
                  6. Seus Direitos (LGPD)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <p className="text-muted-foreground">
                  A LGPD garante os seguintes direitos sobre seus dados pessoais:
                </p>
                
                <div className="grid md:grid-cols-2 gap-3">
                  {[
                    { title: "Acesso", desc: "Saber quais dados temos sobre você" },
                    { title: "Correção", desc: "Corrigir dados incompletos ou incorretos" },
                    { title: "Anonimização", desc: "Solicitar anonimização de dados desnecessários" },
                    { title: "Portabilidade", desc: "Receber seus dados em formato estruturado" },
                    { title: "Eliminação", desc: "Solicitar exclusão de dados pessoais" },
                    { title: "Revogação", desc: "Revogar consentimentos a qualquer momento" },
                    { title: "Informação", desc: "Saber com quem compartilhamos seus dados" },
                    { title: "Oposição", desc: "Opor-se a tratamento em certas situações" },
                  ].map((right, i) => (
                    <div key={i} className="flex gap-2 items-start bg-muted/20 rounded-lg p-3">
                      <CheckCircle className="w-4 h-4 text-success mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{right.title}</p>
                        <p className="text-xs text-muted-foreground">{right.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mt-4">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    Como Exercer Seus Direitos
                  </h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Para exercer qualquer um desses direitos, entre em contato conosco:
                  </p>
                  <ul className="text-sm space-y-1">
                    <li>📧 E-mail: <span className="text-primary">privacidade@blefador.com.br</span></li>
                    <li>⏱️ Prazo de resposta: até 15 dias úteis</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Section 7: Segurança */}
          <section id="seguranca">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" />
                  7. Medidas de Segurança
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Implementamos medidas técnicas e organizacionais para proteger seus dados:
                </p>
                
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="font-medium text-sm mb-1">🔐 Criptografia</p>
                    <p className="text-xs text-muted-foreground">
                      Dados em trânsito (TLS 1.3) e em repouso (AES-256)
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="font-medium text-sm mb-1">🛡️ Autenticação</p>
                    <p className="text-xs text-muted-foreground">
                      Autenticação segura com tokens JWT
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="font-medium text-sm mb-1">📊 Monitoramento</p>
                    <p className="text-xs text-muted-foreground">
                      Logs de acesso e detecção de anomalias
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="font-medium text-sm mb-1">👥 Acesso Restrito</p>
                    <p className="text-xs text-muted-foreground">
                      Apenas equipe autorizada acessa dados pessoais
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Section 8: Cookies */}
          <section id="cookies">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  8. Cookies e Armazenamento Local
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Utilizamos tecnologias de armazenamento local para melhorar sua experiência:
                </p>
                
                <div className="space-y-3">
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h4 className="font-semibold mb-1">Cookies Essenciais</h4>
                    <p className="text-sm text-muted-foreground">
                      Necessários para autenticação e funcionamento básico do jogo. 
                      Não podem ser desativados.
                    </p>
                  </div>
                  
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h4 className="font-semibold mb-1">LocalStorage</h4>
                    <p className="text-sm text-muted-foreground">
                      Armazenamos preferências locais (tema, volume, consentimento Mycroft) 
                      diretamente no seu navegador. Esses dados não são enviados a servidores.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Section 9: Contato */}
          <section id="contato">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  9. Contato e DPO
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Para questões relacionadas à privacidade ou para exercer seus direitos:
                </p>
                
                <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                  <p className="font-medium">O BLEFADOR - Privacidade</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>📧 E-mail: <span className="text-primary">privacidade@blefador.com.br</span></li>
                    <li>🏢 Encarregado (DPO): <span className="text-primary">dpo@blefador.com.br</span></li>
                  </ul>
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>
                    Se você não estiver satisfeito com nossa resposta, pode registrar 
                    uma reclamação junto à Autoridade Nacional de Proteção de Dados (ANPD).
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Footer */}
          <div className="text-center pt-8 pb-16">
            <Separator className="mb-8" />
            <p className="text-sm text-muted-foreground mb-4">
              Esta política pode ser atualizada periodicamente. Recomendamos que você 
              a revise regularmente para se manter informado sobre como protegemos seus dados.
            </p>
            <Link to="/">
              <Button className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Voltar ao Jogo
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
