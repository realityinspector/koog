// Shift+EASTER (hold Shift, type the word) opens this. Five eggs per page. X, Escape, or a click outside closes it.
import { useEffect } from 'react'
import { INFO } from './eggs'
import { EGG_PAGE, pageCount, startEasterCode, useEggCheat, howTo } from './eggCheat'
import './eggs.css'

export function EggCheatSheet() {
  const open = useEggCheat((s) => s.open)
  const page = useEggCheat((s) => s.page)
  const close = useEggCheat((s) => s.close)
  const setPage = useEggCheat((s) => s.setPage)
  const pages = pageCount()
  const safe = Math.max(0, Math.min(page, pages - 1))
  const slice = INFO.slice(safe * EGG_PAGE, safe * EGG_PAGE + EGG_PAGE)
  const from = safe * EGG_PAGE + 1
  const to = safe * EGG_PAGE + slice.length

  useEffect(() => startEasterCode(), [])
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); setPage(Math.min(pages - 1, safe + 1)) }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setPage(Math.max(0, safe - 1)) }
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [open, close, setPage, pages, safe])

  if (!open) return null
  return (
    <div className="eg-cheat-back" onPointerDown={close}>
      <div className="eg-cheat" role="dialog" aria-label="Easter egg cheat sheet" onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => { e.preventDefault(); setPage(Math.max(0, Math.min(pages - 1, safe + (e.deltaY > 0 ? 1 : -1)))) }}>
        <header>
          <h2>Easter eggs</h2>
          <button type="button" className="eg-cheat-x" aria-label="Close" title="Close" onClick={close}>✕</button>
        </header>
        <p className="eg-cheat-sub">Hold Shift and type EASTER any time to open this again.</p>
        <ol className="eg-cheat-list" start={from}>
          {slice.map((e) => (
            <li key={e.id} data-egg={e.id}>
              <span className="eg-cheat-em" aria-hidden>{e.emoji}</span>
              <span>
                <b>{e.name}</b>
                <small>{howTo(e.id)}</small>
                <em>{e.what}</em>
              </span>
            </li>
          ))}
        </ol>
        <footer>
          <button type="button" disabled={safe === 0} onClick={() => setPage(safe - 1)}>Previous</button>
          <span>{from}–{to} of {INFO.length}</span>
          <button type="button" disabled={safe >= pages - 1} onClick={() => setPage(safe + 1)}>Next</button>
        </footer>
      </div>
    </div>
  )
}
