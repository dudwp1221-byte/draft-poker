// 메타 시스템 정의: VIP 등급 · 상점 아이템

export interface VipTier {
  id: number;
  name: string;
  /** 누적 베팅액 기준 */
  minExp: number;
  color: string;
  /** 일일/파산 보너스 배율 */
  bonusMult: number;
  /** 대기실 입장 이펙트 여부 */
  entryFx: boolean;
}

export const VIP_TIERS: VipTier[] = [
  { id: 0, name: '브론즈', minExp: 0, color: '#a07850', bonusMult: 1, entryFx: false },
  { id: 1, name: '실버', minExp: 5_000_000, color: '#b8c4cc', bonusMult: 1.5, entryFx: false },
  { id: 2, name: '골드', minExp: 30_000_000, color: '#e8bd5e', bonusMult: 2, entryFx: true },
  { id: 3, name: '플래티넘', minExp: 150_000_000, color: '#7ee0d6', bonusMult: 3, entryFx: true },
  { id: 4, name: '다이아', minExp: 500_000_000, color: '#9fb7ff', bonusMult: 4, entryFx: true },
];

export function tierOf(exp: number): VipTier {
  let t = VIP_TIERS[0];
  for (const v of VIP_TIERS) if (exp >= v.minExp) t = v;
  return t;
}

export function nextTier(exp: number): VipTier | null {
  return VIP_TIERS.find((v) => v.minExp > exp) ?? null;
}

// ---------------------------------------------------------------------------

export interface ShopItem {
  id: string;
  type: 'frame' | 'cardback' | 'emotepack' | 'pass' | 'gacha' | 'avatarpack';
  category: '골드아바타' | '프리미엄아바타' | '머니뽑기' | '회원제' | '아이템' | '꾸미기';
  name: string;
  desc: string;
  /** 카드에 표시할 아이콘 */
  icon: string;
  priceGold?: number;
  priceGems?: number;
  /** avatarpack: 해금되는 캐릭터 + 지급 골드 */
  avatarKind?: string;
  grantGold?: number;
  /** avatarpack: 캐릭터 컨셉 한 줄 */
  concept?: string;
  /** pass: 일일 보너스 추가 지급량 */
  passDaily?: number;
}

/** 기본 제공 캐릭터 (무료 5종) — 나머지는 상점에서 해금 */
export const FREE_CHARACTERS: { kind: string; name: string }[] = [
  { kind: 'fox', name: '세라' },
  { kind: 'bear', name: '민준' },
  { kind: 'rabbit', name: '서연' },
  { kind: 'panda', name: '지호' },
  { kind: 'monkey', name: '덕배' },
];

/** 프리미엄 캐릭터 (상점 전용 — 이미지: public/avatars/{kind}.webp) */
export const PREMIUM_CHARACTERS: { kind: string; name: string }[] = [
  { kind: 'tiger', name: '도윤' },
  { kind: 'cat', name: '하은' },
  { kind: 'bunny', name: '루나' },
  { kind: 'swan', name: '비비' },
  { kind: 'deer', name: '시온' },
  { kind: 'husky', name: '신참 코디' },
  { kind: 'hamster', name: '보름' },
  { kind: 'chick', name: '하나' },
  { kind: 'redpanda', name: '태수' },
  { kind: 'wolf', name: '갬블러 잭' },
  { kind: 'shark', name: '타짜 타이슨' },
  { kind: 'flamingo', name: '쇼걸 로지' },
  { kind: 'peacock', name: '마담 비올렛' },
  { kind: 'snake', name: '정보상 베라' },
  { kind: 'lion', name: '보스 레오' },
  { kind: 'dragon', name: '전설의 카이' },
  { kind: 'phoenix', name: '불사조 이그니스' },
];

/** 골드 패스: 보유 기간 동안 일일 보너스에 추가 지급 */
export const PASS_DAILY_EXTRA = 200_000;
export const PASS_DAYS = 30;

