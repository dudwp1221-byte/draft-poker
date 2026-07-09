// 로비 (한게임 PC포커 스타일): 채널 탭 + 히어로(바로입장) + 방 카드 그리드 + 우측 프로필 사이드바

import { useEffect, useState } from 'react';
import { formatMoney } from '../game/format';
import type { UserProfile } from '../firebase/auth';
import { createRoom, joinRoom, listenRooms, roomPlayers, type Room } from '../firebase/rooms';
import { CHANNELS, BANKRUPT_BONUS, DAILY_BONUS } from '../game/channels';
import {
  fetchWallet,
  walletAdd,
  claimDaily,
  fetchLastDaily,
  fetchMeta,
  gemsAdd,
  fetchTopWallets,
  type UserMeta,
} from '../firebase/game';
import { tierOf, nextTier, GEM_REWARDS, PASS_DAILY_EXTRA } from '../game/meta';
import { Avatar, type AvatarKind } from './Avatar';
import { ProfilePanel, ShopPanel, RankingPanel } from './MetaPanels';
import { CHARACTERS } from './characters';
import { addBot, startRoom } from '../firebase/rooms';

export function MultiLobby({
  profile,
  onEnterRoom,
  onLogout,
}: {
  profile: UserProfile;
  onEnterRoom: (roomId: string) => void;
  onLogout: () => void;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [creating, setCreating] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [channelId, setChannelId] = useState('rookie');
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [wallet, setWallet] = useState<number | null>(null);
  const [dailyReady, setDailyReady] = useState(false);
  const [view, setView] = useState<'rooms' | 'profile' | 'shop' | 'rank'>('rooms');
  const [myTierMult, setMyTierMult] = useState(1);
  const [gems, setGems] = useState(0);
  const [passActive, setPassActive] = useState(false);
  const [meta, setMeta] = useState<UserMeta | null>(null);
  const [top3, setTop3] = useState<{ nickname: string; wallet: number }[]>([]);

  useEffect(() => listenRooms(setRooms), []);
  useEffect(() => {
    fetchTopWallets(3).then(setTop3).catch(() => {});
  }, []);
  const refreshMe = () => {
    fetchWallet(profile.uid).then(setWallet);
    fetchMeta(profile.uid).then((m) => {
      setMeta(m);
      setMyTierMult(tierOf(m.vipExp).bonusMult);
      setGems(m.gems);
      setPassActive(m.passUntil > Date.now());
    });
  };

  useEffect(() => {
    refreshMe();
    fetchLastDaily(profile.uid).then((d) => {
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
      setDailyReady(d !== today);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.uid, view]);

  const claimDailyBonus = async () => {
    if (!(await claimDaily(profile.uid))) {
      setDailyReady(false);
      return;
    }
    const amount =
      Math.floor(DAILY_BONUS * myTierMult) + (passActive ? (meta?.passDaily ?? PASS_DAILY_EXTRA) : 0);
    await walletAdd(profile.uid, amount);
    await gemsAdd(profile.uid, Math.ceil(GEM_REWARDS.daily * myTierMult));
    setDailyReady(false);
    setWallet(await fetchWallet(profile.uid));
    fetchMeta(profile.uid).then((m) => setGems(m.gems));
  };

  const broke = wallet !== null && wallet < CHANNELS[0].buyin;

  const claimBonus = async () => {
    await walletAdd(profile.uid, Math.floor(BANKRUPT_BONUS * myTierMult));
    setWallet(await fetchWallet(profile.uid));
  };

  const ch = CHANNELS.find((c) => c.id === channelId) ?? CHANNELS[0];
  const channelRooms = rooms.filter((r) => r.channelId === channelId);

  // 혼자 연습: 선택 채널 방 생성 → 봇 4명 → 즉시 시작
  const quickPractice = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const w = await fetchWallet(profile.uid);
    if (w < ch.buyin) {
      setError(`보유 머니가 부족해요 — ${ch.name} 입장에 ${formatMoney(ch.buyin)} 필요`);
      setBusy(false);
      return;
    }
    try {
      const m = await fetchMeta(profile.uid);
      const id = await createRoom({
        name: `${profile.nickname}의 연습`,
        channelId: ch.id,
        maxPlayers: 5,
        uid: profile.uid,
        nickname: profile.nickname,
        avatar: m.avatar,
        frame: m.equipped.frame ?? '',
        vip: tierOf(m.vipExp).id,
      });
      const pool = CHARACTERS.filter((c) => c.kind !== m.avatar)
        .sort(() => Math.random() - 0.5)
        .slice(0, 4);
      for (const c of pool) await addBot(id, { name: c.name, avatar: c.kind });
      await startRoom(id);
      onEnterRoom(id);
    } catch {
      setError('연습 방 생성에 실패했어요. 잠시 후 다시 시도해주세요.');
      setBusy(false);
    }
  };

  const doCreate = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const w = await fetchWallet(profile.uid);
    if (w < ch.buyin) {
      setError(`보유 머니가 부족해요 — ${ch.name} 입장에 ${formatMoney(ch.buyin)} 필요`);
      setBusy(false);
      return;
    }
    try {
      const m = await fetchMeta(profile.uid);
      const id = await createRoom({
        name: roomName,
        channelId,
        maxPlayers,
        uid: profile.uid,
        nickname: profile.nickname,
        avatar: m.avatar,
        frame: m.equipped.frame ?? '',
        vip: tierOf(m.vipExp).id,
      });
      onEnterRoom(id);
    } catch {
      setError('방 생성에 실패했어요. 잠시 후 다시 시도해주세요.');
      setBusy(false);
    }
  };

  const doJoin = async (room: Room) => {
    if (busy) return;
    setBusy(true);
    setError('');
    const rch = CHANNELS.find((c) => c.id === room.channelId) ?? CHANNELS[1];
    const w = await fetchWallet(profile.uid);
    if (w < rch.buyin) {
      setError(`보유 머니가 부족해요 — ${rch.name} 입장에 ${formatMoney(rch.buyin)} 필요`);
      setBusy(false);
      return;
    }
    const m = await fetchMeta(profile.uid);
    const fail = await joinRoom(room.id, {
      uid: profile.uid,
      nickname: profile.nickname,
      avatar: m.avatar,
      frame: m.equipped.frame ?? '',
      vip: tierOf(m.vipExp).id,
    }).catch(() => '입장에 실패했어요.');
    if (fail) {
      setError(fail);
      setBusy(false);
      return;
    }
    onEnterRoom(room.id);
  };

  // 바로입장: 선택 채널에서 자리 있는 대기방에 자동 입장
  const quickJoin = async () => {
    const open = channelRooms.find((r) => {
      const n = roomPlayers(r).length + Object.keys(r.bots ?? {}).length;
      return r.status === 'waiting' && n < r.maxPlayers;
    });
    if (open) {
      await doJoin(open);
    } else {
      setError('열린 방이 없어요 — 방을 만들거나 혼자 연습을 시작해보세요!');
    }
  };

  const tier = meta ? tierOf(meta.vipExp) : null;
  const next = meta ? nextTier(meta.vipExp) : null;
  const vipProgress =
    meta && tier
      ? next
        ? Math.min(100, ((meta.vipExp - tier.minExp) / (next.minExp - tier.minExp)) * 100)
        : 100
      : 0;
  const winRate =
    meta && meta.stats.hands > 0 ? Math.round((meta.stats.wins / meta.stats.hands) * 100) : 0;

  return (
    <div className="hg-shell">
      {/* 상단 바: 로고 + 채널 탭 */}
      <header className="hg-top">
        <span className="hg-logo">♠ 드래프트 포커</span>
        <nav className="hg-tabs">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={channelId === c.id ? 'on' : ''}
              onClick={() => {
                setChannelId(c.id);
                setView('rooms');
              }}
            >
              {c.name}
            </button>
          ))}
        </nav>
      </header>

      <div className="hg-body">
        {/* 메인 */}
        <main className="hg-main">
          {view === 'rooms' ? (
            <>
              {/* 히어로 */}
              <div className="hg-hero">
                <div className="hg-hero-info">
                  <h1 className="hg-hero-title">
                    <span className="hg-hero-dot" style={{ background: ch.color }} />
                    {ch.name}
                  </h1>
                  <p>
                    앤티 {formatMoney(ch.ante)} · 입장 머니 {formatMoney(ch.buyin)}
                  </p>
                </div>
                <div className="hg-hero-actions">
                  <button type="button" className="hg-btn-enter" onClick={quickJoin} disabled={busy}>
                    바로입장
                  </button>
                  <div className="hg-hero-sub">
                    <button type="button" className="hg-btn-blue" onClick={() => setCreating(true)}>
                      방만들기
                    </button>
                    <button type="button" className="hg-btn-blue" onClick={quickPractice} disabled={busy}>
                      🤖 혼자연습
                    </button>
                  </div>
                </div>
              </div>

              {error && <p className="auth-error">{error}</p>}

              {creating && (
                <div className="hg-create">
                  <strong>방 만들기 — {ch.name}</strong>
                  <input
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder={`${profile.nickname}의 방`}
                    maxLength={20}
                  />
                  <div className="seg">
                    {[3, 4, 5, 6].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={maxPlayers === n ? 'on' : ''}
                        onClick={() => setMaxPlayers(n)}
                      >
                        {n}인
                      </button>
                    ))}
                  </div>
                  <div className="create-actions">
                    <button type="button" className="hg-btn-blue" onClick={doCreate} disabled={busy}>
                      {busy ? '생성 중…' : '만들기'}
                    </button>
                    <button type="button" className="hg-btn-gray" onClick={() => setCreating(false)}>
                      취소
                    </button>
                  </div>
                </div>
              )}

              {/* 방 카드 그리드 */}
              <div className="hg-room-grid">
                {channelRooms.length === 0 && (
                  <p className="hg-empty">아직 열린 방이 없어요. 첫 방을 만들어보세요!</p>
                )}
                {channelRooms.map((r, idx) => {
                  const ps = roomPlayers(r);
                  const botN = Object.keys(r.bots ?? {}).length;
                  const n = ps.length + botN;
                  const full = n >= r.maxPlayers;
                  const playing = r.status === 'playing';
                  return (
                    <div key={r.id} className="hg-room-card">
                      <div className="hg-room-head">
                        <span className="hg-room-no">{idx + 1}</span>
                        <span className="hg-room-name">{r.name}</span>
                      </div>
                      <div className="hg-room-body">
                        <div className="hg-room-avatars">
                          {ps.map((p) => (
                            <Avatar key={p.uid} kind={p.avatar as AvatarKind} size={34} />
                          ))}
                          {Array.from({ length: botN }, (_, i) => (
                            <span key={i} className="hg-bot-chip">
                              🤖
                            </span>
                          ))}
                        </div>
                        <div className="hg-room-foot">
                          <span className="hg-room-meta">
                            {n}/{r.maxPlayers}인{playing && ' · 게임중'}
                          </span>
                          <button
                            type="button"
                            className="hg-btn-blue hg-room-join"
                            disabled={full || busy}
                            onClick={() => doJoin(r)}
                          >
                            {full ? '만석' : playing ? '재입장' : '입장'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 랭킹 티커 */}
              {top3.length > 0 && (
                <div className="hg-ticker">
                  <span className="hg-ticker-label">RANKING</span>
                  {top3.map((t, i) => (
                    <span key={i} className="hg-ticker-item">
                      {['🥇', '🥈', '🥉'][i]} {t.nickname} {formatMoney(t.wallet)}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="hg-panel-wrap">
              <div className="hg-panel-head">
                <button type="button" className="hg-btn-gray" onClick={() => setView('rooms')}>
                  ← 게임으로
                </button>
                <strong>{view === 'profile' ? '프로필' : view === 'shop' ? '상점' : '랭킹'}</strong>
              </div>
              {view === 'profile' && <ProfilePanel profile={profile} onChanged={refreshMe} />}
              {view === 'shop' && <ShopPanel profile={profile} onChanged={refreshMe} />}
              {view === 'rank' && <RankingPanel profile={profile} />}
            </div>
          )}
        </main>

        {/* 우측 프로필 사이드바 */}
        <aside className="hg-side">
          <div className="hg-profile">
            <div className={`hg-profile-avatar ${meta?.equipped.frame ?? ''}`}>
              <Avatar kind={(meta?.avatar ?? 'fox') as AvatarKind} size={104} />
            </div>
            <div className="hg-profile-info">
              <strong style={{ color: tier?.color }}>{profile.nickname}</strong>
              {tier && (
                <span className="tier-badge" style={{ color: tier.color, borderColor: tier.color }}>
                  {tier.name}
                </span>
              )}
              <span className="hg-gold">{wallet === null ? '…' : formatMoney(wallet)}</span>
              <span className="gem-amount">💎 {gems}</span>
            </div>
          </div>
          {meta && (
            <p className="hg-record">
              전적 : {meta.stats.wins}승 {meta.stats.hands - meta.stats.wins}패 · 승률 {winRate}%
            </p>
          )}
          <div className="vip-gauge">
            <div
              className="vip-gauge-fill"
              style={{ width: `${vipProgress}%`, background: tier?.color }}
            />
          </div>
          <p className="vip-gauge-label">
            {next ? `${next.name}까지 ${Math.round(vipProgress)}%` : '최고 등급'}
          </p>

          {dailyReady && (
            <button type="button" className="hg-btn-yellow" onClick={claimDailyBonus}>
              🎁 무료충전 +
              {formatMoney(
                Math.floor(DAILY_BONUS * myTierMult) +
                  (passActive ? (meta?.passDaily ?? PASS_DAILY_EXTRA) : 0),
              )}
              {passActive && ' ⭐'}
            </button>
          )}
          {broke && (
            <button type="button" className="hg-btn-yellow" onClick={claimBonus}>
              파산 보너스 +{formatMoney(Math.floor(BANKRUPT_BONUS * myTierMult))}
            </button>
          )}

          <div className="hg-tiles">
            {(
              [
                ['profile', '👤', '프로필'],
                ['shop', '🛒', '상점'],
                ['rank', '🏆', '랭킹'],
              ] as const
            ).map(([v, icon, label]) => (
              <button
                key={v}
                type="button"
                className={`hg-tile ${view === v ? 'on' : ''}`}
                onClick={() => setView(v)}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </div>

          <button type="button" className="hg-btn-gray hg-exit" onClick={onLogout}>
            로그아웃
          </button>
        </aside>
      </div>
    </div>
  );
}
