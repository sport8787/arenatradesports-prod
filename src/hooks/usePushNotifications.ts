import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Request browser notification permission
async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function showNotification(title: string, body: string, url?: string) {
  if (Notification.permission !== 'granted') return;
  const n = new Notification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'mycroft-aprovado',
    requireInteraction: true,
  });
  if (url) {
    n.onclick = () => {
      window.focus();
      window.open(url, '_self');
    };
  }
}

export function usePushNotifications() {
  const permissionGranted = useRef(false);
  const subscribedRef = useRef(false);

  useEffect(() => {
    requestPermission().then(granted => {
      permissionGranted.current = granted;
    });
  }, []);

  useEffect(() => {
    if (subscribedRef.current) return;
    subscribedRef.current = true;

    // Subscribe to realtime changes on mycroft_analyses for new APROVADO verdicts
    const channel = supabase
      .channel('push-aprovado')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mycroft_analyses',
          filter: 'verdict=eq.APROVADO',
        },
        async (payload) => {
          const analysis = payload.new as any;
          if (!analysis) return;

          // Get match info
          const { data: match } = await supabase
            .from('live_matches')
            .select('home_team, away_team, championship, minute')
            .eq('match_id', analysis.match_id)
            .maybeSingle();

          const title = '🎯 SINAL APROVADO';
          const body = match
            ? `${match.home_team} vs ${match.away_team} | ${analysis.market} @ ${analysis.odd} | ${analysis.confidence}%`
            : `${analysis.market} @ ${analysis.odd} | Confiança: ${analysis.confidence}%`;

          showNotification(title, body, '/arena-trader-sports');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      subscribedRef.current = false;
    };
  }, []);

  const requestPush = useCallback(async () => {
    const granted = await requestPermission();
    permissionGranted.current = granted;
    return granted;
  }, []);

  return { requestPush, isSupported: 'Notification' in window };
}
