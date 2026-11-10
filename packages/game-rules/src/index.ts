export type GameMode = 'simple' | 'complex';
export type GamePhase = 'lobby' | 'roll' | 'jail' | 'buy' | 'auction' | 'end-turn' | 'council' | 'finished';
export type GameFinishReason = 'last-standing' | 'round-limit';
export const cityCouncilRules = {
  'rent-growth': { title: '街区繁荣', description: '所有地产租金提高 25%。', effect: 'rent' },
  'loan-relief': { title: '宽信用期', description: '贷款每轮利息减半。', effect: 'interest' },
  'start-subsidy': { title: '起点补贴', description: '经过起点额外获得 100 城币。', effect: 'salary' },
} as const;
export type CityCouncilRuleId = keyof typeof cityCouncilRules;
export interface ActiveCityRule { id: CityCouncilRuleId; expiresAtRound: number }
export const JAIL_BAIL = 50;
export const HOUSE_RENT_MULTIPLIERS = [1, 3, 6, 10, 15] as const;
export const LOAN_TERMS = {
  200: 20,
  500: 60,
  1000: 140,
} as const;
export interface PlayerLoan {
  principal: number;
  interestPerRound: number;
  accruedInterest: number;
}
export interface PropertyAuction {
  propertyIndex: number;
  currentBid: number;
  highestBidderId: string | null;
  currentBidderId: string;
  passedPlayerIds: string[];
}
export interface EventCard {
  id: string;
  title: string;
  description: string;
  amount: number;
  scope: 'personal' | 'all' | 'lowest';
}

export const cityEventCards: EventCard[] = [
  { id: 'street-festival', title: '街区庆典', description: '摊位生意红火，获得庆典分红。', amount: 120, scope: 'personal' },
  { id: 'bike-rebate', title: '公共单车补贴', description: '绿色出行奖励到账。', amount: 80, scope: 'personal' },
  { id: 'market-day', title: '周末市集', description: '出租摊位，收下一笔收入。', amount: 100, scope: 'personal' },
  { id: 'roadworks', title: '道路施工', description: '临时绕行带来额外开支。', amount: -80, scope: 'personal' },
  { id: 'park-fund', title: '公园维护', description: '为公共绿地缴纳维护费用。', amount: -60, scope: 'personal' },
  { id: 'utility-repair', title: '管线抢修', description: '分摊街区公共设施维修费。', amount: -100, scope: 'personal' },
  { id: 'city-bonus', title: '城市繁荣', description: '全城经济向好，每位存活玩家获得补贴。', amount: 50, scope: 'all' },
  { id: 'energy-crisis', title: '能源危机', description: '全城进入节流期，每位存活玩家支付公共能源费。', amount: -40, scope: 'all' },
  { id: 'small-business-grant', title: '小微企业扶持', description: '现金最少的玩家获得发展补助。', amount: 180, scope: 'lowest' },
  { id: 'city-relief', title: '紧急救助金', description: '现金最少的玩家获得临时救助。', amount: 120, scope: 'lowest' },
  { id: 'medical-bill', title: '突发医疗账单', description: '个人承担一笔临时医疗支出。', amount: -120, scope: 'personal' },
  { id: 'tourism-boom', title: '旅游旺季', description: '你的城市宣传成功，获得游客消费分成。', amount: 160, scope: 'personal' },
];

export type BoardSpace =
  | { type: 'start'; name: string }
  | { type: 'property'; name: string; district: string; price: number; rent: number }
  | { type: 'event'; name: string }
  | { type: 'tax'; name: string; amount: number }
  | { type: 'jail'; name: string }
  | { type: 'free'; name: string }
  | { type: 'go-to-jail'; name: string };

export interface Player {
  id: string;
  name: string;
  cash: number;
  position: number;
  bankrupt: boolean;
}

export interface GameState {
  mode: GameMode;
  phase: GamePhase;
  councilVotes: Record<string, CityCouncilRuleId>;
  activeCityRule: ActiveCityRule | null;
  players: Player[];
  currentPlayerIndex: number;
  board: BoardSpace[];
  owners: Record<number, string>;
  buildings: Record<number, number>;
  mortgages: Record<number, boolean>;
  loans: Record<string, PlayerLoan>;
  auction: PropertyAuction | null;
  round: number;
  roundLimit: number;
  lastRoll: [number, number] | null;
  lastEventCard: EventCard | null;
  pendingProperty: number | null;
  log: string[];
  winnerId: string | null;
  finishReason: GameFinishReason | null;
  jailAttempts: Record<string, number>;
}

export interface PlayerSettlement {
  cash: number;
  propertyValue: number;
  houseValue: number;
  loanDebt: number;
  netWorth: number;
}

