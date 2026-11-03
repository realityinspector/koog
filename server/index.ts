// Koog API + remote MCP server. One small Node HTTP server, stateless: it stores nothing and logs no request
// details (no URLs, query strings, bodies or addresses). Run: PORT=8787 node server/index.ts
// Behind nginx in production (see deploy/), which also does the rate limiting.
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createMcpServer } from './mcp.ts'
import { BadInput, catalogJson, cleanAge, cleanBool, cleanList, cleanMinutes, getActivity, getConcept, getStarted, linkFromQuery, listActivities, listConcepts, makeLink, nextSteps, APP_URL, REPO_URL } from './core.ts'
import { LLMS_TXT, OPENAPI, SITE } from './docs.ts'
import { CATALOG } from '../src/links/catalog.ts'

const PORT = Number(process.env.PORT ?? 8787)
const HOST = process.env.HOST ?? '127.0.0.1'
const MAX_BODY = 64 * 1024

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
  'Access-Control-Max-Age': '86400',
}
const BASE = { ...CORS, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }

function send(res: ServerResponse, status: number, body: unknown, type = 'application/json; charset=utf-8', cache = 'no-store') {
  const out = typeof body === 'string' ? body : JSON.stringify(body)
  res.writeHead(status, { ...BASE, 'Content-Type': type, 'Cache-Control': cache, 'Content-Length': Buffer.byteLength(out) })
  res.end(out)
}
const fail = (res: ServerResponse, status: number, error: string) => send(res, status, { error })

class TooLarge extends Error {}
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    if (Number(req.headers['content-length'] ?? 0) > MAX_BODY) return reject(new TooLarge())
    let size = 0, over = false
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) { if (!over) { over = true; chunks.length = 0; reject(new TooLarge()) } return } // keep draining, store nothing
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
async function readJson(req: IncomingMessage): Promise<unknown> {
  const raw = await readBody(req)
  if (!raw.trim()) return undefined
  try { return JSON.parse(raw) } catch { throw new BadInput('Body must be valid JSON') }
}

// ---------- REST ----------

const INDEX = {
  name: 'Koog API',
  about: "Koog is a free kids' piano and synth app that names what a child plays. This API picks activities and returns canonical links. Stateless: nothing is stored or logged.",
  app: APP_URL, source: REPO_URL,
  mcp: { url: `${SITE}/mcp`, transport: 'streamable-http (stateless)', tools: ['get_started', 'list_activities', 'get_activity', 'explain_concept', 'make_link', 'next_steps'] },
  openapi: `${SITE}/openapi.json`, llms_txt: `${SITE}/llms.txt`,
  endpoints: {
    'GET /api/start': 'age, minutes, keyboard, interests (comma list): a session plan with links and what to say',
    'GET /api/activities': 'kind, concept, age, max_minutes, limit, offset',
    'GET /api/activities/{id}': 'one activity, e.g. song-ode',
    'GET /api/concepts': 'the 13 concepts', 'GET /api/concepts/{id}': 'parent and kid explanations plus a demo link',
    'GET|POST /api/link': 'build and validate a link: screen, item, song_mode, rung, phrase, level, key, visual, palette, sound, modes, sheet',
    'GET /api/next': 'done (comma list of activity ids), age',
    'GET /api/catalog': 'everything, as one JSON document',
  },
  counts: { activities: CATALOG.activities.length, concepts: CATALOG.concepts.length },
}

