import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import FutoddsHealthPanel from '@/components/admin/FutoddsHealthPanel';

export default function AdminFutoddsHealthPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  if (authLoading || adminLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/lobby" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-mono text-sm font-semibold text-foreground tracking-tight flex-1">
            FUTODDS HEALTH — MONITOR
          </h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <FutoddsHealthPanel />
      </main>
    </div>
  );
}
