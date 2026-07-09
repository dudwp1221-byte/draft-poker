// 대기실: 플레이어 슬롯 + 캐릭터 선택 + 레디 + 호스트 시작

import { useEffect, useRef, useState } from 'react';
import type { UserProfile } from '../firebase/auth';
import {
  leaveRoom,
  listenRoom,
  roomPlayers,
  roomBots,
  addBot,
  removeBot,
  setReady,
  startRoom,
  type Room,
} from '../firebase/rooms';
import { Avatar, type AvatarKind } from './Avatar';
import { CHARACTERS } from './characters';
import { CHANNELS } from '../game/channels';
import { formatMoney } from '../game/format';
import { fetchWallet } from '../firebase/game';
import { VIP_TIERS } from '../game/meta';

export function WaitingRoom({
  roomId,
  profile,
  onLeave,
  onGameStart,
}: {
  roomId: string;
  profile: UserProfile;
  onLeave: () => void;
  onGameStart: () => void;
}) {
  const [room, setRoom] = useState<Room | null | 'loading'>('loading');
  const [myWallet, setMyWallet] = useState<number | null>(null);
  const [entryFx, setEntryFx] = useState<{ name: string; tier: number; id: number } | null>(null);
  const leftRef = useRef(false);
  const seenUids = useRef<Set<string> | null>(null);
  const fxId = useRef(0);

  useEffect(() => {
    fetchWallet(profile.uid).then(setMyWallet);
  }, [profile.uid]);

  // VIP(골드 이상) 입장 이펙트
  useEffect(() => {
    if (room === 'loading' || room === null) return;
    const ps = roomPlayers(room);
    if (seenUids.current === null) {
      seenUids.current = new Set(ps.map((p) => p.uid));
      return;
    }
    for (const p of ps) {
      if (!seenUids.current.has(p.uid)) {
        seenUids.current.add(p.uid);
        const tier = p.vip ?? 0;
        if (VIP_TIERS[tier]?.entryFx) {
          const id = ++fxId.current;
          setEntryFx({ name: p.nickname, tier, id });
          setTimeout(() => setEntryFx((cur) => (cur?.id === id ? null : cur)), 2600);
        }
      }
    }
  }, [room]);

  // 게임이 시작되면 게임 화면으로 전환
  useEffect(() => {
    if (room !== 'loading' && room !== null && room.status === 'playing') onGameStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  useEffect(
    () =>
      listenRoom(roomId, (r) => {
        setRoom(r);
        if (r === null && !leftRef.current) onLeave(); // 방이 삭제됨
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roomId],
  );

  if (room === 'loading') {
    return (
      <div className="lobby">
        <div className="lobby-panel">
          <p className="room-empty">방 정보를 불러오는 중…</p>
        </div>
      </div>
    );
  }
  if (room === null) return null;

  const players = roomPlayers(room);
  const bots = roomBots(room);
  const total = players.length + bots.length;
  const me = players.find((p) => p.uid === profile.uid);
  const isHost = room.host === profile.uid;
  const ch = CHANNELS.find((c) => c.id === room.channelId) ?? CHANNELS[1];
  const allReady = total >= 3 && players.every((p) => p.ready || p.uid === room.host);
  const shortMoney = myWallet !== null && myWallet < ch.buyin;

  const doAddBot = () => {
    if (total >= room.maxPlayers) return;
    const used = new Set([...players.map((p) => p.avatar), ...bots.map((b) => b.bot.avatar)]);
    const pool = CHARACTERS.filter((c) => !used.has(c.kind));
    const pick = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : CHARACTERS[0];
    addBot(roomId, { name: pick.name, avatar: pick.kind });
  };

  const doLeave = async () => {
    leftRef.current = true;
    await leaveRoom(roomId, profile.uid).catch(() => {});
    onLeave();
  };

  return (
    <div className="lobby">
      {entryFx && (
        <div className={`entry-fx entry-fx-${entryFx.tier}`} aria-hidden="true">
          <div className="entry-fx-strip">
            {entryFx.tier >= 4 ? '👑' : '✨'} {VIP_TIERS[entryFx.tier].name} VIP{' '}
            <strong>{entryFx.name}</strong> 님 입장! {entryFx.tier >= 4 ? '👑' : '✨'}
          </div>
        </div>
      )}
      <div className="lobby-panel lobby-wide">
        <div className="multi-head">
          <div>
            <p className="lobby-eyebrow">WAITING ROOM</p>
            <h1 className="lobby-title">{room.name}</h1>
            <p className="room-sub">
              {ch.name} · 앤티 {formatMoney(ch.ante)} · 입장 {formatMoney(ch.buyin)} · 최대{' '}
              {room.maxPlayers}인
            </p>
          </div>
        </div>

        {room.status === 'playing' ? (
          <div className="create-box">
            <p className="room-empty">게임으로 이동 중… 🃏</p>
          </div>
        ) : (
          <>
            {/* 플레이어 슬롯 */}
            <div className="slot-grid">
              {Array.from({ length: room.maxPlayers }, (_, i) => {
                const p = players[i];
                if (p)
                  return (
                    <div key={p.uid} className={`slot ${p.ready ? 'ready' : ''}`}>
                      {room.host === p.uid && <span className="slot-crown">👑</span>}
                      <span className={`slot-avatar ${p.frame ?? ''}`}>
                        <Avatar kind={p.avatar as AvatarKind} size={56} />
                      </span>
                      <strong style={{ color: VIP_TIERS[p.vip ?? 0]?.color }}>
                        {p.nickname}
                      </strong>
                      <em>
                        {(p.vip ?? 0) >= 1 && `${VIP_TIERS[p.vip ?? 0].name} · `}
                        {room.host === p.uid ? '방장' : p.ready ? '준비 완료' : '대기'}
                      </em>
                    </div>
                  );
                const b = bots[i - players.length];
                if (b)
                  return (
                    <div key={b.id} className="slot ready slot-bot">
                      <span className="slot-crown">🤖</span>
                      {isHost && (
                        <button
                          type="button"
                          className="bot-remove"
                          onClick={() => removeBot(roomId, b.id)}
                          aria-label="봇 제거"
                        >
                          ✕
                        </button>
                      )}
                      <Avatar kind={b.bot.avatar as AvatarKind} size={56} />
                      <strong>{b.bot.name}</strong>
                      <em>봇 · 준비 완료</em>
                    </div>
                  );
                return (
                  <div key={i} className="slot empty">
                    <span className="slot-wait">대기 중…</span>
                  </div>
                );
              })}
            </div>

            {isHost && total < room.maxPlayers && (
              <button type="button" className="btn-secondary bot-add" onClick={doAddBot}>
                🤖 봇 추가 ({total}/{room.maxPlayers})
              </button>
            )}

            {shortMoney && (
              <p className="auth-error">
                보유 머니가 부족해요 — 입장 {formatMoney(ch.buyin)} 필요 (현재{' '}
                {formatMoney(myWallet ?? 0)})
              </p>
            )}

            <div className="create-actions">
              {isHost ? (
                <button
                  type="button"
                  className="btn-primary lobby-start"
                  disabled={!allReady || shortMoney}
                  onClick={() => startRoom(roomId)}
                >
                  {total < 3
                    ? `시작 대기 (최소 3인, 현재 ${total}인)`
                    : allReady
                      ? '게임 시작'
                      : '전원 준비를 기다리는 중…'}
                </button>
              ) : (
                me && (
                  <button
                    type="button"
                    className={me.ready ? 'btn-secondary lobby-start' : 'btn-primary lobby-start'}
                    disabled={shortMoney && !me.ready}
                    onClick={() => setReady(roomId, profile.uid, !me.ready)}
                  >
                    {me.ready ? '준비 해제' : '준비 완료!'}
                  </button>
                )
              )}
            </div>
          </>
        )}

        <button type="button" className="link-btn" onClick={doLeave}>
          ← 방 나가기
        </button>
      </div>
    </div>
  );
}
