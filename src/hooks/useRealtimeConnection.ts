import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface RealtimeSubscription {
  table: string;
  filter?: string;
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
}

interface UseRealtimeConnectionProps {
  channelName: string;
  subscriptions: RealtimeSubscription[];
  onMessage: (payload: RealtimePostgresChangesPayload<any>) => void;
  enabled?: boolean;
}

interface ConnectionState {
  isConnected: boolean;
  isReconnecting: boolean;
  retryCount: number;
  lastError: string | null;
}

const MAX_RETRIES = 10;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

// Calculate exponential backoff delay with jitter
const getBackoffDelay = (retryCount: number): number => {
  const exponentialDelay = BASE_DELAY_MS * Math.pow(2, retryCount);
  const delay = Math.min(exponentialDelay, MAX_DELAY_MS);
  // Add jitter (0-25% of delay)
  const jitter = delay * Math.random() * 0.25;
  return delay + jitter;
};

export function useRealtimeConnection({
  channelName,
  subscriptions,
  onMessage,
  enabled = true,
}: UseRealtimeConnectionProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    isReconnecting: false,
    retryCount: 0,
    lastError: null,
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);
  const retryCountRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  
  // Keep onMessage ref updated
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (channelRef.current) {
      console.log(`[Realtime] Removing channel: ${channelName}`);
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, [channelName]);

  const connect = useCallback(() => {
    if (isUnmountedRef.current || !enabled) return;
    if (subscriptions.length === 0) return;

    cleanup();

    console.log(`[Realtime] Creating channel: ${channelName}`);

    let channel = supabase.channel(channelName);

    // Add all subscriptions
    subscriptions.forEach(({ table, filter, event = '*' }) => {
      const config: any = {
        event,
        schema: 'public',
        table,
      };
      if (filter) {
        config.filter = filter;
      }

      channel = channel.on('postgres_changes', config, (payload) => {
        console.log(`[Realtime] ${table} change:`, payload.eventType);
        onMessageRef.current(payload);
      });
    });

    channelRef.current = channel;

    channel.subscribe((status, err) => {
      if (isUnmountedRef.current) return;

      console.log(`[Realtime] Channel ${channelName} status: ${status}`, err || '');

      if (status === 'SUBSCRIBED') {
        retryCountRef.current = 0;
        setConnectionState({
          isConnected: true,
          isReconnecting: false,
          retryCount: 0,
          lastError: null,
        });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        const errorMessage = err?.message || status;
        console.error(`[Realtime] Connection error: ${errorMessage}`);
        
        const currentRetry = retryCountRef.current;
        retryCountRef.current = currentRetry + 1;
        
        setConnectionState({
          isConnected: false,
          isReconnecting: currentRetry < MAX_RETRIES,
          retryCount: currentRetry + 1,
          lastError: errorMessage,
        });

        // Schedule retry with exponential backoff
        if (currentRetry < MAX_RETRIES) {
          const delay = getBackoffDelay(currentRetry);
          console.log(`[Realtime] Scheduling retry #${currentRetry + 1} in ${Math.round(delay)}ms`);
          
          retryTimeoutRef.current = setTimeout(() => {
            if (!isUnmountedRef.current) {
              console.log(`[Realtime] Attempting reconnection #${currentRetry + 1}`);
              connect();
            }
          }, delay);
        } else {
          console.error(`[Realtime] Max retries (${MAX_RETRIES}) reached. Giving up.`);
        }
      } else if (status === 'CLOSED') {
        setConnectionState((prev) => ({
          ...prev,
          isConnected: false,
        }));
      }
    });
  }, [channelName, subscriptions, enabled, cleanup]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    console.log('[Realtime] Manual reconnection requested');
    retryCountRef.current = 0;
    setConnectionState({
      isConnected: false,
      isReconnecting: true,
      retryCount: 0,
      lastError: null,
    });
    connect();
  }, [connect]);

  useEffect(() => {
    isUnmountedRef.current = false;
    retryCountRef.current = 0;

    if (enabled && subscriptions.length > 0) {
      connect();
    }

    return () => {
      isUnmountedRef.current = true;
      cleanup();
    };
  }, [enabled, channelName]); // Only depend on enabled and channelName, not connect/cleanup

  return {
    ...connectionState,
    reconnect,
  };
}