export interface TradeTerms {
  proposerId: string;
  recipientId: string;
  proposerCash: number;
  proposerPropertyIndexes: number[];
  recipientCash: number;
  recipientPropertyIndexes: number[];
}

const fullBoard: BoardSpace[] = [
  { type: 'start', name: 'Harbor Gate' },
  { type: 'property', name: 'Canal Market', district: 'Old Town', price: 80, rent: 8 },
  { type: 'event', name: 'City News' },
  { type: 'property', name: 'Lantern Lane', district: 'Old Town', price: 100, rent: 10 },
  { type: 'tax', name: 'City Tax', amount: 100 },
  { type: 'property', name: 'North Station', district: 'Transit', price: 160, rent: 16 },
  { type: 'property', name: 'Willow Walk', district: 'Riverside', price: 120, rent: 12 },
  { type: 'event', name: 'City News' },
  { type: 'property', name: 'Ferry Street', district: 'Riverside', price: 140, rent: 14 },
  { type: 'property', name: 'Glasshouse Row', district: 'Riverside', price: 160, rent: 16 },
  { type: 'jail', name: 'Detention Office' },
  { type: 'property', name: 'Foundry Road', district: 'Works Quarter', price: 180, rent: 18 },
  { type: 'property', name: 'Market Tram', district: 'Transit', price: 160, rent: 16 },
  { type: 'property', name: 'Copper Square', district: 'Works Quarter', price: 200, rent: 20 },
  { type: 'property', name: 'Clocktower Court', district: 'Works Quarter', price: 220, rent: 22 },
  { type: 'property', name: 'East Station', district: 'Transit', price: 180, rent: 18 },
  { type: 'property', name: 'Studio Alley', district: 'Arts Quarter', price: 240, rent: 24 },
  { type: 'event', name: 'City News' },
  { type: 'property', name: 'Museum Steps', district: 'Arts Quarter', price: 260, rent: 26 },
  { type: 'property', name: 'Orchard Avenue', district: 'Arts Quarter', price: 280, rent: 28 },
  { type: 'free', name: 'Riverside Park' },
  { type: 'property', name: 'Summit Plaza', district: 'Skyline', price: 300, rent: 30 },
  { type: 'event', name: 'City News' },
  { type: 'property', name: 'Meridian Tower', district: 'Skyline', price: 320, rent: 32 },
  { type: 'property', name: 'Cloudline Square', district: 'Skyline', price: 340, rent: 34 },
  { type: 'property', name: 'West Station', district: 'Transit', price: 180, rent: 18 },
  { type: 'property', name: 'Garden Heights', district: 'Skyline', price: 360, rent: 36 },
  { type: 'property', name: 'Civic Boulevard', district: 'Civic Center', price: 380, rent: 38 },
  { type: 'tax', name: 'Harbor Levy', amount: 150 },
  { type: 'property', name: 'Aurora Center', district: 'Civic Center', price: 420, rent: 42 },
  { type: 'go-to-jail', name: 'Go to Detention' },
  { type: 'property', name: 'Beacon Heights', district: 'Civic Center', price: 460, rent: 46 },
  { type: 'event', name: 'City News' },
  { type: 'property', name: 'Skybridge One', district: 'Skyline', price: 480, rent: 48 },
  { type: 'property', name: 'Grand Terminal', district: 'Transit', price: 200, rent: 20 },
  { type: 'property', name: 'Crown Observatory', district: 'Civic Center', price: 520, rent: 52 },
  { type: 'free', name: 'Night Market' },
  { type: 'property', name: 'Sunrise Pier', district: 'Harborfront', price: 560, rent: 56 },
  { type: 'tax', name: 'Harborfront Fee', amount: 180 },
  { type: 'property', name: 'Lighthouse Point', district: 'Harborfront', price: 600, rent: 60 },
];

const simpleBoard: BoardSpace[] = fullBoard.filter((_, index) => index % 2 === 0);

function activePlayers(state: GameState) {
  return state.players.filter((player) => !player.bankrupt);
}

function updatePlayer(state: GameState, playerId: string, update: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId ? { ...player, ...update } : player),
  };
}

