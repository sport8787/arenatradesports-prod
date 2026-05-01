/**
 * Helper para informar a próxima janela de análise pré-live do Punter.
 * O cron oficial roda 1x/dia às 11:30 BRT (memória: punter/duplicate-prevention-v2).
 * Se já passou, mostra o horário de amanhã.
 */
const PUNTER_HOUR_BRT = 11;
const PUNTER_MINUTE_BRT = 30;

export function getNextPunterAnalysisWindow(now: Date = new Date()): {
  date: Date;
  label: string;
  isToday: boolean;
  minutesUntil: number;
} {
  // Hora local do navegador (assume usuário em BRT — UI só informativa).
  const target = new Date(now);
  target.setHours(PUNTER_HOUR_BRT, PUNTER_MINUTE_BRT, 0, 0);
  const isToday = target.getTime() > now.getTime();
  if (!isToday) {
    target.setDate(target.getDate() + 1);
  }
  const minutesUntil = Math.round((target.getTime() - now.getTime()) / 60000);
  const hh = String(target.getHours()).padStart(2, '0');
  const mm = String(target.getMinutes()).padStart(2, '0');
  const label = isToday
    ? `hoje às ${hh}:${mm}`
    : `amanhã às ${hh}:${mm}`;
  return { date: target, label, isToday, minutesUntil };
}

export function formatMinutesUntil(minutes: number): string {
  if (minutes < 60) return `em ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `em ${h}h`;
  return `em ${h}h ${m}min`;
}