export const SHOP_ITEMS: ShopItem[] = [
  // ----- 골드 아바타: 골드 판매 캐릭터 (골드 싱크) -----
  { id: 'av-tiger', type: 'avatarpack', category: '골드아바타', icon: '🐯', avatarKind: 'tiger', name: '도윤', concept: '서늘한 눈빛의 호랑이 승부사. 침묵 속에서 판을 읽는다.', desc: '캐릭터 해금', priceGold: 500_000 },
  { id: 'av-cat', type: 'avatarpack', category: '골드아바타', icon: '🐱', avatarKind: 'cat', name: '하은', concept: '변덕스러운 고양이 갬블러. 기분에 따라 베팅이 널뛴다.', desc: '캐릭터 해금', priceGold: 500_000 },
  { id: 'av-bunny', type: 'avatarpack', category: '골드아바타', icon: '🐰', avatarKind: 'bunny', name: '루나', concept: '반짝이는 금발의 바니걸. 귀여운 얼굴로 풀 베팅을 던진다.', desc: '캐릭터 해금', priceGold: 1_000_000 },
  { id: 'av-swan', type: 'avatarpack', category: '골드아바타', icon: '🦢', avatarKind: 'swan', name: '비비', concept: '카지노 무대의 디바 백조. 우아하게 당신의 칩을 가져간다.', desc: '캐릭터 해금', priceGold: 2_000_000 },
  { id: 'av-deer', type: 'avatarpack', category: '골드아바타', icon: '🦌', avatarKind: 'deer', name: '시온', concept: '신비로운 흰 사슴 점술가. 다음 카드를 이미 알고 있는 듯하다.', desc: '캐릭터 해금', priceGold: 3_000_000 },
  // ----- 프리미엄 아바타 (캐릭터 해금 + 골드 번들) — 가격 사다리 순 -----
  { id: 'av-husky', type: 'avatarpack', category: '프리미엄아바타', icon: '🐶', avatarKind: 'husky', grantGold: 1_000_000, name: '신참 코디', concept: '오늘 처음 카지노에 발을 들인 풋내기 허스키. 패기 하나는 최고!', desc: '+100만 골드 · 캐릭터 해금', priceGems: 25 },
  { id: 'av-hamster', type: 'avatarpack', category: '프리미엄아바타', icon: '🐹', avatarKind: 'hamster', grantGold: 1_200_000, name: '보름', concept: '칩을 입에 물고 시치미 떼는 먹보 소녀. 볼이 보름달처럼 빵빵한 날은 의심하라.', desc: '+120만 골드 · 캐릭터 해금', priceGems: 30 },
  { id: 'av-chick', type: 'avatarpack', category: '프리미엄아바타', icon: '🐥', avatarKind: 'chick', grantGold: 1_500_000, name: '하나', concept: '행운의 알 껍질 모자를 쓴 카지노 최연소 갬블러. 말버릇은 삐약.', desc: '+150만 골드 · 캐릭터 해금', priceGems: 35 },
  { id: 'av-redpanda', type: 'avatarpack', category: '프리미엄아바타', icon: '🐾', avatarKind: 'redpanda', grantGold: 2_200_000, name: '태수', concept: '송곳니 미소에 갈퀴 포즈가 트레이드마크인 경상도 허세왕. 도발은 일류, 패는 글쎄.', desc: '+220만 골드 · 캐릭터 해금', priceGems: 50 },
  { id: 'av-wolf', type: 'avatarpack', category: '프리미엄아바타', icon: '🐺', avatarKind: 'wolf', grantGold: 2_500_000, name: '갬블러 잭', concept: '황야에서 흘러들어온 외로운 승부사 늑대. 가죽 재킷이 트레이드마크.', desc: '+250만 골드 · 캐릭터 해금', priceGems: 45 },
  { id: 'av-shark', type: 'avatarpack', category: '프리미엄아바타', icon: '🦈', avatarKind: 'shark', grantGold: 3_500_000, name: '타짜 타이슨', concept: '한 번 물면 절대 놓지 않는 줄무늬 정장의 상어 타짜.', desc: '+350만 골드 · 캐릭터 해금', priceGems: 60 },
  { id: 'av-flamingo', type: 'avatarpack', category: '프리미엄아바타', icon: '🦩', avatarKind: 'flamingo', grantGold: 4_500_000, name: '쇼걸 로지', concept: '라스베가스 무대를 휘어잡던 핑크 플라밍고. 등장만으로 시선 집중.', desc: '+450만 골드 · 캐릭터 해금', priceGems: 75 },
  { id: 'av-peacock', type: 'avatarpack', category: '프리미엄아바타', icon: '🦚', avatarKind: 'peacock', grantGold: 6_000_000, name: '마담 비올렛', concept: 'VIP 라운지의 화려한 안주인. 공작 깃털 부채 뒤로 표정을 숨긴다.', desc: '+600만 골드 · 캐릭터 해금', priceGems: 90 },
  { id: 'av-snake', type: 'avatarpack', category: '프리미엄아바타', icon: '🐍', avatarKind: 'snake', grantGold: 9_000_000, name: '정보상 베라', concept: '카지노의 모든 소문이 모이는 정보 브로커. 혀가 두 갈래라 거짓말도 두 배.', desc: '+900만 골드 · 캐릭터 해금', priceGems: 120 },
  { id: 'av-lion', type: 'avatarpack', category: '프리미엄아바타', icon: '🦁', avatarKind: 'lion', grantGold: 12_000_000, name: '보스 레오', concept: '이 카지노의 소유주. 황금 갈기의 제왕이 직접 테이블에 앉았다.', desc: '+1,200만 골드 · 캐릭터 해금', priceGems: 150 },
  { id: 'av-dragon', type: 'avatarpack', category: '프리미엄아바타', icon: '🐲', avatarKind: 'dragon', grantGold: 30_000_000, name: '전설의 카이', concept: '천 년에 한 번 인간계에 내려오는 동방의 수호룡. 운을 지배한다.', desc: '+3,000만 골드 · 캐릭터 해금', priceGems: 300 },
  { id: 'av-phoenix', type: 'avatarpack', category: '프리미엄아바타', icon: '🔥', avatarKind: 'phoenix', grantGold: 60_000_000, name: '불사조 이그니스', concept: '파산의 잿더미에서 부활하는 불멸의 새. 최후의 올인을 두려워하지 않는다.', desc: '+6,000만 골드 · 캐릭터 해금', priceGems: 500 },
  // ----- 머니뽑기 -----
  { id: 'gacha-rsp', type: 'gacha', category: '머니뽑기', icon: '✌️', name: '행운의 가위바위보', desc: '3만 ~ 최대 30만 골드', priceGems: 3 },
  { id: 'gacha-luck', type: 'gacha', category: '머니뽑기', icon: '🎲', name: '럭키 주사위', desc: '5만 ~ 최대 100만 골드', priceGems: 5 },
  { id: 'gacha-joker', type: 'gacha', category: '머니뽑기', icon: '🃏', name: '조커 잡기', desc: '10만 ~ 최대 300만 골드', priceGems: 10 },
  { id: 'gacha-mega', type: 'gacha', category: '머니뽑기', icon: '🔮', name: '메가스톤 드로우', desc: '20만 ~ 최대 1,000만 골드', priceGems: 20 },
  { id: 'gacha-cleo', type: 'gacha', category: '머니뽑기', icon: '🏺', name: '클레오 캐치', desc: '50만 ~ 최대 3,000만 골드', priceGems: 50 },
  // ----- 회원제 -----
  {
    id: 'pass-30',
    type: 'pass',
    category: '회원제',
    icon: '⭐',
    passDaily: PASS_DAILY_EXTRA,
    name: `골드 패스 (${PASS_DAYS}일)`,
    desc: `${PASS_DAYS}일간 일일 보너스 +${PASS_DAILY_EXTRA / 10000}만 추가 · 재구매 연장`,
    priceGems: 60,
  },
  {
    id: 'pass-plat',
    type: 'pass',
    category: '회원제',
    icon: '💠',
    passDaily: 500_000,
    name: `플래티넘 패스 (${PASS_DAYS}일)`,
    desc: `${PASS_DAYS}일간 일일 보너스 +50만 추가 · 재구매 연장`,
    priceGems: 150,
  },
  // ----- 아이템 -----
  { id: 'emote-plus', type: 'emotepack', category: '아이템', icon: '🤑', name: '이모티콘 확장팩', desc: '도발 이모티콘 6종 추가', priceGems: 40 },
  // ----- 꾸미기 -----
  { id: 'cb-gold', type: 'cardback', category: '꾸미기', icon: '🂠', name: '골드 카드백', desc: '카드 뒷면이 황금 문양으로', priceGold: 1_000_000 },
  { id: 'cb-midnight', type: 'cardback', category: '꾸미기', icon: '🌌', name: '미드나잇 카드백', desc: '깊은 밤하늘 카드 뒷면', priceGold: 1_000_000 },
  { id: 'cb-royal', type: 'cardback', category: '꾸미기', icon: '🎴', name: '로열 레드 카드백', desc: '벨벳 레드 카드 뒷면', priceGold: 1_000_000 },
  { id: 'cb-cherry', type: 'cardback', category: '꾸미기', icon: '🌸', name: '벚꽃 카드백', desc: '분홍 벚꽃잎 카드 뒷면', priceGold: 2_000_000 },
  { id: 'cb-neon', type: 'cardback', category: '꾸미기', icon: '🌃', name: '네온 카드백', desc: '사이버 네온 카드 뒷면', priceGold: 2_000_000 },
  { id: 'cb-emerald', type: 'cardback', category: '꾸미기', icon: '💚', name: '에메랄드 카드백', desc: '보석 에메랄드 카드 뒷면', priceGold: 2_000_000 },
];