function resolvePayment(state: GameState, payerId: string, amount: number, recipientId?: string): GameState {
  if (amount <= 0) return state;
  let next = state;
  const payer = next.players.find((player) => player.id === payerId)!;
  let remaining = amount;
  let cash = payer.cash;
  const owned = Object.entries(next.owners)
    .filter(([, owner]) => owner === payerId)
    .map(([index]) => Number(index))
    .sort((left, right) => Number(Boolean(next.buildings[left])) - Number(Boolean(next.buildings[right])));
  for (const index of owned) {
    if (cash >= remaining) break;
    const space = next.board[index];
    if (space.type !== 'property') continue;
    const value = next.mortgages[index] ? 0 : Math.floor(space.price / 2);
    remaining = Math.max(0, remaining - value);
    next = { ...next, owners: { ...next.owners, ...(recipientId ? { [index]: recipientId } : {}) }, mortgages: { ...next.mortgages, [index]: false } };
    if (!recipientId) {
      const owners = { ...next.owners };
      delete owners[index];
      next = { ...next, owners };
    }
    next = { ...next, buildings: { ...next.buildings, [index]: 0 } };
  }
  if (cash >= remaining) {
    next = updatePlayer(next, payerId, { cash: cash - remaining });
    if (recipientId && remaining > 0) next = updatePlayer(next, recipientId, { cash: next.players.find((player) => player.id === recipientId)!.cash + remaining });
    return next;
  }
  const owners = Object.fromEntries(Object.entries(next.owners).filter(([, owner]) => owner !== payerId));
  const loans = Object.fromEntries(Object.entries(next.loans).filter(([id]) => id !== payerId));
  next = { ...next, owners, loans, players: next.players.map((player) => player.id === payerId ? { ...player, cash: 0, bankrupt: true } : player), log: [...next.log, `${payer.name} 无法偿还 ${amount} 城币，宣布破产。`] };
  if (recipientId && cash > 0) next = updatePlayer(next, recipientId, { cash: next.players.find((player) => player.id === recipientId)!.cash + cash });
  return next;
}

function applyEventCard(state: GameState, playerId: string, card: EventCard): GameState {
  let next = state;
  if (card.scope === 'personal') {
    next = card.amount < 0 ? resolvePayment(next, playerId, -card.amount) : updatePlayer(next, playerId, { cash: next.players.find((player) => player.id === playerId)!.cash + card.amount });
  } else if (card.scope === 'all') {
    for (const player of next.players.filter((entry) => !entry.bankrupt)) {
      next = card.amount < 0 ? resolvePayment(next, player.id, -card.amount) : updatePlayer(next, player.id, { cash: player.cash + card.amount });
    }
  } else {
    const target = activePlayers(next).sort((left, right) => left.cash - right.cash)[0];
    if (target) next = updatePlayer(next, target.id, { cash: target.cash + card.amount });
  }
  const targetText = card.scope === 'all' ? '全体玩家' : card.scope === 'lowest' ? '现金最少的玩家' : next.players.find((player) => player.id === playerId)?.name ?? '玩家';
  return { ...next, lastEventCard: card, log: [...next.log, `「${card.title}」影响${targetText}，${card.amount >= 0 ? '获得' : '支付'} ${Math.abs(card.amount)} 城币。`] };
}

export function getPlayerSettlement(state: GameState, playerId: string): PlayerSettlement {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) return { cash: 0, propertyValue: 0, houseValue: 0, loanDebt: 0, netWorth: 0 };
  const values = Object.entries(state.owners)
    .filter(([, ownerId]) => ownerId === playerId)
    .reduce((total, [rawIndex]) => {
      const index = Number(rawIndex);
      const space = state.board[index];
      if (space.type !== 'property') return total;
      return {
        propertyValue: total.propertyValue + (state.mortgages[index] ? Math.floor(space.price / 2) : space.price),
        houseValue: total.houseValue + (state.buildings[index] ?? 0) * Math.ceil(space.price / 2),
      };
    }, { propertyValue: 0, houseValue: 0 });
  const loan = state.loans[playerId];
  const loanDebt = (loan?.principal ?? 0) + (loan?.accruedInterest ?? 0);
  return { cash: player.cash, ...values, loanDebt, netWorth: player.cash + values.propertyValue + values.houseValue - loanDebt };
}

export function getPlayerNetWorth(state: GameState, playerId: string) {
  return getPlayerSettlement(state, playerId).netWorth;
}

function settleWinner(state: GameState): GameState {
  const active = activePlayers(state);
  if (active.length <= 1) {
    return { ...state, phase: 'finished', winnerId: active[0]?.id ?? null, finishReason: 'last-standing' };
  }
  if (state.round >= state.roundLimit) {
    const winner = [...active].sort((left, right) => getPlayerNetWorth(state, right.id) - getPlayerNetWorth(state, left.id))[0];
    return { ...state, phase: 'finished', winnerId: winner.id, finishReason: 'round-limit' };
  }
  return state;
}

export function createGame(
  mode: GameMode,
  players: Array<Pick<Player, 'id' | 'name'>>,
): GameState {
  if (players.length < 4 || players.length > 8) {
    throw new Error('A game requires 4 to 8 players.');
  }
  if (new Set(players.map((player) => player.id)).size !== players.length) {
    throw new Error('Player IDs must be unique.');
  }
  const board = mode === 'simple' ? simpleBoard : fullBoard;
  return {
    mode,
    phase: 'roll',
    councilVotes: {},
    activeCityRule: null,
    players: players.map((player) => ({ ...player, cash: 1500, position: 0, bankrupt: false })),
    currentPlayerIndex: 0,
    board,
    owners: {},
    buildings: {},
    mortgages: {},
    loans: {},
    auction: null,
    round: 1,
    roundLimit: mode === 'simple' ? 18 : 30,
    lastRoll: null,
    lastEventCard: null,
    pendingProperty: null,
    log: ['城市已经开放，祝各位投资顺利。'],
    winnerId: null,
    finishReason: null,
    jailAttempts: {},
  };
}

