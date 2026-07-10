// 게임 방법(튜토리얼) — 드래프트를 직접 해보는 인터랙티브 데모 + 압축된 요약
import { useState } from 'react';
import type { Card } from '../game/deck';
import { CardView } from './CardView';

const c = (rank: number, suit: Card['suit']): Card => ({ rank, suit });

// 드래프트 체험: 뭉치에서 카드를 눌러 손패를 모아본다
function InteractiveDraft() {
  const PACKETS: Card[][] = [
    [c(14, 's'), c(7, 'd'), c(3, 'c'), c(9, 's')],
    [c(13, 's'), c(5, 'h'), c(2, 'd')],
    [c(12, 's'), c(8, 'c')],
  ];
  const [hand, setHand] = useState<Card[]>([]);
  const [round, setRound] = useState(0);
  const done = round >= PACKETS.length;
  const isLast = round === PACKETS.length - 1;
  const pick = (idx: number) => {
    setHand((h) => [...h, PACKETS[round][idx]]);
    setRound((r) => r + 1);
  };
  const reset = () => {
    setHand([]);
    setRound(0);
  };
  return (
    <div className="tut-play">
      <div className="tut-play-hand">
        <span className="tut-play-label">내 손패{hand.length > 0 ? ` · ${hand.length}장` : ''}</span>
        <div className="tut-cards">
          {hand.length === 0 ? (
            <span className="tut-play-empty">아직 없음 — 아래 뭉치에서 골라보세요 👇</span>
          ) : (
            hand.map((card, i) => <CardView key={i} card={card} size="sm" highlight />)
          )}
        </div>
      </div>

      {!done ? (
        <div className="tut-play-packet">
          <span className="tut-play-label pass">
            받은 뭉치 · 1장 선택 {isLast ? '(마지막! 남은 1장은 버려져요)' : '→ 나머지는 옆으로 패스 ➡️'}
          </span>
          <div className="tut-cards">
            {PACKETS[round].map((card, i) => (
              <CardView key={i} card={card} size="sm" onClick={() => pick(i)} />
            ))}
          </div>
        </div>
      ) : (
        <div className="tut-play-done">
          🎉 이렇게 1장씩 골라 손패를 완성해요!
          <button type="button" className="hg-btn-gray tut-replay" onClick={reset}>
            다시 해보기 ↺
          </button>
        </div>
      )}
    </div>
  );
}

type VisualKind = 'hand' | 'draftplay' | 'bet' | 'showdown';

const STEPS: { icon: string; title: string; caption: string; visual: VisualKind }[] = [
  {
    icon: '🃏',
    title: '드래프트 포커란?',
    caption: '홀덤과 똑같은 족보로, 가장 높은 5장을 만들어 승부해요. (원페어 ~ 로열 플러시 순위 동일)',
    visual: 'hand',
  },
  {
    icon: '🔄',
    title: '핵심! 골라서 모으기',
    caption: '뭉치에서 카드를 눌러 1장씩 골라 손패를 만들어요. 나머지는 옆으로 패스(방향은 매 판 랜덤)! 직접 해보세요 👇',
    visual: 'draftplay',
  },
  {
    icon: '💰',
    title: '베팅 — 3구간 · 15초',
    caption: '각 구간 끝에 베팅. 삥=최소·쿼터=¼·하프=½·풀=전액 / 다이=폴드·콜=받기·따당=2배. 콜 뒤엔 콜·다이만, 15초 넘기면 자동 다이.',
    visual: 'bet',
  },
  {
    icon: '🏆',
    title: '쇼다운 & 시작!',
    caption: '남은 사람끼리 높은 5장 족보로 승부! "혼자연습"으로 봇과 해보고, 칩 떨어지면 리바이. (게임 시작엔 4인 이상)',
    visual: 'showdown',
  },
];

function Visual({ kind }: { kind: VisualKind }) {
  if (kind === 'hand') {
    const hand = [c(14, 's'), c(13, 's'), c(9, 's'), c(6, 's'), c(3, 's')];
    return (
      <div className="tut-cards">
        {hand.map((card, i) => (
          <CardView key={i} card={card} size="sm" highlight />
        ))}
      </div>
    );
  }
  if (kind === 'draftplay') {
    return <InteractiveDraft />;
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
  const mine = [c(14, 'd'), c(14, 's'), c(10, 'c'), c(7, 'h'), c(4, 's')];
  const opp = [c(13, 'h'), c(9, 'd'), c(9, 's'), c(5, 'c'), c(2, 'h')];
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
          <span className="tut-step-count">
            {i + 1}/{STEPS.length}
          </span>
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
