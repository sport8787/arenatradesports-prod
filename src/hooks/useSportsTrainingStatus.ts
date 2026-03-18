import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useSportsTrainingStatus() {
  const [completed, setCompleted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCompleted(false);
        setLoading(false);
        return;
      }

      // Use type assertion since column was just added via migration
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const profile = data as any;
      setCompleted(profile?.sports_training_completed ?? false);
      setLoading(false);
    };

    check();
  }, []);

  const markCompleted = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Use type assertion for new column
    await (supabase.from('profiles') as any)
      .update({
        sports_training_completed: true,
        sports_training_completed_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    setCompleted(true);
  };

  return { completed, loading, markCompleted };
}
