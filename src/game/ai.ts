import type { Card } from './deck';
import { bestHand } from './handEval';
import { type GameState, type BetAction, betOptions } from './engine';

// 봇별 성향 (좌석 번호 기반 고정 시드 → 같은 봇은 같은 성향)
function aggression(seat: number): number {
  const x = Math.sin(seat * 9973.7) * 10000;
  return 0.85 + (x - Math.floor(x)) * 0.3; // 0.85 ~ 1.15
}

// ---------------------------------------------------------------------------
// 드래프트 픽
// ---------------------------------------------------------------------------

function scorePick(hand: Card[], c: Card): number {
  let s = c.rank * 0.12; // 높은 카드 선호 (약하게)

  const ranks = hand.map((h) => h.rank);
  const sameRank = ranks.filter((r) => r === c.rank).length;
  if (sameRank === 1) s += 6; // 페어 완성
  else if (sameRank === 2) s += 14; // 트리플
  else if (sameRank >= 3) s += 24; // 포카드

  const sameSuit = hand.filter((h) => h.suit === c.suit).length;
  s += [0, 0.6, 1.8, 4.5, 9, 14][Math.min(sameSuit, 5)];

  const near = ranks.filter((r) => r !== c.rank && Math.abs(r - c.rank) <= 4).length;
  s += near * 0.7;

  return s + Math.random() * 1.6; // 약간의 무작위성
}

export function aiDraftPick(gs: GameState, seat: number): number {
  const p = gs.players[seat];
  if (!p.packet) return 0;
  let bestIdx = 0;
  let bestScore = -Infinity;
  p.packet.forEach((c, i) => {
    const sc = scorePick(p.hand, c);
    if (sc > bestScore) {
      bestScore = sc;
      bestIdx = i;
    }
  });
  return bestIdx;
}

// ---------------------------------------------------------------------------
// 핸드 강도 추정 (0~1)
// ---------------------------------------------------------------------------

function handStrength(hand: Card[], totalPicks: number): number {
  if (hand.length >= 5) {
    const ev = bestHand(hand);
    const base = [0.16, 0.4, 0.58, 0.7, 0.8, 0.86, 0.93, 0.97, 0.99][ev.cat];
    const kicker = Math.max(...hand.map((c) => c.rank)) / 14;
    // 아직 픽이 남아 있으면 발전 가능성 약간 가산
    const growth = hand.length < totalPicks ? 0.04 : 0;
    return Math.min(1, base + kicker * 0.05 + growth);
  }

  // 5장 미만: 잠재력 휴리스틱
  const ranks = hand.map((c) => c.rank);
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const maxOfAKind = Math.max(...counts.values());
  const suitCounts = new Map<string, number>();
  for (const c of hand) suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1);
  const maxSuit = Math.max(...suitCounts.values());

  let s = 0.12 + (Math.max(...ranks) / 14) * 0.12;
  if (maxOfAKind === 2) s += 0.18;
  if (maxOfAKind === 3) s += 0.38;
  if (maxOfAKind >= 4) s += 0.6;
  if ([...counts.values()].filter((v) => v >= 2).length >= 2) s += 0.12; // 투페어 진행
  if (maxSuit >= 3) s += 0.08;
  if (maxSuit >= 4) s += 0.16;
  return Math.min(0.85, s);
}

// ---------------------------------------------------------------------------
// 베팅 결정
// ---------------------------------------------------------------------------

export function aiBettingAction(gs: GameState, seat: number): BetAction {
  const p = gs.players[seat];
  const opt = betOptions(gs, seat);
  const aggr = aggression(seat);
  const noise = Math.random() * 0.14 - 0.07;
  const s = Math.min(1, handStrength(p.hand, gs.totalPicks) * aggr + noise);

  if (opt.open) {
    // 한게임 룰: 체크 없음 — 무조건 띄우거나 다이
    if (s > 0.8) return { type: 'raise', to: opt.half };
    if (s > 0.62) return { type: 'raise', to: opt.quarter };
    if (s < 0.22 && opt.ping > p.chips * 0.05 && Math.random() < 0.5) return { type: 'fold' };
    return { type: 'raise', to: opt.ping }; // 삥은 싸니까 웬만하면 띄운다
  }

  const potOdds = opt.toCall / (gs.pot + opt.toCall);
  // 거대 베팅은 팟 오즈가 1에 수렴해 영원히 콜 불가능해지므로 상한을 둔다:
  // 충분히 강한 패(0.84+)는 어떤 크기의 베팅도 콜한다
  const callBar = Math.min(potOdds + 0.05, 0.84);

  if (opt.capped) {
    // 콜을 단 사람은 콜/다이만 (한국 룰)
    if (s >= callBar) return { type: 'call' };
    if (opt.toCall <= p.chips * 0.04 && s >= potOdds - 0.08) return { type: 'call' };
    return { type: 'fold' };
  }

  if (s > 0.92) return { type: 'raise', to: opt.full };
  if (s > 0.84) return { type: 'raise', to: opt.half };
  if (s > 0.78 && s > potOdds + 0.2)
    return { type: 'raise', to: Math.random() < 0.5 ? opt.ddadang : opt.quarter };
  if (s >= callBar) return { type: 'call' };
  // 콜 금액이 칩 대비 아주 작으면 느슨하게 콜
  if (opt.toCall <= p.chips * 0.04 && s >= potOdds - 0.08) return { type: 'call' };
  // 가끔 히어로 콜 (블러핑 견제)
  if (s > 0.62 && Math.random() < 0.08) return { type: 'call' };
  return { type: 'fold' };
}
