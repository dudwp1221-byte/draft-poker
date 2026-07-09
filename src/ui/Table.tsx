import { useEffect, useRef, useState } from 'react';
import type { GameState, PlayerState, Phase } from '../game/engine';
import { CardBack } from './CardView';
import { Avatar, type AvatarKind } from './Avatar';
import { pickLine, pickRankLine, rankKeyOf, charByKind } from './characters';
import { CAT_NAMES, bestHand } from '../game/handEval';
import { ChipStack, ChipSVG, decomposeChips } from './Chips';
import { formatMoney } from '../game/format';

import { seatPos, seatAngle, POT_POS } from './layout';
import { EmoticonLayer, type EmoType } from './Emoticons';

// ---------------------------------------------------------------------------
// 공용 글라이드 (좌표 A → B로 미끄러지는 FX 요소)
// ---------------------------------------------------------------------------

function Glide({
  from,
  to,
  delay = 0,
  className,
  children,
}: {
  from: { left: string; top: string };
  to: { left: string; top: string };
  delay?: number;
  className: string;
  children?: React.ReactNode;
}) {
  const [pos, setPos] = useState(from);
  useEffect(() => {
    let raf = 0;
    const t = setTimeout(() => {
      raf = requestAnimationFrame(() => requestAnimationFrame(() => setPos(to)));
    }, delay);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className={className} style={{ left: pos.left, top: pos.top }}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 뭉치 이동 FX
// ---------------------------------------------------------------------------

interface PassItem {
  id: string;
  from: { left: string; top: string };
  to: { left: string; top: string };
  count: number;
}

function PassFxLayer({ gs, mySeat }: { gs: GameState; mySeat: number }) {
  const [fx, setFx] = useState<PassItem[]>([]);
  const prev = useRef({ hand: gs.handNumber, step: gs.draftStep });

  useEffect(() => {
    const sameHand = gs.handNumber === prev.current.hand;
    const stepped = gs.draftStep > prev.current.step;
    prev.current = { hand: gs.handNumber, step: gs.draftStep };
    if (!sameHand || !stepped) return;

    const n = gs.players.length;
    const items: PassItem[] = gs.players
      .filter((p) => !p.out && !p.folded && p.packet && p.packetFrom !== null)
      .map((p) => ({
        id: `${gs.handNumber}-${gs.draftStep}-${p.seat}`,
        from: seatPos(n, p.packetFrom!, mySeat),
        to: seatPos(n, p.seat, mySeat),
        count: p.packet!.length,
      }));
    if (items.length === 0) return;
    setFx((cur) => [...cur, ...items]);
    setTimeout(() => setFx((cur) => cur.filter((x) => !items.includes(x))), 850);
  }, [gs]);

  return (
    <div className="fx-layer" aria-hidden="true">
      {fx.map((f) => (
        <Glide key={f.id} from={f.from} to={f.to} className="pass-card">
          <span className="pass-count">{f.count}</span>
        </Glide>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 칩 FX: 라운드 종료 → 팟으로 / 쇼다운 → 승자에게 + 칩 샤워
// ---------------------------------------------------------------------------

interface ChipFlyItem {
  id: string;
  from: { left: string; top: string };
  to: { left: string; top: string };
  amount: number;
  delay: number;
  win: boolean;
}

function ChipBurst({ pos }: { pos: { left: string; top: string } }) {
  return (
    <div className="chip-burst" style={{ left: pos.left, top: pos.top }}>
      {Array.from({ length: 10 }).map((_, i) => {
        const ang = (i / 10) * Math.PI * 2;
        const dist = 34 + (i % 3) * 16;
        return (
          <span
            key={i}
            style={
              {
                '--bx': `${Math.cos(ang) * dist}px`,
                '--by': `${Math.sin(ang) * dist - 26}px`,
                animationDelay: `${640 + i * 28}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

function ChipFxLayer({ gs, mySeat }: { gs: GameState; mySeat: number }) {
  const [fx, setFx] = useState<ChipFlyItem[]>([]);
  const prev = useRef<{ hand: number; phase: Phase; bets: number[] } | null>(null);

  useEffect(() => {
    const p = prev.current;
    prev.current = {
      hand: gs.handNumber,
      phase: gs.phase,
      bets: gs.players.map((q) => q.betThisRound),
    };
    if (!p || p.hand !== gs.handNumber) return;

    const n = gs.players.length;
    const items: ChipFlyItem[] = [];

    // 베팅 라운드 종료: 좌석 → 팟
    gs.players.forEach((q, i) => {
      if (p.bets[i] > 0 && q.betThisRound === 0) {
        items.push({
          id: `pot-${gs.handNumber}-${gs.draftStep}-${i}`,
          from: seatPos(n, i, mySeat),
          to: POT_POS,
          amount: p.bets[i],
          delay: 0,
          win: false,
        });
      }
    });

    // 쇼다운/단독 승리: 팟 → 승자
    if (gs.phase === 'showdown' && p.phase !== 'showdown') {
      for (const r of gs.results) {
        if (r.amount > 0) {
          items.push({
            id: `win-${gs.handNumber}-${r.seat}`,
            from: POT_POS,
            to: seatPos(n, r.seat, mySeat),
            amount: r.amount,
            delay: 520,
            win: true,
          });
        }
      }
    }

    if (items.length === 0) return;
    setFx((cur) => [...cur, ...items]);
    setTimeout(() => setFx((cur) => cur.filter((x) => !items.includes(x))), 2100);
  }, [gs]);

  return (
    <div className="fx-layer" aria-hidden="true">
      {fx.map((f) => (
        <Glide
          key={f.id}
          from={f.from}
          to={f.to}
          delay={f.delay}
          className={`chip-fly ${f.win ? 'chip-fly-win' : ''}`}
        >
          <div className="chip-fly-pile">
            {decomposeChips(f.amount)
              .slice(0, 4)
              .map((c, i) => (
                <span key={i} style={{ bottom: i * 4 }}>
                  <ChipSVG color={c.color} rim={c.rim} size={20} />
                </span>
              ))}
          </div>
          <em>{formatMoney(f.amount)}</em>
        </Glide>
      ))}
      {fx
        .filter((f) => f.win)
        .map((f) => (
          <ChipBurst key={`burst-${f.id}`} pos={f.to} />
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 족보 띠배너
// ---------------------------------------------------------------------------

export function isEpicRank(handName: string): boolean {
  return handName === '포카드' || handName.includes('스트레이트 플러시');
}

function RankBanner({ gs }: { gs: GameState }) {
  const [banner, setBanner] = useState<{ rank: string; name: string; epic: boolean } | null>(null);
  const prevPhase = useRef<Phase>(gs.phase);

  useEffect(() => {
    const was = prevPhase.current;
    prevPhase.current = gs.phase;
    if (gs.phase === 'showdown' && was !== 'showdown' && gs.revealed && gs.results.length > 0) {
      const top = gs.results[0];
      const epic = isEpicRank(top.handName);
      const b = { rank: top.handName, name: gs.players[top.seat].name, epic };
      setBanner(b);
      setTimeout(() => setBanner((cur) => (cur === b ? null : cur)), epic ? 3400 : 2100);
    }
  }, [gs]);

  if (!banner) return null;
  return (
    <div className={`rank-banner ${banner.epic ? 'rank-banner-epic' : ''}`} aria-hidden="true">
      {banner.epic && (
        <>
          <div className="jackpot-flash" />
          <div className="jackpot-confetti">
            {Array.from({ length: 28 }, (_, i) => (
              <span
                key={i}
                style={{
                  left: `${(i * 37) % 100}%`,
                  animationDelay: `${(i % 9) * 0.13}s`,
                  fontSize: `${14 + ((i * 7) % 14)}px`,
                }}
              >
                {['🪙', '✨', '💰', '🃏'][i % 4]}
              </span>
            ))}
          </div>
        </>
      )}
      <div className="rank-banner-strip">
        <span className="rank-banner-rank">{banner.epic ? `💥 ${banner.rank}!! 💥` : `${banner.rank}!`}</span>
        <span className="rank-banner-name">{banner.name} 승리</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 캐릭터 감정 대사 레이어: 상황을 감지해 캐릭터가 자동으로 말한다
// ---------------------------------------------------------------------------

interface EmoteItem {
  id: number;
  seat: number;
  text: string;
}

let emoteId = 0;

function flushQueue(
  queue: { seat: number; text: string; delay: number }[],
  setEmotes: React.Dispatch<React.SetStateAction<EmoteItem[]>>,
): void {
  // 주의: 이펙트 cleanup으로 타이머를 취소하면 게임 상태가 바뀔 때마다
  // "숨김" 타이머가 죽어서 말풍선이 영구히 남는다. 타이머는 끝까지 달리게 둔다.
  for (const item of queue) {
    setTimeout(() => {
      const id = ++emoteId;
      setEmotes((cur) => [
        ...cur.filter((e) => e.seat !== item.seat),
        { id, seat: item.seat, text: item.text },
      ]);
      setTimeout(() => setEmotes((cur) => cur.filter((e) => e.id !== id)), 2600);
    }, item.delay);
  }
}

function EmoteLayer({ gs, mySeat }: { gs: GameState; mySeat: number }) {
  const [emotes, setEmotes] = useState<EmoteItem[]>([]);
  const prev = useRef<{
    hand: number;
    phase: Phase;
    seq: number;
    outs: boolean[];
  } | null>(null);
  const entered = useRef(false);
  const myRankCat = useRef(-1);

  useEffect(() => {
    const queue: { seat: number; text: string; delay: number }[] = [];
    const p = prev.current;
    prev.current = {
      hand: gs.handNumber,
      phase: gs.phase,
      seq: gs.actionSeq,
      outs: gs.players.map((q) => q.out),
    };

    const say = (seat: number, text: string, delay = 0) => queue.push({ seat, text, delay });

    // 게임 입장 인사 (첫 핸드, 2~3명이 시차를 두고)
    if (!entered.current && gs.handNumber >= 1) {
      entered.current = true;
      const alive = gs.players.filter((q) => !q.out);
      const speakers = [...alive].sort(() => Math.random() - 0.5).slice(0, Math.min(3, alive.length));
      speakers.forEach((q, i) => say(q.seat, pickLine(q.avatar, 'enter'), 600 + i * 1300));
    }

    // 내 족보 완성 리액션 (내 화면 전용 — 비공개 손패라 남의 패는 알 수 없음)
    const me = gs.players[0];
    if (gs.handNumber !== (p?.hand ?? 0)) myRankCat.current = -1;
    if (!me.folded && !me.out && me.hand.length >= 5 && gs.phase !== 'showdown') {
      const ev = bestHand(me.hand);
      if (ev.cat >= 3 && ev.cat > myRankCat.current) {
        myRankCat.current = ev.cat;
        const key = rankKeyOf(ev.cat, ev.cards);
        if (key) say(0, pickRankLine(me.avatar, key), 500);
      }
    }

    if (!p) {
      flushQueue(queue, setEmotes);
      return;
    }

    // 새 핸드: 탈락 인사 / 숏스택 푸념 / 랜덤 인사
    if (gs.handNumber !== p.hand && gs.handNumber > 1) {
      gs.players.forEach((q, i) => {
        if (q.out && !p.outs[i]) say(q.seat, pickLine(q.avatar, 'eliminated'), 400);
      });
      const shorts = gs.players.filter(
        (q) => !q.out && q.chips > 0 && q.chips < gs.startChips * 0.25,
      );
      for (const q of shorts) {
        if (Math.random() < 0.4) say(q.seat, pickLine(q.avatar, 'shortStack'), 900);
      }
      if (queue.length === 0 && Math.random() < 0.35) {
        const alive = gs.players.filter((q) => !q.out);
        const q = alive[Math.floor(Math.random() * alive.length)];
        say(q.seat, pickLine(q.avatar, 'greet'), 700);
      }
    }

    // 베팅 액션 반응: 올인 / 큰 레이즈 / 다이
    if (gs.handNumber === p.hand && gs.actionSeq !== p.seq && gs.lastAction) {
      const { seat, text } = gs.lastAction;
      const q = gs.players[seat];
      if (text.includes('올인')) {
        say(seat, pickLine(q.avatar, 'allIn'), 950);
      } else if (text.startsWith('레이즈') || text.startsWith('벳')) {
        if (Math.random() < 0.4) say(seat, pickLine(q.avatar, 'bigRaise'), 950);
      } else if (text.startsWith('다이')) {
        if (Math.random() < 0.6) say(seat, pickLine(q.avatar, 'fold'), 800);
      }
    }

    // 쇼다운: 족보별 승리 대사 / 단독 승리 / 패배 / 배드빗
    if (gs.handNumber === p.hand && gs.phase === 'showdown' && p.phase !== 'showdown') {
      if (gs.revealed) {
        const bigPot = (gs.results[0]?.amount ?? 0) >= gs.startChips * 0.5;
        gs.results.forEach((r) => {
          const q = gs.players[r.seat];
          const cat = CAT_NAMES.indexOf(r.handName as (typeof CAT_NAMES)[number]);
          if (r.amount > 0) {
            // 족보별 전용 승리 대사 (트리플+), 빅팟이면 가끔 빅윈 대사로 교체
            const key = rankKeyOf(cat, r.best5);
            const big = r.amount >= gs.startChips * 0.5;
            if (key && !(big && Math.random() < 0.4)) {
              say(r.seat, pickRankLine(q.avatar, key), 1400);
            } else {
              say(r.seat, pickLine(q.avatar, big ? 'winBig' : 'win'), 1400);
            }
          } else if (bigPot && Math.random() < 0.6) {
            say(r.seat, pickLine(q.avatar, 'loseBig'), 1900);
          } else if (cat >= 3) {
            if (Math.random() < 0.7) say(r.seat, pickLine(q.avatar, 'badBeat'), 1900);
          } else if (Math.random() < 0.25) {
            say(r.seat, pickLine(q.avatar, 'lose'), 1900);
          }
        });
      } else if (gs.results[0]) {
        const w = gs.results[0];
        if (Math.random() < 0.7) say(w.seat, pickLine(gs.players[w.seat].avatar, 'smug'), 900);
      }
    }

    flushQueue(queue, setEmotes);
  }, [gs]);

  const n = gs.players.length;
  return (
    <div className="fx-layer" aria-hidden="true">
      {emotes.map((e) => (
        <div key={e.id} className="emote" style={seatPos(n, e.seat, mySeat)}>
          <span className="emote-name">{charByKind(gs.players[e.seat].avatar).name}</span>
          {e.text}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 좌석
// ---------------------------------------------------------------------------

function Seat({
  gs,
  p,
  bubble,
  mySeat,
}: {
  gs: GameState;
  p: PlayerState;
  bubble: string | null;
  mySeat: number;
}) {
  const n = gs.players.length;
  const isTurn = gs.phase === 'betting' && gs.toAct === p.seat;
  const picked = gs.phase === 'draft' && p.pendingPick !== null;
  const waitingPick = gs.phase === 'draft' && p.packet !== null && p.pendingPick === null;

  const a = seatAngle(n, p.seat, mySeat);
  const betOffset = { x: -Math.cos(a) * 112, y: -Math.sin(a) * 104 };

  const streakTier =
    p.winStreak >= 10 ? 'streak-10' : p.winStreak >= 5 ? 'streak-5' : p.winStreak >= 3 ? 'streak-3' : '';

  const cls = [
    'seat',
    p.folded ? 'seat-folded' : '',
    p.out ? 'seat-out' : '',
    isTurn ? 'seat-turn' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} style={seatPos(n, p.seat, mySeat)}>
      {bubble && <div className="bubble">{bubble}</div>}

      <div className="seat-cards">
        {p.seat !== mySeat &&
          !p.folded &&
          !p.out &&
          p.hand.map((_, i) => <CardBack key={i} size="sm" />)}
      </div>

      <div className={`avatar-ring ${streakTier} ${p.frame ?? ''}`}>
        <div className="avatar-face">
          <Avatar kind={p.avatar as AvatarKind} size={p.seat === mySeat ? 88 : 76} />
        </div>
        {gs.dealer === p.seat && <span className="dealer-chip">선</span>}
        {p.winStreak >= 2 && !p.out && (
          <span className="streak-badge">🔥{p.winStreak}연승</span>
        )}
        {p.folded && !p.out && <span className="seat-stamp">다이</span>}
        {p.allIn && !p.folded && !p.out && <span className="seat-stamp allin">올인</span>}
      </div>

      <div className="seat-plate">
        <div className={`seat-name ${p.vip >= 1 ? `vip-name-${p.vip}` : ''}`}>
          {p.name}
          {p.seat === mySeat && <span className="me-tag">나</span>}
        </div>
        <div className="seat-chips">{formatMoney(p.chips)}</div>
        <div className="seat-status">
          {p.out
            ? '탈락'
            : isTurn
              ? '고민 중…'
              : picked
                ? '선택 완료 ✓'
                : waitingPick
                  ? `뭉치 ${p.packet!.length}장`
                  : '\u00A0'}
        </div>
      </div>

      {p.betThisRound > 0 && (
        <div className="seat-bet" style={{ marginLeft: betOffset.x, marginTop: betOffset.y }}>
          <ChipStack amount={p.betThisRound} size={22} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function Table({
  gs,
  emoTrigger,
  mySeat = 0,
}: {
  gs: GameState;
  emoTrigger: { seat: number; type: EmoType; seq: number } | null;
  mySeat?: number;
}) {
  // 말풍선: lastAction이 갱신될 때 해당 좌석 위에 잠깐 표시
  const [bubble, setBubble] = useState<{ seat: number; text: string } | null>(null);
  const prevSeq = useRef(gs.actionSeq);
  useEffect(() => {
    if (gs.actionSeq !== prevSeq.current && gs.lastAction) {
      prevSeq.current = gs.actionSeq;
      const b = { ...gs.lastAction };
      setBubble(b);
      setTimeout(() => setBubble((cur) => (cur === b ? null : cur)), 1600);
    }
    prevSeq.current = gs.actionSeq;
  }, [gs]);

  const phaseLabel =
    gs.phase === 'draft'
      ? `드래프트 · 픽 ${Math.min(gs.draftStep + 1, gs.totalPicks)}/${gs.totalPicks}`
      : gs.phase === 'betting'
        ? '베팅 라운드'
        : '쇼다운';

  const nextCp = gs.checkpoints.find((c) => c > gs.draftStep);
  const picksToBet = nextCp !== undefined ? nextCp - gs.draftStep : 0;

  return (
    <div className="table-wrap">
      <div className="felt">
        <div className="felt-inner-line" />
        <div className="felt-mark">DRAFT POKER</div>
      </div>

      {/* 시그니처: 이번 판 패스 방향을 흐르는 점선 링 */}
      <svg className={`ring ${gs.direction === 1 ? 'ring-cw' : 'ring-ccw'}`} viewBox="0 0 100 100">
        <ellipse cx="50" cy="50" rx="46" ry="44" />
      </svg>

      <div className="center-info">
        <div className="pot-row">
          <ChipStack amount={gs.pot} size={18} showLabel={false} />
          <div className="pot-num">
            <div className="pot-label">POT</div>
            <div className="pot-amount">{formatMoney(gs.pot)}</div>
          </div>
        </div>
        <div className="hand-meta">
          핸드 #{gs.handNumber} · {phaseLabel}
          {gs.phase === 'draft' && picksToBet > 0 && (
            <span className="bet-eta"> · 베팅까지 {picksToBet}픽</span>
          )}
        </div>
        <div className="dir-badge">패스 {gs.direction === 1 ? '⟳ 시계 방향' : '⟲ 반시계 방향'}</div>
      </div>

      {gs.players.map((p) => (
        <Seat
          key={p.seat}
          gs={gs}
          p={p}
          mySeat={mySeat}
          bubble={bubble?.seat === p.seat ? bubble.text : null}
        />
      ))}

      <PassFxLayer gs={gs} mySeat={mySeat} />
      <ChipFxLayer gs={gs} mySeat={mySeat} />
      <EmoteLayer gs={gs} mySeat={mySeat} />
      <EmoticonLayer gs={gs} trigger={emoTrigger} mySeat={mySeat} />
      <RankBanner gs={gs} />
    </div>
  );
}
