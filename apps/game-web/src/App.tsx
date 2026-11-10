import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  Check,
  CircleDollarSign,
  Copy,
  Crown,
  Dices,
  DoorOpen,
  Gavel,
  Landmark,
  LoaderCircle,
  MapPin,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { io, type Socket } from 'socket.io-client'
import { canBuildHouse, canMortgageProperty, cityCouncilRules, getPlayerSettlement, getPropertyRent, JAIL_BAIL, type BoardSpace, type GameState } from 'game-rules'
import type { RoomView, TradeOfferView } from '@city-game/shared'
import './App.css'

type RoomJoined = { room: RoomView; playerId: string }

type PlayerColor = { bg: string; ink: string }
const playerColors: PlayerColor[] = [
  { bg: '#e86b53', ink: '#fff' },
  { bg: '#287b72', ink: '#fff' },
  { bg: '#d9a632', ink: '#18211e' },
  { bg: '#577ea8', ink: '#fff' },
  { bg: '#a95f85', ink: '#fff' },
  { bg: '#6b8050', ink: '#fff' },
  { bg: '#775db2', ink: '#fff' },
  { bg: '#bf6c3b', ink: '#fff' },
]

const translatedNames: Record<string, string> = {
  'Harbor Gate': '海港起点', 'Canal Market': '运河集市', 'City News': '城市快讯',
  'Lantern Lane': '灯笼巷', 'City Tax': '城市税', 'North Station': '北站',
  'Willow Walk': '垂柳步道', 'Ferry Street': '渡船街', 'Glasshouse Row': '玻璃温室街',
  'Detention Office': '临时留置处', 'Foundry Road': '铸造厂路', 'Market Tram': '集市电车',
  'Copper Square': '铜钟广场', 'Clocktower Court': '钟楼庭院', 'East Station': '东站',
  'Studio Alley': '画室巷', 'Museum Steps': '博物馆阶梯', 'Orchard Avenue': '果园大道',
  'Riverside Park': '滨河公园', 'Summit Plaza': '云顶广场', 'Meridian Tower': '子午线大厦',
  'Cloudline Square': '云际广场', 'West Station': '西站', 'Garden Heights': '花园高地',
  'Civic Boulevard': '市政大道', 'Harbor Levy': '港务附加费', 'Aurora Center': '极光中心',
  'Go to Detention': '前往留置处', 'Beacon Heights': '灯塔高地', 'Skybridge One': '天桥一号',
  'Grand Terminal': '中央总站', 'Crown Observatory': '冠顶观景台', 'Night Market': '夜市',
  'Sunrise Pier': '日出码头', 'Harborfront Fee': '海滨维护费', 'Lighthouse Point': '灯塔角',
}

const districtColors: Record<string, string> = {
  'Old Town': '#df795d', Transit: '#7395a6', Riverside: '#86a77b',
  'Works Quarter': '#d5ad52', 'Arts Quarter': '#a784b7', Skyline: '#527d85',
  'Civic Center': '#ba755d', Harborfront: '#4e8c8e',
}
const districtNames: Record<string, string> = {
  'Old Town': '旧城', Transit: '交通', Riverside: '滨河', 'Works Quarter': '工坊',
  'Arts Quarter': '艺文', Skyline: '云际', 'Civic Center': '市政', Harborfront: '海滨',
}

function CityMark() {
  return (
    <svg className="city-mark" viewBox="0 0 64 64" role="img" aria-label="新城棋盘">
      <path d="M7 54h50M12 54V31h11v23m3 0V17h13v37m4 0V27h10v27" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
      <path d="M30 25h4m-4 8h4m-4 8h4m12-7h3m-3 8h3M15 38h4m-4 8h4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="m26 17 6-8 6 8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  )
}

function getBoardCoordinates() {
  const coordinates: Array<[number, number]> = []
  for (let col = 10; col >= 0; col -= 1) coordinates.push([10, col])
  for (let row = 9; row >= 1; row -= 1) coordinates.push([row, 0])
  for (let col = 1; col <= 10; col += 1) coordinates.push([0, col])
  for (let row = 1; row <= 9; row += 1) coordinates.push([row, 10])
  return coordinates
}

const boardCoordinates = getBoardCoordinates()

function districtColor(space: BoardSpace) {
  return space.type === 'property' ? districtColors[space.district] ?? '#777f74' : '#dce3da'
}

