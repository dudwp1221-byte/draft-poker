// 게임 방법(튜토리얼) 모달 — 일반 포커만 아는 사람을 위한 드래프트 포커 규칙 안내
import { useState } from 'react';

const STEPS: { icon: string; title: string; body: string[] }[] = [
  {
    icon: '🃏',
    title: '드래프트 포커란?',
    body: [
      '일반 포커처럼 "가장 높은 5장 족보"로 승부해요.',
      '하지만 카드를 받는 방식이 다릅니다 — 카드 뭉치에서 원하는 카드를 직접',
      '골라 내 손패를 만들어가는 "드래프트" 방식이에요.',
      '홀덤 족보(원페어 ~ 로열 플러시)를 그대로 쓰니 족보만 알면 금방 익숙해집니다.',
    ],
  },
  {
    icon: '🔄',
    title: '① 드래프트 — 카드 고르기',
    body: [
      '각자 카드 뭉치를 받습니다. 그중 1장을 골라 손패에 넣고,',
      '남은 뭉치는 옆 사람에게 넘겨요(패스). 넘겨받은 뭉치에서 또 1장을 고르고…',
      '이렇게 돌아가며 손패를 모읍니다. 패스 방향(시계/반시계)은 매 판 랜덤!',
      '마지막 픽은 남은 2장 중 1장만 선택하고 1장은 버립니다.',
    ],
  },
  {
    icon: '💰',
    title: '② 베팅 — 3번의 베팅 구간',
    body: [
      '드래프트를 3구간으로 나눠, 각 구간이 끝날 때마다 베팅해요.',
      '한게임식 용어를 씁니다:',
      '• 삥 = 최소 베팅 · 쿼터 = 팟의 1/4 · 하프 = 팟의 1/2 · 풀 = 팟 전액',
      '• 다이 = 폴드(포기) · 콜 = 받기 · 따당 = 상대 벳의 2배로 올리기',
      '체크는 없어요 — 선은 무조건 베팅합니다. 콜 뒤에는 리레이즈 금지(콜/다이만).',
      '제한 시간: 베팅 15초 · 드래프트 픽 20초 (넘기면 자동 처리).',
    ],
  },
  {
    icon: '🏆',
    title: '③ 쇼다운 — 승부',
    body: [
      '마지막 베팅까지 끝나면 손패를 공개해 가장 높은 5장 족보로 겨룹니다.',
      '홀덤과 동일한 족보 순위를 사용하고, 사이드팟도 지원해요.',
      '이긴 사람이 다음 판의 "선(딜러)"이 됩니다.',
      '이제 규칙을 익혔으니, 방을 만들거나 "혼자연습"으로 봇과 연습해보세요!',
    ],
  },
];

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
        <div className="tut-icon">{step.icon}</div>
        <h2 className="tut-title">{step.title}</h2>
        <div className="tut-body">
          {step.body.map((line, k) => (
            <p key={k}>{line}</p>
          ))}
        </div>
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