export function rollDice(
  state: GameState,
  playerId: string,
  dice: [number, number],
  eventCardIndex?: number,
): GameState {
  const current = state.players[state.currentPlayerIndex];
  if (state.phase !== 'roll' || current.id !== playerId) throw new Error('It is not your turn to roll.');
  if (dice.some((value) => !Number.isInteger(value) || value < 1 || value > 6)) throw new Error('Dice must be between 1 and 6.');

  const distance = dice[0] + dice[1];
  const oldPosition = current.position;
  const newPosition = (oldPosition + distance) % state.board.length;
  const passedStart = oldPosition + distance >= state.board.length;
  const salary = passedStart ? 200 + (state.mode === 'complex' && state.activeCityRule?.id === 'start-subsidy' && state.round <= state.activeCityRule.expiresAtRound ? 100 : 0) : 0;
  let next = updatePlayer(state, playerId, { position: newPosition, cash: current.cash + salary });
  next = { ...next, lastRoll: dice, lastEventCard: null, log: [...next.log, `${current.name} 掷出了 ${dice[0]} 和 ${dice[1]}。`] };

  const space = next.board[newPosition];
  if (space.type === 'go-to-jail') {
    const jailIndex = next.board.findIndex((tile) => tile.type === 'jail');
    if (jailIndex < 0) throw new Error('The board has no jail space.');
    next = updatePlayer(next, playerId, { position: jailIndex });
    return {
      ...next,
      phase: 'end-turn',
      pendingProperty: null,
      jailAttempts: { ...next.jailAttempts, [playerId]: 0 },
      log: [...next.log, `${current.name} 前往监狱，本回合结束。`],
    };
  }
  if (space.type === 'property') {
    const ownerId = next.owners[newPosition];
    if (!ownerId) return { ...next, phase: 'buy', pendingProperty: newPosition };
    if (ownerId !== playerId) {
      const rent = getPropertyRent(next, newPosition);
      const owner = next.players.find((player) => player.id === ownerId)!;
      next = resolvePayment(next, playerId, rent, ownerId);
      next = { ...next, log: [...next.log, `${current.name} 向 ${owner.name} 支付了 ${rent} 城币租金。`] };
    }
  } else if (space.type === 'tax') {
    next = resolvePayment(next, playerId, space.amount);
    next = { ...next, log: [...next.log, `${current.name} 支付了 ${space.amount} 城币公共费用。`] };
  } else if (space.type === 'event') {
    if (eventCardIndex === undefined || !Number.isInteger(eventCardIndex) || !cityEventCards[eventCardIndex]) {
      throw new Error('A valid event card must be drawn for this space.');
    }
    const card = cityEventCards[eventCardIndex];
    next = applyEventCard(next, playerId, card);
  }

  return settleWinner({ ...next, phase: 'end-turn', pendingProperty: null });
}

function releaseFromJail(state: GameState, playerId: string, dice: [number, number], paid: boolean, eventCardIndex?: number): GameState {
  const current = state.players[state.currentPlayerIndex];
  if (state.phase !== 'jail' || current.id !== playerId) throw new Error('It is not your turn to act in jail.');
  if (dice.some((value) => !Number.isInteger(value) || value < 1 || value > 6)) throw new Error('Dice must be between 1 and 6.');
  if (paid && current.cash < JAIL_BAIL) throw new Error('Not enough cash to pay bail.');

  const attempts = (state.jailAttempts[playerId] ?? 0) + 1;
  const doubles = dice[0] === dice[1];
  if (!paid && !doubles && attempts < 3) {
    return {
      ...state,
      phase: 'end-turn',
      jailAttempts: { ...state.jailAttempts, [playerId]: attempts },
      lastRoll: dice,
      log: [...state.log, `${current.name} 在监狱尝试掷对子失败（${attempts}/3），回合结束。`],
    };
  }

  const bail = paid || !doubles ? JAIL_BAIL : 0;
  let next = updatePlayer(state, playerId, { cash: current.cash - bail });
  next = {
    ...next,
    phase: 'roll',
    jailAttempts: Object.fromEntries(Object.entries(next.jailAttempts).filter(([id]) => id !== playerId)),
    lastRoll: dice,
    log: [...next.log, `${current.name}${paid ? ` 支付 ${JAIL_BAIL} 城币保释` : doubles ? ' 掷出对子离开监狱' : ' 第三次尝试失败，支付保释金'}，前进 ${dice[0] + dice[1]} 格。`],
  };
  return rollDice(next, playerId, dice, eventCardIndex);
}

