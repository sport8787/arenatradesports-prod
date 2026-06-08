/**
 * Som de alerta crítico (SAIR AGORA) — gerado via Web Audio API.
 * Não depende de ElevenLabs nem de assets externos. Toca instantaneamente.
 *
 * Padrão: 3 beeps urgentes em frequência alta (tipo sirene de emergência).
 */

let audioCtx: AudioContext | null = null;
let unlockListenerAdded = false;

/**
 * Desbloqueia o AudioContext no primeiro gesto do usuário.
 * Browsers bloqueiam Web Audio até haver interação (click/tap/key).
 * Chamar esta função no mount do app garante que o som funciona assim que
 * o usuário tocar qualquer coisa — mesmo que o alerta dispare minutos depois.
 */
export function setupAudioUnlock() {
  if (typeof window === 'undefined' || unlockListenerAdded) return;
  unlockListenerAdded = true;

  const unlock = () => {
    try {
      if (!audioCtx || audioCtx.state === 'closed') {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
    } catch { /* ignore */ }
  };

  // Qualquer gesto do usuário desbloqueia
  ['click', 'touchstart', 'keydown', 'pointerdown'].forEach(evt => {
    window.addEventListener(evt, unlock, { once: false, passive: true });
  });
}

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      // Tenta retomar — só funciona durante/após gesto do usuário
      audioCtx.resume().catch(() => {});
    }
    if (audioCtx.state === 'suspended') {
      // Ainda suspeso: navegador bloqueou → retorna null para falhar silenciosamente
      return null;
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

/**
 * Beep com forma de onda customizável e leve glide de frequência (estilo sci-fi).
 */
function tone(
  ctx: AudioContext,
  startAt: number,
  freqStart: number,
  freqEnd: number,
  duration: number,
  volume = 0.3,
  type: OscillatorType = 'triangle',
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, startAt);
  osc.frequency.exponentialRampToValueAtTime(Math.max(50, freqEnd), startAt + duration);

  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(volume, startAt + 0.015);
  gain.gain.linearRampToValueAtTime(volume * 0.6, startAt + duration * 0.7);
  gain.gain.linearRampToValueAtTime(0, startAt + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/**
 * Padrão IA — arpejo sci-fi futurista, totalmente diferente do alerta crítico.
 * 4 notas ascendentes em onda triangular + glide final, lembra "computador pensando concluiu".
 * Duração total ~1.0s.
 */
export function playAiSignalAlert() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Arpejo: C5 → E5 → G5 → B5 (acorde Cmaj7 ascendente)
  tone(ctx, now + 0.00, 523.25, 523.25, 0.14, 0.28, 'triangle');
  tone(ctx, now + 0.13, 659.25, 659.25, 0.14, 0.28, 'triangle');
  tone(ctx, now + 0.26, 783.99, 783.99, 0.14, 0.28, 'triangle');
  // Nota final com glide pra cima (sinal "confirma")
  tone(ctx, now + 0.42, 987.77, 1318.51, 0.42, 0.32, 'sine');

  // Camada sutil de "shimmer" (segunda voz uma oitava acima na última nota)
  tone(ctx, now + 0.42, 1975.53, 2637.02, 0.42, 0.12, 'sine');

  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([60, 40, 60, 40, 60, 40, 180]);
    }
  } catch { /* ignore */ }
}
