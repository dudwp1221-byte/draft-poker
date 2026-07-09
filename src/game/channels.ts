// 채널(스테이크) 정의 — 보유 머니가 입장비보다 적으면 입장 불가

export interface Channel {
  id: string;
  name: string;
  ante: number;
  buyin: number;
  color: string;
}

export const CHANNELS: Channel[] = [
  { id: 'rookie', name: '초보 채널', ante: 1000, buyin: 100000, color: '#3E8E5A' },
  { id: 'normal', name: '일반 채널', ante: 5000, buyin: 500000, color: '#4A7BD0' },
  { id: 'expert', name: '고수 채널', ante: 20000, buyin: 2000000, color: '#7E5FC0' },
  { id: 'vip', name: 'VIP 채널', ante: 100000, buyin: 10000000, color: '#D9A53E' },
];

export const BANKRUPT_BONUS = 500_000;

export const DAILY_BONUS = 100_000;
