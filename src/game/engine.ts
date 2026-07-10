import type { Card } from './deck';
import { makeDeck, shuffle, cardLabel } from './deck';
import { bestHand, CAT_NAMES, type HandEval } from './handEval';
import { formatMoney } from './format';

export type Phase = 'idle' | 'draft' | 'betting' | 'showdown' | 'gameover';

export interface PlayerState {
  seat: number;
  name: string;
  /** 캐릭터 아바타 종류 (코스메틱) */
  avatar: string;
  isBot: boolean;
  chips: number;
  /** 칩이 없어 이번 핸드에 참가하지 못함 */
  out: boolean;
  folded: boolean;
  allIn: boolean;
  hand: Card[];
  /** 현재 들고 있는 드래프트 뭉치 (null = 없음/폐기됨) */
  packet: Card[] | null;
  /** 현재 뭉치를 처음 들었던 좌석 (공개 정보 — 누구나 추적 가능) */
  packetOrigin: number | null;
  /** 현재 뭉치를 나에게 넘긴 좌석 (null = 내가 처음 받은 뭉치) */
  packetFrom: number | null;
  /** 이번 픽에서 고른 카드의 packet 내 인덱스 (null = 아직 안 골랐음) */
  pendingPick: number | null;
  /** 이번 베팅 라운드에 낸 금액 */
  betThisRound: number;
  /** 이번 핸드에 낸 총액 (앤티 포함, 사이드팟 계산용) */
  totalBet: number;
  /** 이번 베팅 라운드에서 액션을 마쳤는지 */
  acted: boolean;
  /** 한국 룰: 이번 라운드에 콜을 한 적 있음 → 리레이즈 금지 */
  roundCapped: boolean;
  /** 연승 횟수 (핸드 승리 시 +1, 패배 시 0) */
  winStreak: number;
  /** 장착한 프로필 테두리 (코스메틱) */
  frame: string;
  /** VIP 등급 인덱스 (코스메틱 표시용) */
  vip: number;
}

export type BetAction =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'raise'; to: number }; // to = 이번 라운드 본인 총 베팅 목표액 (벳/레이즈/올인 공용)

export interface ShowdownResult {
  seat: number;
  amount: number;
  handName: string;
  best5: Card[];
}

export interface GameState {
  players: PlayerState[];
  startChips: number;
  phase: Phase;
  handNumber: number;
  dealer: number;
  nextDealer: number;
  /** +1 = 좌석 번호 증가 방향으로 패스, -1 = 감소 방향 */
  direction: 1 | -1;
  ante: number;
  /** 팟 수수료율 */
  rake: number;
  /** 지금까지 시스템이 가져간 수수료 누계 */
  rakeTotal: number;
  pot: number;
  handSize: number;
  totalPicks: number;
  /** 이 픽 수가 끝난 직후 베팅 라운드 시작 */
  checkpoints: number[];
  draftStep: number;
  currentBet: number;
  toAct: number | null;
  /** 쇼다운 공개 여부 (전원 폴드 승리는 비공개) */
  revealed: boolean;
  /** 말풍선 연출용: 마지막 베팅 액션 */
  actionSeq: number;
  lastAction: { seat: number; text: string } | null;
  results: ShowdownResult[];
  log: string[];
}

/** 팟 수수료율 (시스템이 가져가는 비율) — 머니 인플레 방지 */
export const DEFAULT_RAKE = 0.05;

export interface GameConfig {
  names: string[];
  botFlags: boolean[];
  startChips: number;
  ante: number;
  /** 팟 수수료율 (기본 5%) */
  rake?: number;
  /** 좌석별 프로필 테두리 (코스메틱) */
  frames?: string[];
  /** 좌석별 VIP 등급 (코스메틱) */
  vips?: number[];
  /** 좌석별 캐릭터 (생략 시 기본 순서) */
  avatars?: string[];
}

function pushLog(gs: GameState, msg: string) {
  gs.log.push(msg);
  if (gs.log.length > 120) gs.log.splice(0, gs.log.length - 120);
}

