import { useEffect, useState } from 'react'
import './requests.css'

const API = 'http://127.0.0.1:5174/requests'

interface Req { id: number; text: string; status: 'new' | 'building' | 'done' | 'later'; reply: string }

const LABEL: Record<Req['status'], string> = {
  new: 'Got it 📬',
  building: 'Building 🔨',
  done: 'Done ✅',
  later: 'Saved for later 💾',
}

export function RequestBar() {
  const [text, setText] = useState('')
  const [list, setList] = useState<Req[]>([])
  const [online, setOnline] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const r = await fetch(API)
        if (alive) { setList(await r.json()); setOnline(true) }
      } catch {
        if (alive) setOnline(false)
      }
    }
    void poll()
    const id = setInterval(poll, 3000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    const t = text.trim()
    if (!t || sending) return
    setSending(true)
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t }) })
      const item = (await r.json()) as Req
      setList((l) => [...l, item])
      setText('')
    } catch {
      setOnline(false)
    } finally {
      setSending(false)
    }
  }

  const recent = list.slice(-3).reverse()

  return (
    <div className="rq">
      <form onSubmit={submit} className="rq-form">
        <span className="rq-icon">💡</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Got an idea? Type a feature request and hit Enter. Claude gets it live."
          maxLength={500}
        />
        <button disabled={!text.trim() || sending}>Send</button>
      </form>
      {!online && <div className="rq-off">Request inbox is offline right now.</div>}
      {recent.length > 0 && (
        <ul className="rq-list">
          {recent.map((r) => (
            <li key={r.id}>
              <span className={`rq-status ${r.status}`}>{LABEL[r.status] ?? r.status}</span>
              <span className="rq-text">{r.text}</span>
              {r.reply && <div className="rq-reply">Claude: {r.reply}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
