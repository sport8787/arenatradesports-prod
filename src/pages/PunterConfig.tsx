import { ArrowLeft, Settings, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import HorusConfig from '@/components/punter/HorusConfig';
import NotificationSettings from '@/components/punter/NotificationSettings';

export default function PunterConfig() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button onClick={() => navigate('/punter')} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            <h1 className="font-mono text-sm font-semibold text-foreground tracking-tight">
              CONFIGURAÇÕES
            </h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-5 space-y-6 max-w-2xl">
        {user ? (
           <>
             <section className="space-y-2">
               <h2 className="font-mono text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                 <Bell className="w-3.5 h-3.5" /> Notificações
               </h2>
               <NotificationSettings userId={user.id} />
             </section>

             <section className="space-y-2">
               <h2 className="font-mono text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                 <Settings className="w-3.5 h-3.5" /> Alertas do Hórus
               </h2>
               <HorusConfig userId={user.id} />
             </section>
           </>
        ) : (
          <p className="text-muted-foreground text-sm text-center py-8">Faça login para acessar as configurações.</p>
        )}
      </div>
    </div>
  );
}
