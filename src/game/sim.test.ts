import {
  createGame,
  startHand,
  draftPick,
  bettingAction,
  pendingPickSeats,
  type GameState,
} from './engine';
import { aiDraftPick, aiBettingAction } from './ai';

function totalChips(gs: GameState): number {
  // 시스템이 가져간 수수료까지 합하면 항상 보존되어야 한다
  return gs.players.reduce((sum, p) => sum + p.chips, 0) + gs.pot + gs.rakeTotal;
}

function assert(cond: boolean, msg: string, gs?: GameState) {
  if (!cond) {
    console.error(`✗ INVARIANT FAILED: ${msg}`);
    if (gs) console.error(JSON.stringify({ phase: gs.phase, hand: gs.handNumber, log: gs.log.slice(-8) }, null, 2));
    process.exit(1);
  }
}

let handsPlayed = 0;
let showdowns = 0;
let uncontested = 0;

for (let game = 0; game < 60; game++) {
  const n = 3 + (game % 4); // 3~6인
  const names = Array.from({ length: n }, (_, i) => `봇${i}`);
  const gs = createGame({
    names,
    botFlags: names.map(() => true),
    startChips: 1000,
    ante: 10,
  });
  const expectedTotal = 1000 * n;

  for (let hand = 0; hand < 80 && gs.phase !== 'gameover'; hand++) {
    const rakeBefore = gs.rakeTotal;
    startHand(gs);
    if (gs.phase === 'gameover') break;
    handsPlayed++;

    let guard = 0;
    while (gs.phase === 'draft' || gs.phase === 'betting') {
      assert(++guard < 2000, '핸드가 끝나지 않음 (무한 루프)', gs);

      if (gs.phase === 'draft') {
        const seats = pendingPickSeats(gs);
        assert(seats.length > 0, '드래프트 단계인데 픽할 사람이 없음', gs);
        for (const s of seats) draftPick(gs, s, aiDraftPick(gs, s));
      } else {
        assert(gs.toAct !== null, '베팅 단계인데 toAct가 null', gs);
        bettingAction(gs, gs.toAct!, aiBettingAction(gs, gs.toAct!));
      }
      assert(totalChips(gs) === expectedTotal, `칩 총합 불일치: ${totalChips(gs)} != ${expectedTotal}`, gs);
      for (const p of gs.players) assert(p.chips >= 0, `${p.name} 칩 음수: ${p.chips}`, gs);
    }

    assert(gs.phase === 'showdown' || gs.phase === 'gameover', `이상한 종료 phase: ${gs.phase}`, gs);
    assert(gs.pot === 0, '핸드 종료 후 팟이 남아있음', gs);
    assert(totalChips(gs) === expectedTotal, '정산 후 칩 총합 불일치', gs);

    if (gs.revealed) {
      showdowns++;
      // 쇼다운 참가자의 손패 길이 = handSize
      for (const r of gs.results) {
        const p = gs.players[r.seat];
        assert(p.hand.length === gs.handSize, `손패 길이 오류: ${p.hand.length} != ${gs.handSize}`, gs);
        assert(r.best5.length === 5, 'best5가 5장이 아님', gs);
      }
      const totalWon = gs.results.reduce((s, r) => s + r.amount, 0);
      const totalBet = gs.players.reduce((s, p) => s + p.totalBet, 0);
      const fee = gs.rakeTotal - rakeBefore;
      assert(
        totalWon === totalBet - fee,
        `분배 총액 불일치: ${totalWon} != ${totalBet} - 수수료 ${fee}`,
        gs,
      );
    } else {
      uncontested++;
    }
  }
}

console.log(
  `sim: ${handsPlayed}핸드 플레이 완료 (쇼다운 ${showdowns}, 폴드 종료 ${uncontested}) — 모든 불변식 통과 ✓`,
);
