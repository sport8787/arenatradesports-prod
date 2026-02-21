export function detectPlatform(handContent: string): string {
  if (/pokerstars/i.test(handContent)) return 'PokerStars';
  if (/ggpoker/i.test(handContent)) return 'GGPoker';
  if (/888poker/i.test(handContent)) return '888poker';
  if (/partypoker/i.test(handContent)) return 'PartyPoker';
  if (/full tilt/i.test(handContent)) return 'FullTilt';
  if (/winamax/i.test(handContent)) return 'Winamax';
  if (/wpn|acr|americas cardroom/i.test(handContent)) return 'ACR';
  return 'unknown';
}
