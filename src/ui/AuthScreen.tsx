// 원버튼 로그인: 아이디 + 4자리 비밀번호만 입력 →
// 계정이 있으면 로그인, 없으면 자동 가입 후 바로 입장

import { useState } from 'react';
import { signIn, signUp, authErrorMessage, validateId, validatePin } from '../firebase/auth';

export function AuthScreen({ onDone }: { onDone: () => void }) {
  const [userId, setUserId] = useState('');
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [welcome, setWelcome] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setError('');
    const id = userId.trim();
    const idErr = validateId(id);
    if (idErr) {
      setError(idErr);
      return;
    }
    const pinErr = validatePin(pin);
    if (pinErr) {
      setError(pinErr);
      return;
    }
    setBusy(true);
    try {
      // 1) 신규 가입 시도 → 이미 있는 아이디면 로그인으로 전환
      await signUp(id, pin, nickname.trim() || id);
      setWelcome(`새 계정을 만들었어요! 어서 와요, ${nickname.trim() || id} 🎉`);
      setTimeout(onDone, 1100);
    } catch (e) {
      const code = (e as { code?: string })?.code ?? '';
      if (code === 'auth/email-already-in-use') {
        try {
          await signIn(id, pin);
          onDone();
        } catch (e2) {
          setError(authErrorMessage(e2));
          setBusy(false);
        }
      } else {
        setError(authErrorMessage(e));
        setBusy(false);
      }
    }
  };

  return (
    <div className="lobby">
      <div className="lobby-panel auth-panel">
        <p className="lobby-eyebrow">DRAFT POKER ONLINE</p>
        <h1 className="lobby-title">입장하기</h1>
        <p className="auth-hint">
          아이디와 비밀번호만 입력하면 끝 — 처음이면 자동으로 계정이 만들어져요.
        </p>

        <label className="field">
          <span>아이디</span>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            maxLength={12}
            placeholder="영문/숫자 3~12자"
            autoComplete="username"
            autoCapitalize="none"
          />
        </label>

        <label className="field">
          <span>비밀번호 (숫자 4자리)</span>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            maxLength={4}
            placeholder="••••"
            autoComplete="current-password"
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
        </label>

        <label className="field">
          <span>닉네임 (처음 가입할 때만 사용)</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={8}
            placeholder="비워두면 아이디로 표시돼요"
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
        </label>

        {error && <p className="auth-error">{error}</p>}
        {welcome && <p className="reclaim-note">{welcome}</p>}

        <button type="button" className="btn-primary lobby-start" onClick={submit} disabled={busy}>
          {busy ? '입장 중…' : '게임 입장'}
        </button>

        <p className="auth-caveat">
          ※ 아이디를 잘못 치면 그 이름으로 새 계정이 생겨요 — 오타에 주의! 비밀번호는 게임
          전용으로, 평소 쓰는 비밀번호는 쓰지 마세요.
        </p>

      </div>
    </div>
  );
}
