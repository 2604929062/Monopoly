import { createServer } from 'node:http';
import { randomInt, randomUUID } from 'node:crypto';
import { Server } from 'socket.io';
import {
  buyProperty,
  bidOnProperty,
  buildHouse,
  borrowLoan,
  cityCouncilRules,
  cityEventCards,
  createGame,
  declineProperty,
  endTurn,
  executeTrade,
  passAuction,
  payJailBailAndRoll,
  mortgageProperty,
  rollDice,
  repayLoan,
  tryJailDoubles,
  voteCityCouncil,
  type CityCouncilRuleId,
  type GameState,
} from 'game-rules';
import {
  auctionBidSchema,
  buildPropertySchema,
  createRoomSchema,
  councilVoteSchema,
  joinRoomSchema,
  jailActionSchema,
  loanActionSchema,
  roomActionSchema,
  startGameSchema,
  tradeOfferSchema,
  tradeResponseSchema,
  type RoomPlayerView,
  type RoomView,
  type TradeOfferView,
} from '@city-game/shared';

interface RoomPlayer extends RoomPlayerView {
  socketId: string;
}

interface Room {
  code: string;
  hostId: string;
  mode: 'simple' | 'complex';
  status: 'lobby' | 'active' | 'finished';
  players: RoomPlayer[];
  game: GameState | null;
  pendingTrade: TradeOfferView | null;
  botTimer?: ReturnType<typeof setTimeout>;
}

const rooms = new Map<string, Room>();
const httpServer = createServer((_, response) => {
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ service: 'city-game', status: 'ok' }));
});

const allowedOrigins = (process.env.GAME_WEB_ORIGIN ?? 'http://localhost:5173').split(',');
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 16_384,
});

function roomView(room: Room): RoomView {
  return {
    code: room.code,
    hostId: room.hostId,
    mode: room.mode,
    status: room.status,
    players: room.players.map(({ id, name, ready, connected, isBot }) => ({ id, name, ready, connected, isBot })),
  };
}

function broadcastRoom(room: Room) {
  if (room.pendingTrade) {
    const proposer = room.players.find((player) => player.id === room.pendingTrade?.proposerId);
    const recipient = room.players.find((player) => player.id === room.pendingTrade?.recipientId);
    if (!proposer?.connected || !recipient?.connected) {
      room.pendingTrade = null;
      io.to(room.code).emit('trade:notice', { message: '交易参与者已离线，报价已自动取消。' });
    }
  }
  castBotCouncilVotes(room);
  if (room.status !== 'active') room.pendingTrade = null;
  io.to(room.code).emit('room:update', roomView(room));
  if (room.game) io.to(room.code).emit('game:update', room.game);
  io.to(room.code).emit('trade:update', room.pendingTrade);
  scheduleBotTurn(room);
}

function castBotCouncilVotes(room: Room) {
  if (!room.game || room.game.phase !== 'council') return;
  const ruleIds = Object.keys(cityCouncilRules) as CityCouncilRuleId[];
  for (const bot of room.players.filter((player) => player.isBot)) {
    if (room.game.phase !== 'council') break;
    if (room.game.councilVotes[bot.id] || room.game.players.find((player) => player.id === bot.id)?.bankrupt) continue;
    room.game = voteCityCouncil(room.game, bot.id, ruleIds[randomInt(ruleIds.length)]);
  }
}