function SettlementPanel({ game }: { game: GameState }) {
  const ranking = [...game.players].sort((left, right) => getPlayerSettlement(game, right.id).netWorth - getPlayerSettlement(game, left.id).netWorth)
  const reason = game.finishReason === 'last-standing' ? '仅剩一名未破产玩家' : '达到回合上限，按净资产结算'
  return <section className="settlement-panel"><div className="section-heading"><h3><Crown size={16} />最终结算</h3><span>{game.round} / {game.roundLimit} 轮</span></div><p className="settlement-reason">{reason}</p><div className="settlement-list">{ranking.map((player, index) => {
    const properties = Object.entries(game.owners).filter(([, owner]) => owner === player.id).length
    const houses = Object.entries(game.buildings).filter(([index]) => game.owners[Number(index)] === player.id).reduce((total, [, level]) => total + level, 0)
    const settlement = getPlayerSettlement(game, player.id)
    const status = player.id === game.winnerId ? '获胜' : player.bankrupt ? '已破产' : '未获胜'
    return <div className={`settlement-row ${player.id === game.winnerId ? 'winner' : ''} ${player.bankrupt ? 'bankrupt' : ''}`} key={player.id}><b className="settlement-rank">{index + 1}</b><span className="settlement-player"><strong>{player.name}<small>{status}</small></strong><small>{properties} 处地产 · {houses} 级房屋</small><small>现金 {settlement.cash.toLocaleString()} · 地产 {settlement.propertyValue.toLocaleString()} · 房屋 {settlement.houseValue.toLocaleString()} · 贷款 -{settlement.loanDebt.toLocaleString()}</small></span><strong className="settlement-worth">{settlement.netWorth.toLocaleString()}<small>净资产</small></strong></div>
  })}</div></section>
}

function Tile({
  space,
  index,
  players,
  owner,
  active,
}: {
  space: BoardSpace
  index: number
  players: GameState['players']
  owner?: string
  active: boolean
}) {
  const color = districtColor(space)
  const tokens = players.filter((player) => player.position === index)
  const label = translatedNames[space.name] ?? space.name
  const special = space.type !== 'property'
  const tileClass = `board-tile ${special ? 'tile-special' : 'tile-property'} ${active ? 'tile-active' : ''}`
  return (
    <div className={tileClass} style={{ '--tile-accent': color } as React.CSSProperties} title={`${label}${space.type === 'property' ? ` · ${space.price} 城币 / 租金 ${space.rent}` : ''}`}>
      {space.type === 'property' && <span className="tile-band" />}
      <span className="tile-type">{space.type === 'property' ? districtNames[space.district] ?? space.district : space.type === 'start' ? '出发' : space.type === 'event' ? '事件' : space.type === 'tax' ? '费用' : space.type === 'free' ? '休整' : '特殊'}</span>
      <span className="tile-name">{label}</span>
      {space.type === 'property' && <span className="tile-price">{space.price}</span>}
      {owner && <span className="owned-dot" aria-label="已被购买" />}
      {tokens.length > 0 && <span className="tile-tokens">{tokens.map((player) => {
        const playerIndex = players.findIndex((entry) => entry.id === player.id)
        return <i key={player.id} style={{ background: playerColors[playerIndex % playerColors.length].bg }} title={player.name} />
      })}</span>}
    </div>
  )
}

function Board({ game, currentPlayerId }: { game: GameState; currentPlayerId: string }) {
  const coords = game.board.length === 40
    ? boardCoordinates
    : boardCoordinates.filter((_, index) => index % 2 === 0)
  const positions = new Map(coords.map(([row, col], index) => [`${row}-${col}`, index]))
  const propertyCount = game.board.filter((space) => space.type === 'property').length
  const current = game.players[game.currentPlayerIndex]
  return (
    <section className="board-frame" aria-label="新城地产棋盘">
      <div className="board-grid">
        {Array.from({ length: 121 }, (_, cell) => {
          const row = Math.floor(cell / 11)
          const col = cell % 11
          const index = positions.get(`${row}-${col}`)
          if (index === undefined || index >= game.board.length) {
            if (row >= 1 && row <= 9 && col >= 1 && col <= 9) return null
            return <div key={cell} className="board-blank" />
          }
          const space = game.board[index]
          const owner = game.owners[index]
          return <Tile key={cell} space={space} index={index} players={game.players} owner={owner} active={current.id === currentPlayerId && current.position === index} />
        })}
        <div className="board-center">
          <div className="board-city-art"><CityMark /><span>NEW CITY</span></div>
          <div className="board-center-status">
            <span className="eyebrow">第 {game.round} 回合 · {game.mode === 'simple' ? '简化版' : '复杂版'}</span>
            <strong>{current.name} 的回合</strong>
            {game.lastRoll && <span className="dice-result"><Dices size={17} /> {game.lastRoll[0]} + {game.lastRoll[1]}</span>}
            <span className="board-stat"><Landmark size={14} /> {propertyCount} 处可投资地产</span>
          </div>
          <div className="board-walkway"><span>旧城街巷</span><ArrowRight size={14} /><span>滨河商圈</span><ArrowRight size={14} /><span>云际天际线</span></div>
        </div>
      </div>
    </section>
  )
}