export function tryJailDoubles(state: GameState, playerId: string, dice: [number, number], eventCardIndex?: number): GameState {
  return releaseFromJail(state, playerId, dice, false, eventCardIndex);
}

export function payJailBailAndRoll(state: GameState, playerId: string, dice: [number, number], eventCardIndex?: number): GameState {
  return releaseFromJail(state, playerId, dice, true, eventCardIndex);
}

export function buyProperty(state: GameState, playerId: string): GameState {
  if (state.phase !== 'buy' || state.players[state.currentPlayerIndex].id !== playerId || state.pendingProperty === null) {
    throw new Error('There is no property available to buy.');
  }
  const index = state.pendingProperty;
  const space = state.board[index];
  if (space.type !== 'property') throw new Error('The current space is not a property.');
  const player = state.players[state.currentPlayerIndex];
  if (player.cash < space.price) throw new Error('Not enough cash to buy this property.');
  const next = updatePlayer(state, playerId, { cash: player.cash - space.price });
  return {
    ...next,
    phase: 'end-turn',
    pendingProperty: null,
    owners: { ...next.owners, [index]: playerId },
    log: [...next.log, `${player.name} 买下了 ${space.name}，支付 ${space.price} 城币。`],
  };
}

function districtTiles(state: GameState, district: string) {
  return state.board.flatMap((space, index) => space.type === 'property' && space.district === district ? [index] : []);
}

function ownsDistrict(state: GameState, playerId: string, district: string) {
  const tiles = districtTiles(state, district);
  return tiles.length > 0 && tiles.every((index) => state.owners[index] === playerId);
}

export function getPropertyRent(state: GameState, index: number) {
  const space = state.board[index];
  if (!space || space.type !== 'property') throw new Error('The selected space is not a property.');
  if (state.mortgages[index]) return 0;
  const level = Math.min(state.buildings[index] ?? 0, HOUSE_RENT_MULTIPLIERS.length - 1);
  const districtBonus = state.mode === 'complex' && ownsDistrict(state, state.owners[index] ?? '', space.district);
  const rent = space.rent * HOUSE_RENT_MULTIPLIERS[level] * (districtBonus ? 2 : 1);
  return state.mode === 'complex' && state.activeCityRule?.id === 'rent-growth' && state.round <= state.activeCityRule.expiresAtRound
    ? Math.ceil(rent * 1.25)
    : rent;
}

export function canMortgageProperty(state: GameState, playerId: string, index: number) {
  const space = state.board[index];
  return state.phase === 'end-turn'
    && state.players[state.currentPlayerIndex]?.id === playerId
    && space?.type === 'property'
    && state.owners[index] === playerId
    && !state.mortgages[index]
    && !(state.buildings[index] ?? 0);
}

export function mortgageProperty(state: GameState, playerId: string, index: number): GameState {
  if (!canMortgageProperty(state, playerId, index)) throw new Error('This property cannot be mortgaged now.');
  const space = state.board[index];
  if (space.type !== 'property') throw new Error('The selected space is not a property.');
  const value = Math.floor(space.price / 2);
  const player = state.players.find((entry) => entry.id === playerId)!;
  return {
    ...state,
    players: state.players.map((entry) => entry.id === playerId ? { ...entry, cash: entry.cash + value } : entry),
    mortgages: { ...state.mortgages, [index]: true },
    log: [...state.log, `${player.name} 抵押了 ${space.name}，获得 ${value} 城币。`],
  };
}

export function canTradeProperty(state: GameState, playerId: string, index: number) {
  return state.mode === 'complex'
    && state.phase !== 'lobby'
    && state.phase !== 'finished'
    && state.players.some((player) => player.id === playerId && !player.bankrupt)
    && state.board[index]?.type === 'property'
    && state.owners[index] === playerId
    && !state.mortgages[index]
    && !(state.buildings[index] ?? 0);
}

