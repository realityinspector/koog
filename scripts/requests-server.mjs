// Tiny local server for feature requests typed into the app.
// Listens on 127.0.0.1 only. Stores requests in requests.json at the project root.
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const PORT = 5174
const ORIGIN = 'http://localhost:5173'
const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'requests.json')

const load = () => {
  try { return existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : [] } catch { return [] }
}
const save = (list) => writeFileSync(FILE, JSON.stringify(list, null, 2) + '\n')

createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.writeHead(204).end()

  if (req.url === '/requests' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify(load()))
  }

  if (req.url === '/requests' && req.method === 'POST') {
    let body = ''
    req.on('data', (c) => {
      body += c
      if (body.length > 4000) req.destroy()
    })
    req.on('end', () => {
      try {
        const data = JSON.parse(body)
        const text = String(data.text ?? '').trim().slice(0, 500)
        // which kid sent it (their profile code word), if signed in
        const from = /^[a-z][a-z0-9]{0,11}$/.test(String(data.from ?? '')) ? String(data.from) : undefined
        if (!text) return res.writeHead(400).end()
        const list = load()
        const item = { id: (list.at(-1)?.id ?? 0) + 1, text, ...(from && { from }), status: 'new', reply: '', at: new Date().toISOString() }
        list.push(item)
        save(list)
        console.log(`REQUEST #${item.id}${from ? ` (from ${from})` : ''}: ${text}`)
        res.writeHead(201, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(item))
      } catch {
        res.writeHead(400).end()
      }
    })
    return
  }
  res.writeHead(404).end()
}).listen(PORT, '127.0.0.1', () => console.log(`requests server on http://127.0.0.1:${PORT}`))
