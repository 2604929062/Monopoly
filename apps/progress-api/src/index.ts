import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { Pool } from 'pg'
import { z } from 'zod'

const port = Number(process.env.PORT ?? 3002)
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const pool = new Pool({ connectionString: databaseUrl, max: 10, connectionTimeoutMillis: 5000 })
const suggestionSchema = z.object({ title: z.string().trim().min(1).max(60), body: z.string().trim().min(1).max(400) }).strict()
const windows = new Map<string, { start: number; count: number }>()
const rateWindowMs = 60_000
const rateLimit = 30
const maxBodyBytes = 8 * 1024
const allowedOrigins = new Set((process.env.CORS_ORIGINS ?? process.env.PROGRESS_WEB_ORIGIN ?? '').split(',').map(value => value.trim()).filter(Boolean))

function send(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  response.end(JSON.stringify(value))
}
function clientIp(request: IncomingMessage) {
  const forwardedIp = request.headers['x-real-ip']
  return typeof forwardedIp === 'string' && forwardedIp.length > 0 ? forwardedIp : request.socket.remoteAddress ?? 'unknown'
}
function readJson(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0
    let tooLarge = false
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > maxBodyBytes) tooLarge = true
      else if (!tooLarge) chunks.push(chunk)
    })
    request.on('end', () => {
      if (tooLarge) { reject(Object.assign(new Error('Request body too large'), { status: 413 })); return }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { reject(Object.assign(new Error('Invalid JSON body'), { status: 400 })) }
    })
    request.on('error', reject)
  })
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin')
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  } else if (origin && allowedOrigins.size > 0) { send(response, 403, { error: 'Origin not allowed' }); return }
  if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return }
  const url = new URL(request.url ?? '/', 'http://localhost')
  if (request.method === 'GET' && (url.pathname === '/health' || url.pathname === '/api/health')) {
    try { await pool.query('SELECT 1'); send(response, 200, { status: 'ok' }) }
    catch { send(response, 503, { status: 'unavailable' }) }
    return
  }
  if (request.method === 'GET' && url.pathname === '/api/suggestions') {
    try { const result = await pool.query('SELECT id, title, body, created_at FROM suggestions ORDER BY created_at DESC, id DESC'); send(response, 200, result.rows) }
    catch (error) { console.error('Failed to read suggestions', error); send(response, 500, { error: 'Unable to load suggestions' }) }
    return
  }
  if (request.method === 'POST' && url.pathname === '/api/suggestions') {
    const now = Date.now(), ip = clientIp(request), current = windows.get(ip)
    if (windows.size > 10_000) {
      for (const [key, value] of windows) if (now - value.start >= rateWindowMs) windows.delete(key)
      if (windows.size > 10_000) windows.delete(windows.keys().next().value!)
    }
    if (!current || now - current.start >= rateWindowMs) windows.set(ip, { start: now, count: 1 })
    else if (current.count >= rateLimit) { send(response, 429, { error: '提交过于频繁，请稍后再试。' }); return }
    else current.count++
    if (!(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) { send(response, 415, { error: 'Content-Type must be application/json' }); return }
    try {
      const payload = suggestionSchema.safeParse(await readJson(request))
      if (!payload.success) { send(response, 400, { error: '标题需为 1-60 字，内容需为 1-400 字。' }); return }
      const result = await pool.query('INSERT INTO suggestions (title, body) VALUES ($1, $2) RETURNING id, title, body, created_at', [payload.data.title, payload.data.body])
      send(response, 201, result.rows[0])
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500
      if (status === 400 || status === 413) send(response, status, { error: error instanceof Error ? error.message : 'Invalid request' })
      else { console.error('Failed to create suggestion', error); send(response, 500, { error: 'Unable to save suggestion' }) }
    }
    return
  }
  send(response, 404, { error: 'Not found' })
})

try {
  await pool.query('CREATE TABLE IF NOT EXISTS suggestions (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, title VARCHAR(60) NOT NULL CHECK (char_length(title) BETWEEN 1 AND 60), body VARCHAR(400) NOT NULL CHECK (char_length(body) BETWEEN 1 AND 400), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())')
  server.listen(port, '0.0.0.0', () => console.log('Progress API listening on ' + port))
} catch (error) { console.error('Unable to initialize progress API database', error); process.exitCode = 1 }
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { server.close(); void pool.end() })