export function executeTrade(state: GameState, terms: TradeTerms): GameState {
  if (state.mode !== 'complex' || state.phase === 'lobby' || state.phase === 'finished') {
    throw new Error('Trades are only available during a complex game.');
  }
  const proposer = state.players.find((player) => player.id === terms.proposerId);
  const recipient = state.players.find((player) => player.id === terms.recipientId);
  if (!proposer || !recipient || proposer.id === recipient.id || proposer.bankrupt || recipient.bankrupt) {
    throw new Error('Both trade participants must be active players.');
  }
  if (![terms.proposerCash, terms.recipientCash].every((amount) => Number.isInteger(amount) && amount >= 0)) {
    throw new Error('Trade cash amounts must be non-negative whole numbers.');
  }
  if (proposer.cash < terms.proposerCash || recipient.cash < terms.recipientCash) {
    throw new Error('A player no longer has enough cash for this trade.');
  }
  if (new Set(terms.proposerPropertyIndexes).size !== terms.proposerPropertyIndexes.length
    || new Set(terms.recipientPropertyIndexes).size !== terms.recipientPropertyIndexes.length) {
    throw new Error('A property can only appear once in a trade.');
  }
  const proposerAssets = [...terms.proposerPropertyIndexes, ...terms.recipientPropertyIndexes];
  if (new Set(proposerAssets).size !== proposerAssets.length) throw new Error('A property cannot be traded to both sides.');
  const propertyCount = terms.proposerPropertyIndexes.length + terms.recipientPropertyIndexes.length;
  if (terms.proposerCash + terms.recipientCash === 0 && propertyCount === 0) throw new Error('The trade must exchange cash or property.');
  for (const index of terms.proposerPropertyIndexes) {
    if (!canTradeProperty(state, proposer.id, index)) throw new Error('A property offered by the proposer is no longer tradable.');
  }
  for (const index of terms.recipientPropertyIndexes) {
    if (!canTradeProperty(state, recipient.id, index)) throw new Error('A property offered by the recipient is no longer tradable.');
  }

  const logTerms = (cash: number, indexes: number[]) => [
    ...(cash > 0 ? [`${cash} 城币`] : []),
    ...indexes.map((index) => {
      const space = state.board[index];
      return space.type === 'property' ? space.name : '';
    }),
  ].join('、') || '无';
  const proposerGives = logTerms(terms.proposerCash, terms.proposerPropertyIndexes);
  const recipientGives = logTerms(terms.recipientCash, terms.recipientPropertyIndexes);
  const owners = { ...state.owners };
  for (const index of terms.proposerPropertyIndexes) owners[index] = recipient.id;
  for (const index of terms.recipientPropertyIndexes) owners[index] = proposer.id;
  return {
    ...state,
    players: state.players.map((player) => player.id === proposer.id
      ? { ...player, cash: player.cash - terms.proposerCash + terms.recipientCash }
      : player.id === recipient.id
        ? { ...player, cash: player.cash - terms.recipientCash + terms.proposerCash }
        : player),
    owners,
    log: [...state.log, `${proposer.name} 与 ${recipient.name} 完成交易：${proposer.name} 提供 ${proposerGives}；${recipient.name} 提供 ${recipientGives}。`],
  };
}

export function borrowLoan(state: GameState, playerId: string, amount: keyof typeof LOAN_TERMS): GameState {
  if (state.phase !== 'end-turn' || state.players[state.currentPlayerIndex]?.id !== playerId) throw new Error('Borrow during your settlement phase.');
  if (state.loans[playerId]) throw new Error('Repay your current loan before borrowing again.');
  const interestPerRound = LOAN_TERMS[amount];
  const player = state.players.find((entry) => entry.id === playerId)!;
  return {
    ...state,
    players: state.players.map((entry) => entry.id === playerId ? { ...entry, cash: entry.cash + amount } : entry),
    loans: { ...state.loans, [playerId]: { principal: amount, interestPerRound, accruedInterest: 0 } },
    log: [...state.log, `${player.name} 向银行借款 ${amount} 城币，每轮利息 ${interestPerRound} 城币。`],
  };
}

export function repayLoan(state: GameState, playerId: string): GameState {
  if (state.phase !== 'end-turn' || state.players[state.currentPlayerIndex]?.id !== playerId) throw new Error('Repay during your settlement phase.');
  const loan = state.loans[playerId];
  if (!loan) throw new Error('You do not have an active loan.');
  const total = loan.principal + loan.accruedInterest;
  const player = state.players.find((entry) => entry.id === playerId)!;
  if (player.cash < total) throw new Error('Not enough cash to repay this loan.');
  return {
    ...state,
    players: state.players.map((entry) => entry.id === playerId ? { ...entry, cash: entry.cash - total } : entry),
    loans: Object.fromEntries(Object.entries(state.loans).filter(([id]) => id !== playerId)),
    log: [...state.log, `${player.name} 向银行还清贷款，共支付 ${total} 城币。`],
  };
}