function App() {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [mode, setMode] = useState<'simple' | 'complex'>('simple')
  const [room, setRoom] = useState<RoomView | null>(null)
  const [playerId, setPlayerId] = useState('')
  const [game, setGame] = useState<GameState | null>(null)
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)
  const [auctionBid, setAuctionBid] = useState('1')
  const [pendingTrade, setPendingTrade] = useState<TradeOfferView | null>(null)

  useEffect(() => {
    const socket = io(import.meta.env.VITE_GAME_SERVER_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin), { autoConnect: false })
    socketRef.current = socket
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('room:joined', ({ room: joinedRoom, playerId: joinedId }: RoomJoined) => {
      setRoom(joinedRoom)
      setPlayerId(joinedId)
      setNotice('房间已连接，把房间码分享给朋友吧。')
    })
    socket.on('room:update', (nextRoom: RoomView) => setRoom(nextRoom))
    socket.on('game:update', (nextGame: GameState) => setGame(nextGame))
    socket.on('trade:update', (nextTrade: TradeOfferView | null) => setPendingTrade(nextTrade))
    socket.on('trade:notice', ({ message }: { message: string }) => setNotice(message))
    socket.on('game:error', ({ message }: { message: string }) => setNotice(message))
    socket.connect()
    return () => { socket.disconnect() }
  }, [])

  useEffect(() => {
    if (game?.auction) setAuctionBid(String(game.auction.currentBid + 1))
  }, [game?.auction?.currentBid, game?.auction?.currentBidderId])

  const isHost = room?.hostId === playerId
  const activePlayer = game?.players[game.currentPlayerIndex]
  const myTurn = Boolean(activePlayer && activePlayer.id === playerId)
  const currentSpace = game && activePlayer ? game.board[activePlayer.position] : null
  const ownedCount = game ? Object.values(game.owners).filter((owner) => owner === playerId).length : 0
  const recentLog = useMemo(() => game?.log.slice(-5).reverse() ?? [], [game?.log])

  const send = (event: string, extra: Record<string, unknown> = {}) => {
    if (!room || !playerId) return
    socketRef.current?.emit(event, { roomCode: room.code, playerId, ...extra })
  }

  const createRoom = () => {
    if (!name.trim()) return setNotice('先填写你的玩家昵称。')
    socketRef.current?.emit('room:create', { playerName: name, mode })
  }

  const joinRoom = () => {
    if (!name.trim() || joinCode.trim().length !== 6) return setNotice('请填写昵称和 6 位房间码。')
    socketRef.current?.emit('room:join', { playerName: name, roomCode: joinCode })
  }

  const copyCode = async () => {
    if (!room) return
    await navigator.clipboard?.writeText(room.code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const resetView = () => {
    if (room && playerId) socketRef.current?.emit('room:leave', { roomCode: room.code, playerId })
    setRoom(null)
    setGame(null)
    setPlayerId('')
    setNotice('已离开当前页面。服务器房间会在回收策略启用后自动清理。')
  }

  if (!room) {
    return (
      <main className="app-shell">
        <header className="topbar">
          <a className="brand" href="/" aria-label="新城地产局首页"><span className="brand-mark"><CityMark /></span><span><strong>新城地产局</strong><small>NEW CITY PROPERTY CLUB</small></span></a>
          <div className="topbar-right"><a className="text-link" href="http://localhost:5174" target="_blank" rel="noreferrer">开发进度 <ArrowDownRight size={15} /></a><span className={`connection ${connected ? 'is-online' : ''}`}><i />{connected ? '服务已连接' : '正在连接服务'}</span></div>
        </header>
        <section className="lobby-layout">
          <div className="lobby-copy">
            <div className="kicker"><span className="kicker-dot" /> 新城，欢迎入场</div>
            <h1>下一站，<em>成为房东。</em></h1>
            <p className="lobby-lead">和朋友绕着新城走一圈。买下喜欢的街区，收租、扩张，在城市里留下你的名字。</p>
            <div className="lobby-facts"><span><Users size={16} /> 单人 AI / 4-8 人联机</span><span><ShieldCheck size={16} /> 服务端同步</span><span><Sparkles size={16} /> 简化 / 复杂模式</span></div>
          </div>
          <div className="entry-layout">
            <section className="entry-panel">
              <div className="panel-heading"><div><span className="eyebrow">快速开局</span><h2>创建一桌</h2></div><span className="panel-index">01</span></div>
              <label className="field-label" htmlFor="player-name">玩家昵称</label>
              <input id="player-name" className="text-input" maxLength={18} placeholder="例如：小岛主" value={name} onChange={(event) => setName(event.target.value)} />
              <div className="field-label mode-label">选择玩法</div>
              <div className="mode-switch" role="group" aria-label="选择玩法模式">
                <button className={mode === 'simple' ? 'mode-option selected' : 'mode-option'} onClick={() => setMode('simple')} type="button"><span>轻快一局</span><small>约 20-40 分钟</small></button>
                <button className={mode === 'complex' ? 'mode-option selected' : 'mode-option'} onClick={() => setMode('complex')} type="button"><span>完整经营</span><small>约 40-60 分钟</small></button>
              </div>
              <button className="primary-button" disabled={!connected} onClick={createRoom} type="button"><Plus size={18} />创建房间 <ArrowRight size={16} /></button>
              <div className="join-divider"><span />或加入朋友的房间<span /></div>
              <div className="join-row"><input aria-label="6 位房间码" className="text-input code-input" maxLength={6} placeholder="输入房间码" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} /><button className="secondary-button" disabled={!connected} onClick={joinRoom} type="button"><DoorOpen size={17} />加入</button></div>
              {notice && <p className="notice" role="status">{notice}</p>}
            </section>
            <aside className="city-preview" aria-label="原创虚构城市主题示意图">
              <div className="preview-caption"><MapPin size={14} /> 新城城市规划图 <span>VOL. 01</span></div>
              <div className="preview-illustration"><div className="sun-disc" /><div className="river-line" /><div className="building b1" /><div className="building b2" /><div className="building b3" /><div className="building b4" /><div className="building b5" /><div className="building b6" /><div className="park-patch" /><div className="preview-street street-one" /><div className="preview-street street-two" /><div className="preview-street street-three" /><span className="map-label label-old">旧城</span><span className="map-label label-river">滨河</span><span className="map-label label-sky">云际</span></div>
              <div className="preview-footer"><span>一座等待你投资的城市</span><span>39° 33′ N</span></div>
            </aside>
          </div>
          <footer className="lobby-footer"><span>原创城市 · 朋友同桌 · 从一枚棋子开始</span><span>BUILD 0.1 · PLAYTEST</span></footer>
        </section>
      </main>
    )
  }

  if (!game) {
    return (
      <main className="app-shell">
        <header className="topbar"><a className="brand" href="/" aria-label="新城地产局"><span className="brand-mark"><CityMark /></span><span><strong>新城地产局</strong><small>NEW CITY PROPERTY CLUB</small></span></a><div className="topbar-right"><span className="connection is-online"><i />房间已连接</span><button className="icon-button" title="离开房间" aria-label="离开房间" onClick={resetView}><DoorOpen size={18} /></button></div></header>
        <main className="room-layout">
          <section className="room-main">
            <div className="room-title-row"><div><span className="eyebrow">等待玩家加入</span><h1>新城会客厅</h1></div><div className="room-code"><span>房间码</span><strong>{room.code}</strong><button className="icon-button" onClick={copyCode} title="复制房间码" aria-label="复制房间码">{copied ? <Check size={17} /> : <Copy size={17} />}</button></div></div>
            <div className="room-meta"><span><Users size={16} /> {room.players.length} / 8 玩家</span><span><Sparkles size={16} /> {room.mode === 'simple' ? '简化版' : '复杂版'}</span><span><ShieldCheck size={16} /> 私人房间</span></div>
            <div className="seat-grid">{Array.from({ length: 8 }, (_, index) => {
              const player = room.players[index]
              return player ? <div key={player.id} className={`seat filled ${player.id === playerId ? 'is-self' : ''}`}><span className="seat-token" style={{ background: playerColors[index].bg }}>{player.name.slice(0, 1)}</span><div className="seat-info"><strong>{player.name}{player.isBot && <small>AI</small>}{player.id === room.hostId && <Crown size={14} />}{player.id === playerId && <small>你</small>}</strong><span>{player.isBot ? '电脑玩家' : player.connected ? '在线' : '连接中断'}</span></div><span className={`ready-state ${player.ready ? 'ready' : ''}`}>{player.ready ? '已准备' : '未准备'}</span></div> : <div key={`empty-${index}`} className="seat empty"><span className="seat-placeholder"><Plus size={17} /></span><div className="seat-info"><strong>等待玩家</strong><span>分享房间码邀请朋友</span></div></div>
            })}</div>
            <div className="room-bottom"><p><span className="kicker-dot" /> {room.players.length === 1 ? '可以单人挑战电脑，也可以邀请朋友' : '4-8 位玩家准备好后即可开始'}</p>{isHost ? <div className="room-actions"><button className="secondary-button" disabled={room.players.length !== 1} onClick={() => send('game:start', { solo: true })}><Dices size={17} />单人挑战 AI</button><button className="primary-button" disabled={room.players.length < 4 || room.players.some((player) => !player.ready)} onClick={() => send('game:start')}><Sparkles size={17} />开始联机游戏 <ArrowRight size={16} /></button></div> : <button className="secondary-button ready-button" onClick={() => send('room:ready')}><Check size={17} />切换准备状态</button>}</div>
            {notice && <p className="notice" role="status">{notice}</p>}
          </section>
          <aside className="room-aside"><div className="aside-city"><CityMark /><span>NEW CITY</span></div><h2>等朋友入座</h2><p>当 4-8 位玩家都准备好，房主即可开始新城之旅。</p><div className="seat-progress"><span style={{ width: `${Math.min(room.players.length / 4, 1) * 100}%` }} /></div><div className="progress-caption"><span>当前玩家</span><strong>{room.players.length} / 4 起步人数</strong></div><button className="outline-button" onClick={copyCode}><Copy size={16} />{copied ? '已复制房间码' : '复制房间码邀请朋友'}</button><button className="subtle-button" onClick={resetView}><DoorOpen size={16} />离开房间</button></aside>
          <footer className="room-footer"><span>房主可以在 4-8 人就绪后开始</span><span>单桌试玩 · 版本 0.1</span></footer>
        </main>
      </main>
    )
  }

  const turnPlayer = activePlayer
  const myCouncilVote = game.councilVotes[playerId]
  const activeCouncilVoters = game.players.filter((player) => !player.bankrupt)
  const pending = game.pendingProperty === null ? null : game.board[game.pendingProperty]
  const canRoll = myTurn && game.phase === 'roll'
  const canBuy = myTurn && game.phase === 'buy'
  const canEnd = myTurn && game.phase === 'end-turn'
  const inJail = myTurn && game.phase === 'jail'
  const jailAttempts = game.jailAttempts[playerId] ?? 0
  const auction = game.auction
  const auctionProperty = auction ? game.board[auction.propertyIndex] : null
  const auctionBidder = auction ? game.players.find((player) => player.id === auction.currentBidderId) : null
  const auctionLeader = auction?.highestBidderId ? game.players.find((player) => player.id === auction.highestBidderId) : null
  const myAuctionTurn = auction?.currentBidderId === playerId
  const enteredBid = Number(auctionBid)

  return (
    <main className="app-shell game-shell">
      <header className="topbar game-topbar"><a className="brand" href="/" aria-label="新城地产局"><span className="brand-mark"><CityMark /></span><span><strong>新城地产局</strong><small>NEW CITY PROPERTY CLUB</small></span></a><div className="game-room-info"><span className="live-dot" />正在进行 <b>房间 {room.code}</b><span className="room-mode">{game.mode === 'simple' ? '简化版' : '复杂版'}</span></div><button className="icon-button" title="返回大厅" aria-label="返回大厅" onClick={resetView}><DoorOpen size={18} /></button></header>
      <div className="game-layout">
        <section className="game-main">
          <div className="game-heading"><div><span className="eyebrow">新城 · 第 {game.round} 回合</span><h1>城市经营中</h1></div><div className="turn-chip" style={{ '--player-color': playerColors[(game.phase === 'auction' ? game.players.findIndex((player) => player.id === auction?.currentBidderId) : game.currentPlayerIndex) % playerColors.length].bg } as React.CSSProperties}><span />{game.phase === 'council' ? '城市议会' : game.phase === 'auction' ? `${auctionBidder?.name} 竞价中` : turnPlayer?.name}{game.phase === 'council' ? ' · 全员投票' : game.phase === 'auction' && myAuctionTurn ? ' · 轮到你' : game.phase !== 'auction' && myTurn ? ' · 你的回合' : ' · 行动中'}</div></div>
          {game.activeCityRule && game.round <= game.activeCityRule.expiresAtRound && <div className="city-rule-strip"><Landmark size={17} /><span><strong>本期城市规则：{cityCouncilRules[game.activeCityRule.id].title}</strong><small>{cityCouncilRules[game.activeCityRule.id].description} · 持续至第 {game.activeCityRule.expiresAtRound} 轮</small></span></div>}
          {game.phase === 'finished' && <div className="winner-banner"><Crown size={20} /><div><strong>{game.players.find((player) => player.id === game.winnerId)?.name ?? '本局'} 获胜</strong><span>{game.mode === 'simple' ? '达到回合上限，按现金与地产价值结算。' : '本局已结束。'}</span></div></div>}
          {game.phase === 'finished' && <SettlementPanel game={game} />}
          <Board game={game} currentPlayerId={playerId} />
          <div className="player-strip">{game.players.map((player, index) => <div key={player.id} className={`player-pill ${player.id === turnPlayer?.id ? 'active' : ''}`}><span className="player-dot" style={{ background: playerColors[index % playerColors.length].bg }} /><span className="pill-name">{player.name}</span><span className="pill-cash"><CircleDollarSign size={14} />{player.cash}</span></div>)}</div>
        </section>
        <aside className="game-rail">
          <section className="action-panel">
            <div className="action-head"><div><span className="eyebrow">本回合操作</span><h2>{game.phase === 'council' ? '城市议会投票' : game.phase === 'auction' ? (myAuctionTurn ? '轮到你竞价' : `等待 ${auctionBidder?.name} 竞价`) : inJail ? '你在监狱中' : myTurn ? '轮到你了' : `等待 ${turnPlayer?.name}`}</h2></div><span className="action-round">{game.round.toString().padStart(2, '0')}</span></div>
            {game.phase === 'council' && <div className="council-panel"><div className="council-heading"><Landmark size={17} /><strong>第 {game.round - 1} 轮结束 · 制定接下来三轮的临时规则</strong></div><p>每位未破产玩家一票，最高票政策生效；最高票平票则本次不生效。已投 {Object.keys(game.councilVotes).length} / {activeCouncilVoters.length}</p><div className="council-options">{Object.entries(cityCouncilRules).map(([ruleId, rule]) => {
              const count = Object.values(game.councilVotes).filter((vote) => vote === ruleId).length
              const selected = myCouncilVote === ruleId
              return <button className={`council-option ${selected ? 'selected' : ''}`} key={ruleId} aria-pressed={selected} disabled={Boolean(myCouncilVote) || Boolean(game.players.find((player) => player.id === playerId)?.bankrupt)} onClick={() => send('game:council-vote', { ruleId })}><span><strong>{rule.title}</strong><small>{rule.description}</small></span><b>{count} 票</b></button>
            })}</div>{myCouncilVote && <div className="council-voted"><Check size={14} />你已投票：{cityCouncilRules[myCouncilVote].title}，等待其余玩家。</div>}</div>}
            {turnPlayer && <div className="current-player-card"><span className="current-token" style={{ background: playerColors[game.currentPlayerIndex % playerColors.length].bg }}>{turnPlayer.name.slice(0, 1)}</span><div><strong>{turnPlayer.name}</strong><small>{turnPlayer.cash.toLocaleString()} 城币 · {turnPlayer.position + 1} 号地块</small></div></div>}
            {game.lastRoll && <div className="dice-display"><span className="die-face">{game.lastRoll[0]}</span><span className="dice-plus">+</span><span className="die-face">{game.lastRoll[1]}</span><span className="dice-total">共 {game.lastRoll[0] + game.lastRoll[1]} 步</span></div>}
            {currentSpace && <div className="current-location"><span className="location-icon"><MapPin size={16} /></span><div><small>当前位置</small><strong>{translatedNames[currentSpace.name] ?? currentSpace.name}</strong></div></div>}
            {game.lastEventCard && <div className={`event-card ${game.lastEventCard.amount > 0 ? 'event-gain' : 'event-cost'}`}><span className="eyebrow">城市事件 · {game.lastEventCard.scope === 'all' ? '全城' : game.lastEventCard.scope === 'lowest' ? '救助' : '个人'}</span><strong>{game.lastEventCard.title}</strong><p>{game.lastEventCard.description}</p><b>{game.lastEventCard.amount > 0 ? '+' : ''}{game.lastEventCard.amount} 城币</b></div>}
            {inJail && <div className="jail-panel"><span className="eyebrow">出狱方式</span><p>已尝试 {jailAttempts}/3 次。掷出对子可离开；第三次仍未掷出对子将支付保释金并移动。</p><button className="primary-button action-button" onClick={() => send('game:jail-try')}><Dices size={18} />尝试掷对子</button><button className="secondary-button action-button" disabled={(turnPlayer?.cash ?? 0) < JAIL_BAIL} onClick={() => send('game:jail-pay')}><CircleDollarSign size={17} />支付 {JAIL_BAIL} 城币并掷骰</button></div>}
            {game.phase === 'auction' && auction && auctionProperty?.type === 'property' && <div className="auction-panel"><div className="auction-title"><Gavel size={17} /><span>地产拍卖</span><b>{translatedNames[auctionProperty.name] ?? auctionProperty.name}</b></div><div className="auction-price"><span>当前最高价</span><strong>{auction.currentBid.toLocaleString()} <small>城币</small></strong></div><div className="auction-leader">{auctionLeader ? `领先：${auctionLeader.name}` : '尚无人出价'} · {auctionBidder?.name} 正在行动</div>{myAuctionTurn ? <><label className="bid-input-label" htmlFor="auction-bid">你的出价</label><div className="bid-input-row"><input id="auction-bid" type="number" min={auction.currentBid + 1} max={game.players.find((player) => player.id === playerId)?.cash ?? 0} step="1" value={auctionBid} onChange={(event) => setAuctionBid(event.target.value)} /><span>城币</span></div><button className="primary-button action-button" disabled={!Number.isInteger(enteredBid) || enteredBid <= auction.currentBid || enteredBid > (game.players.find((player) => player.id === playerId)?.cash ?? 0)} onClick={() => send('game:auction-bid', { amount: enteredBid })}><Gavel size={17} />提交出价</button><button className="secondary-button action-button" onClick={() => send('game:auction-pass')}>弃拍</button></> : <div className="waiting-note"><LoaderCircle size={16} />等待玩家出价或弃拍</div>}</div>}
            {canRoll && <button className="primary-button action-button" onClick={() => send('game:roll')}><Dices size={19} />掷骰子 <ArrowRight size={16} /></button>}
            {canBuy && pending?.type === 'property' && <><div className="purchase-summary"><span>购入价格</span><strong>{pending.price} <small>城币</small></strong><span>落地租金 {pending.rent} 城币</span></div><button className="primary-button action-button" onClick={() => send('game:buy')}><CircleDollarSign size={18} />购买地块</button><button className="secondary-button action-button" onClick={() => send('game:decline')}><ArrowDownRight size={16} />暂不购买</button></>}
            {canEnd && <><div className="resolved-note"><Check size={16} />地块已结算，可以结束本回合。</div><button className="primary-button action-button" onClick={() => send('game:end-turn')}><ArrowRight size={17} />结束回合</button></>}
            {canEnd && <LoanPanel game={game} playerId={playerId} onSend={send} />}
            {game.phase === 'finished' && <div className="resolved-note"><Crown size={16} />本局结束。</div>}
            {!myTurn && game.phase !== 'auction' && game.phase !== 'council' && <div className="waiting-note"><LoaderCircle size={16} />等待当前玩家完成操作</div>}
          </section>
          <section className="asset-panel"><div className="section-heading"><h3>我的资产</h3><span>{ownedCount} 处地产</span></div>{ownedCount ? Object.entries(game.owners).filter(([, owner]) => owner === playerId).map(([rawIndex]) => {
            const index = Number(rawIndex)
            const space = game.board[index]
            if (space.type !== 'property') return null
            const houses = game.buildings[index] ?? 0
            const buildCost = Math.ceil(space.price / 2)
            const mortgaged = Boolean(game.mortgages[index])
            return <div className="asset-row" key={index}><span className="asset-color" style={{ background: districtColor(space) }} /><strong>{translatedNames[space.name] ?? space.name}<small>{mortgaged ? '已抵押 · 暂停收租' : houses ? `${houses} 级房屋` : districtNames[space.district] ?? space.district}</small></strong><span>{getPropertyRent(game, index)} 租金</span>{game.mode === 'complex' && canBuildHouse(game, playerId, index) && <button className="build-button" disabled={(game.players[game.currentPlayerIndex]?.cash ?? 0) < buildCost} onClick={() => send('game:build', { index })} title={`建造房屋，花费 ${buildCost} 城币`}><Plus size={13} />建房 {buildCost}</button>}{canMortgageProperty(game, playerId, index) && <button className="build-button mortgage-button" onClick={() => send('game:mortgage', { index })} title={`抵押后获得 ${Math.floor(space.price / 2)} 城币`}><CircleDollarSign size={13} />抵押 +{Math.floor(space.price / 2)}</button>}</div>
          }) : <p className="empty-assets">还没有地产，先掷骰开启你的城市之旅。</p>}</section>
          <TradePanel game={game} room={room} playerId={playerId} offer={pendingTrade} onSend={send} />
          <section className="log-panel"><div className="section-heading"><h3>城市动态</h3><span><span className="live-dot" />实时</span></div><ul>{recentLog.map((entry, index) => <li key={`${entry}-${index}`}><span className="log-mark" />{entry}</li>)}</ul></section>
          <button className="subtle-button small-exit" onClick={resetView}><RotateCcw size={15} />返回大厅</button>
        </aside>
      </div>
      <footer className="game-footer"><span><ShieldCheck size={14} />服务器裁定 · 房间状态实时同步</span><span>{room.players.length} 位玩家 · 我的回合状态：{myTurn ? '行动中' : '等待中'}</span></footer>
    </main>
  )
}

