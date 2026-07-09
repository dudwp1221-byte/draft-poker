import type { GameState } from '../game/engine';
import { CardView } from './CardView';
import { Avatar, type AvatarKind } from './Avatar';
import { formatMoney } from '../game/format';

export function ShowdownOverlay({
  gs,
  canRebuy,
  onNext,
  onRebuy,
  onLobby,
  mySeat = 0,
  nextLabel,
  nextDisabled = false,
}: {
  gs: GameState;
  canRebuy: boolean;
  onNext: () => void;
  onRebuy: () => void;
  onLobby: () => void;
  mySeat?: number;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  const me = gs.players[mySeat];

  if (gs.phase === 'gameover') {
    const champ = gs.players.find((p) => p.chips > 0);
    return (
      <div className="overlay">
        <div className="overlay-panel">
          <p className="overlay-eyebrow">GAME OVER</p>
          <h2 className="overlay-title">🏆 {champ?.name} 최종 승리</h2>
          <p className="overlay-sub">최종 칩 {formatMoney(champ?.chips ?? 0)}</p>
          <button type="button" className="btn-primary" onClick={onLobby}>
            로비로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay">
      <div className="overlay-panel">
        <p className="overlay-eyebrow">{gs.revealed ? 'SHOWDOWN' : 'HAND OVER'}</p>
        {gs.revealed ? (
          <div className="results">
            {gs.results.map((r) => {
              const p = gs.players[r.seat];
              const bestKeys = new Set(r.best5.map((c) => `${c.rank}${c.suit}`));
              return (
                <div key={r.seat} className={`result-row ${r.amount > 0 ? 'result-winner' : ''}`}>
                  <div className="result-head">
                    <span className="result-avatar">
                      <Avatar kind={p.avatar as AvatarKind} size={28} />
                    </span>
                    <span className="result-name">{p.name}</span>
                    <span className="result-hand">{r.handName}</span>
                    {r.amount > 0 && <span className="result-amount">+{formatMoney(r.amount)}</span>}
                  </div>
                  <div className="card-row card-row-sm">
                    {p.hand.map((c, i) => (
                      <CardView
                        key={`${c.rank}${c.suit}-${i}`}
                        card={c}
                        size="sm"
                        highlight={bestKeys.has(`${c.rank}${c.suit}`)}
                        dimmed={!bestKeys.has(`${c.rank}${c.suit}`)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <h2 className="overlay-title">
            {gs.players[gs.results[0]?.seat]?.name} 단독 승리 · +
            {formatMoney(gs.results[0]?.amount ?? 0)}
          </h2>
        )}
        <div className="overlay-actions">
          {me.chips <= 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onRebuy}
              disabled={!canRebuy}
              title={canRebuy ? '' : '보유 머니 부족'}
            >
              {canRebuy ? `리바이 (-${formatMoney(gs.startChips)})` : '리바이 불가 (머니 부족)'}
            </button>
          )}
          {me.chips <= 0 && (
            <button type="button" className="btn-secondary" onClick={onLobby}>
              로비로 나가기
            </button>
          )}
          <button type="button" className="btn-primary" onClick={onNext} disabled={nextDisabled}>
            {nextLabel ?? '다음 핸드'}
          </button>
        </div>
      </div>
    </div>
  );
}
