import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface AudioSyncEvent {
  type: 'play_audio' | 'stop_audio';
  audioUrl?: string;
  text?: string;
  personaId?: string;
  playAt: number; // Unix timestamp when audio should start
  eventId: string;
}

interface UseAudioSyncProps {
  roomId: string | null;
  isHost: boolean;
  canPlayAudio: boolean;
  onAudioReceived?: (audioUrl: string, text: string) => void;
}

interface UseAudioSyncReturn {
  broadcastAudio: (audioUrl: string, text: string, personaId: string) => void;
  broadcastStop: () => void;
  isConnected: boolean;
  lastEventId: string | null;
}

// Sync buffer in ms - audio starts this much after broadcast to allow propagation
const SYNC_BUFFER_MS = 500;

export function useAudioSync({
  roomId,
  isHost,
  canPlayAudio,
  onAudioReceived,
}: UseAudioSyncProps): UseAudioSyncReturn {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const processedEventsRef = useRef<Set<string>>(new Set());

  // Schedule audio to play at a specific time
  const scheduleAudioPlay = useCallback((audioUrl: string, playAt: number, text: string) => {
    const now = Date.now();
    const delay = Math.max(0, playAt - now);

    console.log('[AudioSync] Scheduling audio play in', delay, 'ms');

    setTimeout(() => {
      if (!canPlayAudio) {
        console.log('[AudioSync] Cannot play audio (mode restriction)');
        return;
      }

      // Stop any existing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => console.log('[AudioSync] Audio started playing:', text?.substring(0, 30));
      audio.onended = () => {
        console.log('[AudioSync] Audio ended');
        audioRef.current = null;
      };
      audio.onerror = (e) => {
        console.error('[AudioSync] Audio error:', e);
        audioRef.current = null;
      };

      audio.play().catch((err) => {
        console.error('[AudioSync] Play failed:', err);
      });
    }, delay);
  }, [canPlayAudio]);

  // Handle incoming audio events
  const handleAudioEvent = useCallback((event: AudioSyncEvent) => {
    // Prevent processing same event twice
    if (processedEventsRef.current.has(event.eventId)) {
      console.log('[AudioSync] Skipping duplicate event:', event.eventId);
      return;
    }
    processedEventsRef.current.add(event.eventId);
    setLastEventId(event.eventId);

    // Keep set size manageable
    if (processedEventsRef.current.size > 100) {
      const entries = Array.from(processedEventsRef.current);
      entries.slice(0, 50).forEach(id => processedEventsRef.current.delete(id));
    }

    if (event.type === 'play_audio' && event.audioUrl) {
      console.log('[AudioSync] Received play_audio event:', event.eventId);
      
      // Notify parent component
      if (onAudioReceived && event.text) {
        onAudioReceived(event.audioUrl, event.text);
      }

      // Schedule playback
      scheduleAudioPlay(event.audioUrl, event.playAt, event.text || '');
    } else if (event.type === 'stop_audio') {
      console.log('[AudioSync] Received stop_audio event');
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    }
  }, [scheduleAudioPlay, onAudioReceived]);

  // Subscribe to room channel
  useEffect(() => {
    if (!roomId) return;

    const channelName = `audio-sync-${roomId}`;
    console.log('[AudioSync] Subscribing to channel:', channelName);

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: {
          self: false, // Don't receive own broadcasts
        },
      },
    });

    channel
      .on('broadcast', { event: 'audio_sync' }, (payload) => {
        console.log('[AudioSync] Received broadcast:', payload);
        handleAudioEvent(payload.payload as AudioSyncEvent);
      })
      .subscribe((status) => {
        console.log('[AudioSync] Channel status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      console.log('[AudioSync] Unsubscribing from channel');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [roomId, handleAudioEvent]);

  // Broadcast audio to all players (host only)
  const broadcastAudio = useCallback((audioUrl: string, text: string, personaId: string) => {
    if (!channelRef.current || !isHost) {
      console.log('[AudioSync] Cannot broadcast - not host or no channel');
      return;
    }

    const eventId = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const playAt = Date.now() + SYNC_BUFFER_MS;

    const event: AudioSyncEvent = {
      type: 'play_audio',
      audioUrl,
      text,
      personaId,
      playAt,
      eventId,
    };

    console.log('[AudioSync] Broadcasting audio:', eventId);

    channelRef.current.send({
      type: 'broadcast',
      event: 'audio_sync',
      payload: event,
    });

    // Host also plays the audio (since self is false)
    if (canPlayAudio) {
      scheduleAudioPlay(audioUrl, playAt, text);
    }
  }, [isHost, canPlayAudio, scheduleAudioPlay]);

  // Broadcast stop to all players
  const broadcastStop = useCallback(() => {
    if (!channelRef.current || !isHost) return;

    const eventId = `stop_${Date.now()}`;

    channelRef.current.send({
      type: 'broadcast',
      event: 'audio_sync',
      payload: {
        type: 'stop_audio',
        playAt: Date.now(),
        eventId,
      } as AudioSyncEvent,
    });

    // Stop local audio too
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, [isHost]);

  return {
    broadcastAudio,
    broadcastStop,
    isConnected,
    lastEventId,
  };
}
