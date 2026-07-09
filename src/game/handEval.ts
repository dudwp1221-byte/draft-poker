import type { Card } from './deck';

export const CAT_NAMES = [
  '하이카드',
  '원페어',
  '투페어',
  '트리플',
  '스트레이트',
  '플러시',
  '풀하우스',
  '포카드',
  '스트레이트 플러시',
] as const;

export interface HandEval {
  /** 클수록 강한 패. 카테고리·키커까지 단일 숫자로 비교 가능 */
  score: number;
  /** 0=하이카드 ~ 8=스트레이트 플러시 */
  cat: number;
  /** 족보를 구성하는 베스트 5장 */
  cards: Card[];
}

/** 정확히 5장을 평가 */
function eval5(cs: Card[]): { score: number; cat: number } {
  const ranks = cs.map((c) => c.rank).sort((a, b) => b - a);
  const flush = cs.every((c) => c.suit === cs[0].suit);

  // 스트레이트 (A-2-3-4-5 휠은 5 하이로 취급, A-K-Q-J-10이 최고)
  let straightHigh = 0;
  const uniq = [...new Set(ranks)];
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    else if (uniq[0] === 14 && uniq[1] === 5 && uniq[1] - uniq[4] === 3) straightHigh = 5;
  }

  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  let cat: number;
  let tie: number[];
  if (flush && straightHigh) {
    cat = 8;
    tie = [straightHigh];
  } else if (groups[0][1] === 4) {
    cat = 7;
    tie = [groups[0][0], groups[1][0]];
  } else if (groups[0][1] === 3 && groups[1][1] === 2) {
    cat = 6;
    tie = [groups[0][0], groups[1][0]];
  } else if (flush) {
    cat = 5;
    tie = ranks;
  } else if (straightHigh) {
    cat = 4;
    tie = [straightHigh];
  } else if (groups[0][1] === 3) {
    cat = 3;
    tie = [groups[0][0], groups[1][0], groups[2][0]];
  } else if (groups[0][1] === 2 && groups[1][1] === 2) {
    cat = 2;
    tie = [groups[0][0], groups[1][0], groups[2][0]];
  } else if (groups[0][1] === 2) {
    cat = 1;
    tie = [groups[0][0], groups[1][0], groups[2][0], groups[3][0]];
  } else {
    cat = 0;
    tie = ranks;
  }

  let score = cat;
  for (let k = 0; k < 5; k++) score = score * 15 + (tie[k] ?? 0);
  return { score, cat };
}

function* combinations5(n: number): Generator<number[]> {
  for (let a = 0; a < n - 4; a++)
    for (let b = a + 1; b < n - 3; b++)
      for (let c = b + 1; c < n - 2; c++)
        for (let d = c + 1; d < n - 1; d++)
          for (let e = d + 1; e < n; e++) yield [a, b, c, d, e];
}

/** N장(5~7장)에서 베스트 5장 족보를 찾는다 */
export function bestHand(cards: Card[]): HandEval {
  if (cards.length < 5) throw new Error(`bestHand requires >= 5 cards, got ${cards.length}`);
  if (cards.length === 5) {
    const e = eval5(cards);
    return { ...e, cards: [...cards] };
  }
  let best: HandEval | null = null;
  for (const combo of combinations5(cards.length)) {
    const cs = combo.map((i) => cards[i]);
    const e = eval5(cs);
    if (!best || e.score > best.score) best = { ...e, cards: cs };
  }
  return best!;
}