function applyBotAction(room: Room) {
  if (!room.game) return;
  const game = room.game;
  const current = game.players[game.currentPlayerIndex];
  const bot = room.players.find((player) => player.id === current.id && player.isBot);
  if (!bot) return;

  if (game.phase === 'roll') {
    room.game = rollDice(game, current.id, [randomInt(1, 7), randomInt(1, 7)], randomInt(cityEventCards.length));
  } else if (game.phase === 'jail') {
    const attempts = game.jailAttempts[current.id] ?? 0;
    room.game = attempts >= 2 || current.cash < 50
      ? payJailBailAndRoll(game, current.id, [randomInt(1, 7), randomInt(1, 7)], randomInt(cityEventCards.length))
      : tryJailDoubles(game, current.id, [randomInt(1, 7), randomInt(1, 7)], randomInt(cityEventCards.length));
  } else if (game.phase === 'buy' && game.pendingProperty !== null) {
    const space = game.board[game.pendingProperty];
    room.game = space.type === 'property' && current.cash >= space.price + 100
      ? buyProperty(game, current.id)
      : declineProperty(game, current.id);
  } else if (game.phase === 'auction' && game.auction?.currentBidderId === current.id) {
    const space = game.board[game.auction.propertyIndex];
    const maximum = space.type === 'property' ? Math.min(current.cash, Math.max(10, Math.ceil(space.price * 0.65))) : 0;
    const nextBid = game.auction.currentBid + 10;
    room.game = nextBid <= maximum ? bidOnProperty(game, current.id, nextBid) : passAuction(game, current.id);
  } else if (game.phase === 'end-turn') {
    room.game = endTurn(game, current.id);
  }
}

function scheduleBotTurn(room: Room) {
  if (room.botTimer || !room.game || room.status !== 'active') return;
  const current = room.game.players[room.game.currentPlayerIndex];
  if (room.game.phase === 'council' || !room.players.some((player) => player.id === current.id && player.isBot)) return;
  room.botTimer = setTimeout(() => {
    room.botTimer = undefined;
    try {
      applyBotAction(room);
      if (room.game?.phase === 'finished') room.status = 'finished';
      broadcastRoom(room);
    } catch (error) {
      console.error(`Bot action failed in room ${room.code}:`, error);
    }
  }, 650);
}

function createRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function getRoom(code: string, playerId: string, socketId: string) {
  const room = rooms.get(code);
  if (!room) throw new Error('Room not found.');
  if (!room.players.some((player) => player.id === playerId && player.socketId === socketId && player.connected)) {
    throw new Error('This connection does not own the player seat.');
  }
  return room;
}

function emitError(socketId: string, error: unknown) {
  io.to(socketId).emit('game:error', { message: error instanceof Error ? error.message : 'Request failed.' });
}