/** 뽑기 확률표: [확률, 최소, 최대] — 합 1.0 */
export const GACHA_TABLES: Record<string, [number, number, number][]> = {
  'gacha-rsp': [
    [0.6, 30_000, 80_000],
    [0.3, 80_000, 150_000],
    [0.1, 150_000, 300_000],
  ],
  'gacha-joker': [
    [0.5, 100_000, 300_000],
    [0.3, 300_000, 800_000],
    [0.15, 800_000, 1_500_000],
    [0.05, 1_500_000, 3_000_000],
  ],
  'gacha-cleo': [
    [0.5, 500_000, 1_500_000],
    [0.3, 1_500_000, 5_000_000],
    [0.15, 5_000_000, 15_000_000],
    [0.05, 15_000_000, 30_000_000],
  ],
  'gacha-luck': [
    [0.5, 50_000, 150_000],
    [0.3, 150_000, 350_000],
    [0.15, 350_000, 650_000],
    [0.05, 650_000, 1_000_000],
  ],
  'gacha-mega': [
    [0.5, 200_000, 700_000],
    [0.3, 700_000, 2_000_000],
    [0.15, 2_000_000, 5_000_000],
    [0.05, 5_000_000, 10_000_000],
  ],
};

export function rollGacha(id: string): number {
  const table = GACHA_TABLES[id];
  if (!table) return 0;
  let r = Math.random();
  for (const [p, min, max] of table) {
    if (r < p) {
      const v = min + Math.random() * (max - min);
      return Math.floor(v / 10000) * 10000; // 만 단위 절사
    }
    r -= p;
  }
  const [, min] = table[0];
  return min;
}

export const GEM_REWARDS = {
  daily: 2, // 일일 보너스에 포함 (VIP 배율 적용)
  quads: 5, // 포카드 승리
  stflush: 20, // 스트레이트 플러시 승리
  streak10: 10, // 10연승 달성
};