function accrueRoundInterest(state: GameState, completedRound: number) {
  const loans = Object.fromEntries(Object.entries(state.loans).map(([playerId, loan]) => {
    const reduced = state.mode === 'complex' && state.activeCityRule?.id === 'loan-relief' && completedRound <= state.activeCityRule.expiresAtRound;
    const interest = reduced ? Math.ceil(loan.interestPerRound / 2) : loan.interestPerRound;
    return [playerId, { ...loan, accruedInterest: loan.accruedInterest + interest }];
  })) as GameState['loans'];
  const interestLog = Object.entries(state.loans).map(([playerId, loan]) => {
    const player = state.players.find((entry) => entry.id === playerId);
    const reduced = state.mode === 'complex' && state.activeCityRule?.id === 'loan-relief' && completedRound <= state.activeCityRule.expiresAtRound;
    const interest = reduced ? Math.ceil(loan.interestPerRound / 2) : loan.interestPerRound;
    return player ? `${player.name} 产生 ${interest} 城币贷款利息。` : '';
  }).filter(Boolean);
  return { ...state, loans, log: [...state.log, ...interestLog] };
}

export function canBuildHouse(state: GameState, playerId: string, index: number) {
  const space = state.board[index];
  if (state.mode !== 'complex' || state.phase !== 'end-turn' || state.players[state.currentPlayerIndex]?.id !== playerId) return false;
  if (!space || space.type !== 'property' || state.owners[index] !== playerId || !ownsDistrict(state, playerId, space.district)) return false;
  const district = districtTiles(state, space.district);
  const levels = district.map((tile) => state.buildings[tile] ?? 0);
  const level = state.buildings[index] ?? 0;
  return level < 4 && level === Math.min(...levels) && state.players[state.currentPlayerIndex].cash >= Math.ceil(space.price / 2);
}

export function buildHouse(state: GameState, playerId: string, index: number): GameState {
  const space = state.board[index];
  if (state.mode !== 'complex') throw new Error('Houses are available in complex mode only.');
  if (state.phase !== 'end-turn' || state.players[state.currentPlayerIndex]?.id !== playerId) throw new Error('Build during your turn before ending it.');
  if (!space || space.type !== 'property' || state.owners[index] !== playerId) throw new Error('You must own this property to build.');
  if (!ownsDistrict(state, playerId, space.district)) throw new Error('You must complete the district before building.');
  const district = districtTiles(state, space.district);
  const levels = district.map((tile) => state.buildings[tile] ?? 0);
  const level = state.buildings[index] ?? 0;
  if (level >= 4) throw new Error('This property already has four houses.');
  if (level !== Math.min(...levels)) throw new Error('Houses must be developed evenly across the district.');
  const cost = Math.ceil(space.price / 2);
  const player = state.players[state.currentPlayerIndex];
  if (player.cash < cost) throw new Error('Not enough cash to build a house.');
  return {
    ...state,
    buildings: { ...state.buildings, [index]: level + 1 },
    players: state.players.map((entry) => entry.id === playerId ? { ...entry, cash: entry.cash - cost } : entry),
    log: [...state.log, `${player.name} 在 ${space.name} 建造了第 ${level + 1} 级房屋，支付 ${cost} 城币。`],
  };
}

export function declineProperty(state: GameState, playerId: string): GameState {
  if (state.phase !== 'buy' || state.players[state.currentPlayerIndex].id !== playerId || state.pendingProperty === null) {
    throw new Error('There is no property decision to decline.');
  }
  const propertyIndex = state.pendingProperty;
  const space = state.board[propertyIndex];
  if (!space || space.type !== 'property') throw new Error('The selected space is not a property.');
  return {
    ...state,
    phase: 'auction',
    pendingProperty: null,
    auction: { propertyIndex, currentBid: 0, highestBidderId: null, currentBidderId: playerId, passedPlayerIds: [] },
    log: [...state.log, `${state.players[state.currentPlayerIndex].name} 放弃购买 ${space.name}，开始拍卖。`],
  };
}

function finishAuction(state: GameState, winnerId: string | null): GameState {
  const auction = state.auction;
  if (!auction) throw new Error('There is no active auction.');
  const space = state.board[auction.propertyIndex];
  if (!space || space.type !== 'property') throw new Error('The auction property is invalid.');
  const winner = winnerId ? state.players.find((player) => player.id === winnerId) : null;
  const next = winner
    ? {
      ...state,
      players: state.players.map((player) => player.id === winner.id ? { ...player, cash: player.cash - auction.currentBid } : player),
      owners: { ...state.owners, [auction.propertyIndex]: winner.id },
    }
    : state;
  return settleWinner({
    ...next,
    phase: 'end-turn',
    pendingProperty: null,
    auction: null,
    log: [...next.log, winner ? `${winner.name} 以 ${auction.currentBid} 城币拍下 ${space.name}。` : `${space.name} 流拍，暂时无人购买。`],
  });
}

function advanceAuction(state: GameState, playerId: string, highestBidderId: string | null, currentBid: number, passedPlayerIds: string[]) {
  const currentIndex = state.players.findIndex((player) => player.id === playerId);
  for (let step = 1; step <= state.players.length; step += 1) {
    const candidate = state.players[(currentIndex + step) % state.players.length];
    if (candidate.bankrupt || passedPlayerIds.includes(candidate.id)) continue;
    if (candidate.id === highestBidderId) return finishAuction(state, highestBidderId);
    return {
      ...state,
      auction: { ...state.auction!, currentBid, highestBidderId, currentBidderId: candidate.id, passedPlayerIds },
    };
  }
  return finishAuction(state, highestBidderId);
}