export function createGame(cfg: GameConfig): GameState {
  const DEFAULT_AVATARS = ['fox', 'bear', 'rabbit', 'tiger', 'cat', 'panda', 'monkey', 'swan', 'bunny', 'deer'];
  const players: PlayerState[] = cfg.names.map((name, seat) => ({
    seat,
    name,
    avatar: cfg.avatars?.[seat] ?? DEFAULT_AVATARS[seat % DEFAULT_AVATARS.length],
    isBot: cfg.botFlags[seat],
    chips: cfg.startChips,
    out: false,
    folded: false,
    allIn: false,
    hand: [],
    packet: null,
    packetOrigin: null,
    packetFrom: null,
    pendingPick: null,
    betThisRound: 0,
    totalBet: 0,
    acted: false,
    roundCapped: false,
    winStreak: 0,
    frame: cfg.frames?.[seat] ?? '',
    vip: cfg.vips?.[seat] ?? 0,
  }));
  return {
    players,
    startChips: cfg.startChips,
    phase: 'idle',
    handNumber: 0,
    dealer: 0,
    nextDealer: Math.floor(Math.random() * players.length),
    direction: 1,
    ante: cfg.ante,
    rake: cfg.rake ?? DEFAULT_RAKE,
    rakeTotal: 0,
    pot: 0,
    handSize: 0,
    totalPicks: 0,
    checkpoints: [],
    draftStep: 0,
    currentBet: 0,
    toAct: null,
    revealed: false,
    actionSeq: 0,
    lastAction: null,
    results: [],
    log: [],
  };
}

/** 이번 핸드에 살아있는(폴드 안 한, 참가 중인) 좌석들 — 좌석 번호 오름차순 */
function activeSeats(gs: GameState): number[] {
  return gs.players.filter((p) => !p.out && !p.folded).map((p) => p.seat);
}

/** 베팅 액션이 가능한 좌석 (올인 제외) */
function canActSeat(gs: GameState, seat: number): boolean {
  const p = gs.players[seat];
  return !p.out && !p.folded && !p.allIn && p.chips > 0;
}

