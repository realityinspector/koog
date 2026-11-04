// "✎ Name him" chip in the visual bar while the Dancer is showing: a tiny popover with one text box.
import { useEffect, useRef, useState } from 'react'
import { NAME_MAX, setDancerName, useDancerName } from './dancerName'

export function DancerName() {
  const name = useDancerName((s) => s.name)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(name)
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open) { setDraft(name); requestAnimationFrame(() => input.current?.select()) } }, [open, name])
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])
  const save = () => { setDancerName(draft); setOpen(false) }
  return (
    <div className="vb-scene" ref={box}>
      <button className={'vb-chip' + (open ? ' open' : '')} aria-expanded={open} title="Give your dancer a name" onClick={() => setOpen((o) => !o)}>
        ✎ <span className="vb-cur">{name || 'Name him'}</span>
      </button>
      {open && (
        <form className="vb-pop" role="dialog" aria-label="Name your dancer" onSubmit={(e) => { e.preventDefault(); save() }}>
          <div className="vb-poph">Name your dancer</div>
          {/* keys typed here are words, not notes (typing in a field never plays the piano) */}
          <input ref={input} value={draft} maxLength={NAME_MAX} placeholder="e.g. Ziggy" aria-label="Dancer's name"
            onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setOpen(false) }}
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,.25)', background: 'rgba(0,0,0,.35)', color: '#fff', font: '600 15px system-ui, sans-serif' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="submit" className="vb-chip" style={{ flex: 1 }}>Save</button>
            {name && <button type="button" className="vb-chip" onClick={() => { setDancerName(''); setOpen(false) }}>Clear</button>}
          </div>
        </form>
      )}
    </div>
  )
}
