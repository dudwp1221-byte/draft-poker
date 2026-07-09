// 인물 아바타
//  1순위: public/avatars/<id>.png 에 커스텀 일러스트가 있으면 그걸 사용
//  2순위(폴백): Big Heads 코드 생성 상반신 (MIT, README 크레딧 참고)
// 커스텀 일러스트 적용법: 프로젝트의 public/avatars/ 폴더에
//   fox bear rabbit tiger cat panda monkey swan bunny deer (.webp 또는 .png) 10장을 넣으면 끝
// 용량 절약을 위해 webp(512x512, 품질 80) 권장 — squoosh.app에서 변환 가능

import { useState } from 'react';
import { AVATAR_URIS } from './avatarData';

// 기본 10종 + 상점 프리미엄 캐릭터 (이미지 파일만 public/avatars/에 추가하면 동작)
export type AvatarKind = string;

export const ALL_KINDS: AvatarKind[] = ['fox', 'bear', 'rabbit', 'tiger', 'cat', 'panda', 'monkey', 'swan', 'bunny', 'deer'];

// 커스텀 이미지 탐색 순서: webp → png → 코드 생성 폴백 (404난 단계는 기억해서 재시도 안 함)
const EXTS = ['webp', 'png'];
const failStage = new Map<string, number>();

/** 이미지가 아직 없는 프리미엄 캐릭터용 자리표시 (왕관 카드) */
const PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="14" fill="#1d2a5e"/><rect x="4" y="4" width="92" height="92" rx="11" fill="none" stroke="#e8bd5e" stroke-width="3"/><text x="50" y="62" font-size="42" text-anchor="middle">👑</text></svg>`,
  );

export function Avatar({ kind, size = 56 }: { kind: AvatarKind; size?: number }) {
  const [, force] = useState(0);
  const stage = failStage.get(kind) ?? 0;
  const src =
    stage < EXTS.length
      ? `/avatars/${kind}.${EXTS[stage]}`
      : (AVATAR_URIS[kind as keyof typeof AVATAR_URIS] ?? PLACEHOLDER);
  return (
    <img
      src={src}
      onError={() => {
        if (stage < EXTS.length) {
          failStage.set(kind, stage + 1);
          force((x) => x + 1);
        }
      }}
      width={size}
      height={size}
      alt=""
      draggable={false}
      style={{ display: 'block', objectFit: 'cover', width: size, height: size }}
    />
  );
}
