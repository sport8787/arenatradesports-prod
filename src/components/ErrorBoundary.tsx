import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Home, CheckCircle } from 'lucide-react';
import { useState } from 'react';

interface Props {
  children: ReactNode;
  fallbackRoute?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

function ErrorFallbackUI({ 
  error, 
  errorInfo, 
  onReset 
}: { 
  error: Error | null; 
  errorInfo: ErrorInfo | null; 
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const errorDetails = `
=== BLEFADOR ERROR REPORT ===
Date: ${new Date().toISOString()}
URL: ${window.location.href}
UserAgent: ${navigator.userAgent}

Error: ${error?.message || 'Unknown error'}

Stack: ${error?.stack || 'No stack trace'}

Component Stack: ${errorInfo?.componentStack || 'No component stack'}
`.trim();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(errorDetails);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = errorDetails;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="font-orbitron text-2xl text-destructive font-bold">
            Ops! Algo deu errado
          </h1>
          <p className="text-muted-foreground text-sm">
            Ocorreu um erro inesperado. Não se preocupe, seus dados estão seguros.
          </p>
        </div>

        {/* Error Message */}
        <div className="p-4 bg-secondary/50 rounded-lg border border-border/50 text-left">
          <p className="text-xs text-muted-foreground mb-1">Mensagem do erro:</p>
          <p className="text-sm text-foreground font-mono break-all">
            {error?.message || 'Erro desconhecido'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleReload}
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Recarregar Página
          </button>

          <button
            onClick={handleGoHome}
            className="w-full py-3 px-4 bg-secondary text-secondary-foreground rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-secondary/80 transition-colors"
          >
            <Home className="w-5 h-5" />
            Voltar ao Início
          </button>

          <button
            onClick={handleCopy}
            className="w-full py-2 px-4 border border-border rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-secondary/50 transition-colors text-muted-foreground"
          >
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4 text-success" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copiar Detalhes Técnicos
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground">
          Se o problema persistir, entre em contato com o suporte.
        </p>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    const msg = error?.message || '';

    // Auto-reload silencioso: chunk JS desatualizado após novo deploy (Vercel).
    const isChunkError =
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('error loading dynamically imported module') ||
      /Loading chunk \d+ failed/i.test(msg);

    if (isChunkError) {
      const alreadyReloaded = sessionStorage.getItem('chunk_reload');
      if (!alreadyReloaded) {
        console.warn('[ErrorBoundary] Chunk desatualizado detectado — recarregando automaticamente.');
        sessionStorage.setItem('chunk_reload', '1');
        window.location.reload();
        return;
      }
      sessionStorage.removeItem('chunk_reload');
    }

    // Auto-recover from DOM mutation errors caused by browser extensions
    // (Chrome auto-translate, Grammarly, LanguageTool, etc.) that wrap text
    // nodes and conflict with React's reconciliation.
    const isExtensionDomError =
      msg.includes('removeChild') ||
      msg.includes('insertBefore') ||
      msg.includes('not a child of this node') ||
      msg.includes('não é filho deste nó');

    if (isExtensionDomError) {
      console.warn('[ErrorBoundary] Extension-induced DOM error detected — auto-recovering.');
      setTimeout(() => {
        this.setState({ hasError: false, error: null, errorInfo: null });
      }, 50);
      return;
    }

    this.setState({ error, errorInfo });

    // Log to console for debugging
    console.error('=== BLEFADOR ERROR BOUNDARY ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('Component Stack:', errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallbackUI
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
