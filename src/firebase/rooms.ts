// 멀티플레이 방 시스템 (RTDB)
//  rooms/{id} = { id, name, host, channelId, maxPlayers, status, createdAt, players: { uid: {...} } }

import {
  getDatabase,
  ref,
  push,
  set,
  update,
  remove,
  get,
  onValue,
  onDisconnect,
} from 'firebase/database';
import { getFirebaseApp } from './config';

export interface RoomPlayer {
  uid: string;
  nickname: string;
  avatar: string;
  ready: boolean;
  joinedAt: number;
  /** 장착 프로필 테두리 (코스메틱) */
  frame?: string;
  /** VIP 등급 인덱스 */
  vip?: number;
}

export interface RoomBot {
  name: string;
  avatar: string;
}

export interface Room {
  id: string;
  name: string;
  host: string;
  channelId: string;
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'ended';
  createdAt: number;
  players?: Record<string, RoomPlayer>;
  bots?: Record<string, RoomBot>;
  seats?: string[];
  settled?: boolean;
}

function db() {
  return getDatabase(getFirebaseApp());
}

export function roomPlayers(room: Room): RoomPlayer[] {
  return Object.values(room.players ?? {}).sort((a, b) => a.joinedAt - b.joinedAt);
}

/** 봇 목록 (등록 순서 고정) */
export function roomBots(room: Room): { id: string; bot: RoomBot }[] {
  return Object.entries(room.bots ?? {})
    .map(([id, bot]) => ({ id, bot }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function addBot(roomId: string, bot: RoomBot): Promise<void> {
  await set(push(ref(db(), `rooms/${roomId}/bots`)), bot);
}

export async function removeBot(roomId: string, botId: string): Promise<void> {
  await remove(ref(db(), `rooms/${roomId}/bots/${botId}`));
}

export async function createRoom(opts: {
  name: string;
  channelId: string;
  maxPlayers: number;
  uid: string;
  nickname: string;
  avatar: string;
  frame?: string;
  vip?: number;
}): Promise<string> {
  const roomRef = push(ref(db(), 'rooms'));
  const id = roomRef.key!;
  const room: Room = {
    id,
    name: opts.name.trim() || `${opts.nickname}의 방`,
    host: opts.uid,
    channelId: opts.channelId,
    maxPlayers: opts.maxPlayers,
    status: 'waiting',
    createdAt: Date.now(),
  };
  await set(roomRef, room);
  await joinRoom(id, opts);
  return id;
}

export async function joinRoom(
  roomId: string,
  opts: { uid: string; nickname: string; avatar: string; frame?: string; vip?: number },
): Promise<string | null> {
  const snap = await get(ref(db(), `rooms/${roomId}`));
  if (!snap.exists()) return '방이 사라졌어요.';
  const room = snap.val() as Room;
  const players = roomPlayers(room);
  const seated = room.seats?.includes(opts.uid) ?? false; // 게임 참가자는 재입장 허용
  if (room.status !== 'waiting' && !players.some((p) => p.uid === opts.uid) && !seated)
    return '이미 게임이 시작된 방이에요.';
  const botCount = Object.keys(room.bots ?? {}).length;
  if (players.length + botCount >= room.maxPlayers && !players.some((p) => p.uid === opts.uid))
    return '방이 가득 찼어요.';

  const meRef = ref(db(), `rooms/${roomId}/players/${opts.uid}`);
  const me: RoomPlayer = {
    uid: opts.uid,
    nickname: opts.nickname,
    avatar: opts.avatar,
    ready: false,
    joinedAt: Date.now(),
    frame: opts.frame ?? '',
    vip: opts.vip ?? 0,
  };
  await set(meRef, me);
  // 접속이 끊기면 자동으로 방에서 제거
  onDisconnect(meRef).remove();
  return null;
}

export async function leaveRoom(roomId: string, uid: string): Promise<void> {
  const roomRef = ref(db(), `rooms/${roomId}`);
  const snap = await get(roomRef);
  if (!snap.exists()) return;
  const room = snap.val() as Room;
  const rest = roomPlayers(room).filter((p) => p.uid !== uid);

  onDisconnect(ref(db(), `rooms/${roomId}/players/${uid}`)).cancel();

  if (rest.length === 0) {
    await remove(roomRef); // 마지막 사람이 나가면 방 삭제
    return;
  }
  const patch: Record<string, unknown> = { [`players/${uid}`]: null };
  if (room.host === uid) patch.host = rest[0].uid; // 호스트 이양 (가장 먼저 들어온 사람)
  await update(roomRef, patch);
}

export async function setReady(roomId: string, uid: string, ready: boolean): Promise<void> {
  await update(ref(db(), `rooms/${roomId}/players/${uid}`), { ready });
}

export async function setAvatar(roomId: string, uid: string, avatar: string): Promise<void> {
  await update(ref(db(), `rooms/${roomId}/players/${uid}`), { avatar });
}

export async function startRoom(roomId: string): Promise<void> {
  await update(ref(db(), `rooms/${roomId}`), { status: 'playing' });
}

/** 대기 중인 방 목록 구독 (인원 0명 방은 숨김) */
export function listenRooms(cb: (rooms: Room[]) => void): () => void {
  return onValue(ref(db(), 'rooms'), (snap) => {
    const all: Room[] = [];
    snap.forEach((child) => {
      const r = child.val() as Room;
      if (r.status === 'waiting' && roomPlayers(r).length > 0) all.push(r);
    });
    all.sort((a, b) => b.createdAt - a.createdAt);
    cb(all.slice(0, 50));
  });
}

/** 단일 방 구독. 방이 삭제되면 null */
export function listenRoom(roomId: string, cb: (room: Room | null) => void): () => void {
  return onValue(ref(db(), `rooms/${roomId}`), (snap) => {
    cb(snap.exists() ? (snap.val() as Room) : null);
  });
}
