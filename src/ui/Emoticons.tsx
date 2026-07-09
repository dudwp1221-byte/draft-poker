// 움직이는 이모티콘 시스템 — 버튼을 누르면 좌석 위에 애니메이션 이모티콘이 뜬다
// 봇도 쇼다운 결과에 반응해 자동으로 사용한다

import { useEffect, useRef, useState } from 'react';
import type { GameState, Phase } from '../game/engine';
import { seatPos } from './layout';

export type EmoType =
  | 'thanks' | 'sad' | 'sorry' | 'joy' | 'wow' | 'angry'
  | 'rich' | 'cool' | 'freeze' | 'rage' | 'party' | 'meh';

export const EMOTICONS: { type: EmoType; label: string; glyph: string; particle: string }[] = [
  { type: 'thanks', label: '감사', glyph: '🙏', particle: '♪' },
  { type: 'sad', label: '슬픔', glyph: '😭', particle: '💧' },
  { type: 'sorry', label: '미안', glyph: '🙇', particle: '💦' },
  { type: 'joy', label: '기쁨', glyph: '😍', particle: '❤' },
  { type: 'wow', label: '황당', glyph: '😳', particle: '❗' },
  { type: 'angry', label: '화남', glyph: '😡', particle: '💢' },
];

/** 이모티콘 확장팩 (상점 구매 시 사용 가능) — 도발 컨셉 */
export const EMOTICONS_PLUS: { type: EmoType; label: string; glyph: string; particle: string }[] = [
  { type: 'rich', label: '부자', glyph: '🤑', particle: '💵' },
  { type: 'cool', label: '여유', glyph: '😎', particle: '✨' },
  { type: 'freeze', label: '오싹', glyph: '🥶', particle: '❄' },
  { type: 'rage', label: '분노', glyph: '🤬', particle: '🔥' },
  { type: 'party', label: '파티', glyph: '🥳', particle: '🎉' },
  { type: 'meh', label: '시큰둥', glyph: '🙄', particle: '…' },
];

const GLYPHS = Object.fromEntries(
  [...EMOTICONS, ...EMOTICONS_PLUS].map((e) => [e.type, e]),
) as Record<EmoType, (typeof EMOTICONS)[number]>;

interface EmoItem {
  id: number;
  seat: number;
  type: EmoType;
}

let eid = 0;

export function EmoticonLayer({
  gs,
  trigger,
  mySeat = 0,
}: {
  gs: GameState;
  trigger: { seat: number; type: EmoType; seq: number } | null;
  mySeat?: number;
}) {
  const [items, setItems] = useState<EmoItem[]>([]);
  const prevSeq = useRef(0);
  const prevPhase = useRef<Phase>(gs.phase);

  const fire = (seat: number, type: EmoType, delay = 0) => {
    setTimeout(() => {
      const id = ++eid;
      setItems((cur) => [...cur.filter((i) => i.seat !== seat), { id, seat, type }]);
      setTimeout(() => setItems((cur) => cur.filter((i) => i.id !== id)), 2300);
    }, delay);
  };

  // 내 이모티콘 (버튼 입력)
  useEffect(() => {
    if (trigger && trigger.seq !== prevSeq.current) {
      prevSeq.current = trigger.seq;
      fire(trigger.seat, trigger.type);
    }
  }, [trigger]);

  // 봇 자동 반응: 쇼다운 결과에 감정 표현 (대사 말풍선이 지나간 뒤에)
  useEffect(() => {
    const was = prevPhase.current;
    prevPhase.current = gs.phase;
    if (gs.phase !== 'showdown' || was === 'showdown') return;

    if (gs.revealed) {
      const bigPot = (gs.results[0]?.amount ?? 0) >= gs.startChips * 0.5;
      gs.results.forEach((r) => {
        const q = gs.players[r.seat];
        if (!q.isBot) return;
        if (r.amount > 0 && Math.random() < 0.55) {
          fire(r.seat, 'joy', 3000 + Math.random() * 400);
        } else if (r.amount === 0 && bigPot && Math.random() < 0.55) {
          fire(r.seat, Math.random() < 0.5 ? 'angry' : 'wow', 3200 + Math.random() * 400);
        }
      });
    } else if (gs.results[0] && gs.players[gs.results[0].seat].isBot && Math.random() < 0.4) {
      fire(gs.results[0].seat, 'thanks', 2400);
    }
  }, [gs]);

  const n = gs.players.length;
  return (
    <div className="fx-layer" aria-hidden="true">
      {items.map((it) => {
        const def = GLYPHS[it.type];
        const falling = it.type === 'sad' || it.type === 'sorry';
        return (
          <div key={it.id} className={`emoticon emo-${it.type}`} style={seatPos(n, it.seat, mySeat)}>
            <span className="emo-main">{def.glyph}</span>
            {[0, 1, 2].map((k) => (
              <span
                key={k}
                className={`emo-part ${falling ? 'emo-part-fall' : ''}`}
                style={{
                  left: `${k * 26 - 26}px`,
                  animationDelay: `${0.15 + k * 0.22}s`,
                }}
              >
                {def.particle}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
