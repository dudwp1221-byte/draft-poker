// WebAudio 합성 효과음 — 외부 에셋 없음

let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = localStorage.getItem('dp-muted') === '1';
} catch {
  /* ignore */
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(v: boolean): void {
  muted = v;
  try {
    localStorage.setItem('dp-muted', v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function ac(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType = 'sine',
  peak = 0.16,
): void {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(start: number, dur: number, freq: number, q: number, peak = 0.18): void {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + start;
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(peak, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp).connect(g).connect(c.destination);
  src.start(t0);
}

export const sfx = {
  /** 카드 픽 클릭 */
  click(): void {
    if (muted) return;
    tone(820, 0, 0.06, 'square', 0.07);
  },
  /** 카드 슬라이드 (뭉치 패스) */
  card(): void {
    if (muted) return;
    noise(0, 0.13, 2600, 1.2, 0.12);
  },
  /** 칩 짤랑 (베팅) */
  chip(): void {
    if (muted) return;
    const d = Math.random() * 120;
    tone(3600 + d, 0, 0.045, 'triangle', 0.12);
    tone(4200 + d, 0.05, 0.05, 'triangle', 0.1);
  },
  /** 내 차례 띵 */
  ding(): void {
    if (muted) return;
    tone(880, 0, 0.14, 'sine', 0.14);
    tone(1318, 0.1, 0.22, 'sine', 0.12);
  },
  /** 족보 띠배너 등장 */
  banner(): void {
    if (muted) return;
    tone(196, 0, 0.55, 'triangle', 0.2);
    tone(294, 0.04, 0.5, 'sine', 0.1);
    noise(0, 0.3, 5200, 2, 0.05);
  },
  /** 대박 연출: 상승 아르페지오 + 반짝임 (포카드/스트레이트 플러시) */
  jackpot(): void {
    if (muted) return;
    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((f, i) => tone(f, 0.07 + i * 0.085, 0.18, 'triangle', 0.15));
    tone(2093, 0.65, 0.32, 'sine', 0.08);
    tone(2637, 0.77, 0.32, 'sine', 0.07);
    tone(3136, 0.89, 0.36, 'sine', 0.06);
  },
  /** 승리 팡파레 + 칩 샤워 */
  win(): void {
    if (muted) return;
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => tone(f, i * 0.09, 0.16, 'triangle', 0.14));
    tone(1046, 0.4, 0.4, 'sine', 0.1);
    for (let i = 0; i < 6; i++) {
      tone(3400 + Math.random() * 900, 0.45 + i * 0.06, 0.05, 'triangle', 0.07);
    }
  },
};
