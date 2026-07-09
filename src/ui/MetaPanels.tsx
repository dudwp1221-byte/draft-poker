// 프로필 / 상점 / 랭킹 패널 (로비 내부 뷰)

import { useEffect, useState } from 'react';
import type { UserProfile } from '../firebase/auth';
import {
  fetchMeta,
  fetchWallet,
  buyItem,
  equipItem,
  fetchTopWallets,
  type UserMeta,
} from '../firebase/game';
import { tierOf, nextTier, SHOP_ITEMS, FREE_CHARACTERS, PREMIUM_CHARACTERS, type ShopItem } from '../game/meta';
import { saveAvatar } from '../firebase/game';
import { Avatar } from './Avatar';
import { formatMoney } from '../game/format';

function TierBadge({ exp }: { exp: number }) {
  const t = tierOf(exp);
  return (
    <span className="tier-badge" style={{ color: t.color, borderColor: t.color }}>
      {t.name}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 프로필
// ---------------------------------------------------------------------------

export function ProfilePanel({
  profile,
  onChanged,
}: {
  profile: UserProfile;
  onChanged?: () => void;
}) {
  const [meta, setMeta] = useState<UserMeta | null>(null);
  const [wallet, setWallet] = useState(0);

  const load = () => {
    fetchMeta(profile.uid).then(setMeta);
    fetchWallet(profile.uid).then(setWallet);
  };
  useEffect(load, [profile.uid]);

  if (!meta) return <p className="room-empty">불러오는 중…</p>;

  const tier = tierOf(meta.vipExp);
  const next = nextTier(meta.vipExp);
  const progress = next
    ? Math.min(100, ((meta.vipExp - tier.minExp) / (next.minExp - tier.minExp)) * 100)
    : 100;
  const owned = SHOP_ITEMS.filter((s) => meta.items[s.id] && s.type !== 'pass');
  const slotOf = (t: ShopItem['type']) => (t === 'frame' ? 'frame' : 'cardback');
  const passDaysLeft =
    meta.passUntil > Date.now() ? Math.ceil((meta.passUntil - Date.now()) / 86400000) : 0;

  const equip = async (slot: 'frame' | 'cardback', id: string) => {
    await equipItem(profile.uid, slot, meta.equipped[slot] === id ? null : id);
    load();
    onChanged?.();
  };

  const myCharacters = [
    ...FREE_CHARACTERS,
    ...PREMIUM_CHARACTERS.filter((c) =>
      SHOP_ITEMS.some((s) => s.avatarKind === c.kind && meta.items[s.id]),
    ),
  ];

  const pickCharacter = async (kind: string) => {
    await saveAvatar(profile.uid, kind);
    load();
    onChanged?.();
  };

  return (
    <div className="meta-panel">
      <div className="profile-head">
        <strong>{profile.nickname}</strong>
        <TierBadge exp={meta.vipExp} />
        <span className="gem-amount">💎 {meta.gems}</span>
        {passDaysLeft > 0 && <span className="pass-badge">⭐ 골드 패스 D-{passDaysLeft}</span>}
      </div>

      <div className="vip-gauge-wrap">
        <div className="vip-gauge">
          <div className="vip-gauge-fill" style={{ width: `${progress}%`, background: tier.color }} />
        </div>
        <p className="vip-gauge-label">
          {next
            ? `${next.name}까지 ${formatMoney(next.minExp - meta.vipExp)} 베팅 남음 · 보너스 ×${tier.bonusMult}`
            : `최고 등급! · 보너스 ×${tier.bonusMult}`}
        </p>
      </div>

      <div className="stat-grid">
        <div className="stat-cell">
          <em>플레이</em>
          <strong>{meta.stats.hands}판</strong>
        </div>
        <div className="stat-cell">
          <em>승리</em>
          <strong>
            {meta.stats.wins}판 ({meta.stats.hands > 0 ? Math.round((meta.stats.wins / meta.stats.hands) * 100) : 0}%)
          </strong>
        </div>
        <div className="stat-cell">
          <em>최고 연승</em>
          <strong>🔥 {meta.stats.bestStreak}</strong>
        </div>
        <div className="stat-cell">
          <em>최대 획득</em>
          <strong>{formatMoney(meta.stats.biggestWin)}</strong>
        </div>
        <div className="stat-cell">
          <em>보유 골드</em>
          <strong>{formatMoney(wallet)}</strong>
        </div>
        <div className="stat-cell">
          <em>VIP 경험치</em>
          <strong>{formatMoney(meta.vipExp)}</strong>
        </div>
      </div>

      <div className="field">
        <span>내 캐릭터 (탭해서 대표 캐릭터 변경)</span>
        <div className="char-grid">
          {myCharacters.map((c) => (
            <button
              key={c.kind}
              type="button"
              className={`char-cell ${meta.avatar === c.kind ? 'on' : ''}`}
              onClick={() => pickCharacter(c.kind)}
            >
              <Avatar kind={c.kind} size={52} />
              <em>{c.name}</em>
            </button>
          ))}
        </div>
        <p className="auth-caveat">새 캐릭터는 상점 → 골드/프리미엄 아바타에서 영입할 수 있어요</p>
      </div>

      <div className="field">
        <span>인벤토리 (탭해서 장착/해제)</span>
        {owned.length === 0 ? (
          <p className="room-empty">아직 보유한 아이템이 없어요 — 상점을 구경해보세요!</p>
        ) : (
          <div className="inv-grid">
            {owned.map((it) => {
              const noEquip = it.type === 'emotepack' || it.type === 'avatarpack';
              const slot = slotOf(it.type);
              const on = !noEquip && meta.equipped[slot] === it.id;
              return (
                <button
                  key={it.id}
                  type="button"
                  className={`inv-cell ${on ? 'on' : ''}`}
                  onClick={() => !noEquip && equip(slot, it.id)}
                >
                  {it.type === 'avatarpack' ? (
                    <Avatar kind={it.avatarKind!} size={34} />
                  ) : (
                    <span className={`inv-preview ${it.id}`} />
                  )}
                  <strong>{it.name}</strong>
                  <em>
                    {it.type === 'emotepack'
                      ? '자동 적용'
                      : it.type === 'avatarpack'
                        ? '대기실에서 선택'
                        : on
                          ? '장착 중 ✓'
                          : '탭하여 장착'}
                  </em>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 상점
// ---------------------------------------------------------------------------

export function ShopPanel({
  profile,
  onChanged,
}: {
  profile: UserProfile;
  onChanged?: () => void;
}) {
  const [meta, setMeta] = useState<UserMeta | null>(null);
  const [wallet, setWallet] = useState(0);
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<ShopItem['category']>('골드아바타');

  const load = () => {
    fetchMeta(profile.uid).then(setMeta);
    fetchWallet(profile.uid).then(setWallet);
  };
  useEffect(load, [profile.uid]);

  if (!meta) return <p className="room-empty">불러오는 중…</p>;

  const buy = async (it: ShopItem) => {
    if (busy) return;
    setBusy(true);
    setMsg('');
    const res = await buyItem(profile.uid, it.id);
    setMsg(res.message);
    setMsgOk(res.ok);
    load();
    onChanged?.();
    setBusy(false);
  };

  const categories = ['골드아바타', '프리미엄아바타', '머니뽑기', '회원제', '아이템', '꾸미기'] as const;
  const cat = tab;

  return (
    <div className="meta-panel">
      <div className="profile-head">
        <span className="wallet-amount">{formatMoney(wallet)}</span>
        <span className="gem-amount">💎 {meta.gems}</span>
      </div>

      <div className="shop-tabs">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className={tab === c ? 'on' : ''}
            onClick={() => {
              setTab(c);
              setMsg('');
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {msg && <p className={msgOk ? 'shop-win' : 'auth-error'}>{msg}</p>}
      {[cat].map((cat) => (
        <div key={cat} className="shop-section">
          <div className={cat.includes('아바타') ? 'shop-grid shop-grid-big' : 'shop-grid'}>
            {SHOP_ITEMS.filter((it) => it.category === cat).map((it) => {
              const repeatable = it.type === 'pass' || it.type === 'gacha';
              const ownedAlready = !repeatable && meta.items[it.id];
              const big = it.type === 'avatarpack';
              return (
                <div key={it.id} className={`shop-card ${big ? 'shop-card-big' : ''}`}>
                  {big ? (
                    <div className="shop-portrait">
                      <Avatar kind={it.avatarKind!} size={150} />
                      <span className="shop-gold-tag">
                        +{Math.floor((it.grantGold ?? 0) / 10000)}만 골드
                      </span>
                    </div>
                  ) : (
                    <span className="shop-icon">{it.icon}</span>
                  )}
                  <strong>{it.name}</strong>
                  {big && it.concept && <p className="shop-concept">{it.concept}</p>}
                  <em>{it.desc}</em>
                  <button
                    type="button"
                    className="hg-btn-blue shop-buy"
                    disabled={!!ownedAlready || busy}
                    onClick={() => buy(it)}
                  >
                    {ownedAlready
                      ? '보유 중'
                      : it.priceGems
                        ? `💎 ${it.priceGems}`
                        : formatMoney(it.priceGold ?? 0)}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <p className="auth-caveat">
        💎 젬 얻는 법: 일일 보너스 · 포카드 승리 +5 · 스트레이트 플러시 승리 +20 · 10연승 달성 +10
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 랭킹 (보유 골드)
// ---------------------------------------------------------------------------

export function RankingPanel({ profile }: { profile: UserProfile }) {
  const [rows, setRows] = useState<
    { uid: string; nickname: string; wallet: number; vipExp: number }[] | null
  >(null);

  useEffect(() => {
    fetchTopWallets(20).then(setRows).catch(() => setRows([]));
  }, []);

  if (!rows) return <p className="room-empty">불러오는 중…</p>;

  return (
    <div className="meta-panel">
      <div className="rank-list">
        {rows.length === 0 && <p className="room-empty">아직 랭킹 데이터가 없어요.</p>}
        {rows.map((r, i) => (
          <div key={r.uid} className={`rank-row ${r.uid === profile.uid ? 'me' : ''}`}>
            <span className={`rank-no rank-no-${i + 1}`}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
            </span>
            <strong className="rank-name">
              {r.nickname}
              {r.uid === profile.uid && <span className="me-tag">나</span>}
            </strong>
            <TierBadge exp={r.vipExp} />
            <span className="rank-gold">{formatMoney(r.wallet)}</span>
          </div>
        ))}
      </div>
      <p className="auth-caveat">보유 골드 기준 TOP 20 · VIP 등급은 누적 베팅액으로 상승해요</p>
    </div>
  );
}
