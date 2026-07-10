// 게임 방법(튜토리얼) — 실제 카드 그래픽으로 보여주는 시각형 안내 (확장판)
import { useState } from 'react';
import type { Card } from '../game/deck';
import { CardView } from './CardView';

const c = (rank: number, suit: Card['suit']): Card => ({ rank, suit });

type VisualKind = 'hand' | 'ranks' | 'draft' | 'lastpick' | 'segments' | 'bet' | 'showdown' | 'start';

const STEPS: { icon: string; title: string; caption: string; visual: VisualKind }[] = [
  {
    icon: '🃏',
    title: '드래프트 포커란?',
    caption: '홀덤과 똑같은 족보로, 가장 높은 5장을 만들어 승부해요. 아래는 "플러시(같은 무늬 5장)".',
    visual: 'hand',
  },
  {
    icon: '🏅',
    title: '족보는 홀덤과 동일',
    caption: '원페어 ~ 로열 플러시까지 순위가 똑같아요. 새로 외울 건 없어요!',
    visual: 'ranks',
  },
  {
    icon: '🔄',
    title: '① 드래프트 — 골라서 옆으로',
    caption: '받은 뭉치에서 1장만 골라 손패에 넣고, 나머지는 옆 사람에게 넘겨요. 방향은 매 판 랜덤!',
    visual: 'draft',
  },
  {
    icon: '🎯',
    title: '② 마지막 픽 — 2장 중 1장',
    caption: '마지막엔 남은 2장 중 1장만 손패에 넣고, 1장은 비공개로 버려요.',
    visual: 'lastpick',
  },
  {
    icon: '⏱️',
    title: '③ 베팅 — 3구간 · 각 15초',
    caption: '드래프트를 3구간으로 나눠, 각 구간이 끝날 때마다 베팅해요. 시간 넘기면 자동 다이!',
    visual: 'segments',
  },
  {
    icon: '💰',
    title: '④ 베팅 용어',
    caption: '삥=최소 · 쿼터=팟¼ · 하프=팟½ · 풀=팟전액 / 다이=폴드 · 콜=받기 · 따당=2배. 콜 뒤엔 콜·다이만!',
    visual: 'bet',
  },
  {
    icon: '🏆',
    title: '⑤ 쇼다운 — 승부!',
    caption: '남은 사람끼리 5장 족보로 비교. 높은 쪽이 이기고 다음 판 "선"이 됩니다.',
    visual: 'showdown',
  },
  {
    icon: '🚀',
    title: '이제 시작해볼까요?',
    caption: '규칙은 여기까지! 먼저 봇과 연습해보고, 칩이 떨어지면 리바이로 다시 채울 수 있어요.',
    visual: 'start',
  },
];

function Row({ cards, highlightAll = false }: { cards: Card[]; highlightAll?: boolean }) {
  return (
    <div className="tut-cards">
      {cards.map((card, i) => (
        <CardView key={i} card={card} size="sm" highlight={highlightAll} />
      ))}
    </div>
  );
}

function Visual({ kind }: { kind: VisualKind }) {
  if (kind === 'hand') {
    return <Row cards={[c(14, 's'), c(13, 's'), c(9, 's'), c(6, 's'), c(3, 's')]} highlightAll />;
  }
  if (kind === 'ranks') {
    const rows: { label: string; cards: Card[] }[] = [
      { label: '스트레이트 플러시', cards: [c(9, 'h'), c(10, 'h'), c(11, 'h'), c(12, 'h'), c(13, 'h')] },
      { label: '플러시', cards: [c(14, 's'), c(12, 's'), c(8, 's'), c(5, 's'), c(2, 's')] },
      { label: '스트레이트', cards: [c(5, 'c'), c(6, 'd'), c(7, 's'), c(8, 'h'), c(9, 'c')] },
    ];
    return (
      <div className="tut-ranks">
        {rows.map((r) => (
          <div className="tut-rank-row" key={r.label}>
            <span className="tut-rank-label">{r.label}</span>
            <div className="tut-cards">
              {r.cards.map((card, i) => (
                <CardView key={i} card={card} size="sm" />
              ))}
            </div>
          </div>
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
  if (kind === 'lastpick') {
    return (
      <div className="tut-draft">
        <div className="tut-cards">
          <CardView card={c(14, 'h')} size="sm" highlight />
          <CardView card={c(2, 'c')} size="sm" dimmed />
        </div>
        <div className="tut-draft-legend">
          <span className="tut-pick">✓ 선택</span>
          <span className="tut-pass">✕ 버림</span>
        </div>
      </div>
    );
  }
  if (kind === 'segments') {
    return (
      <div className="tut-bet">
        <div className="tut-seg">
          <span className="tut-seg-block">1구간</span>
          <span className="tut-seg-arrow">→ 💰</span>
          <span className="tut-seg-block">2구간</span>
          <span className="tut-seg-arrow">→ 💰</span>
          <span className="tut-seg-block">3구간</span>
          <span className="tut-seg-arrow">→ 💰</span>
        </div>
        <div className="tut-pot">각 구간 끝에 베팅 · ⏱️ 15초</div>
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
  if (kind === 'showdown') {
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
  // start
  return (
    <div className="tut-tips">
      <div className="tut-tip">🤖 <strong>혼자연습</strong> — 봇과 부담 없이 연습</div>
      <div className="tut-tip">💵 <strong>리바이</strong> — 칩이 떨어지면 다시 충전</div>
      <div className="tut-tip">👥 <strong>4인 이상</strong> — 게임 시작에 필요</div>
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