function nextSeatFrom(gs: GameState, from: number, pred: (s: number) => boolean): number | null {
  const n = gs.players.length;
  for (let i = 1; i <= n; i++) {
    const s = (from + i) % n;
    if (pred(s)) return s;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 핸드 시작
// ---------------------------------------------------------------------------

export function startHand(gs: GameState): void {
  // 칩 없는 플레이어 정리
  for (const p of gs.players) p.out = p.chips <= 0;
  const alive = gs.players.filter((p) => !p.out);
  if (alive.length < 2) {
    gs.phase = 'gameover';
    pushLog(gs, `🏆 ${alive[0]?.name ?? '?'} 최종 승리!`);
    return;
  }

  gs.handNumber += 1;
  gs.pot = 0;
  gs.revealed = false;
  gs.results = [];
  gs.draftStep = 0;
  gs.currentBet = 0;
  gs.toAct = null;

  // 선: 직전 승자 (게임에서 빠졌으면 다음 생존 좌석)
  gs.dealer = !gs.players[gs.nextDealer].out
    ? gs.nextDealer
    : nextSeatFrom(gs, gs.nextDealer, (s) => !gs.players[s].out)!;

  // 패스 방향: 매판 랜덤
  gs.direction = Math.random() < 0.5 ? 1 : -1;

  const n = alive.length;
  gs.handSize = Math.max(5, n + 1); // 3인일 때 5장 보장 (룰 a안)
  gs.totalPicks = gs.handSize;
  const packetSize = gs.handSize + 1;

  // 베팅 체크포인트: 픽을 3구간으로 나눠 각 구간 끝에 베팅
  const h = gs.totalPicks;
  const c1 = Math.ceil(h / 3);
  const c2 = c1 + Math.ceil((h - c1) / 2);
  gs.checkpoints = [...new Set([c1, c2, h])];

  // 덱 셔플 & 뭉치 배분
  const deck = shuffle(makeDeck());
  for (const p of gs.players) {
    p.folded = false;
    p.allIn = false;
    p.hand = [];
    p.packet = null;
    p.packetOrigin = null;
    p.packetFrom = null;
    p.pendingPick = null;
    p.betThisRound = 0;
    p.totalBet = 0;
    p.acted = false;
    p.roundCapped = false;
  }
  for (const p of alive) {
    p.packet = deck.splice(0, packetSize);
    p.packetOrigin = p.seat;
    p.packetFrom = null;
  }

  // 앤티
  for (const p of alive) {
    const pay = Math.min(gs.ante, p.chips);
    p.chips -= pay;
    p.totalBet += pay;
    gs.pot += pay;
    if (p.chips === 0) p.allIn = true;
  }

  gs.phase = 'draft';
  pushLog(
    gs,
    `— 핸드 #${gs.handNumber} 시작 · ${n}인 · 손패 ${gs.handSize}장 · 선 ${gs.players[gs.dealer].name} · 패스 방향 ${gs.direction === 1 ? '⟳ 시계' : '⟲ 반시계'}`,
  );
}

// ---------------------------------------------------------------------------
// 드래프트
// ---------------------------------------------------------------------------

/** 뭉치를 들고 있고 아직 픽하지 않은 좌석들 */
export function pendingPickSeats(gs: GameState): number[] {
  return gs.players
    .filter((p) => !p.out && !p.folded && p.packet && p.pendingPick === null)
    .map((p) => p.seat);
}

export function draftPick(gs: GameState, seat: number, cardIdx: number): void {
  const p = gs.players[seat];
  if (gs.phase !== 'draft' || !p.packet || p.pendingPick !== null) return;
  if (cardIdx < 0 || cardIdx >= p.packet.length) return;
  p.pendingPick = cardIdx;
  if (pendingPickSeats(gs).length === 0) resolveDraftStep(gs);
}

function resolveDraftStep(gs: GameState): void {
  const holders = gs.players.filter((p) => !p.out && !p.folded && p.packet);

  for (const p of holders) {
    const idx = p.pendingPick!;
    const card = p.packet!.splice(idx, 1)[0];
    p.hand.push(card);
    p.pendingPick = null;
    // 마지막 픽: 2장 중 1장 선택 → 남은 1장은 비공개 폐기
    if (p.packet!.length <= 1) {
      p.packet = null;
      p.packetOrigin = null;
      p.packetFrom = null;
    }
  }

  gs.draftStep += 1;

  // 뭉치 순환 (남은 픽이 있을 때만)
  const stillHolding = gs.players.filter((p) => !p.out && !p.folded && p.packet);
  if (stillHolding.length > 0) {
    const seats = stillHolding.map((p) => p.seat);
    const packets = new Map<number, Card[]>();
    const origins = new Map<number, number | null>();
    for (const p of stillHolding) {
      packets.set(p.seat, p.packet!);
      origins.set(p.seat, p.packetOrigin);
    }
    for (const s of seats) {
      const receiver = nextActiveInDirection(gs, s, seats);
      gs.players[receiver].packet = packets.get(s)!;
      gs.players[receiver].packetOrigin = origins.get(s) ?? null;
      gs.players[receiver].packetFrom = s;
    }
  }

  if (gs.checkpoints.includes(gs.draftStep)) {
    startBettingRound(gs);
  }
}

/** direction을 따라 s의 다음 활성 좌석 (seats 안에서) */
function nextActiveInDirection(gs: GameState, s: number, seats: number[]): number {
  const n = gs.players.length;
  for (let i = 1; i <= n; i++) {
    const cand = (s + gs.direction * i + n * i) % n;
    if (seats.includes(cand)) return cand;
  }
  return s;
}

// ---------------------------------------------------------------------------
// 베팅
// ---------------------------------------------------------------------------

function startBettingRound(gs: GameState): void {
  gs.currentBet = 0;
  for (const p of gs.players) {
    p.betThisRound = 0;
    p.acted = false;
    p.roundCapped = false;
  }
  const actable = activeSeats(gs).filter((s) => canActSeat(gs, s));
  if (actable.length <= 1) {
    // 베팅이 성립하지 않음 (전원 올인 등) → 다음 단계로
    endBettingRound(gs);
    return;
  }
  gs.phase = 'betting';
  gs.toAct = nextSeatFrom(gs, gs.dealer, (s) => canActSeat(gs, s));
  pushLog(gs, `💰 베팅 라운드 (픽 ${gs.draftStep}/${gs.totalPicks} 완료)`);
}

function setAction(gs: GameState, seat: number, text: string): void {
  gs.actionSeq += 1;
  gs.lastAction = { seat, text };
}

export function bettingAction(gs: GameState, seat: number, action: BetAction): void {
  if (gs.phase !== 'betting' || gs.toAct !== seat) return;
  const p = gs.players[seat];

  switch (action.type) {
    case 'fold': {
      p.folded = true;
      p.packet = null; // 들고 있던 뭉치 통째로 폐기 (룰)
      p.packetOrigin = null;
      p.packetFrom = null;
      p.acted = true;
      setAction(gs, seat, '다이…');
      pushLog(gs, `${p.name} 폴드`);
      const act = activeSeats(gs);
      if (act.length === 1) {
        awardUncontested(gs, act[0]);
        return;
      }
      break;
    }
    case 'check': {
      // 한게임 룰: 체크 없음 — 베팅을 띄우거나 다이
      return;
    }
    case 'call': {
      const need = gs.currentBet - p.betThisRound;
      if (need <= 0) return;
      const pay = Math.min(need, p.chips);
      payChips(gs, p, pay);
      p.acted = true;
      p.roundCapped = true;
      setAction(gs, seat, p.allIn ? '올인 콜!' : `콜 ${formatMoney(pay)}`);
      pushLog(gs, p.allIn ? `${p.name} 콜 올인 (${formatMoney(pay)})` : `${p.name} 콜 (${formatMoney(pay)})`);
      break;
    }
    case 'raise': {
      const maxTo = p.betThisRound + p.chips;
      const to = Math.min(action.to, maxTo);
      if (p.roundCapped || to <= gs.currentBet) {
        // 레이즈가 불가능한 금액 (칩 부족 등) → 콜로 처리 (모자라면 자연 올인)
        const need = gs.currentBet - p.betThisRound;
        if (need <= 0) return;
        const pay = Math.min(need, p.chips);
        payChips(gs, p, pay);
        p.acted = true;
        p.roundCapped = true;
        setAction(gs, seat, p.allIn ? '올인 콜!' : `콜 ${formatMoney(pay)}`);
        pushLog(gs, `${p.name} 콜${p.allIn ? ' 올인' : ''} (${formatMoney(pay)})`);
        break;
      }
      const pay = to - p.betThisRound;
      payChips(gs, p, pay);
      const wasBet = gs.currentBet === 0;
      gs.currentBet = to;
      // 레이즈가 들어오면 다른 사람들은 다시 액션해야 함
      for (const q of gs.players) if (q.seat !== seat) q.acted = false;
      p.acted = true;
      setAction(gs, seat, p.allIn ? '올인!!' : wasBet ? `벳 ${formatMoney(to)}` : `레이즈 ${formatMoney(to)}!`);
      pushLog(
        gs,
        `${p.name} ${wasBet ? '벳' : '레이즈'} ${formatMoney(to)}${p.allIn ? ' (올인)' : ''}`,
      );
      break;
    }
  }

  advanceTurn(gs, seat);
}

function payChips(gs: GameState, p: PlayerState, amount: number): void {
  p.chips -= amount;
  p.betThisRound += amount;
  p.totalBet += amount;
  gs.pot += amount;
  if (p.chips === 0) p.allIn = true;
}

function advanceTurn(gs: GameState, fromSeat: number): void {
  if (gs.phase !== 'betting') return;
  const next = nextSeatFrom(
    gs,
    fromSeat,
    (s) => canActSeat(gs, s) && (!gs.players[s].acted || gs.players[s].betThisRound < gs.currentBet),
  );
  if (next === null) {
    endBettingRound(gs);
  } else {
    gs.toAct = next;
  }
}

function endBettingRound(gs: GameState): void {
  gs.toAct = null;
  for (const p of gs.players) p.betThisRound = 0;
  if (activeSeats(gs).length === 1) {
    awardUncontested(gs, activeSeats(gs)[0]);
    return;
  }
  if (gs.draftStep >= gs.totalPicks) {
    showdown(gs);
  } else {
    gs.phase = 'draft';
  }
}

// ---------------------------------------------------------------------------
// 정산
// ---------------------------------------------------------------------------

/** 핸드 종료 시 연승 갱신: 이번 핸드 승자는 +1, 참가했던 나머지는 0 */
function updateWinStreaks(gs: GameState, winners: Set<number>): void {
  for (const p of gs.players) {
    if (winners.has(p.seat)) p.winStreak += 1;
    else p.winStreak = 0; // 이기지 못한 모두 연승 리셋 (패배/폴드/탈락 포함)
  }
}

function awardUncontested(gs: GameState, seat: number): void {
  for (const q of gs.players) q.betThisRound = 0;
  const p = gs.players[seat];
  const fee = Math.floor(gs.pot * gs.rake);
  const net = gs.pot - fee;
  gs.rakeTotal += fee;
  p.chips += net;
  gs.results = [{ seat, amount: net, handName: '', best5: [] }];
  pushLog(gs, `${p.name} 단독 승리 — 팟 ${net} 획득 (패 비공개${fee > 0 ? ` · 수수료 ${fee}` : ''})`);
  updateWinStreaks(gs, new Set([seat]));
  gs.pot = 0;
  gs.revealed = false;
  gs.nextDealer = seat;
  gs.phase = 'showdown';
}

function showdown(gs: GameState): void {
  const contenders = activeSeats(gs);
  const evals = new Map<number, HandEval>();
  for (const s of contenders) evals.set(s, bestHand(gs.players[s].hand));

  // 사이드팟 계산 (totalBet 레이어 방식)
  const levels = [...new Set(gs.players.map((p) => p.totalBet).filter((v) => v > 0))].sort(
    (a, b) => a - b,
  );
  const winningsBySeat = new Map<number, number>();
  let prev = 0;
  let firstWinner: number | null = null;

  for (const level of levels) {
    let potAmount = 0;
    for (const p of gs.players) {
      potAmount += Math.max(0, Math.min(p.totalBet, level) - Math.min(p.totalBet, prev));
    }
    prev = level;
    if (potAmount === 0) continue;
    const eligible = contenders.filter((s) => gs.players[s].totalBet >= level);
    if (eligible.length === 0) continue;
    const bestScore = Math.max(...eligible.map((s) => evals.get(s)!.score));
    const winners = eligible.filter((s) => evals.get(s)!.score === bestScore);
    const share = Math.floor(potAmount / winners.length);
    let remainder = potAmount - share * winners.length;
    for (const w of winners) {
      let amt = share;
      if (remainder > 0) {
        amt += 1;
        remainder -= 1;
      }
      winningsBySeat.set(w, (winningsBySeat.get(w) ?? 0) + amt);
      if (firstWinner === null) firstWinner = w;
    }
  }

  // 팟 수수료: 각 승자의 획득액에서 비율만큼 차감
  let handFee = 0;
  const netBySeat = new Map<number, number>();
  for (const [seat, amt] of winningsBySeat) {
    const fee = Math.floor(amt * gs.rake);
    handFee += fee;
    netBySeat.set(seat, amt - fee);
  }
  gs.rakeTotal += handFee;

  gs.results = contenders.map((s) => {
    const ev = evals.get(s)!;
    return {
      seat: s,
      amount: netBySeat.get(s) ?? 0,
      handName: CAT_NAMES[ev.cat],
      best5: ev.cards,
    };
  });
  gs.results.sort((a, b) => b.amount - a.amount);

  for (const [seat, amt] of netBySeat) gs.players[seat].chips += amt;
  // 연승은 실제로 팟을 이긴 사람만 (사이드팟 환급받은 2등은 제외)
  updateWinStreaks(gs, new Set(winningsBySeat.keys()));

  const topWinner = gs.results[0];
  gs.nextDealer = topWinner.seat;
  pushLog(
    gs,
    `🃏 쇼다운! ${gs.players[topWinner.seat].name} ${topWinner.handName}(${topWinner.best5
      .map(cardLabel)
      .join(' ')})로 ${topWinner.amount} 획득${handFee > 0 ? ` · 수수료 ${handFee}` : ''}`,
  );
  gs.pot = 0;
  gs.revealed = true;
  gs.phase = 'showdown';
}

// ---------------------------------------------------------------------------
// 헬퍼 (UI/AI 공용)
// ---------------------------------------------------------------------------

export function callAmount(gs: GameState, seat: number): number {
  const p = gs.players[seat];
  return Math.min(gs.currentBet - p.betThisRound, p.chips);
}

/** 한게임식 제한 베팅 메뉴: 삥/따당/하프/풀 (전부 maxTo로 클램프 → 모자라면 자연 올인) */
export interface BetOptions {
  toCall: number;
  maxTo: number;
  canRaise: boolean;
  /** 아직 아무도 벳하지 않음 → 체크 불가, 다이/삥/쿼터/하프로 무조건 띄워야 함 (한게임 룰) */
  open: boolean;
  /** 이번 라운드에 콜을 한 적 있음 → 콜/다이만 가능 (한국 룰) */
  capped: boolean;
  ping: number;
  ddadang: number;
  quarter: number;
  half: number;
  full: number;
}

export function betOptions(gs: GameState, seat: number): BetOptions {
  const p = gs.players[seat];
  const toCall = Math.max(0, gs.currentBet - p.betThisRound);
  const maxTo = p.betThisRound + p.chips;
  const open = gs.currentBet === 0;
  const clamp = (v: number) => Math.min(Math.max(v, 1), maxTo);
  return {
    toCall,
    maxTo,
    canRaise: !p.roundCapped && maxTo > gs.currentBet,
    open,
    capped: p.roundCapped,
    ping: clamp(gs.ante),
    ddadang: clamp(gs.currentBet + toCall),
    quarter: clamp(gs.currentBet + Math.max(gs.ante, Math.floor(gs.pot / 4))),
    half: clamp(gs.currentBet + Math.max(gs.ante, Math.floor(gs.pot / 2))),
    full: clamp(gs.currentBet + Math.max(gs.ante, gs.pot)),
  };
}

export function aliveCount(gs: GameState): number {
  return gs.players.filter((p) => p.chips > 0).length;
}