io.on('connection', (socket) => {
  socket.on('room:create', (payload: unknown) => {
    const parsed = createRoomSchema.safeParse(payload);
    if (!parsed.success) return emitError(socket.id, new Error('Enter a name of 1-18 characters.'));
    const code = createRoomCode();
    const playerId = randomUUID();
    const room: Room = {
      code,
      hostId: playerId,
      mode: parsed.data.mode,
      status: 'lobby',
      players: [{ id: playerId, name: parsed.data.playerName, ready: true, connected: true, socketId: socket.id }],
      game: null,
      pendingTrade: null,
    };
    rooms.set(code, room);
    socket.join(code);
    socket.emit('room:joined', { room: roomView(room), playerId });
  });

  socket.on('room:join', (payload: unknown) => {
    const parsed = joinRoomSchema.safeParse(payload);
    if (!parsed.success) return emitError(socket.id, new Error('Check the room code and player name.'));
    const room = rooms.get(parsed.data.roomCode);
    if (!room) return emitError(socket.id, new Error('Room not found.'));
    if (room.status !== 'lobby') return emitError(socket.id, new Error('This game has already started.'));
    if (room.players.length >= 8) return emitError(socket.id, new Error('This room is full.'));
    const playerId = randomUUID();
    room.players.push({ id: playerId, name: parsed.data.playerName, ready: false, connected: true, socketId: socket.id });
    socket.join(room.code);
    socket.emit('room:joined', { room: roomView(room), playerId });
    broadcastRoom(room);
  });

  socket.on('room:leave', (payload: unknown) => {
    const parsed = roomActionSchema.safeParse(payload);
    if (!parsed.success) return emitError(socket.id, new Error('Invalid room action.'));
    try {
      const room = getRoom(parsed.data.roomCode, parsed.data.playerId, socket.id);
      const leavingIndex = room.players.findIndex((player) => player.id === parsed.data.playerId);
      const [leavingPlayer] = room.players.splice(leavingIndex, 1);
      socket.leave(room.code);

      if (room.status === 'lobby') {
        if (room.players.length === 0) {
          rooms.delete(room.code);
        } else if (room.hostId === leavingPlayer.id) {
          room.hostId = room.players[0].id;
          room.players[0].ready = true;
        }
      } else {
        room.players.splice(leavingIndex, 0, { ...leavingPlayer, connected: false });
      }

      socket.emit('room:left', { roomCode: room.code });
      if (rooms.has(room.code)) broadcastRoom(room);
    } catch (error) {
      emitError(socket.id, error);
    }
  });

  socket.on('room:ready', (payload: unknown) => {
    const parsed = roomActionSchema.safeParse(payload);
    if (!parsed.success) return emitError(socket.id, new Error('Invalid room action.'));
    try {
      const room = getRoom(parsed.data.roomCode, parsed.data.playerId, socket.id);
      if (room.status !== 'lobby') throw new Error('The game has already started.');
      const player = room.players.find((entry) => entry.id === parsed.data.playerId)!;
      player.ready = !player.ready;
      broadcastRoom(room);
    } catch (error) {
      emitError(socket.id, error);
    }
  });

  socket.on('game:start', (payload: unknown) => {
    const parsed = startGameSchema.safeParse(payload);
    if (!parsed.success) return emitError(socket.id, new Error('Invalid room action.'));
    try {
      const room = getRoom(parsed.data.roomCode, parsed.data.playerId, socket.id);
      if (room.hostId !== parsed.data.playerId) throw new Error('Only the host can start the game.');
      if (parsed.data.solo && room.players.length !== 1) throw new Error('单人挑战只能由房主单独开局。');
      if (!parsed.data.solo && (room.players.length < 4 || room.players.length > 8)) throw new Error('普通模式需要 4-8 位玩家。');
      if (room.players.some((player) => !player.ready)) throw new Error('All players must be ready.');
      if (parsed.data.solo) {
        const botNames = ['电脑·晨星', '电脑·海风', '电脑·云杉'];
        botNames.forEach((name) => room.players.push({ id: randomUUID(), name, ready: true, connected: true, isBot: true, socketId: `bot:${randomUUID()}` }));
      }
      room.status = 'active';
      room.game = createGame(room.mode, room.players.map(({ id, name }) => ({ id, name })));
      broadcastRoom(room);
    } catch (error) {
      emitError(socket.id, error);
    }
  });

  const applyGameAction = (event: string, handler: (game: GameState, playerId: string) => GameState) => {
    socket.on(event, (payload: unknown) => {
      const parsed = roomActionSchema.safeParse(payload);
      if (!parsed.success) return emitError(socket.id, new Error('Invalid game action.'));
      try {
        const room = getRoom(parsed.data.roomCode, parsed.data.playerId, socket.id);
        if (room.status !== 'active' || !room.game) throw new Error('No active game in this room.');
        room.game = handler(room.game, parsed.data.playerId);
        if (room.game.phase === 'finished') room.status = 'finished';
        broadcastRoom(room);
      } catch (error) {
        emitError(socket.id, error);
      }
    });
  };

  applyGameAction('game:roll', (game, playerId) => rollDice(
    game,
    playerId,
    [randomInt(1, 7), randomInt(1, 7)],
    randomInt(cityEventCards.length),
  ));
  const applyJailAction = (event: string, action: typeof tryJailDoubles | typeof payJailBailAndRoll) => {
    socket.on(event, (payload: unknown) => {
      const parsed = jailActionSchema.safeParse(payload);
      if (!parsed.success) return emitError(socket.id, new Error('Invalid jail action.'));
      try {
        const room = getRoom(parsed.data.roomCode, parsed.data.playerId, socket.id);
        if (room.status !== 'active' || !room.game) throw new Error('No active game in this room.');
        room.game = action(room.game, parsed.data.playerId, [randomInt(1, 7), randomInt(1, 7)], randomInt(cityEventCards.length));
        if (room.game.phase === 'finished') room.status = 'finished';
        broadcastRoom(room);
      } catch (error) {
        emitError(socket.id, error);
      }
    });
  };
  applyJailAction('game:jail-try', tryJailDoubles);
  applyJailAction('game:jail-pay', payJailBailAndRoll);
  applyGameAction('game:buy', buyProperty);
  socket.on('game:mortgage', (payload: unknown) => {
    const parsed = buildPropertySchema.safeParse(payload);
    if (!parsed.success) return emitError(socket.id, new Error('Invalid mortgage action.'));
    try {
      const room = getRoom(parsed.data.roomCode, parsed.data.playerId, socket.id);
      if (room.status !== 'active' || !room.game) throw new Error('No active game in this room.');
      room.game = mortgageProperty(room.game, parsed.data.playerId, parsed.data.index);
      broadcastRoom(room);
    } catch (error) {
      emitError(socket.id, error);
    }
  });
  socket.on('game:loan-borrow', (payload: unknown) => {
    const parsed = loanActionSchema.safeParse(payload);
    if (!parsed.success || !parsed.data.amount) return emitError(socket.id, new Error('Choose a valid loan amount.'));
    try {
      const room = getRoom(parsed.data.roomCode, parsed.data.playerId, socket.id);
      if (room.status !== 'active' || !room.game) throw new Error('No active game in this room.');
      room.game = borrowLoan(room.game, parsed.data.playerId, parsed.data.amount);
      broadcastRoom(room);
    } catch (error) {
      emitError(socket.id, error);
    }
  });
  socket.on('game:loan-repay', (payload: unknown) => {
    const parsed = loanActionSchema.safeParse(payload);
    if (!parsed.success) return emitError(socket.id, new Error('Invalid loan action.'));
    try {
      const room = getRoom(parsed.data.roomCode, parsed.data.playerId, socket.id);
      if (room.status !== 'active' || !room.game) throw new Error('No active game in this room.');
      room.game = repayLoan(room.game, parsed.data.playerId);
      broadcastRoom(room);
    } catch (error) {
      emitError(socket.id, error);
    }
  });
  socket.on('game:build', (payload: unknown) => {
    const parsed = buildPropertySchema.safeParse(payload);
    if (!parsed.success) return emitError(socket.id, new Error('Invalid building action.'));
    try {
      const room = getRoom(parsed.data.roomCode, parsed.data.playerId, socket.id);
      if (room.status !== 'active' || !room.game) throw new Error('No active game in this room.');
      room.game = buildHouse(room.game, parsed.data.playerId, parsed.data.index);
      broadcastRoom(room);
    } catch (error) {
      emitError(socket.id, error);
    }
  });
  applyGameAction('game:decline', declineProperty);
  applyGameAction('game:end-turn', endTurn);
  socket.on('game:council-vote', (payload: unknown) => {
    const parsed = councilVoteSchema.safeParse(payload);
    if (!parsed.success) return emitError(socket.id, new Error('Invalid city council vote.'));
    try {
      const room = getRoom(parsed.data.roomCode, parsed.data.playerId, socket.id);
      if (room.status !== 'active' || !room.game) throw new Error('No active game in this room.');
      room.game = voteCityCouncil(room.game, parsed.data.playerId, parsed.data.ruleId);
      broadcastRoom(room);
    } catch (error) {
      emitError(socket.id, error);
    }
  });
  socket.on('game:auction-bid', (payload: unknown) => {
    const parsed = auctionBidSchema.safeParse(payload);
    if (!parsed.success) return emitError(socket.id, new Error('Enter a valid bid.'));
    try {
      const room = getRoom(parsed.data.roomCode, parsed.data.playerId, socket.id);
      if (room.status !== 'active' || !room.game) throw new Error('No active game in this room.');
      room.game = bidOnProperty(room.game, parsed.data.playerId, parsed.data.amount);
      broadcastRoom(room);
    } catch (error) {
      emitError(socket.id, error);
    }
  });
  applyGameAction('game:auction-pass', passAuction);

  socket.on('game:trade-offer', (payload: unknown) => {
    const parsed = tradeOfferSchema.safeParse(payload);
    if (!parsed.success) return emitError(socket.id, new Error('Invalid trade offer.'));
    try {
      const room = getRoom(parsed.data.roomCode, parsed.data.playerId, socket.id);
      if (room.status !== 'active' || !room.game || room.game.mode !== 'complex') throw new Error('交易仅在复杂版对局中开放。');
      if (room.pendingTrade) throw new Error('当前已有一笔待处理交易。');
      const proposer = room.players.find((player) => player.id === parsed.data.playerId);
      const recipient = room.players.find((player) => player.id === parsed.data.recipientId);
      if (!proposer || proposer.isBot || !recipient || recipient.isBot || proposer.id === recipient.id) throw new Error('请选择另一位真人玩家。');
      const terms: TradeOfferView = {
        proposerId: proposer.id,
        recipientId: recipient.id,
        proposerCash: parsed.data.proposerCash,
        proposerPropertyIndexes: parsed.data.proposerPropertyIndexes,
        recipientCash: parsed.data.recipientCash,
        recipientPropertyIndexes: parsed.data.recipientPropertyIndexes,
      };
      executeTrade(room.game, terms);
      room.pendingTrade = terms;
      broadcastRoom(room);
    } catch (error) {
      emitError(socket.id, error);
    }
  });

  const respondToTrade = (event: string, response: 'accept' | 'decline' | 'withdraw') => {
    socket.on(event, (payload: unknown) => {
      const parsed = tradeResponseSchema.safeParse(payload);
      if (!parsed.success) return emitError(socket.id, new Error('Invalid trade response.'));
      let room: Room | null = null;
      try {
        room = getRoom(parsed.data.roomCode, parsed.data.playerId, socket.id);
        const offer = room.pendingTrade;
        if (room.status !== 'active' || !room.game || !offer) throw new Error('There is no pending trade.');
        if (response === 'accept' && parsed.data.playerId !== offer.recipientId) throw new Error('Only the recipient can accept a trade.');
        if (response === 'decline' && parsed.data.playerId !== offer.recipientId) throw new Error('Only the recipient can decline a trade.');
        if (response === 'withdraw' && parsed.data.playerId !== offer.proposerId) throw new Error('Only the proposer can withdraw a trade.');
        if (response === 'accept') {
          room.game = executeTrade(room.game, offer);
          io.to(room.code).emit('trade:notice', { message: '交易已完成。' });
        } else if (response === 'decline') {
          io.to(room.code).emit('trade:notice', { message: '交易已被拒绝。' });
        } else {
          io.to(room.code).emit('trade:notice', { message: '交易报价已撤回。' });
        }
        room.pendingTrade = null;
        broadcastRoom(room);
      } catch (error) {
        if (room && error instanceof Error && /no longer tradable|enough cash|active players/.test(error.message)) {
          room.pendingTrade = null;
          broadcastRoom(room);
          emitError(socket.id, new Error('报价中的现金或地产已变化，交易已取消，请重新报价。'));
          return;
        }
        emitError(socket.id, error);
      }
    });
  };
  respondToTrade('game:trade-accept', 'accept');
  respondToTrade('game:trade-decline', 'decline');
  respondToTrade('game:trade-withdraw', 'withdraw');

  socket.on('disconnect', () => {
    for (const room of rooms.values()) {
      const player = room.players.find((entry) => entry.socketId === socket.id);
      if (player) {
        player.connected = false;
        broadcastRoom(room);
      }
    }
  });
});

const port = Number(process.env.PORT ?? 3001);
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Game server listening on http://localhost:${port}`);
});
