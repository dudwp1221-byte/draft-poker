// 멀티플레이 게임 화면 — 호스트 권한 동기화
//  · 호스트: 엔진 실행 + 상태 기록 + 액션 큐 처리 + 워치독(잠수 강제 진행) + 머니 정산
//  · 게스트: 상태 구독 렌더 + 내 액션을 큐로 전송
//  · 호스트가 나가면 좌석 순서상 첫 접속자가 자동 승계 (상태가 DB에 있어 끊김 없음)

import { useEffect, useRef, useState } from 'react';
import {
  startHand,
  draftPick,
  bettingAction,
  pendingPickSeats,
  createGame,
  type GameState,
} from '../game/engine';
import type { UserProfile } from '../firebase/auth';
import { listenRoom, leaveRoom, roomPlayers, roomBots, type Room } from '../firebase/rooms';
import { aiDraftPick, aiBettingAction } from '../game/ai';
import {
  writeState,
  claimInitialState,
  listenState,
  pushAction,
  listenActions,
  removeAction,
  pushEmote,
  listenEmotes,
  setSeats,
  walletAdd,
  walletTryDeduct,
  fetchWallet,
  claimSettlement,
  type GameAction,
} from '../firebase/game';
import { getDatabase, ref, update } from 'firebase/database';
import { getFirebaseApp } from '../firebase/config';
import { CHANNELS } from '../game/channels';
import { GEM_REWARDS } from '../game/meta';
import { vipExpAdd, statsApply, gemsAdd, fetchMeta } from '../firebase/game';
import { Table, isEpicRank } from './Table';
import { Dock } from './Dock';
import { ShowdownOverlay } from './Showdown';
import { sfx, isMuted, setMuted } from './sound';
import type { EmoType } from './Emoticons';

const BET_GRACE_MS = 18000; // 클라 15초 + 유예 3초
const PICK_GRACE_MS = 23000; // 클라 20초 + 유예 3초
const NEXT_HAND_MS = 6500;

