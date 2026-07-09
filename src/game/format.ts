/** 한게임식 머니 표기: 1.2만 / 3.5억 */
export function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (v >= 100_000_000) return `${sign}${trim(v / 100_000_000)}억`;
  if (v >= 10_000) return `${sign}${trim(v / 10_000)}만`;
  return `${sign}${v.toLocaleString()}`;
}

function trim(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? r.toLocaleString() : r.toFixed(1);
}
