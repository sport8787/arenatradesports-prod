import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Briefcase, Eye, EyeOff, UserX, ArrowLeft, Sparkles, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { track } from '@/lib/analytics';
import { z } from 'zod';

const emailSchema = z.string().email('E-mail inválido');
const passwordSchema = z.string().min(6, 'Senha deve ter no mínimo 6 caracteres');
const usernameSchema = z.string().min(3, 'Username deve ter no mínimo 3 caracteres').max(20, 'Username deve ter no máximo 20 caracteres');

type AuthMode = 'login' | 'register' | 'forgot';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showNicknameSetup, setShowNicknameSetup] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [guestNickname, setGuestNickname] = useState('');
  const [showGuestNicknameInput, setShowGuestNicknameInput] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { signIn, signUp, signInWithGoogle, signInWithApple, resetPassword, updateProfile, isAuthenticated, profile, loading } = useAuth();

  // Detect UTM referral and pre-fill promo
  const refSource = searchParams.get('ref') || searchParams.get('utm_source') || '';
  const prefilledCode = searchParams.get('promo') || '';

  useEffect(() => {
    if (prefilledCode) {
      setPromoCode(prefilledCode.toUpperCase());
      setMode('register');
    } else if (refSource) {
      // Auto-store referral source for later use on signup
      sessionStorage.setItem('referral_source', refSource);
    }
  }, [prefilledCode, refSource]);

  // Redireciona assim que o estado de auth confirmar o login.
  // Não esperamos o profile carregar para evitar travamento — só usamos o
  // profile (se já estiver disponível) para abrir o setup de nickname do Google.
  useEffect(() => {
    if (loading || !isAuthenticated) return;
    if (profile && profile.username === 'Jogador') {
      setShowNicknameSetup(true);
      return;
    }
    navigate('/menu', { replace: true });
  }, [isAuthenticated, loading, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      toast({ title: 'Erro', description: emailResult.error.errors[0].message, variant: 'destructive' });
      return;
    }

    if (mode === 'forgot') {
      setIsLoading(true);
      const { error } = await resetPassword(email);
      setIsLoading(false);
      
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'E-mail enviado!', description: 'Verifique sua caixa de entrada para redefinir sua senha.' });
        setMode('login');
      }
      return;
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      toast({ title: 'Erro', description: passwordResult.error.errors[0].message, variant: 'destructive' });
      return;
    }

    if (mode === 'register') {
      const usernameResult = usernameSchema.safeParse(username);
      if (!usernameResult.success) {
        toast({ title: 'Erro', description: usernameResult.error.errors[0].message, variant: 'destructive' });
        return;
      }
      if (!fullName.trim() || fullName.trim().length < 2) {
        toast({ title: 'Erro', description: 'Informe seu nome completo (mínimo 2 caracteres)', variant: 'destructive' });
        return;
      }
    }

    setIsLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast({ title: 'Erro', description: 'E-mail ou senha incorretos', variant: 'destructive' });
          } else if (error.message.includes('security purposes') || error.message.includes('request this after')) {
            toast({ title: 'Aguarde', description: 'Por segurança, aguarde alguns segundos antes de tentar novamente.', variant: 'destructive' });
          } else {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
          }
        } else {
          sessionStorage.setItem('showOpening', 'true');
          toast({ title: 'Bem-vindo!', description: 'Login realizado com sucesso' });
          // NÃO navegar aqui — o useEffect acima cuida do redirect assim que
          // o estado de auth (user) for populado pelo onAuthStateChange.
          // Navegar imediatamente causa race com RequireSubscription, que vê
          // user=null no próximo render e devolve para /auth.
        }
      } else {
        const { data, error } = await signUp(email, password, username, fullName.trim());
        if (error) {
          if (error.message.includes('already registered')) {
            toast({ title: 'Erro', description: 'Este e-mail já está cadastrado', variant: 'destructive' });
          } else if (error.message.includes('security purposes') || error.message.includes('request this after')) {
            toast({ title: 'Aguarde', description: 'Por segurança, aguarde alguns segundos antes de tentar novamente.', variant: 'destructive' });
          } else {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
          }
        } else {
          // Account created — try to redeem promo code or referral
          const userId = data?.user?.id;
          const storedRef = sessionStorage.getItem('referral_source') || refSource;
          
          if (userId && (promoCode || storedRef)) {
            try {
              const { data: promoResult } = await supabase.functions.invoke('redeem-promo', {
                body: {
                  user_id: userId,
                  code: promoCode || undefined,
                  referral_source: !promoCode ? storedRef : undefined,
                }
              });
              if (promoResult?.success) {
                toast({ 
                  title: `🎉 ${promoResult.trial_days} dias grátis!`, 
                  description: `Parceria ${promoResult.partner_name} ativada com sucesso!` 
                });
              }
            } catch (e) {
              console.warn('Promo redemption failed:', e);
            }
            sessionStorage.removeItem('referral_source');
          }
          
          // PostHog: signup completo (com UTMs anexadas via super-properties)
          track.signUp('trial', storedRef || 'organic', 'email');

          // Meta Pixel: Lead + CompleteRegistration + StartTrial (signup = trial 7d ativado)
          if (typeof window !== 'undefined' && (window as any).fbq) {
            const fbq = (window as any).fbq;
            fbq('track', 'Lead', {
              content_name: 'signup_email',
              source: storedRef || 'organic',
            });
            fbq('track', 'CompleteRegistration', {
              content_name: 'signup_email',
              status: true,
              source: storedRef || 'organic',
            });
            fbq('track', 'StartTrial', {
              content_name: 'trial_7_dias',
              currency: 'BRL',
              value: 0,
              predicted_ltv: 149.90,
            });
          }

          sessionStorage.setItem('showOpening', 'true');
          toast({ title: 'Conta criada!', description: 'Bem-vindo ao Oráculo Mycroft!' });
          // Mesma razão do login: deixar o useEffect redirecionar quando user atualizar.
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'Lead', { content_name: 'signup_google' });
    }
    const { error } = await signInWithGoogle();
    if (error) {
      toast({ title: 'Erro', description: 'Falha ao conectar com Google', variant: 'destructive' });
    }
    setIsLoading(false);
  };

  const handleAppleSignIn = async () => {
    setIsLoading(true);
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'Lead', { content_name: 'signup_apple' });
    }
    const { error } = await signInWithApple();
    if (error) {
      toast({ title: 'Erro', description: 'Falha ao conectar com Apple', variant: 'destructive' });
    }
    setIsLoading(false);
  };

  const handleGuestMode = () => {
    setShowGuestNicknameInput(true);
  };

  const handleConfirmGuestNickname = () => {
    const result = usernameSchema.safeParse(guestNickname);
    if (!result.success) {
      toast({ title: 'Erro', description: result.error.errors[0].message, variant: 'destructive' });
      return;
    }
    
    sessionStorage.setItem('guestMode', 'true');
    sessionStorage.setItem('guestNickname', guestNickname);
    navigate('/menu');
  };

  const handleSaveNickname = async () => {
    const result = usernameSchema.safeParse(newNickname);
    if (!result.success) {
      toast({ title: 'Erro', description: result.error.errors[0].message, variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const { error } = await updateProfile({ username: newNickname });
    setIsLoading(false);

    if (error) {
      toast({ title: 'Erro', description: 'Falha ao salvar nickname', variant: 'destructive' });
    } else {
      toast({ title: 'Nickname salvo!', description: `Bem-vindo, ${newNickname}!` });
      navigate('/menu');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Briefcase className="w-12 h-12 text-primary" />
        </motion.div>
      </div>
    );
  }

  // Nickname setup modal for Google users
  if (showNicknameSetup) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/10" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-2xl" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="text-center mb-8">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
              className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary to-primary/60 rounded-2xl shadow-2xl shadow-primary/30 mb-4"
            >
              <Sparkles className="w-10 h-10 text-primary-foreground" />
            </motion.div>
            <h1 className="text-2xl font-bold text-primary tracking-wider mb-2">ESCOLHA SEU NICKNAME</h1>
            <p className="text-muted-foreground text-sm">Como você quer ser conhecido no jogo?</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-2xl"
          >
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Nickname</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Seu nome no jogo"
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                    className="pl-10 bg-background/50 border-border/50 focus:border-primary"
                    maxLength={20}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">3-20 caracteres. Este nome aparecerá no ranking.</p>
              </div>

              <Button
                onClick={handleSaveNickname}
                disabled={isLoading || newNickname.length < 3}
                className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-bold py-6 text-lg shadow-lg shadow-primary/30"
              >
                {isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Briefcase className="w-5 h-5" />
                  </motion.div>
                ) : (
                  'CONFIRMAR NICKNAME'
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/10" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-2xl" />
      
      {/* Decorative Lines */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: 'spring' }}
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary to-primary/60 rounded-2xl shadow-2xl shadow-primary/30 mb-4"
          >
            <Briefcase className="w-10 h-10 text-primary-foreground" />
          </motion.div>
          <h1 className="text-3xl font-bold text-primary tracking-wider mb-2 font-orbitron">ORÁCULO MYCROFT</h1>
          <p className="text-muted-foreground text-sm">Plataforma de Investimento Esportivo com IA</p>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-2xl"
        >
          {mode === 'forgot' ? (
            <>
              <button
                onClick={() => setMode('login')}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
              <h2 className="text-xl font-bold text-foreground mb-2">Recuperar Senha</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Digite seu e-mail e enviaremos um link para redefinir sua senha.
              </p>
            </>
          ) : (
            /* Tabs */
            <div className="flex gap-2 mb-6 p-1 bg-muted/30 rounded-lg">
              <button
                onClick={() => setMode('login')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  mode === 'login'
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                ENTRAR
              </button>
              <button
                onClick={() => setMode('register')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  mode === 'register'
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                CRIAR CONTA
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="text-sm text-muted-foreground mb-1.5 block">Nickname</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Seu nome no jogo"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 bg-background/50 border-border/50 focus:border-primary"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Este será seu nome nas partidas</p>

                {/* Nome completo */}
                <div className="mt-3">
                  <label className="text-sm text-muted-foreground mb-1.5 block">Nome</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Seu nome completo"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10 bg-background/50 border-border/50 focus:border-primary"
                      maxLength={120}
                    />
                  </div>
                </div>

                {/* Promo Code */}
                <div className="mt-3">
                  <label className="text-sm text-muted-foreground mb-1.5 block">Código promocional (opcional)</label>
                  <div className="relative">
                    <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Ex: SPIN30"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      className="pl-10 bg-background/50 border-border/50 focus:border-primary uppercase"
                      maxLength={20}
                    />
                  </div>
                  {promoCode && (
                    <p className="text-xs text-green-400 mt-1">🎁 Código será aplicado ao criar a conta</p>
                  )}
                  {!promoCode && refSource && (
                    <p className="text-xs text-green-400 mt-1">🎁 Parceiro {refSource} detectado — bônus será aplicado automaticamente</p>
                  )}
                </div>
              </motion.div>
            )}

            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-background/50 border-border/50 focus:border-primary"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-background/50 border-border/50 focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'login' && (
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                Esqueci minha senha
              </button>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-bold py-6 text-lg shadow-lg shadow-primary/30"
            >
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Briefcase className="w-5 h-5" />
                </motion.div>
              ) : mode === 'forgot' ? (
                'ENVIAR LINK'
              ) : mode === 'login' ? (
                'ENTRAR'
              ) : (
                'CRIAR CONTA'
              )}
            </Button>
          </form>

          {mode !== 'forgot' && (
            <>
              {/* Divider */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-xs text-muted-foreground">OU</span>
                <div className="flex-1 h-px bg-border/50" />
              </div>

              {/* Google Sign In */}
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full border-border/50 hover:bg-muted/30 py-6 mb-3"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Entrar com Google
              </Button>

              {/* Apple Sign In */}
              <Button
                type="button"
                variant="outline"
                onClick={handleAppleSignIn}
                disabled={isLoading}
                className="w-full border-border/50 hover:bg-muted/30 py-6 mb-3"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                Entrar com Apple
              </Button>

              {/* Guest Mode */}
              {showGuestNicknameInput ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3 p-4 bg-muted/20 rounded-lg border border-border/50"
                >
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Nickname de Convidado</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Seu nome no jogo"
                        value={guestNickname}
                        onChange={(e) => setGuestNickname(e.target.value)}
                        className="pl-10 bg-background/50 border-border/50 focus:border-primary"
                        maxLength={20}
                        autoFocus
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">3-20 caracteres</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowGuestNicknameInput(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      onClick={handleConfirmGuestNickname}
                      disabled={guestNickname.length < 3}
                      className="flex-1 bg-gradient-to-r from-primary to-primary/80"
                    >
                      Entrar
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleGuestMode}
                    disabled={isLoading}
                    className="w-full text-muted-foreground hover:text-foreground hover:bg-muted/20 py-6"
                  >
                    <UserX className="w-5 h-5 mr-2" />
                    Entrar como Convidado
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Modo convidado não salva BluffCoins
                  </p>
                </>
              )}
            </>
          )}
        </motion.div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Ao entrar, você concorda com nossos Termos de Uso
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;