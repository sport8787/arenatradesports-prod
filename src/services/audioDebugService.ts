// Audio Debug Service - Tracks TTS enqueue/execute events for debugging triple narration issue

export interface AudioDebugEvent {
  moment: string;
  text: string;
  source: string;
  timestamp: number;
}

interface AudioDebugStats {
  enqueued: Record<string, number>;
  executed: Record<string, number>;
  blocked: Record<string, number>;
  events: AudioDebugEvent[];
}

const stats: AudioDebugStats = {
  enqueued: {},
  executed: {},
  blocked: {},
  events: [],
};

const MAX_EVENTS = 50;

export function recordEnqueue(moment: string, text: string, source: string = 'unknown') {
  stats.enqueued[moment] = (stats.enqueued[moment] || 0) + 1;
  stats.events.unshift({
    moment,
    text: text.substring(0, 60),
    source,
    timestamp: Date.now(),
  });
  if (stats.events.length > MAX_EVENTS) {
    stats.events.pop();
  }
  console.log(`[AudioDebug] 📥 ENQUEUE [${moment}] from ${source} (total: ${stats.enqueued[moment]})`);
}

export function recordExecute(moment: string) {
  stats.executed[moment] = (stats.executed[moment] || 0) + 1;
  console.log(`[AudioDebug] ▶️ EXECUTE [${moment}] (total: ${stats.executed[moment]})`);
}

export function recordBlocked(moment: string, reason: string) {
  stats.blocked[moment] = (stats.blocked[moment] || 0) + 1;
  console.log(`[AudioDebug] ⛔ BLOCKED [${moment}] reason: ${reason} (total: ${stats.blocked[moment]})`);
}

export function getAudioDebugStats(): AudioDebugStats {
  return { ...stats };
}

export function resetAudioDebugStats() {
  stats.enqueued = {};
  stats.executed = {};
  stats.blocked = {};
  stats.events = [];
  console.log('[AudioDebug] 🔄 Stats reset');
}

// Subscribe to stats changes (simple polling approach)
let listeners: (() => void)[] = [];

export function subscribeToAudioDebug(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

export function notifyAudioDebugListeners() {
  listeners.forEach(l => l());
}
