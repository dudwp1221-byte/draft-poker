// 카지노 칩 (SVG 직접 렌더링)

const DENOMS: { value: number; color: string; rim: string }[] = [
  { value: 100000, color: '#D9A53E', rim: '#8F6A1E' },
  { value: 50000, color: '#C8527E', rim: '#8F2F52' },
  { value: 10000, color: '#7E5FC0', rim: '#52398B' },
  { value: 5000, color: '#33383F', rim: '#15181C' },
  { value: 1000, color: '#3E8E5A', rim: '#256B3D' },
  { value: 100, color: '#4A7BD0', rim: '#2F549B' },
];

export function decomposeChips(amount: number, maxChips = 7): { color: string; rim: string }[] {
  const out: { color: string; rim: string }[] = [];
  let rest = amount;
  for (const d of DENOMS) {
    while (rest >= d.value && out.length < maxChips) {
      out.push({ color: d.color, rim: d.rim });
      rest -= d.value;
    }
  }
  if (out.length === 0 && amount > 0) out.push(DENOMS[DENOMS.length - 1]);
  return out.reverse(); // 작은 칩이 아래로
}

export function ChipSVG({
  color,
  rim,
  size = 22,
}: {
  color: string;
  rim: string;
  size?: number;
}) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <ellipse cx="20" cy="21.5" rx="19" ry="17.5" fill="rgba(0,0,0,0.35)" />
      <circle cx="20" cy="19" r="19" fill={rim} />
      <circle cx="20" cy="18" r="18.2" fill={color} />
      <circle
        cx="20"
        cy="18"
        r="16"
        fill="none"
        stroke="#F5F1E6"
        strokeWidth="4.4"
        strokeDasharray="8.35 8.35"
        strokeDashoffset="4.2"
      />
      <circle cx="20" cy="18" r="10.5" fill={color} />
      <circle cx="20" cy="18" r="10.5" fill="rgba(255,255,255,0.16)" />
      <circle
        cx="20"
        cy="18"
        r="10.5"
        fill="none"
        stroke="rgba(245,241,230,0.75)"
        strokeWidth="1.1"
        strokeDasharray="2.4 3.1"
      />
    </svg>
  );
}

import { formatMoney } from '../game/format';

/** 칩 더미 + 금액 라벨 */
export function ChipStack({
  amount,
  size = 24,
  showLabel = true,
}: {
  amount: number;
  size?: number;
  showLabel?: boolean;
}) {
  if (amount <= 0) return null;
  const chips = decomposeChips(amount);
  return (
    <div className="chipstack">
      <div className="chipstack-pile" style={{ width: size, height: size + (chips.length - 1) * 5 }}>
        {chips.map((c, i) => (
          <span key={i} style={{ bottom: i * 5 }}>
            <ChipSVG color={c.color} rim={c.rim} size={size} />
          </span>
        ))}
      </div>
      {showLabel && <em className="chipstack-amount">{formatMoney(amount)}</em>}
    </div>
  );
}
