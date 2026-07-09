// 게임 상태 동기화 (호스트 권한 방식)
//  rooms/{id}/state   : 직렬화된 GameState (호스트만 기록)
//  rooms/{id}/actions : 게스트 → 호스트 액션 큐
//  rooms/{id}/emotes  : 이모티콘 브로드캐스트
//  rooms/{id}/seats   : 좌석 순서 (uid 배열) — 시작 시 호스트가 확정
//
// 상태는 JSON "문자열"로 저장한다. RTDB는 빈 배열/undefined를 제거하는
// 특성이 있어서 객체 그대로 저장하면 손패/뭉치 배열이 깨질 수 있다.

import {
  getDatabase,
  ref,
  push,
  set,
  get,
  update,
  remove,
  onValue,
  onChildAdded,
  runTransaction,
} from 'firebase/database';
import { getFirebaseApp } from './config';
import type { GameState, BetAction } from '../game/engine';

function db() {
  return getDatabase(getFirebaseApp());
}

// ---------- 상태 ----------

export function writeState(roomId: string, gs: GameState): void {
  set(ref(db(), `rooms/${roomId}/state`), JSON.stringify(gs));
}

/** 초기 상태 선점 기록 (StrictMode/동시 호스트 경쟁에도 1회만 성공) */
export async function claimInitialState(roomId: string, gs: GameState): Promise<boolean> {
  const res = await runTransaction(ref(db(), `rooms/${roomId}/state`), (cur) =>
    cur === null ? JSON.stringify(gs) : undefined,
  );
  return res.committed;
}

export function listenState(
  roomId: string,
  cb: (gs: GameState | null) => void,
): () => void {
  return onValue(ref(db(), `rooms/${roomId}/state`), (snap) => {
    const v = snap.val();
    cb(typeof v === 'string' ? (JSON.parse(v) as GameState) : null);
  });
}

// ---------- 액션 큐 ----------

export type GameAction =
  | { kind: 'pick'; seat: number; idx: number }
  | { kind: 'bet'; seat: number; action: BetAction }
  | { kind: 'leave'; seat: number; uid: string }
  | { kind: 'rebuy'; seat: number; uid: string };

export function pushAction(roomId: string, action: GameAction): void {
  push(ref(db(), `rooms/${roomId}/actions`), { ...action, ts: Date.now() });
}

export function listenActions(
  roomId: string,
  cb: (id: string, action: GameAction) => void,
): () => void {
  return onChildAdded(ref(db(), `rooms/${roomId}/actions`), (snap) => {
    cb(snap.key!, snap.val() as GameAction);
  });
}

export function removeAction(roomId: string, id: string): void {
  remove(ref(db(), `rooms/${roomId}/actions/${id}`));
}

// ---------- 이모티콘 ----------

export function pushEmote(roomId: string, seat: number, type: string): void {
  push(ref(db(), `rooms/${roomId}/emotes`), { seat, type, ts: Date.now() });
}

export function listenEmotes(
  roomId: string,
  cb: (seat: number, type: string, ts: number) => void,
): () => void {
  return onChildAdded(ref(db(), `rooms/${roomId}/emotes`), (snap) => {
    const v = snap.val() as { seat: number; type: string; ts: number };
    cb(v.seat, v.type, v.ts);
  });
}

// ---------- 좌석 ----------

export async function setSeats(roomId: string, uids: string[]): Promise<void> {
  await update(ref(db(), `rooms/${roomId}`), { seats: uids });
}

// ---------- 지갑 (호스트가 정산 권한) ----------

export async function walletAdd(uid: string, delta: number): Promise<void> {
  await runTransaction(ref(db(), `users/${uid}/wallet`), (cur) =>
    Math.max(0, (typeof cur === 'number' ? cur : 0) + delta),
  );
}

/** 잔액이 충분할 때만 차감. 성공 여부 반환 */
export async function walletTryDeduct(uid: string, amount: number): Promise<boolean> {
  const res = await runTransaction(ref(db(), `users/${uid}/wallet`), (cur) => {
    const w = typeof cur === 'number' ? cur : 0;
    return w >= amount ? w - amount : undefined;
  });
  return res.committed;
}