export default App

function TradePanel({ game, room, playerId, offer, onSend }: {
  game: GameState
  room: RoomView
  playerId: string
  offer: TradeOfferView | null
  onSend: (event: string, extra?: Record<string, unknown>) => void
}) {
  const [recipientId, setRecipientId] = useState('')
  const [offeredCash, setOfferedCash] = useState('0')
  const [requestedCash, setRequestedCash] = useState('0')
  const [offeredProperties, setOfferedProperties] = useState<string[]>([])
  const [requestedProperties, setRequestedProperties] = useState<string[]>([])
  if (game.mode !== 'complex' || game.phase === 'finished') return null

  const me = game.players.find((player) => player.id === playerId)
  const recipients = game.players.filter((player) => player.id !== playerId && !player.bankrupt
    && room.players.some((seat) => seat.id === player.id && !seat.isBot && seat.connected))
  const recipient = game.players.find((player) => player.id === recipientId && !player.bankrupt)
  const canOffer = Boolean(me && !me.bankrupt && recipients.length > 0)
  const propertyOptions = (ownerId: string) => Object.entries(game.owners)
    .filter(([, currentOwner]) => currentOwner === ownerId)
    .flatMap(([rawIndex]) => {
      const index = Number(rawIndex)
      const space = game.board[index]
      if (space.type !== 'property' || game.mortgages[index] || game.buildings[index]) return []
      return [{ index: String(index), label: translatedNames[space.name] ?? space.name }]
    })
  const availableMine = propertyOptions(playerId)
  const availableTheirs = recipient ? propertyOptions(recipient.id) : []
  const formatAssets = (cash: number, indexes: number[]) => [
    ...(cash > 0 ? [`${cash.toLocaleString()} 城币`] : []),
    ...indexes.map((index) => {
      const space = game.board[index]
      return space?.type === 'property' ? translatedNames[space.name] ?? space.name : '地产状态已变化'
    }),
  ].join('、') || '无'
  const otherPlayer = (id: string) => game.players.find((player) => player.id === id)?.name ?? '玩家'
  const hasOfferContent = Number(offeredCash) > 0 || offeredProperties.length > 0
    || Number(requestedCash) > 0 || requestedProperties.length > 0
  const cashIsValid = [offeredCash, requestedCash].every((value) => /^\d+$/.test(value))
    && Number(offeredCash) <= (me?.cash ?? 0)
    && Number(requestedCash) <= (recipient?.cash ?? 0)
  const toggleProperty = (values: string[], setValues: (next: string[]) => void, index: string) => {
    setValues(values.includes(index) ? values.filter((value) => value !== index) : [...values, index])
  }

  return <section className="trade-panel">
    <div className="section-heading"><h3><ArrowLeftRight size={16} />玩家交易</h3><span>复杂版</span></div>
    {offer ? <div className="trade-pending">
      <div className="trade-parties"><strong>{otherPlayer(offer.proposerId)}</strong><ArrowLeftRight size={15} /><strong>{otherPlayer(offer.recipientId)}</strong></div>
      <div className="trade-sides"><p><small>{otherPlayer(offer.proposerId)} 提供</small>{formatAssets(offer.proposerCash, offer.proposerPropertyIndexes)}</p><p><small>{otherPlayer(offer.recipientId)} 提供</small>{formatAssets(offer.recipientCash, offer.recipientPropertyIndexes)}</p></div>
      {playerId === offer.recipientId ? <div className="trade-actions"><button className="primary-button" onClick={() => onSend('game:trade-accept')}><Check size={15} />接受交易</button><button className="secondary-button" onClick={() => onSend('game:trade-decline')}>拒绝</button></div>
        : playerId === offer.proposerId ? <button className="secondary-button trade-withdraw" onClick={() => onSend('game:trade-withdraw')}>撤回报价</button>
          : <p className="trade-waiting">等待双方玩家处理这笔报价。</p>}
    </div> : canOffer ? <div className="trade-editor">
      <label className="trade-field">交易对象<select value={recipientId} onChange={(event) => { setRecipientId(event.target.value); setRequestedCash('0'); setRequestedProperties([]) }}>
        <option value="">选择一位在线玩家</option>{recipients.map((player) => <option key={player.id} value={player.id}>{player.name} · {player.cash.toLocaleString()} 城币</option>)}
      </select></label>
      <div className="trade-columns">
        <TradeSide title="我提供" cash={offeredCash} onCashChange={setOfferedCash} properties={availableMine} selected={offeredProperties} onToggle={(index) => toggleProperty(offeredProperties, setOfferedProperties, index)} />
        <TradeSide title="我想要" cash={requestedCash} onCashChange={setRequestedCash} properties={availableTheirs} selected={requestedProperties} onToggle={(index) => toggleProperty(requestedProperties, setRequestedProperties, index)} disabled={!recipient} />
      </div>
      <button className="primary-button trade-submit" disabled={!recipient || !hasOfferContent || !cashIsValid} onClick={() => onSend('game:trade-offer', {
        recipientId,
        proposerCash: Number(offeredCash),
        proposerPropertyIndexes: offeredProperties.map(Number),
        recipientCash: Number(requestedCash),
        recipientPropertyIndexes: requestedProperties.map(Number),
      })}><ArrowLeftRight size={16} />发送交易报价</button>
      {!cashIsValid && <p className="trade-validation">现金必须是非负整数，且不能超过对应玩家现有余额。</p>}
    </div> : <p className="trade-waiting">{me?.bankrupt ? '破产玩家不能参与交易。' : '当前没有可参与交易的在线真人玩家。'}</p>}
  </section>
}