export function bidOnProperty(state: GameState, playerId: string, amount: number): GameState {
  const auction = state.auction;
  if (state.phase !== 'auction' || !auction || auction.currentBidderId !== playerId) throw new Error('It is not your turn to bid.');
  if (!Number.isInteger(amount) || amount <= auction.currentBid) throw new Error('Your bid must be higher than the current bid.');
  const player = state.players.find((entry) => entry.id === playerId)!;
  if (amount > player.cash) throw new Error('Not enough cash for this bid.');
  const space = state.board[auction.propertyIndex];
  if (!space || space.type !== 'property') throw new Error('The auction property is invalid.');
  const next = {
    ...state,
    log: [...state.log, `${player.name} 出价 ${amount} 城币竞拍 ${space.name}。`],
  };
  return advanceAuction(next, playerId, playerId, amount, auction.passedPlayerIds);
}

export function passAuction(state: GameState, playerId: string): GameState {
  const auction = state.auction;
  if (state.phase !== 'auction' || !auction || auction.currentBidderId !== playerId) throw new Error('It is not your turn to pass.');
  const player = state.players.find((entry) => entry.id === playerId)!;
  const passedPlayerIds = [...auction.passedPlayerIds, playerId];
  const next = {
    ...state,
    log: [...state.log, `${player.name} 放弃本次竞价。`],
  };
  return advanceAuction(next, playerId, auction.highestBidderId, auction.currentBid, passedPlayerIds);
}

export function endTurn(state: GameState, playerId: string): GameState {
  if (state.phase !== 'end-turn' || state.players[state.currentPlayerIndex].id !== playerId) {
    throw new Error('The current turn cannot be ended.');
  }
  let index = state.currentPlayerIndex;
  do {
    index = (index + 1) % state.players.length;
  } while (state.players[index].bankrupt);
  const nextRound = index <= state.currentPlayerIndex ? state.round + 1 : state.round;
  const nextPlayer = state.players[index];
  const completedRound = nextRound > state.round;
  let next: GameState = { ...state, currentPlayerIndex: index, round: nextRound, phase: Object.hasOwn(state.jailAttempts, nextPlayer.id) ? 'jail' : 'roll', lastRoll: null };
  if (completedRound) next = accrueRoundInterest(next, state.round);
  if (next.mode === 'complex' && completedRound && nextRound > 1 && (nextRound - 1) % 4 === 0) {
    next = { ...next, phase: 'council', councilVotes: {}, log: [...next.log, `第 ${nextRound - 1} 轮结束，城市议会开始投票。`] };
  }
  return settleWinner(next);
}

export function voteCityCouncil(state: GameState, playerId: string, ruleId: CityCouncilRuleId): GameState {
  if (state.mode !== 'complex' || state.phase !== 'council') throw new Error('There is no active city council.');
  if (!Object.hasOwn(cityCouncilRules, ruleId)) throw new Error('Choose a valid city rule.');
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player || player.bankrupt) throw new Error('Only active players can vote.');
  if (state.councilVotes[playerId]) throw new Error('You have already voted.');
  const councilVotes = { ...state.councilVotes, [playerId]: ruleId };
  const active = activePlayers(state);
  if (!active.every((entry) => councilVotes[entry.id])) return { ...state, councilVotes };
  const currentPlayer = state.players[state.currentPlayerIndex];
  const resumePhase = Object.hasOwn(state.jailAttempts, currentPlayer.id) ? 'jail' : 'roll';

  const counts = Object.fromEntries(Object.keys(cityCouncilRules).map((id) => [id, 0])) as Record<CityCouncilRuleId, number>;
  for (const entry of active) {
    const vote = councilVotes[entry.id];
    if (vote) counts[vote] += 1;
  }
  const highest = Math.max(...Object.values(counts));
  const winners = Object.entries(counts).filter(([, count]) => count === highest);
  if (winners.length !== 1) {
    return { ...state, phase: resumePhase, councilVotes, activeCityRule: null, log: [...state.log, '城市议会票数相同，本次维持现状。'] };
  }
  const id = winners[0][0] as CityCouncilRuleId;
  const policy = cityCouncilRules[id];
  return {
    ...state,
    phase: resumePhase,
    councilVotes,
    activeCityRule: { id, expiresAtRound: state.round + 2 },
    log: [...state.log, `城市议会通过「${policy.title}」：${policy.description}（持续至第 ${state.round + 2} 轮结束）。`],
  };
}
