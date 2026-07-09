import { useEffect, useMemo, useState } from 'react';
import type { BetAction, GameState } from '../game/engine';
import { betOptions } from '../game/engine';
import { formatMoney } from '../game/format';
import { EMOTICONS, EMOTICONS_PLUS, type EmoType } from './Emoticons';
import { bestHand, CAT_NAMES } from '../game/handEval';
import { CardView } from './CardView';

export function Dock({
  gs,
  onPick,
  onAction,
  onEmote,
  mySeat = 0,
  emotePlus = false,
}: {
  gs: GameState;
  onPick: (idx: number) => void;
  onAction: (a: BetAction) => void;
  onEmote: (t: EmoType) => void;
  mySeat?: number;
  emotePlus?: boolean;
}) {
  const me = gs.players[mySeat];

  const myEval = useMemo(() => (me.hand.length >= 5 ? bestHand(me.hand) : null), [me.hand]);
  const best5Keys = useMemo(
    () => new Set(myEval?.cards.map((c) => `${c.rank}${c.suit}`) ?? []),
    [myEval],
  );

  const canPick =
    gs.phase === 'draft' && me.packet !== null && me.pendingPick === null && !me.folded;
  const myTurnToBet = gs.phase === 'betting' && gs.toAct === mySeat;

  // 뭉치 귀환 힌트: 지금 든 뭉치가 (폴드 없을 시) 픽 t+N에 다시 돌아오는지
  const holdersCount = gs.players.filter((p) => !p.out && !p.folded && p.packet).length;
  const returnPick = gs.draftStep + 1 + holdersCount;
  const returnsToMe = canPick && returnPick <= gs.totalPicks;
  const returnCount = me.packet ? me.packet.length - holdersCount : 0;

  return (
    <div className="dock">
      <div className="dock-hand">
        <div className="dock-label">
          내 손패{' '}
          {myEval ? (
            <strong className="hand-name">{CAT_NAMES[myEval.cat]}</strong>
          ) : (
            <span className="hand-progress">
              {me.hand.length}/{gs.handSize}장
            </span>
          )}
        </div>
        <div className="card-row">
          {me.hand.length === 0 && <div className="empty-hint">첫 픽을 기다리는 중…</div>}
          {me.hand.map((c, i) => (
            <CardView
              key={`${c.rank}${c.suit}-${i}`}
              card={c}
              size="md"
              highlight={best5Keys.has(`${c.rank}${c.suit}`)}
            />
          ))}
        </div>
      </div>

      <div className="dock-action">
        {me.folded && gs.phase !== 'showdown' && (
          <div className="dock-note">다이했습니다. 다음 핸드를 기다려 주세요.</div>
        )}

        {canPick && (
          <div className="pick-area">
            <TurnTimer
              key={`pick-${gs.handNumber}-${gs.draftStep}`}
              ms={20000}
              onTimeout={() => onPick(Math.floor(Math.random() * me.packet!.length))}
            />
            <div className="dock-label gold">
              뭉치에서 1장 선택
              {me.packetFrom !== null && (
                <span className="packet-meta"> · {gs.players[me.packetFrom].name} → 나</span>
              )}
              {me.packetOrigin !== null && me.packetOrigin !== 0 && (
                <span className="packet-meta"> · 처음 주인: {gs.players[me.packetOrigin].name}</span>
              )}
              {me.packetOrigin === 0 && me.packetFrom !== null && (
                <span className="origin-tag">🔁 내 첫 뭉치 귀환</span>
              )}
              {me.packet!.length === 2 && (
                <span className="discard-warn"> · 남는 1장은 버려집니다!</span>
              )}
            </div>
            {returnsToMe && (
              <div className="return-hint">
                🔁 이 뭉치는 {returnPick === gs.totalPicks ? '마지막 픽' : `픽 ${returnPick}`}에
                나에게 돌아옵니다 — 그때 {returnCount}장 남음 (폴드 없을 시)
              </div>
            )}
            <div className="card-row">
              {me.packet!.map((c, i) => (
                <CardView
                  key={`${c.rank}${c.suit}-${i}`}
                  card={c}
                  size="lg"
                  onClick={() => onPick(i)}
                />
              ))}
            </div>
          </div>
        )}

        {gs.phase === 'draft' && !me.folded && !canPick && me.pendingPick !== null && (
          <div className="dock-note">선택 완료 ✓ — 다른 플레이어를 기다리는 중…</div>
        )}
        {gs.phase === 'draft' &&
          !me.folded &&
          !canPick &&
          me.pendingPick === null &&
          me.packet === null && <div className="dock-note">드래프트 진행 중…</div>}
        {gs.phase === 'betting' && !myTurnToBet && !me.folded && (
          <div className="dock-note">
            {gs.toAct !== null ? `${gs.players[gs.toAct].name}의 차례…` : ''}
          </div>
        )}

        {myTurnToBet && <BetControls gs={gs} mySeat={mySeat} onAction={onAction} />}
      </div>

      <div className="emote-bar">
        {[...EMOTICONS, ...(emotePlus ? EMOTICONS_PLUS : [])].map((e) => (
          <button
            key={e.type}
            type="button"
            className="emote-btn"
            onClick={() => onEmote(e.type)}
            title={e.label}
          >
            <span>{e.glyph}</span>
            <em>{e.label}</em>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 공용 턴 타이머 (마운트 시 시작, 시간 초과 시 콜백)
// ---------------------------------------------------------------------------

function TurnTimer({ ms, onTimeout }: { ms: number; onTimeout: () => void }) {
  const [left, setLeft] = useState(ms);
  useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => {
      const rem = ms - (Date.now() - start);
      setLeft(Math.max(0, rem));
      if (rem <= 0) {
        clearInterval(iv);
        onTimeout();
      }
    }, 100);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const urgent = left < 5000;
  return (
    <div className={`turn-timer ${urgent ? 'urgent' : ''}`}>
      <div className="turn-timer-fill" style={{ width: `${(left / ms) * 100}%` }} />
      <span className="turn-timer-sec">{Math.ceil(left / 1000)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 한게임식 베팅 버튼 바
//  - 오픈(아직 베팅 없음): 다이 / 삥 / 쿼터 / 하프  (체크 없음 — 무조건 띄워야 함)
//  - 베팅을 받음: 다이 / 콜 / 따당 / 쿼터 / 하프 / 풀
//  - 콜을 단 사람: 다이 / 콜만 (한국 룰: 콜 후 리레이즈 금지)
//  - 올인은 칩이 모자랄 때만 자연 발생
// ---------------------------------------------------------------------------

const BET_TURN_MS = 15000;

function BetControls({
  gs,
  mySeat,
  onAction,
}: {
  gs: GameState;
  mySeat: number;
  onAction: (a: BetAction) => void;
}) {
  const opt = betOptions(gs, mySeat);

  const raises: { label: string; to: number; cls: string }[] = [];
  if (opt.canRaise) {
    if (opt.open) {
      raises.push({ label: '삥', to: opt.ping, cls: 'hgbtn-ping' });
      raises.push({ label: '쿼터', to: opt.quarter, cls: 'hgbtn-half' });
      raises.push({ label: '하프', to: opt.half, cls: 'hgbtn-full' });
    } else {
      raises.push({ label: '따당', to: opt.ddadang, cls: 'hgbtn-ping' });
      raises.push({ label: '쿼터', to: opt.quarter, cls: 'hgbtn-half' });
      raises.push({ label: '하프', to: opt.half, cls: 'hgbtn-full' });
      raises.push({ label: '풀', to: opt.full, cls: 'hgbtn-allin' });
    }
  }
  // 클램프로 금액이 겹치면 (숏스택) 앞의 버튼만 남긴다
  const seen = new Set<number>();
  const menu = raises.filter((r) => {
    if (r.to <= gs.currentBet || seen.has(r.to)) return false;
    seen.add(r.to);
    return true;
  });

  return (
    <div className="bet-controls">
      <TurnTimer ms={BET_TURN_MS} onTimeout={() => onAction({ type: 'fold' })} />
      <div className="bet-bar">
        <button type="button" className="hgbtn hgbtn-die" onClick={() => onAction({ type: 'fold' })}>
          다이
        </button>
        {opt.toCall > 0 && (
          <button type="button" className="hgbtn hgbtn-call" onClick={() => onAction({ type: 'call' })}>
            콜
            <small>
              {opt.toCall >= gs.players[mySeat].chips ? '올인 ' : ''}
              {formatMoney(Math.min(opt.toCall, gs.players[mySeat].chips))}
            </small>
          </button>
        )}
        {menu.map((r) => (
          <button
            key={r.label}
            type="button"
            className={`hgbtn ${r.cls}`}
            onClick={() => onAction({ type: 'raise', to: r.to })}
          >
            {r.label}
            <small>
              {r.to === opt.maxTo ? '올인 ' : ''}
              {formatMoney(r.to)}
            </small>
          </button>
        ))}
        {opt.capped && <span className="capped-note">콜 선언 — 콜/다이만 가능</span>}
      </div>
    </div>
  );
}
