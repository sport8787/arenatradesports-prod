import { motion } from 'framer-motion';
import { Zap, Check, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ComingSoonModuleProps {
  title: string;
  description: string;
  features: string[];
  className?: string;
}

export default function ComingSoonModule({ title, description, features, className }: ComingSoonModuleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "border border-border rounded-lg bg-gradient-to-br from-card to-muted/20 overflow-hidden",
        className
      )}
    >
      <div className="p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
          <Zap className="w-5 h-5 text-primary-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="font-mono text-xs font-semibold text-foreground tracking-tight">{title}</h3>
            <span className="px-1.5 py-0.5 bg-warning/15 text-warning text-[9px] font-mono font-semibold rounded">
              EM BREVE
            </span>
          </div>

          <p className="text-[10px] font-mono text-muted-foreground leading-relaxed mb-3">{description}</p>

          <div className="space-y-1.5 mb-3">
            {features.map((feature, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-[10px] font-mono">
                <Check className="w-3 h-3 text-success shrink-0" />
                <span className="text-foreground/70">{feature}</span>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="font-mono text-[10px] h-7 px-3"
            onClick={() => toast.success('Você será notificado quando disponível!')}
          >
            <Bell className="w-3 h-3 mr-1.5" />
            Notificar Quando Disponível
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
