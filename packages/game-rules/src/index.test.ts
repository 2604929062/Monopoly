import { describe, expect, it } from 'vitest'
import { bidOnProperty, borrowLoan, buildHouse, buyProperty, canMortgageProperty, canTradeProperty, createGame, declineProperty, endTurn, executeTrade, getPlayerNetWorth, getPlayerSettlement, getPropertyRent, JAIL_BAIL, mortgageProperty, passAuction, payJailBailAndRoll, repayLoan, rollDice, tryJailDoubles, voteCityCouncil, type GameState } from './index'

const players = Array.from({ length: 4 }, (_, index) => ({ id: `p${index + 1}`, name: `Player ${index + 1}` }))

describe('game rules', () => {
  it('requires four to eight unique players', () => {
    expect(() => createGame('simple', players.slice(0, 3))).toThrow()
    expect(() => createGame('simple', [...players, ...Array.from({ length: 5 }, (_, i) => ({ id: `extra${i}`, name: 'Extra' }))])).toThrow()
    expect(() => createGame('simple', [...players, { id: 'p1', name: 'Duplicate' }])).toThrow()
  })

  it('moves active player and awards salary after passing start', () => {
    const game = createGame('complex', players)
    const nearStart = { ...game, players: game.players.map((player, index) => index === 0 ? { ...player, position: 35 } : player) }
    const next = rollDice(nearStart, 'p1', [3, 3])
    expect(next.players[0].position).toBe(1)
    expect(next.players[0].cash).toBe(1700)
    expect(next.lastRoll).toEqual([3, 3])
  })

  it('allows the active player to buy property and pass turn', () => {
    const game = createGame('complex', players)
    const offer = rollDice(game, 'p1', [1, 2])
    expect(offer.phase).toBe('buy')
    const purchased = buyProperty(offer, 'p1')
    expect(purchased.owners[3]).toBe('p1')
    expect(purchased.players[0].cash).toBe(1400)
    const next = endTurn(purchased, 'p1')
    expect(next.currentPlayerIndex).toBe(1)
  })

  it('sells a declined property to the highest valid bidder', () => {
    const game = { ...createGame('complex', players), phase: 'buy' as const, pendingProperty: 1 }
    const auction = declineProperty(game, 'p1')
    expect(auction.phase).toBe('auction')
    expect(auction.auction?.currentBidderId).toBe('p1')

    const p1Passes = passAuction(auction, 'p1')
    const p2Bids = bidOnProperty(p1Passes, 'p2', 120)
    expect(p2Bids.auction?.currentBidderId).toBe('p3')
    const p3Passes = passAuction(p2Bids, 'p3')
    const sold = passAuction(p3Passes, 'p4')

    expect(sold.phase).toBe('end-turn')
    expect(sold.auction).toBeNull()
    expect(sold.owners[1]).toBe('p2')
    expect(sold.players[1].cash).toBe(1380)
    expect(sold.log.at(-1)).toContain('120 城币')
  })

  it('leaves a property unsold when every player passes', () => {
    let game: GameState = { ...createGame('simple', players), phase: 'buy', pendingProperty: 3 }
    game = declineProperty(game, 'p1')
    for (const player of players) game = passAuction(game, player.id)

    expect(game.phase).toBe('end-turn')
    expect(game.owners[3]).toBeUndefined()
    expect(game.auction).toBeNull()
  })

  it('rejects invalid, unaffordable, and out-of-turn auction bids', () => {
    const game = declineProperty({ ...createGame('complex', players), phase: 'buy' as const, pendingProperty: 1 }, 'p1')
    expect(() => bidOnProperty(game, 'p2', 100)).toThrow('It is not your turn')
    expect(() => bidOnProperty(game, 'p1', 0)).toThrow('higher than the current bid')
    expect(() => bidOnProperty(game, 'p1', 1501)).toThrow('Not enough cash')
  })

  it('lets an outbid leader re-enter and win while passed players stay out', () => {
    let game = declineProperty({ ...createGame('complex', players), phase: 'buy' as const, pendingProperty: 1 }, 'p1')
    game = passAuction(game, 'p1')
    game = bidOnProperty(game, 'p2', 100)
    game = bidOnProperty(game, 'p3', 120)
    expect(game.auction?.currentBidderId).toBe('p4')
    game = passAuction(game, 'p4')
    expect(game.auction?.currentBidderId).toBe('p2')
    game = bidOnProperty(game, 'p2', 140)
    game = passAuction(game, 'p3')
    expect(game.phase).toBe('end-turn')
    expect(game.owners[1]).toBe('p2')
    expect(game.players[1].cash).toBe(1360)
  })

  it('moves to jail and enters jail action phase on the detained player next turn', () => {
    const game = createGame('complex', players)
    const nearJail = { ...game, players: game.players.map((player, index) => index === 0 ? { ...player, position: 28 } : player) }
    const jailed = rollDice(nearJail, 'p1', [1, 1])
    expect(jailed.phase).toBe('end-turn')
    expect(jailed.players[0].position).toBe(10)
    let turn = endTurn(jailed, 'p1')
    expect(turn.phase).toBe('roll')
    expect(turn.currentPlayerIndex).toBe(1)
    const passTurn = (state: GameState, playerId: string) => endTurn({ ...state, phase: 'end-turn' }, playerId)
    turn = passTurn(turn, 'p2')
    turn = passTurn(turn, 'p3')
    turn = passTurn(turn, 'p4')
    expect(turn.phase).toBe('jail')
    expect(turn.currentPlayerIndex).toBe(0)
    const firstFailedTry = tryJailDoubles(turn, 'p1', [1, 2])
    expect(firstFailedTry.phase).toBe('end-turn')
    const nextPlayer = endTurn(firstFailedTry, 'p1')
    expect(nextPlayer.phase).toBe('roll')
    expect(nextPlayer.currentPlayerIndex).toBe(1)
  })

  it('ends failed jail turns and releases on doubles', () => {
    const base = createGame('complex', players)
    const game = { ...base, phase: 'jail' as const, players: base.players.map((player, index) => index === 0 ? { ...player, position: 10 } : player), jailAttempts: { p1: 0 } }
    const failed = tryJailDoubles(game, 'p1', [1, 2])
    expect(failed.phase).toBe('end-turn')
    expect(failed.jailAttempts.p1).toBe(1)
    const released = tryJailDoubles({ ...game, jailAttempts: { p1: 2 } }, 'p1', [2, 2])
    expect(released.phase).not.toBe('jail')
    expect(released.players[0].position).toBe(14)
    expect(released.players[0].cash).toBe(1500)
  })

  it('charges bail, forces bail after the third failure, and rejects other players', () => {
    const base = createGame('complex', players)
    const game = { ...base, phase: 'jail' as const, players: base.players.map((player, index) => index === 0 ? { ...player, position: 10 } : player), jailAttempts: { p1: 0 } }
    const paid = payJailBailAndRoll(game, 'p1', [1, 2])
    expect(paid.players[0].cash).toBe(1500 - JAIL_BAIL)
    expect(paid.players[0].position).toBe(13)
    const finalAttempt = tryJailDoubles({ ...game, jailAttempts: { p1: 2 } }, 'p1', [1, 2])
    expect(finalAttempt.players[0].cash).toBe(1500 - JAIL_BAIL)
    expect(finalAttempt.players[0].position).toBe(13)
    expect(() => tryJailDoubles(game, 'p2', [1, 2])).toThrow()
  })

  it('transfers rent from the visitor to the property owner', () => {
    const game = createGame('complex', players)
    const ownedGame = { ...game, currentPlayerIndex: 1, owners: { 3: 'p1' } }
    const next = rollDice(ownedGame, 'p2', [1, 2])

    expect(next.phase).toBe('end-turn')
    expect(next.players[0].cash).toBe(1510)
    expect(next.players[1].cash).toBe(1490)
  })

  it('doubles rent for a complete district and increases rent with houses', () => {
    const game = createGame('complex', players)
    const completeDistrict = { ...game, owners: { 1: 'p1', 3: 'p1' } }
    expect(getPropertyRent(completeDistrict, 1)).toBe(16)

    const developed = { ...completeDistrict, buildings: { 1: 1 } }
    expect(getPropertyRent(developed, 1)).toBe(48)
    expect(getPropertyRent({ ...completeDistrict, buildings: { 1: 2 } }, 1)).toBe(96)
    const nearTile = { ...developed, currentPlayerIndex: 1, players: developed.players.map((player, index) => index === 1 ? { ...player, position: 39 } : player) }
    const paid = rollDice(nearTile, 'p2', [1, 1])
    expect(paid.players[0].cash).toBe(1548)
    expect(paid.players[1].cash).toBe(1652)
  })

  it('allows balanced house building only after completing a complex district', () => {
    const game = createGame('complex', players)
    const activeTurn = { ...game, phase: 'end-turn' as const, owners: { 1: 'p1' } }
    expect(() => buildHouse(activeTurn, 'p1', 1)).toThrow('complete the district')

    const completeDistrict = {
      ...game,
      phase: 'end-turn' as const,
      owners: { 1: 'p1', 3: 'p1' },
    }
    const firstHouse = buildHouse(completeDistrict, 'p1', 1)
    expect(firstHouse.buildings[1]).toBe(1)
    expect(firstHouse.players[0].cash).toBe(1460)
    expect(() => buildHouse(firstHouse, 'p1', 1)).toThrow('evenly')
    expect(() => buildHouse({ ...firstHouse, mode: 'simple' }, 'p1', 3)).toThrow('complex mode')
  })

  it('allows a player to mortgage an unbuilt property and stops its rent', () => {
    const game = { ...createGame('simple', players), phase: 'end-turn' as const, owners: { 3: 'p1' } }
    expect(canMortgageProperty(game, 'p1', 3)).toBe(true)
    const mortgaged = mortgageProperty(game, 'p1', 3)
    expect(mortgaged.players[0].cash).toBe(1560)
    expect(mortgaged.mortgages[3]).toBe(true)
    expect(getPropertyRent(mortgaged, 3)).toBe(0)
    expect(canMortgageProperty(mortgaged, 'p1', 3)).toBe(false)
  })

  it('accrues one loan interest payment per completed round and repays the balance', () => {
    const borrowed = borrowLoan({ ...createGame('simple', players), phase: 'end-turn' as const }, 'p1', 500)
    expect(borrowed.players[0].cash).toBe(2000)
    expect(borrowed.loans.p1.accruedInterest).toBe(0)
    const nextPlayer = endTurn(borrowed, 'p1')
    const afterRound = { ...nextPlayer, currentPlayerIndex: 3, phase: 'end-turn' as const }
    const nextRound = endTurn(afterRound, 'p4')
    expect(nextRound.round).toBe(2)
    expect(nextRound.loans.p1.accruedInterest).toBe(60)
    const repaid = repayLoan({ ...nextRound, phase: 'end-turn' as const, currentPlayerIndex: 0 }, 'p1')
    expect(repaid.loans.p1).toBeUndefined()
    expect(repaid.players[0].cash).toBe(1440)
  })

  it('opens city council every four completed complex rounds and applies the winning rule', () => {
    const base = createGame('complex', players)
    const roundFour = { ...base, round: 4, currentPlayerIndex: 3, phase: 'end-turn' as const }
    const council = endTurn(roundFour, 'p4')
    expect(council.round).toBe(5)
    expect(council.phase).toBe('council')

    let result = voteCityCouncil(council, 'p1', 'start-subsidy')
    result = voteCityCouncil(result, 'p2', 'start-subsidy')
    result = voteCityCouncil(result, 'p3', 'start-subsidy')
    result = voteCityCouncil(result, 'p4', 'rent-growth')
    expect(result.phase).toBe('roll')
    expect(result.activeCityRule).toEqual({ id: 'start-subsidy', expiresAtRound: 7 })

    const nearStart = { ...result, players: result.players.map((player, index) => index === 0 ? { ...player, position: 35 } : player) }
    expect(rollDice(nearStart, 'p1', [3, 3]).players[0].cash).toBe(1800)
  })

  it('rejects repeat council votes and leaves the city unchanged on a tie', () => {
    const council = { ...createGame('complex', players), phase: 'council' as const }
    const firstVote = voteCityCouncil(council, 'p1', 'rent-growth')
    expect(() => voteCityCouncil(firstVote, 'p1', 'loan-relief')).toThrow('already voted')
    const secondVote = voteCityCouncil(firstVote, 'p2', 'rent-growth')
    const thirdVote = voteCityCouncil(secondVote, 'p3', 'loan-relief')
    const tied = voteCityCouncil(thirdVote, 'p4', 'loan-relief')
    expect(tied.phase).toBe('roll')
    expect(tied.activeCityRule).toBeNull()
    expect(tied.log.at(-1)).toContain('票数相同')
  })

  it('excludes bankrupt players from council ballots and does not open in simple mode', () => {
    const game = createGame('complex', players)
    const council = {
      ...game,
      phase: 'council' as const,
      players: game.players.map((player) => player.id === 'p4' ? { ...player, bankrupt: true } : player),
    }
    let result = voteCityCouncil(council, 'p1', 'rent-growth')
    result = voteCityCouncil(result, 'p2', 'loan-relief')
    result = voteCityCouncil(result, 'p3', 'loan-relief')
    expect(result.activeCityRule?.id).toBe('loan-relief')
    expect(() => voteCityCouncil(council, 'p4', 'rent-growth')).toThrow('Only active players')

    const simple = { ...createGame('simple', players), round: 4, currentPlayerIndex: 3, phase: 'end-turn' as const }
    expect(endTurn(simple, 'p4').phase).toBe('roll')
  })

  it('applies the rent increase only while the three-round policy is active', () => {
    const game = createGame('complex', players)
    const property = game.board.findIndex((space) => space.type === 'property')
    const active = {
      ...game,
      round: 7,
      owners: { [property]: 'p2' },
      activeCityRule: { id: 'rent-growth' as const, expiresAtRound: 7 },
    }
    const space = active.board[property]
    if (space.type !== 'property') throw new Error('Expected a property space')
    expect(getPropertyRent(active, property)).toBe(Math.ceil(space.rent * 1.25))
    expect(getPropertyRent({ ...active, round: 8 }, property)).toBe(space.rent)
  })

  it('uses the completed round when expiring reduced loan interest', () => {
    const game = createGame('complex', players)
    const endingRoundSeven = {
      ...game,
      round: 7,
      currentPlayerIndex: 3,
      phase: 'end-turn' as const,
      activeCityRule: { id: 'loan-relief' as const, expiresAtRound: 7 },
      loans: { p1: { principal: 200, interestPerRound: 20, accruedInterest: 0 } },
    }
    const afterRoundSeven = endTurn(endingRoundSeven, 'p4')
    expect(afterRoundSeven.loans.p1.accruedInterest).toBe(10)

    const endingRoundEight = { ...afterRoundSeven, round: 8, currentPlayerIndex: 3, phase: 'end-turn' as const }
    expect(endTurn(endingRoundEight, 'p4').loans.p1.accruedInterest).toBe(30)
  })

  it('draws a server-selected event card and applies its cash effect', () => {
    const game = createGame('simple', players)
    const nearEvent = { ...game, players: game.players.map((player, index) => index === 0 ? { ...player, position: game.board.length - 1 } : player) }
    const gain = rollDice(nearEvent, 'p1', [1, 1], 0)

    expect(gain.phase).toBe('end-turn')
    expect(gain.players[0].cash).toBe(1820)
    expect(gain.lastEventCard?.title).toBe('街区庆典')
    expect(gain.log.at(-1)).toContain('获得 120 城币')

    const expense = rollDice(nearEvent, 'p1', [1, 1], 5)
    expect(expense.players[0].cash).toBe(1600)
    expect(expense.lastEventCard?.amount).toBe(-100)
  })

  it('applies citywide events to active players and relief to the poorest player', () => {
    const game = createGame('simple', players)
    const citywide = rollDice({ ...game, players: game.players.map((player, index) => index === 0 ? { ...player, position: game.board.length - 1 } : player) }, 'p1', [1, 1], 6)
    expect(citywide.players[0].cash).toBe(1750)
    expect(citywide.players.slice(1).every((player) => player.cash === 1550)).toBe(true)
    const relief = rollDice({ ...game, players: game.players.map((player, index) => index === 0 ? { ...player, position: game.board.length - 1, cash: 1000 } : player) }, 'p1', [1, 1], 8)
    expect(relief.players[0].cash).toBe(1380)
    expect(relief.players[1].cash).toBe(1500)
  })

  it('uses property value before cash when a player cannot cover rent', () => {
    const base = createGame('complex', players)
    const game = { ...base, phase: 'roll' as const, owners: { 1: 'p1', 3: 'p2' }, players: base.players.map((player, index) => index === 0 ? { ...player, cash: 0, position: 0 } : player) }
    const next = rollDice(game, 'p1', [1, 2])
    expect(next.players[0].bankrupt).toBe(false)
    expect(next.owners[3]).toBe('p2')
    expect(next.owners[1]).toBe('p2')
    expect(next.players[0].cash).toBe(0)
    expect(next.players[1].cash).toBe(1500)
  })

  it('requires a valid event card when landing on an event space', () => {
    const game = createGame('simple', players)
    const nearEvent = { ...game, players: game.players.map((player, index) => index === 0 ? { ...player, position: game.board.length - 1 } : player) }
    expect(() => rollDice(nearEvent, 'p1', [1, 1])).toThrow('A valid event card must be drawn')
    expect(() => rollDice(nearEvent, 'p1', [1, 1], 999)).toThrow('A valid event card must be drawn')
  })

  it('rejects actions from players who do not own the turn', () => {
    const game = createGame('simple', players)
    expect(() => rollDice(game, 'p2', [2, 3])).toThrow()
  })

  it('settles at the round limit using cash plus property value', () => {
    const game = createGame('simple', players)
    const finalTurn = {
      ...game,
      phase: 'end-turn' as const,
      round: game.roundLimit,
      players: game.players.map((player, index) => ({ ...player, cash: index === 0 ? 500 : index === 1 ? 600 : 400 })),
      owners: { 3: 'p1' },
    }

    const finished = endTurn(finalTurn, 'p1')
    expect(finished.phase).toBe('finished')
    expect(finished.winnerId).toBe('p1')
    expect(finished.finishReason).toBe('round-limit')
  })

  it('sets a higher safety limit for complex games', () => {
    expect(createGame('complex', players).roundLimit).toBeGreaterThan(createGame('simple', players).roundLimit)
  })

  it('includes house value and loan debt in final net worth', () => {
    const base = createGame('complex', players)
    const game: GameState = {
      ...base,
      owners: { 1: 'p1' },
      buildings: { 1: 2 },
      loans: { p1: { principal: 500, interestPerRound: 60, accruedInterest: 60 } },
      players: base.players.map((player) => player.id === 'p1' ? { ...player, cash: 1000 } : player),
    }
    const property = game.board[1]
    if (property.type !== 'property') throw new Error('Expected a property space')
    expect(getPlayerSettlement(game, 'p1')).toEqual({
      cash: 1000,
      propertyValue: property.price,
      houseValue: Math.ceil(property.price / 2) * 2,
      loanDebt: 560,
      netWorth: 1000 + property.price + Math.ceil(property.price / 2) * 2 - 560,
    })
    expect(getPlayerNetWorth(game, 'p1')).toBe(getPlayerSettlement(game, 'p1').netWorth)
  })

  it('exchanges cash and eligible properties atomically', () => {
    const base = createGame('complex', players)
    const game: GameState = {
      ...base,
      owners: { 1: 'p1', 3: 'p1', 5: 'p2' },
      players: base.players.map((player) => player.id === 'p1' ? { ...player, cash: 900 } : player.id === 'p2' ? { ...player, cash: 700 } : player),
    }
    expect(canTradeProperty(game, 'p1', 1)).toBe(true)

    const traded = executeTrade(game, {
      proposerId: 'p1',
      recipientId: 'p2',
      proposerCash: 200,
      proposerPropertyIndexes: [1],
      recipientCash: 50,
      recipientPropertyIndexes: [5],
    })

    expect(traded.players.find((player) => player.id === 'p1')?.cash).toBe(750)
    expect(traded.players.find((player) => player.id === 'p2')?.cash).toBe(850)
    expect(traded.owners[1]).toBe('p2')
    expect(traded.owners[5]).toBe('p1')
    expect(traded.owners[3]).toBe('p1')
    expect(traded.log.at(-1)).toContain('完成交易')
  })

  it('rejects duplicate, mortgaged, developed, or unaffordable trade assets without mutation', () => {
    const base = createGame('complex', players)
    const game: GameState = { ...base, owners: { 1: 'p1', 3: 'p1' }, mortgages: { 1: true }, buildings: { 3: 1 } }
    expect(canTradeProperty(game, 'p1', 1)).toBe(false)
    expect(canTradeProperty(game, 'p1', 3)).toBe(false)
    expect(() => executeTrade(game, {
      proposerId: 'p1', recipientId: 'p2', proposerCash: 0,
      proposerPropertyIndexes: [1, 1], recipientCash: 0, recipientPropertyIndexes: [],
    })).toThrow('only appear once')
    expect(() => executeTrade(game, {
      proposerId: 'p1', recipientId: 'p2', proposerCash: 1600,
      proposerPropertyIndexes: [], recipientCash: 0, recipientPropertyIndexes: [],
    })).toThrow('enough cash')
    expect(game.players[0].cash).toBe(1500)
    expect(game.owners[1]).toBe('p1')
  })

  it('rejects trade in simple mode and with bankrupt participants', () => {
    const simple = createGame('simple', players)
    const terms = { proposerId: 'p1', recipientId: 'p2', proposerCash: 10, proposerPropertyIndexes: [], recipientCash: 0, recipientPropertyIndexes: [] }
    expect(() => executeTrade(simple, terms)).toThrow('complex game')
    const bankrupt = { ...createGame('complex', players), players: players.map((player, index) => ({ ...player, cash: 1500, position: 0, bankrupt: index === 1 })) }
    expect(() => executeTrade(bankrupt, terms)).toThrow('active players')
  })
})
