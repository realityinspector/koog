import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { isGuest, useProfile } from '../../profile/profile'
import './requests.css'

const API = 'http://127.0.0.1:5174/requests'

interface Req { id: number; text: string; from?: string; status: 'new' | 'building' | 'done' | 'later'; reply: string }

const LABEL: Record<Req['status'], string> = {
  new: 'Got it 📬',
  building: 'Building 🔨',
  done: 'Done ✅',
  later: 'Saved for later 💾',
}

const SEEN = 'koog.rq.seen'
const sig = (r: Req) => r.status + '|' + r.reply
function loadSeen(): Record<number, string> | null {
  try { const s = localStorage.getItem(SEEN); return s ? JSON.parse(s) : null } catch { return null }
}

/** Pops up when Claude updates a request, so she sees replies without opening the Idea box. */
function RequestToasts({ list }: { list: Req[] }) {
  const [seen, setSeen] = useState(loadSeen)
  useEffect(() => {
    // first visit ever: treat what's there now as already seen
    if (seen === null && list.length) {
      const all = Object.fromEntries(list.map((r) => [r.id, sig(r)]))
      setSeen(all)
      try { localStorage.setItem(SEEN, JSON.stringify(all)) } catch { /* ignore */ }
    }
  }, [list, seen])
  if (!seen) return null
  // Only finished or answered requests pop up, one at a time (newest first), so they don't pile up.
  const pending = list.filter((r) => (r.status === 'done' || r.status === 'later') && seen[r.id] !== sig(r))
  if (!pending.length) return null
  const fresh = [pending[pending.length - 1]]
  const more = pending.length - 1
  const dismiss = (r: Req) => {
    const next = { ...seen, [r.id]: sig(r) }
    setSeen(next)
    try { localStorage.setItem(SEEN, JSON.stringify(next)) } catch { /* ignore */ }
  }
  return createPortal(
    <div className="rq-toasts" aria-live="polite">
      {fresh.map((r) => (
        <div key={r.id} className={`rq-toast ${r.status}`}>
          <div className="rq-toast-hd"><span className={`rq-status ${r.status}`}>{LABEL[r.status] ?? r.status}</span> {r.text}</div>
          {r.reply && <div className="rq-toast-reply">{r.reply}</div>}
          <button onClick={() => dismiss(r)}>Nice 👍{more > 0 ? ` (${more} more)` : ''}</button>
        </div>
      ))}
    </div>,
    document.body,
  )
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
    const who = useProfile.getState().active
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t, from: isGuest(who) ? undefined : who }) })
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
      <RequestToasts list={list} />
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
              {r.from && <span className="rq-from">{r.from}:</span>}
              <span className="rq-text">{r.text}</span>
              {r.reply && <div className="rq-reply">Claude: {r.reply}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
