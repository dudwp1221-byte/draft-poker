export type Suit = 's' | 'h' | 'd' | 'c';

export interface Card {
  /** 2~14 (11=J, 12=Q, 13=K, 14=A) */
  rank: number;
  suit: Suit;
}

export const SUITS: Suit[] = ['s', 'h', 'd', 'c'];
export const SUIT_GLYPH: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const SUIT_COLOR: Record<Suit, 'red' | 'black'> = { s: 'black', h: 'red', d: 'red', c: 'black' };

export function rankLabel(rank: number): string {
  if (rank <= 10) return String(rank);
  return { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[rank]!;
}

export function cardLabel(c: Card): string {
  return `${SUIT_GLYPH[c.suit]}${rankLabel(c.rank)}`;
}

export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) deck.push({ rank, suit });
  }
  return deck;
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
