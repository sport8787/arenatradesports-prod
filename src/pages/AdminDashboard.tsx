import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import PunterCalibration from '@/components/admin/PunterCalibration';
import PunterPromptSimulator from '@/components/admin/PunterPromptSimulator';

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth?redirect=/admin" replace />;
  if (!isAdmin) return <Navigate to="/punter" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Painel do Administrador</h1>
            <p className="text-sm text-muted-foreground">Calibragem do Mycroft Punter</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="bg-primary text-primary-foreground">
              <a href="/admin/hub">🧭 Hub Admin</a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href="/admin/metricas-conversao">📊 Métricas de Conversão</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/admin/auditoria-sinais">⚖️ Auditoria de Sinais</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/admin/mycroft-chat-access">🔒 Tentativas Chat Mycroft</a>
            </Button>
          </div>
        </div>

        <PunterPromptSimulator />
        <PunterCalibration />
      </div>
    </div>
  );
}