export async function fetchWallet(uid: string): Promise<number> {
  const snap = await get(ref(db(), `users/${uid}/wallet`));
  return typeof snap.val() === 'number' ? snap.val() : 0;
}

/** 일일 출석 보너스 선점 — 오늘(KST) 아직 안 받았으면 기록하고 true */
export async function claimDaily(uid: string): Promise<boolean> {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  const res = await runTransaction(ref(db(), `users/${uid}/lastDaily`), (cur) =>
    cur === today ? undefined : today,
  );
  return res.committed;
}

export async function fetchLastDaily(uid: string): Promise<string | null> {
  const snap = await get(ref(db(), `users/${uid}/lastDaily`));
  return typeof snap.val() === 'string' ? snap.val() : null;
}

/** 게임오버 정산 선점 (1회만 성공) */
export async function claimSettlement(roomId: string): Promise<boolean> {
  const res = await runTransaction(ref(db(), `rooms/${roomId}/settled`), (cur) =>
    cur === null || cur === false ? true : undefined,
  );
  return res.committed;
}

// ---------- 메타: 젬 / VIP 경험치 / 전적 / 인벤토리 / 상점 / 랭킹 ----------

import { query, orderByChild, limitToLast } from 'firebase/database';
import { SHOP_ITEMS, PASS_DAYS, rollGacha } from '../game/meta';

export interface UserMeta {
  gems: number;
  vipExp: number;
  items: Record<string, true>;
  equipped: { frame?: string; cardback?: string };
  stats: { hands: number; wins: number; bestStreak: number; biggestWin: number };
  /** 골드 패스 만료 시각 (ms) — 미래면 활성 */
  passUntil: number;
  /** 패스 일일 추가 지급량 */
  passDaily: number;
  /** 대표 캐릭터 */
  avatar: string;
}

export async function fetchMeta(uid: string): Promise<UserMeta> {
  const snap = await get(ref(db(), `users/${uid}`));
  const v = (snap.val() ?? {}) as Partial<UserMeta>;
  return {
    gems: typeof v.gems === 'number' ? v.gems : 0,
    vipExp: typeof v.vipExp === 'number' ? v.vipExp : 0,
    items: v.items ?? {},
    equipped: v.equipped ?? {},
    stats: v.stats ?? { hands: 0, wins: 0, bestStreak: 0, biggestWin: 0 },
    passUntil: typeof v.passUntil === 'number' ? v.passUntil : 0,
    passDaily:
      typeof (v as Record<string, unknown>).passDaily === 'number'
        ? ((v as Record<string, unknown>).passDaily as number)
        : 200_000,
    avatar: typeof (v as Record<string, unknown>).avatar === 'string' ? ((v as Record<string, unknown>).avatar as string) : 'fox',
  };
}

export async function saveAvatar(uid: string, avatar: string): Promise<void> {
  await update(ref(db(), `users/${uid}`), { avatar });
}

export async function gemsAdd(uid: string, delta: number): Promise<void> {
  await runTransaction(ref(db(), `users/${uid}/gems`), (cur) =>
    Math.max(0, (typeof cur === 'number' ? cur : 0) + delta),
  );
}

export async function vipExpAdd(uid: string, delta: number): Promise<void> {
  await runTransaction(ref(db(), `users/${uid}/vipExp`), (cur) =>
    Math.max(0, (typeof cur === 'number' ? cur : 0) + delta),
  );
}

/** 핸드 종료 후 전적 갱신 (호스트가 기록) */
export async function statsApply(
  uid: string,
  d: { hand: boolean; win: boolean; streak: number; won: number },
): Promise<void> {
  await runTransaction(ref(db(), `users/${uid}/stats`), (cur) => {
    const s = cur ?? { hands: 0, wins: 0, bestStreak: 0, biggestWin: 0 };
    return {
      hands: (s.hands ?? 0) + (d.hand ? 1 : 0),
      wins: (s.wins ?? 0) + (d.win ? 1 : 0),
      bestStreak: Math.max(s.bestStreak ?? 0, d.streak),
      biggestWin: Math.max(s.biggestWin ?? 0, d.won),
    };
  });
}

