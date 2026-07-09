/** 좌석 배치 좌표 (테이블·FX 레이어 공용)
 *  my: 내 좌석 번호 — 내 좌석이 항상 화면 하단(6시)에 오도록 표시를 회전한다 */

export function seatAngle(n: number, i: number, my = 0): number {
  const d = (((i - my) % n) + n) % n;
  return Math.PI / 2 + (2 * Math.PI * d) / n;
}

export function seatPos(n: number, i: number, my = 0) {
  const a = seatAngle(n, i, my);
  return {
    left: `${50 + 43 * Math.cos(a)}%`,
    top: `${50 + 41 * Math.sin(a)}%`,
  };
}

export const POT_POS = { left: '50%', top: '40%' };
