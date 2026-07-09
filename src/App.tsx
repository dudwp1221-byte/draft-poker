// 드래프트 포커 — 온라인 전용
// 흐름: 접속 → (세션 자동 로그인) → 로비 → 방/대기실 → 게임
// 모든 게임은 멀티 경로(호스트 동기화)로 진행 — 혼자 연습도 봇 채운 방으로

import { useEffect, useState } from 'react';
import { AuthScreen } from './ui/AuthScreen';
import { MultiLobby } from './ui/MultiLobby';
import { WaitingRoom } from './ui/WaitingRoom';
import { MultiGame } from './ui/MultiGame';
import { isFirebaseConfigured } from './firebase/config';
import { onAuth, fetchProfile, signOut, type UserProfile } from './firebase/auth';

export default function App() {
  const [screen, setScreen] = useState<'splash' | 'auth' | 'lobby' | 'room' | 'mgame'>('splash');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    // 인증 응답이 늦으면 로그인 화면으로
    const fallback = setTimeout(() => setScreen((s) => (s === 'splash' ? 'auth' : s)), 5000);
    const off = onAuth(async (u) => {
      if (!u) {
        setProfile(null);
        setScreen((s) => (s === 'splash' ? 'auth' : s));
        return;
      }
      let p = await fetchProfile(u.uid);
      if (!p) {
        // 회원가입 직후 프로필 기록이 끝나기 전일 수 있음 — 한 번 재시도
        await new Promise((r) => setTimeout(r, 900));
        p = await fetchProfile(u.uid);
      }
      setProfile(p ?? { uid: u.uid, nickname: '플레이어', wallet: 0, createdAt: Date.now() });
      setScreen((s) => (s === 'splash' || s === 'auth' ? 'lobby' : s));
    });
    return () => {
      clearTimeout(fallback);
      off();
    };
  }, []);

  if (!isFirebaseConfigured()) {
    return (
      <div className="lobby">
        <div className="lobby-panel">
          <p className="lobby-eyebrow">DRAFT POKER</p>
          <h1 className="lobby-title">설정이 필요해요</h1>
          <p className="room-empty">
            src/firebase/config.ts에 Firebase 설정값을 넣어주세요. (README 참고)
          </p>
        </div>
      </div>
    );
  }

  if (screen === 'auth') {
    return <AuthScreen onDone={() => setScreen('lobby')} />;
  }

  if (screen === 'lobby' && profile) {
    return (
      <MultiLobby
        profile={profile}
        onEnterRoom={(id) => {
          setRoomId(id);
          setScreen('room');
        }}
        onLogout={async () => {
          await signOut().catch(() => {});
          setProfile(null);
          setScreen('auth');
        }}
      />
    );
  }

  if (screen === 'room' && roomId && profile) {
    return (
      <WaitingRoom
        roomId={roomId}
        profile={profile}
        onLeave={() => {
          setRoomId(null);
          setScreen('lobby');
        }}
        onGameStart={() => setScreen('mgame')}
      />
    );
  }

  if (screen === 'mgame' && roomId && profile) {
    return (
      <MultiGame
        roomId={roomId}
        profile={profile}
        onExit={() => {
          setRoomId(null);
          setScreen('lobby');
        }}
      />
    );
  }

  // 스플래시 / 폴백
  return (
    <div className="lobby">
      <div className="lobby-panel">
        <p className="lobby-eyebrow">DRAFT POKER</p>
        <h1 className="lobby-title">드래프트 포커</h1>
        <p className="room-empty">접속 중… 🃏</p>
      </div>
    </div>
  );
}
