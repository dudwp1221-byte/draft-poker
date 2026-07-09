// 캐릭터 아바타 사전 생성 — Big Heads (MIT) 상반신 일러스트
// 사용법: npm run gen:avatars  (props를 바꾸고 다시 돌리면 외형이 바뀜)
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BigHead } from '@bigheads/core';
import { writeFileSync } from 'node:fs';

// 캐릭터 성격에 맞춘 외형 설정
const LOOKS: Record<string, Record<string, unknown>> = {
  // 세라 — 능글맞은 타짜: 윙크, 긴 머리, 블랙 드레스셔츠
  fox: {
    body: 'breasts', skinTone: 'light', hair: 'long', hairColor: 'orange',
    eyes: 'wink', eyebrows: 'raised', mouth: 'grin', lashes: true, lipColor: 'red',
    clothing: 'dressShirt', clothingColor: 'black', accessory: 'none',
    facialHair: 'none', hat: 'none', graphic: 'none',
  },
  // 민준 — 과묵한 큰손: 수염, 진지한 입, 네이비 셔츠
  bear: {
    body: 'chest', skinTone: 'brown', hair: 'buzz', hairColor: 'black',
    eyes: 'simple', eyebrows: 'serious', mouth: 'serious', lashes: false,
    clothing: 'dressShirt', clothingColor: 'blue', accessory: 'none',
    facialHair: 'mediumBeard', hat: 'none', graphic: 'none',
  },
  // 서연 — 하이텐션: 활짝 웃는 입, 픽시컷, 레드 티셔츠
  rabbit: {
    body: 'breasts', skinTone: 'light', hair: 'pixie', hairColor: 'brown',
    eyes: 'happy', eyebrows: 'raised', mouth: 'openSmile', lashes: true, lipColor: 'pink',
    clothing: 'shirt', clothingColor: 'red', accessory: 'none',
    facialHair: 'none', hat: 'none', graphic: 'none',
  },
  // 도윤 — 허세 가득한 왕: 선글라스, 올백 느낌, 블랙 셔츠
  tiger: {
    body: 'chest', skinTone: 'yellow', hair: 'short', hairColor: 'black',
    eyes: 'normal', eyebrows: 'angry', mouth: 'grin', lashes: false,
    clothing: 'dressShirt', clothingColor: 'black', accessory: 'shades',
    facialHair: 'none', hat: 'none', graphic: 'none',
  },
  // 하은 — 시크 도도: 단발, 무표정, 화이트 브이넥
  cat: {
    body: 'breasts', skinTone: 'light', hair: 'bob', hairColor: 'black',
    eyes: 'content', eyebrows: 'leftLowered', mouth: 'serious', lashes: true, lipColor: 'purple',
    clothing: 'vneck', clothingColor: 'white', accessory: 'none',
    facialHair: 'none', hat: 'none', graphic: 'none',
  },
  // 지호 — 느긋한 먹보: 비니, 게슴츠레한 눈, 그린 티셔츠
  panda: {
    body: 'chest', skinTone: 'light', hair: 'short', hairColor: 'brown',
    eyes: 'squint', eyebrows: 'raised', mouth: 'openSmile', lashes: false,
    clothing: 'shirt', clothingColor: 'green', accessory: 'none',
    facialHair: 'none', hat: 'beanie', hatColor: 'green', graphic: 'none',
  },
  // 덕배 — 개그캐: 혀 내민 표정, 빨간 탱크탑
  monkey: {
    body: 'chest', skinTone: 'yellow', hair: 'afro', hairColor: 'brown',
    eyes: 'squint', eyebrows: 'concerned', mouth: 'tongue', lashes: false,
    clothing: 'tankTop', clothingColor: 'red', accessory: 'none',
    facialHair: 'none', hat: 'none', graphic: 'none',
  },
  // 비비 — 글램: 금발 롱헤어, 레드 드레스
  swan: {
    body: 'breasts', skinTone: 'light', hair: 'long', hairColor: 'blonde',
    eyes: 'content', eyebrows: 'raised', mouth: 'lips', lashes: true, lipColor: 'red',
    clothing: 'dress', clothingColor: 'red', accessory: 'none',
    facialHair: 'none', hat: 'none', graphic: 'none',
  },
  // 루나 — 바니걸: 핑크 헤어, 블랙 드레스
  bunny: {
    body: 'breasts', skinTone: 'light', hair: 'bun', hairColor: 'pink',
    eyes: 'happy', eyebrows: 'raised', mouth: 'openSmile', lashes: true, lipColor: 'pink',
    clothing: 'dress', clothingColor: 'black', accessory: 'none',
    facialHair: 'none', hat: 'none', graphic: 'none',
  },
  // 시온 — 동안 미소년 성인: 금발, 화이트 셔츠
  deer: {
    body: 'chest', skinTone: 'light', hair: 'short', hairColor: 'blonde',
    eyes: 'happy', eyebrows: 'raised', mouth: 'openSmile', lashes: false,
    clothing: 'shirt', clothingColor: 'white', accessory: 'none',
    facialHair: 'none', hat: 'none', graphic: 'none',
  },
};

const entries = Object.entries(LOOKS).map(([kind, props]) => {
  const svg = renderToStaticMarkup(createElement(BigHead, props));
  const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  return `  ${kind}: '${uri}',`;
});

const out = `// 자동 생성 파일 — scripts/gen-avatars.ts 로 재생성
// Big Heads (https://bigheads.io) by Robert Cooper — MIT License

export const AVATAR_URIS: Record<string, string> = {
${entries.join('\n')}
};
`;

writeFileSync(new URL('../src/ui/avatarData.ts', import.meta.url), out);
console.log('src/ui/avatarData.ts generated (Big Heads)');