/** 상점 구매: 재화 차감 성공 시 지급 */
export async function buyItem(
  uid: string,
  itemId: string,
): Promise<{ ok: boolean; message: string }> {
  const item = SHOP_ITEMS.find((s) => s.id === itemId);
  if (!item) return { ok: false, message: '없는 상품이에요.' };
  const repeatable = item.type === 'pass' || item.type === 'gacha';
  if (!repeatable) {
    const meta = await fetchMeta(uid);
    if (meta.items[itemId]) return { ok: false, message: '이미 보유 중이에요.' };
  }
  if (item.priceGems) {
    const ok = await runTransaction(ref(db(), `users/${uid}/gems`), (cur) => {
      const g = typeof cur === 'number' ? cur : 0;
      return g >= item.priceGems! ? g - item.priceGems! : undefined;
    });
    if (!ok.committed) return { ok: false, message: '젬이 부족해요.' };
  }
  if (item.priceGold) {
    const ok = await walletTryDeduct(uid, item.priceGold);
    if (!ok) return { ok: false, message: '골드가 부족해요.' };
  }
  if (item.type === 'pass') {
    // 활성 중이면 만료 시점에서 연장, 아니면 지금부터 시작
    await runTransaction(ref(db(), `users/${uid}/passUntil`), (cur) => {
      const base = Math.max(Date.now(), typeof cur === 'number' ? cur : 0);
      return base + PASS_DAYS * 24 * 60 * 60 * 1000;
    });
    if (item.passDaily) await update(ref(db(), `users/${uid}`), { passDaily: item.passDaily });
    return { ok: true, message: `${item.name} 적용 완료! ⭐` };
  }
  if (item.type === 'avatarpack') {
    await update(ref(db(), `users/${uid}/items`), { [itemId]: true });
    if (item.grantGold) await walletAdd(uid, item.grantGold);
    return {
      ok: true,
      message: `${item.name} 영입! +${Math.floor((item.grantGold ?? 0) / 10000)}만 골드 지급 — 대기실에서 선택할 수 있어요`,
    };
  }
  if (item.type === 'gacha') {
    const won = rollGacha(itemId);
    await walletAdd(uid, won);
    return { ok: true, message: `🎉 ${Math.floor(won / 10000)}만 골드 당첨!` };
  }
  await update(ref(db(), `users/${uid}/items`), { [itemId]: true });
  return { ok: true, message: `${item.name} 구매 완료!` };
}

export async function equipItem(
  uid: string,
  slot: 'frame' | 'cardback',
  itemId: string | null,
): Promise<void> {
  await update(ref(db(), `users/${uid}/equipped`), { [slot]: itemId });
}

/** 보유 골드 TOP N (users에 .indexOn: ["wallet"] 규칙 필요) */
export async function fetchTopWallets(
  n = 20,
): Promise<{ uid: string; nickname: string; wallet: number; vipExp: number }[]> {
  const collect = (snap: { forEach: (cb: (child: { key: string | null; val: () => unknown }) => void) => void }) => {
    const out: { uid: string; nickname: string; wallet: number; vipExp: number }[] = [];
    snap.forEach((child) => {
      const v = (child.val() ?? {}) as Record<string, unknown>;
      out.push({
        uid: child.key!,
        nickname: typeof v.nickname === 'string' ? v.nickname : '???',
        wallet: typeof v.wallet === 'number' ? v.wallet : 0,
        vipExp: typeof v.vipExp === 'number' ? v.vipExp : 0,
      });
    });
    return out;
  };
  try {
    const snap = await get(query(ref(db(), 'users'), orderByChild('wallet'), limitToLast(n)));
    return collect(snap).reverse();
  } catch {
    // .indexOn 규칙이 아직 없으면 전체 조회 후 정렬 (소규모에선 충분)
    const snap = await get(ref(db(), 'users'));
    return collect(snap)
      .sort((a, b) => b.wallet - a.wallet)
      .slice(0, n);
  }
}
