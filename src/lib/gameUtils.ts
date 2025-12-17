// Generate a random 4-character PIN
export function generatePin(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pin = '';
  for (let i = 0; i < 4; i++) {
    pin += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pin;
}

// Generate a unique session ID
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get session ID from localStorage or create new
export function getOrCreateSessionId(): string {
  const key = 'blefador_session_id';
  let sessionId = localStorage.getItem(key);
  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem(key, sessionId);
  }
  return sessionId;
}

// Get avatar colors based on index
export function getAvatarColor(index: number): string {
  const colors = [
    'from-amber-500 to-orange-600',
    'from-emerald-500 to-teal-600',
    'from-blue-500 to-indigo-600',
    'from-purple-500 to-pink-600',
    'from-red-500 to-rose-600',
    'from-cyan-500 to-sky-600',
  ];
  return colors[index % colors.length];
}

// Get initials from nickname
export function getInitials(nickname: string): string {
  return nickname.substring(0, 2).toUpperCase();
}

// Format score with leading zeros
export function formatScore(score: number): string {
  return score.toString().padStart(4, '0');
}

function normalizeQuestionText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Removes duplicated questions (same question text) to prevent repeats within a match.
 */
export function uniqueQuestionsByText<T extends { question_text: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];

  for (const row of rows) {
    const key = normalizeQuestionText(row.question_text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
}

