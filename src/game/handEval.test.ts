import type { Card, Suit } from './deck';
import { bestHand, CAT_NAMES } from './handEval';

let passed = 0;
let failed = 0;

function c(str: string): Card {
  const suit = str[str.length - 1] as Suit;
  const rs = str.slice(0, -1);
  const rank = { J: 11, Q: 12, K: 13, A: 14 }[rs] ?? Number(rs);
  return { rank, suit };
}
function hand(...strs: string[]): Card[] {
  return strs.map(c);
}

function expectCat(name: string, cards: Card[], cat: number) {
  const ev = bestHand(cards);
  if (ev.cat === cat) passed++;
  else {
    failed++;
    console.error(`✗ ${name}: expected ${CAT_NAMES[cat]}, got ${CAT_NAMES[ev.cat]}`);
  }
}
function expectBeats(name: string, a: Card[], b: Card[]) {
  const ea = bestHand(a);
  const eb = bestHand(b);
  if (ea.score > eb.score) passed++;
  else {
    failed++;
    console.error(`✗ ${name}: expected first hand to win (${ea.score} vs ${eb.score})`);
  }
}
function expectTie(name: string, a: Card[], b: Card[]) {
  const ea = bestHand(a);
  const eb = bestHand(b);
  if (ea.score === eb.score) passed++;
  else {
    failed++;
    console.error(`✗ ${name}: expected tie (${ea.score} vs ${eb.score})`);
  }
}

// 카테고리 판정
expectCat('하이카드', hand('2s', '5h', '7d', '9c', 'Ks'), 0);
expectCat('원페어', hand('2s', '2h', '7d', '9c', 'Ks'), 1);
expectCat('투페어', hand('2s', '2h', '9d', '9c', 'Ks'), 2);
expectCat('트리플', hand('2s', '2h', '2d', '9c', 'Ks'), 3);
expectCat('스트레이트', hand('5s', '6h', '7d', '8c', '9s'), 4);
expectCat('백스트레이트(휠)', hand('As', '2h', '3d', '4c', '5s'), 4);
expectCat('마운틴(브로드웨이)', hand('As', 'Kh', 'Qd', 'Jc', '10s'), 4);
expectCat('플러시', hand('2s', '6s', '9s', 'Js', 'Ks'), 5);
expectCat('풀하우스', hand('2s', '2h', '2d', '9c', '9s'), 6);
expectCat('포카드', hand('2s', '2h', '2d', '2c', '9s'), 7);
expectCat('스트레이트 플러시', hand('5s', '6s', '7s', '8s', '9s'), 8);
expectCat('로열 스트레이트 플러시', hand('10s', 'Js', 'Qs', 'Ks', 'As'), 8);

// 비교
expectBeats('브로드웨이 > 휠', hand('As', 'Kh', 'Qd', 'Jc', '10s'), hand('Ad', '2h', '3d', '4c', '5s'));
expectBeats('휠은 6하이 스트레이트보다 낮음', hand('2s', '3h', '4d', '5c', '6s'), hand('Ad', '2h', '3d', '4c', '5h'));
expectBeats('높은 페어 승리', hand('Ks', 'Kh', '2d', '3c', '4s'), hand('Qs', 'Qh', 'Ad', 'Kc', '9s'));
expectBeats('키커 비교', hand('Ks', 'Kh', 'Ad', '3c', '4s'), hand('Kd', 'Kc', 'Qd', 'Jc', '9s'));
expectBeats('투페어 > 원페어', hand('2s', '2h', '3d', '3c', '4s'), hand('As', 'Ah', 'Kd', 'Qc', 'Js'));
expectBeats('플러시 > 스트레이트', hand('2h', '6h', '9h', 'Jh', 'Kh'), hand('5s', '6h', '7d', '8c', '9s'));
expectBeats('풀하우스 트리플 우선', hand('9s', '9h', '9d', '2c', '2s'), hand('8s', '8h', '8d', 'Ac', 'As'));
expectTie('동일 족보 무승부', hand('As', 'Kh', 'Qd', 'Jc', '9s'), hand('Ad', 'Ks', 'Qh', 'Jd', '9c'));

// 7장 중 베스트 5 선택
expectCat('7장에서 플러시 발견', hand('2s', '6s', '9s', 'Js', 'Ks', 'Ah', 'Ad'), 5);
expectCat('7장에서 풀하우스 발견', hand('2s', '2h', '2d', '9c', '9s', 'Kh', 'Ad'), 6);
expectBeats(
  '7장 vs 6장 정확 비교',
  hand('As', 'Ah', 'Ad', 'Kc', 'Ks', '2h', '3d'),
  hand('Qs', 'Qh', 'Qd', 'Jc', 'Js', '2c'),
);

const ev = bestHand(hand('2s', '2h', '2d', '9c', '9s', 'Kh', 'Ad'));
if (ev.cards.length === 5) passed++;
else {
  failed++;
  console.error('✗ best5는 항상 5장이어야 함');
}

console.log(`handEval: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