export function MultiGame({
  roomId,
  profile,
  onExit,
}: {
  roomId: string;
  profile: UserProfile;
  onExit: () => void;
}) {
  const [gs, setGs] = useState<GameState | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [muted, setMutedState] = useState(isMuted());
  const [emoTrigger, setEmoTrigger] = useState<{ seat: number; type: EmoType; seq: number } | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [myWallet, setMyWallet] = useState(0);
  const [myCardback, setMyCardback] = useState('');
  const [emotePlus, setEmotePlus] = useState(false);

  useEffect(() => {
    fetchMeta(profile.uid).then((m) => {
      setMyCardback(m.equipped.cardback ?? '');
      setEmotePlus(!!m.items['emote-plus']);
    });
  }, [profile.uid]);

  const latest = useRef<GameState | null>(null);
  latest.current = gs;
  const initTried = useRef(false);
  const settled = useRef(false);
  const exited = useRef(false);

  const seats: string[] = room?.seats ?? [];
  const mySeat = seats.indexOf(profile.uid);
  const isHost = room?.host === profile.uid;
  const channel = CHANNELS.find((c) => c.id === room?.channelId) ?? CHANNELS[1];

  // ---------- 구독: 방 / 상태 / 이모티콘 ----------
  useEffect(() => listenRoom(roomId, setRoom), [roomId]);
  useEffect(() => listenState(roomId, setGs), [roomId]);

  useEffect(() => {
    const mountTs = Date.now() - 1500;
    let seq = 0;
    return listenEmotes(roomId, (seat, type, ts) => {
      if (ts < mountTs) return;
      setEmoTrigger({ seat, type: type as EmoType, seq: ++seq });
    });
  }, [roomId]);

  // ---------- 재입장 보장: 내 player 엔트리가 사라졌다면 복구 ----------
  useEffect(() => {
    if (!room || mySeat < 0) return;
    const present = roomPlayers(room).some((p) => p.uid === profile.uid);
    if (!present) {
      import('../firebase/rooms').then(({ joinRoom }) =>
        joinRoom(roomId, { uid: profile.uid, nickname: profile.nickname, avatar: 'fox' }),
      );
    }
  }, [room, mySeat, roomId, profile]);

  // ---------- 호스트: 게임 초기화 (1회 선점) ----------
  useEffect(() => {
    if (!room || !isHost || gs !== null || initTried.current) return;
    if (room.status !== 'playing') return;
    initTried.current = true;
    (async () => {
      const ps = roomPlayers(room);
      const bs = roomBots(room).map((b) => b.bot);
      const g = createGame({
        names: [...ps.map((p) => p.nickname), ...bs.map((b) => b.name)],
        botFlags: [...ps.map(() => false), ...bs.map(() => true)],
        startChips: channel.buyin,
        ante: channel.ante,
        avatars: [...ps.map((p) => p.avatar), ...bs.map((b) => b.avatar)],
        frames: [...ps.map((p) => p.frame ?? ''), ...bs.map(() => '')],
        vips: [...ps.map((p) => p.vip ?? 0), ...bs.map(() => 0)],
      });
      startHand(g);
      const committed = await claimInitialState(roomId, g);
      if (committed) {
        await setSeats(roomId, ps.map((p) => p.uid));
        // 전원 입장비 차감 (호스트가 단일 정산 권한)
        await Promise.all(ps.map((p) => walletAdd(p.uid, -channel.buyin)));
      }
    })();
  }, [room, isHost, gs, roomId, channel]);

  // ---------- 호스트: 엔진 적용 헬퍼 ----------
  const apply = (fn: (g: GameState) => void) => {
    if (!latest.current) return;
    const g = structuredClone(latest.current);
    try {
      fn(g);
    } catch {
      return; // 엔진 검증 실패(턴 아님 등) — 무시
    }
    latest.current = g;
    setGs(g);
    writeState(roomId, g);
  };
  const applyRef = useRef(apply);
  applyRef.current = apply;

  // 좌석 이탈 처리 (칩 회수 + 폴드 + 탈락) — 호스트 전용
  const applyLeave = async (seat: number, uid: string) => {
    const cur = latest.current;
    if (!cur || seat < 0 || seat >= cur.players.length) return;
    const creditBefore = cur.players[seat].chips;
    applyRef.current((g) => {
      const p = g.players[seat];
      if (g.phase === 'draft' && p.packet && p.pendingPick === null) {
        draftPick(g, seat, 0); // 대기 중 픽을 소진해 드래프트 흐름 유지
      }
      if (g.phase === 'betting' && g.toAct === seat) {
        bettingAction(g, seat, { type: 'fold' });
      }
      const q = g.players[seat];
      q.folded = true;
      q.out = true;
      q.chips = 0;
      g.log.push(`${q.name} 퇴장 — 남은 칩은 지갑으로 회수됩니다.`);
    });
    await walletAdd(uid, creditBefore);
  };

  // ---------- 호스트: 액션 큐 처리 ----------
  useEffect(() => {
    if (!isHost) return;
    return listenActions(roomId, (id, a: GameAction) => {
      removeAction(roomId, id);
      if (a.kind === 'pick') applyRef.current((g) => draftPick(g, a.seat, a.idx));
      else if (a.kind === 'bet') applyRef.current((g) => bettingAction(g, a.seat, a.action));
      else if (a.kind === 'leave') applyLeave(a.seat, a.uid);
      else if (a.kind === 'rebuy') {
        walletTryDeduct(a.uid, channel.buyin).then((ok) => {
          if (ok)
            applyRef.current((g) => {
              g.players[a.seat].chips += g.startChips;
            });
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, roomId]);

  // ---------- 호스트: 봇 드라이버 (봇 좌석이 있으면 AI가 대신 플레이) ----------
  useEffect(() => {
    if (!isHost || !gs) return;

    if (gs.phase === 'draft') {
      const botSeats = pendingPickSeats(gs).filter((s) => gs.players[s].isBot);
      const timers = botSeats.map((s, i) =>
        setTimeout(
          () => applyRef.current((g) => draftPick(g, s, aiDraftPick(g, s))),
          550 + i * 300 + Math.random() * 450,
        ),
      );
      return () => timers.forEach(clearTimeout);
    }

    if (gs.phase === 'betting' && gs.toAct !== null && gs.players[gs.toAct].isBot) {
      const seat = gs.toAct;
      const t = setTimeout(
        () =>
          applyRef.current((g) => {
            if (g.phase === 'betting' && g.toAct === seat) {
              bettingAction(g, seat, aiBettingAction(g, seat));
            }
          }),
        850 + Math.random() * 800,
      );
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, gs]);

  // ---------- 호스트: 워치독 (잠수/끊김 강제 진행 + 자동 다음 핸드 + 정산) ----------
  useEffect(() => {
    if (!isHost || !gs) return;
    if (gs.phase === 'betting') {
      const seat = gs.toAct;
      if (seat === null) return;
      const t = setTimeout(
        () => applyRef.current((g) => bettingAction(g, seat, { type: 'fold' })),
        BET_GRACE_MS,
      );
      return () => clearTimeout(t);
    }
    if (gs.phase === 'draft') {
      const t = setTimeout(() => {
        applyRef.current((g) => {
          for (const seat of pendingPickSeats(g)) {
            const len = g.players[seat].packet?.length ?? 0;
            if (len > 0) draftPick(g, seat, Math.floor(Math.random() * len));
          }
        });
      }, PICK_GRACE_MS);
      return () => clearTimeout(t);
    }
    if (gs.phase === 'showdown') {
      const t = setTimeout(() => applyRef.current((g) => startHand(g)), NEXT_HAND_MS);
      return () => clearTimeout(t);
    }
    if (gs.phase === 'gameover' && !settled.current) {
      settled.current = true;
      (async () => {
        if (await claimSettlement(roomId)) {
          await Promise.all(
            seats.map((uid, i) => {
              const chips = gs.players[i]?.chips ?? 0;
              return chips > 0 ? walletAdd(uid, chips) : Promise.resolve();
            }),
          );
          update(ref(getDatabase(getFirebaseApp()), `rooms/${roomId}`), { status: 'ended' });
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, gs?.handNumber, gs?.draftStep, gs?.actionSeq, gs?.phase]);

  // ---------- 호스트: 핸드 종료 시 메타 기록 (VIP 경험치 = 베팅액, 전적, 젬 보상) ----------
  const metaPrevHand = useRef(0);
  useEffect(() => {
    if (!isHost || !gs || gs.phase !== 'showdown') return;
    if (gs.handNumber === metaPrevHand.current) return;
    metaPrevHand.current = gs.handNumber;

    const winners = new Set(gs.results.filter((r) => r.amount > 0).map((r) => r.seat));
    const top = gs.results[0];

    seats.forEach((uid, seat) => {
      const p = gs.players[seat];
      if (!p || p.out) return;
      const won = winners.has(seat);
      const myWon = gs.results.find((r) => r.seat === seat)?.amount ?? 0;
      vipExpAdd(uid, p.totalBet);
      statsApply(uid, { hand: true, win: won, streak: p.winStreak, won: myWon });
      // 젬 보상: 대박 족보 승리 / 10연승 달성
      if (won && top && top.seat === seat && gs.revealed) {
        if (top.handName === '포카드') gemsAdd(uid, GEM_REWARDS.quads);
        else if (top.handName.includes('스트레이트 플러시')) gemsAdd(uid, GEM_REWARDS.stflush);
      }
      if (won && p.winStreak === 10) gemsAdd(uid, GEM_REWARDS.streak10);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, gs?.phase, gs?.handNumber]);

  // ---------- 효과음 ----------
  const sndPrev = useRef({ hand: 0, step: 0, seq: 0, phase: 'idle' as GameState['phase'], myTurn: false });
  useEffect(() => {
    if (!gs || mySeat < 0) return;
    const p = sndPrev.current;
    const myTurn = gs.phase === 'betting' && gs.toAct === mySeat;
    if (gs.handNumber === p.hand) {
      if (gs.draftStep > p.step) sfx.card();
      if (gs.actionSeq > p.seq) sfx.chip();
      if (gs.phase === 'showdown' && p.phase !== 'showdown') {
        if (gs.revealed) {
          sfx.banner();
          const epic = gs.results.length > 0 && isEpicRank(gs.results[0].handName);
          setTimeout(() => (epic ? sfx.jackpot() : sfx.win()), 650);
        } else sfx.win();
      }
      if (myTurn && !p.myTurn) sfx.ding();
    } else if (gs.handNumber > 0) sfx.card();
    sndPrev.current = { hand: gs.handNumber, step: gs.draftStep, seq: gs.actionSeq, phase: gs.phase, myTurn };
  }, [gs, mySeat]);

  // ---------- 쇼다운 오버레이 지연 + 내 지갑 갱신 ----------
  useEffect(() => {
    if (!gs) return;
    if (gs.phase === 'showdown' || gs.phase === 'gameover') {
      fetchWallet(profile.uid).then(setMyWallet);
      const t = setTimeout(() => setShowOverlay(true), gs.revealed ? 2400 : 1200);
      return () => clearTimeout(t);
    }
    setShowOverlay(false);
  }, [gs?.phase, gs?.handNumber, profile.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- 내 액션 (호스트면 즉시 적용, 게스트면 큐 전송) ----------
  const sendPick = (idx: number) => {
    sfx.click();
    if (isHost) applyRef.current((g) => draftPick(g, mySeat, idx));
    else pushAction(roomId, { kind: 'pick', seat: mySeat, idx });
  };
  const sendBet = (a: Parameters<typeof bettingAction>[2]) => {
    if (isHost) applyRef.current((g) => bettingAction(g, mySeat, a));
    else pushAction(roomId, { kind: 'bet', seat: mySeat, action: a });
  };
  const sendRebuy = () => {
    if (isHost) {
      walletTryDeduct(profile.uid, channel.buyin).then((ok) => {
        if (ok)
          applyRef.current((g) => {
            g.players[mySeat].chips += g.startChips;
          });
      });
    } else pushAction(roomId, { kind: 'rebuy', seat: mySeat, uid: profile.uid });
  };

  const exitGame = async () => {
    if (exited.current) return;
    exited.current = true;
    if (gs && gs.phase !== 'gameover' && mySeat >= 0) {
      if (isHost) await applyLeave(mySeat, profile.uid);
      else pushAction(roomId, { kind: 'leave', seat: mySeat, uid: profile.uid });
    }
    await leaveRoom(roomId, profile.uid).catch(() => {});
    onExit();
  };

  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  // ---------- 렌더 ----------
  if (!room || !gs || mySeat < 0) {
    return (
      <div className="lobby">
        <div className="lobby-panel">
          <p className="room-empty">게임을 준비하는 중… 🃏</p>
          <button type="button" className="link-btn" onClick={exitGame}>
            ← 나가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`game-root ${myCardback}`}>
      <header className="topbar">
        <span className="topbar-logo">Draft Poker · 온라인</span>
        <span className="topbar-info">
          {channel.name} · 앤티 {gs.ante.toLocaleString()}
          {isHost && ' · 👑'}
          <button type="button" className="mute-btn" onClick={toggleMute} aria-label="효과음">
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            type="button"
            className="exit-btn"
            onClick={() => {
              if (gs.phase === 'gameover' || window.confirm('나가면 현재 칩이 지갑으로 회수되고 게임에서 탈락합니다.'))
                exitGame();
            }}
          >
            나가기 ✕
          </button>
        </span>
      </header>

      <Table gs={gs} mySeat={mySeat} emoTrigger={emoTrigger} />

      <Dock
        gs={gs}
        mySeat={mySeat}
        onPick={sendPick}
        onAction={sendBet}
        onEmote={(t) => {
          sfx.click();
          pushEmote(roomId, mySeat, t);
        }}
        emotePlus={emotePlus}
      />

      <div className="log-panel">
        {gs.log.slice(-4).map((line, i) => (
          <div key={`${gs.log.length}-${i}`} className="log-line">
            {line}
          </div>
        ))}
      </div>

      {(gs.phase === 'showdown' || gs.phase === 'gameover') && showOverlay && (
        <ShowdownOverlay
          gs={gs}
          mySeat={mySeat}
          canRebuy={myWallet >= channel.buyin}
          onNext={() => {
            if (isHost) applyRef.current((g) => startHand(g));
          }}
          nextLabel={isHost ? '다음 핸드' : '잠시 후 자동 시작…'}
          nextDisabled={!isHost}
          onRebuy={sendRebuy}
          onLobby={exitGame}
        />
      )}
    </div>
  );
}