async function rest(req: IncomingMessage, res: ServerResponse, path: string, q: URLSearchParams) {
  const post = req.method === 'POST'
  if (post && path !== '/api/link') return fail(res, 405, 'POST is only accepted on /api/link')
  const cache = 'public, max-age=300'
  if (path === '/api') return send(res, 200, INDEX, undefined, cache)
  if (path === '/api/catalog') return send(res, 200, catalogJson(), undefined, cache)
  if (path === '/api/start') {
    const out = getStarted({ age: cleanAge(q.get('age')), minutes: cleanMinutes(q.get('minutes')), has_usb_keyboard: cleanBool(q.get('keyboard')), interests: cleanList(q.get('interests')) })
    return send(res, 200, out, undefined, cache)
  }
  if (path === '/api/activities') {
    const num = (k: string) => { const v = q.get(k); if (v === null || v === '') return undefined; const n = Number(v); if (!Number.isFinite(n)) throw new BadInput(`${k} must be a number`); return n }
    return send(res, 200, listActivities({ kind: q.get('kind') ?? undefined, concept: q.get('concept') ?? undefined, age: num('age'), max_minutes: num('max_minutes'), limit: num('limit'), offset: num('offset') }), undefined, cache)
  }
  let m = /^\/api\/activities\/([^/]+)$/.exec(path)
  if (m) return send(res, 200, getActivity(decodeURIComponent(m[1])), undefined, cache)
  if (path === '/api/concepts') return send(res, 200, listConcepts(), undefined, cache)
  m = /^\/api\/concepts\/([^/]+)$/.exec(path)
  if (m) return send(res, 200, getConcept(decodeURIComponent(m[1])), undefined, cache)
  if (path === '/api/link') {
    if (post) {
      const body = await readJson(req)
      if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new BadInput('Send a JSON object, e.g. {"screen":"songs","item":"ode","song_mode":"learn"}')
      return send(res, 200, makeLink(body as Record<string, never>))
    }
    return send(res, 200, makeLink(linkFromQuery(q)))
  }
  if (path === '/api/next') return send(res, 200, nextSteps(cleanList(q.get('done'), 60), cleanAge(q.get('age'))), undefined, cache)
  return fail(res, 404, 'Not found. GET /api lists the endpoints.')
}

// ---------- MCP (Streamable HTTP, stateless: a fresh server and transport per request) ----------

async function mcp(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    // Stateless mode has no sessions to resume (GET) or end (DELETE).
    res.setHeader('Allow', 'POST')
    return send(res, 405, { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed. This server is stateless: POST JSON-RPC to /mcp.' }, id: null })
  }
  const body = await readJson(req)
  const server = createMcpServer()
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  res.on('close', () => { void transport.close(); void server.close() })
  Object.entries(BASE).forEach(([k, v]) => res.setHeader(k, v))
  res.setHeader('Cache-Control', 'no-store')
  await server.connect(transport)
  await transport.handleRequest(req, res, body)
}

// ---------- routing ----------

const http = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname
    if (req.method === 'OPTIONS') { res.writeHead(204, BASE); return res.end() }
    if (path === '/healthz') return send(res, 200, { ok: true })
    if (path === '/mcp') return await mcp(req, res)
    if (req.method !== 'GET' && req.method !== 'HEAD' && !(req.method === 'POST' && path === '/api/link')) return fail(res, 405, 'Method not allowed')
    if (path === '/openapi.json') return send(res, 200, OPENAPI, undefined, 'public, max-age=300')
    if (path === '/llms.txt') return send(res, 200, LLMS_TXT, 'text/plain; charset=utf-8', 'public, max-age=300')
    if (path === '/api' || path.startsWith('/api/')) return await rest(req, res, path, url.searchParams)
    return fail(res, 404, 'Not found')
  } catch (e) {
    if (res.headersSent) { res.end(); return }
    if (e instanceof TooLarge) { res.setHeader('Connection', 'close'); res.on('finish', () => req.destroy()); return fail(res, 413, 'Body too large (64 KB max)') }
    if (e instanceof BadInput) return fail(res, 400, e.message)
    console.error('request failed:', e instanceof Error ? e.message : 'unknown error') // never the URL or body
    fail(res, 500, 'Something went wrong')
  }
})
http.requestTimeout = 15_000
http.headersTimeout = 10_000
http.keepAliveTimeout = 5_000
http.maxHeadersCount = 50

http.listen(PORT, HOST, () => console.log(`Koog API and MCP server listening on ${HOST}:${PORT}`))
for (const sig of ['SIGTERM', 'SIGINT'] as const) process.on(sig, () => { http.close(); setTimeout(() => process.exit(0), 500).unref() })