function TradeSide({ title, cash, onCashChange, properties, selected, onToggle, disabled = false }: {
  title: string
  cash: string
  onCashChange: (value: string) => void
  properties: Array<{ index: string; label: string }>
  selected: string[]
  onToggle: (index: string) => void
  disabled?: boolean
}) {
  return <div className={`trade-side ${disabled ? 'is-disabled' : ''}`}>
    <strong>{title}</strong>
    <label>现金<input type="number" min="0" step="1" value={cash} disabled={disabled} onChange={(event) => onCashChange(event.target.value)} /></label>
    <div className="trade-property-list"><span>地产</span>{properties.length ? properties.map((property) => <label key={property.index}><input type="checkbox" checked={selected.includes(property.index)} disabled={disabled} onChange={() => onToggle(property.index)} />{property.label}</label>) : <small>无可交易地产</small>}</div>
  </div>
}

function LoanPanel({ game, playerId, onSend }: { game: GameState; playerId: string; onSend: (event: string, extra?: Record<string, unknown>) => void }) {
  const loan = game.loans[playerId]
  const player = game.players.find((entry) => entry.id === playerId)
  if (!player) return null
  return <div className="loan-panel"><div className="loan-heading"><CircleDollarSign size={16} /><span>银行借贷</span>{loan && <b>欠款 {(loan.principal + loan.accruedInterest).toLocaleString()}</b>}</div>{loan ? <><p>本金 {loan.principal} · 已计利息 {loan.accruedInterest} · 每轮增加 {loan.interestPerRound}</p><button className="secondary-button action-button" disabled={player.cash < loan.principal + loan.accruedInterest} onClick={() => onSend('game:loan-repay')}><Check size={16} />还清贷款</button></> : <><p>本局最多同时持有一笔贷款，利息在每轮结束时累计。</p><div className="loan-options"><button className="secondary-button" onClick={() => onSend('game:loan-borrow', { amount: 200 })}>借 200</button><button className="secondary-button" onClick={() => onSend('game:loan-borrow', { amount: 500 })}>借 500</button><button className="secondary-button" onClick={() => onSend('game:loan-borrow', { amount: 1000 })}>借 1000</button></div></>}</div>
}






