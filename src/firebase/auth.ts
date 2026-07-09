// 회원가입/로그인 (Firebase Auth 이메일/비밀번호) + 유저 프로필 (RTDB)

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { getDatabase, ref, set, get } from 'firebase/database';
import { getFirebaseApp } from './config';

export interface UserProfile {
  uid: string;
  nickname: string;
  wallet: number;
  createdAt: number;
}

const START_WALLET = 1_000_000;

// 아이디/4자리 비밀번호를 Firebase 이메일/비밀번호 형식으로 변환
// (계정 수집 목적이 아니므로 이메일을 받지 않는다)
const ID_RE = /^[a-zA-Z0-9_]{3,12}$/;
const PIN_RE = /^\d{4}$/;

export function validateId(id: string): string | null {
  return ID_RE.test(id) ? null : '아이디는 영문/숫자/_ 조합 3~12자예요.';
}

export function validatePin(pin: string): string | null {
  return PIN_RE.test(pin) ? null : '비밀번호는 숫자 4자리예요.';
}

function toEmail(id: string): string {
  return `${id.toLowerCase()}@draftpoker.local`;
}

function toPassword(pin: string): string {
  return `${pin}_dp!`; // Firebase 최소 6자 조건을 채우기 위한 고정 패딩
}

function auth() {
  return getAuth(getFirebaseApp());
}

function db() {
  return getDatabase(getFirebaseApp());
}

export async function signUp(id: string, pin: string, nickname: string): Promise<UserProfile> {
  const cred = await createUserWithEmailAndPassword(auth(), toEmail(id), toPassword(pin));
  const profile: UserProfile = {
    uid: cred.user.uid,
    nickname: nickname.trim() || '플레이어',
    wallet: START_WALLET,
    createdAt: Date.now(),
  };
  await set(ref(db(), `users/${cred.user.uid}`), profile);
  return profile;
}

export async function signIn(id: string, pin: string): Promise<void> {
  await signInWithEmailAndPassword(auth(), toEmail(id), toPassword(pin));
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth());
}

export async function fetchProfile(uid: string): Promise<UserProfile | null> {
  const snap = await get(ref(db(), `users/${uid}`));
  return snap.exists() ? (snap.val() as UserProfile) : null;
}

/** 로그인 상태 변화 구독. 반환값은 구독 해제 함수 */
export function onAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth(), cb);
}

/** 한국어 에러 메시지 매핑 */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return '아이디는 영문/숫자/_ 조합 3~12자예요.';
    case 'auth/email-already-in-use':
      return '이미 사용 중인 아이디예요.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return '아이디 또는 비밀번호가 맞지 않아요.';
    case 'auth/too-many-requests':
      return '시도가 너무 많아요. 잠시 후 다시 해주세요.';
    case 'auth/network-request-failed':
      return '네트워크 연결을 확인해주세요.';
    default:
      return '오류가 발생했어요. 다시 시도해주세요.';
  }
}
