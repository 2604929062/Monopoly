import { z } from 'zod';

export const playerNameSchema = z.string().trim().min(1).max(18);
export const roomCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/);
export const gameModeSchema = z.enum(['simple', 'complex']);

export const createRoomSchema = z.object({
  playerName: playerNameSchema,
  mode: gameModeSchema,
});

export const joinRoomSchema = z.object({
  roomCode: roomCodeSchema,
  playerName: playerNameSchema,
});

export const roomActionSchema = z.object({
  roomCode: roomCodeSchema,
  playerId: z.string().uuid(),
});

export const buildPropertySchema = roomActionSchema.extend({
  index: z.number().int().nonnegative(),
});

export const auctionBidSchema = roomActionSchema.extend({
  amount: z.number().int().positive(),
});

export const jailActionSchema = roomActionSchema;
export const startGameSchema = roomActionSchema.extend({
  solo: z.boolean().optional(),
});
export const loanActionSchema = roomActionSchema.extend({
  amount: z.union([z.literal(200), z.literal(500), z.literal(1000)]).optional(),
});
export const councilVoteSchema = roomActionSchema.extend({
  ruleId: z.enum(['rent-growth', 'loan-relief', 'start-subsidy']),
});

export const tradeOfferSchema = roomActionSchema.extend({
  recipientId: z.string().uuid(),
  proposerCash: z.number().int().nonnegative(),
  proposerPropertyIndexes: z.array(z.number().int().nonnegative()).max(40),
  recipientCash: z.number().int().nonnegative(),
  recipientPropertyIndexes: z.array(z.number().int().nonnegative()).max(40),
}).superRefine((offer, context) => {
  if (new Set(offer.proposerPropertyIndexes).size !== offer.proposerPropertyIndexes.length) {
    context.addIssue({ code: 'custom', path: ['proposerPropertyIndexes'], message: 'Property indexes must be unique.' });
  }
  if (new Set(offer.recipientPropertyIndexes).size !== offer.recipientPropertyIndexes.length) {
    context.addIssue({ code: 'custom', path: ['recipientPropertyIndexes'], message: 'Property indexes must be unique.' });
  }
});

export const tradeResponseSchema = roomActionSchema;

export interface TradeOfferView {
  proposerId: string;
  recipientId: string;
  proposerCash: number;
  proposerPropertyIndexes: number[];
  recipientCash: number;
  recipientPropertyIndexes: number[];
}

export type GameModeInput = z.infer<typeof gameModeSchema>;

export interface RoomPlayerView {
  id: string;
  name: string;
  ready: boolean;
  connected: boolean;
  isBot?: boolean;
}

export interface RoomView {
  code: string;
  hostId: string;
  mode: GameModeInput;
  status: 'lobby' | 'active' | 'finished';
  players: RoomPlayerView[];
}

export interface ServerError {
  message: string;
}
