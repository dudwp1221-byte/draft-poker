// 게임 방법(튜토리얼) — 실제 카드 그래픽으로 보여주는 시각형 안내
import { useState } from 'react';
import type { Card } from '../game/deck';
import { CardView } from './CardView';

const c = (rank: number, suit: Card['suit']): Card => ({ rank, suit });

// 각 단계: 짧은 설명 + 카드/버튼 시각 데모
const STEPS: { icon: string; title: string; caption: string; visual: 'hand' | 'draft' | 'bet' | 'showdown' }[] = [
  {
    icon: '🃏',
    title: '드래프트 포커란?',
    caption: '홀덤과 똑같은 족보로, 가장 높은 5장으로 승부해요. 아래는 "플러시(같은 무늬 5장)" 예시.',
    visual: 'hand',
  },
  {
    icon: '🔄',
    title: '① 드래프트 — 골라서 옆으로',
    caption: '받은 뭉치에서 1장만 골라 내 손패에 넣고, 나머지는 옆 사람에게 넘겨요. 매 판 방향은 랜덤!',
    visual: 'draft',
  },
  {
    icon: '💰',
    title: '② 베팅 — 3구간, 15초',
    caption: '삥=최소 · 쿼터=팟¼ · 하프=팟½ · 풀=팟전액 / 다이=폴드 · 콜=받기 · 따당=2배. 콜 뒤엔 콜·다이만.',
    visual: 'bet',
  },
  {
    icon: '🏆',
    title: '③ 쇼다운 — 승부!',
    caption: '남은 사람끼리 5장 족보로 비교. 높은 쪽이 이기고 다음 판 "선"이 됩니다.',
    visual: 'showdown',
  },
];

function Visual({ kind }: { kind: string }) {
  if (kind === 'hand') {
    const hand = [c(14, 's'), c(11, 's'), c(9, 's'), c(6, 's'), c(3, 's')];
    return (
      <div className="tut-cards">
        {hand.map((card, i) => (
          <CardView key={i} card={card} size="sm" highlight />
        ))}
      </div>
    );
  }
  if (kind === 'draft') {
    const packet = [c(7, 'h'), c(13, 's'), c(2, 'c'), c(10, 'd')];
    return (
      <div className="tut-draft">
        <div className="tut-cards">
          {packet.map((card, i) => (
            <CardView key={i} card={card} size="sm" highlight={i === 1} dimmed={i !== 1} />
          ))}
        </div>
        <div className="tut-draft-legend">
          <span className="tut-pick">✋ 1장 선택</span>
          <span className="tut-pass">나머지 → 옆으로 패스 ➡️</span>
        </div>
      </div>
    );
  }
  if (kind === 'bet') {
    return (
      <div className="tut-bet">
        <div className="tut-pot">💰 팟</div>
        <div className="bet-bar tut-bet-bar">
          <span className="hgbtn hgbtn-die">다이</span>
          <span className="hgbtn hgbtn-call">콜</span>
          <span className="hgbtn hgbtn-ping">삥/따당</span>
          <span className="hgbtn hgbtn-half">쿼터·하프</span>
          <span className="hgbtn hgbtn-allin">풀</span>
        </div>
      </div>
    );
  }
  // showdown
  const mine = [c(14, 'd'), c(14, 's'), c(10, 'c'), c(7, 'h'), c(4, 's')]; // 원페어(A) — 예시 승
  const opp = [c(13, 'h'), c(9, 'd'), c(9, 's'), c(5, 'c'), c(2, 'h')]; // 원페어(9)
  return (
    <div className="tut-show">
      <div className="tut-show-row win">
        <span className="tut-show-tag">🏆 나 · 페어 A</span>
        <div className="tut-cards">
          {mine.map((card, i) => (
            <CardView key={i} card={card} size="sm" highlight={card.rank === 14} />
          ))}
        </div>
      </div>
      <div className="tut-show-row lose">
        <span className="tut-show-tag">상대 · 페어 9</span>
        <div className="tut-cards">
          {opp.map((card, i) => (
            <CardView key={i} card={card} size="sm" dimmed />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <div className="tut-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="tut-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="tut-close" onClick={onClose} aria-label="닫기">
          ✕
        </button>
        <div className="tut-head">
          <span className="tut-icon-sm">{step.icon}</span>
          <h2 className="tut-title">{step.title}</h2>
        </div>

        <div className="tut-stage">
          <Visual kind={step.visual} />
        </div>

        <p className="tut-caption">{step.caption}</p>

        <div className="tut-dots">
          {STEPS.map((_, k) => (
            <span key={k} className={k === i ? 'on' : ''} />
          ))}
        </div>
        <div className="tut-actions">
          {i > 0 && (
            <button type="button" className="hg-btn-gray" onClick={() => setI(i - 1)}>
              ← 이전
            </button>
          )}
          {last ? (
            <button type="button" className="hg-btn-yellow" onClick={onClose}>
              시작하기!
            </button>
          ) : (
            <button type="button" className="hg-btn-blue" onClick={() => setI(i + 1)}>
              다음 →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
