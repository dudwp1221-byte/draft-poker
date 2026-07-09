import type { Card } from '../game/deck';
import { SUIT_GLYPH, SUIT_COLOR, rankLabel } from '../game/deck';

export function CardView({
  card,
  size = 'md',
  highlight = false,
  dimmed = false,
  onClick,
}: {
  card: Card;
  size?: 'sm' | 'md' | 'lg';
  highlight?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
}) {
  const cls = [
    'card',
    `card-${size}`,
    SUIT_COLOR[card.suit],
    highlight ? 'card-highlight' : '',
    dimmed ? 'card-dimmed' : '',
    onClick ? 'card-clickable' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={cls} onClick={onClick} disabled={!onClick}>
      <span className="card-corner">
        {rankLabel(card.rank)}
        <em>{SUIT_GLYPH[card.suit]}</em>
      </span>
      <span className="card-pip">{SUIT_GLYPH[card.suit]}</span>
    </button>
  );
}

export function CardBack({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return <div className={`card card-${size} card-back`} aria-hidden="true" />;
}
