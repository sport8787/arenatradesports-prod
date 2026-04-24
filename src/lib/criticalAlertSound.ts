/**
 * Som de alerta crítico (SAIR AGORA) — gerado via Web Audio API.
 * Não depende de ElevenLabs nem de assets externos. Toca instantaneamente.
 *
 * Padrão: 3 beeps urgentes em frequência alta (tipo sirene de emergência).
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Toca um beep único (oscilador + envelope ADSR rápido).
 */
function beep(ctx: AudioContext, freq: number, startAt: number, duration = 0.18, volume = 0.35) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, startAt);

  // Envelope: ataque rápido, decay rápido — soa "urgente"
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(volume, startAt + 0.01);
  gain.gain.linearRampToValueAtTime(volume * 0.8, startAt + duration * 0.6);
  gain.gain.linearRampToValueAtTime(0, startAt + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/**
 * Padrão crítico: 3 beeps alternando 880Hz / 1200Hz (estilo sirene de emergência).
 * Duração total: ~0.8s.
 */
export function playCriticalAlert() {
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  beep(ctx, 1200, now + 0.00, 0.18, 0.4);
  beep(ctx, 880,  now + 0.22, 0.18, 0.4);
  beep(ctx, 1200, now + 0.44, 0.22, 0.45);

  // Vibração no mobile (se suportado)
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([180, 80, 180, 80, 250]);
    }
  } catch { /* ignore */ }
}

/**
 * Padrão de aviso (WARNING — pressão crescente): 2 beeps suaves em 660Hz.
 */
export function playWarningAlert() {
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  beep(ctx, 660, now + 0.00, 0.15, 0.25);
  beep(ctx, 660, now + 0.20, 0.15, 0.25);

  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([120, 60, 120]);
    }
  } catch { /* ignore */ }
}
