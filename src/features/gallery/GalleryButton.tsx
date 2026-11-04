import { useEffect, useRef, useState } from 'react'
import { useOnePop } from '../../ui/onePop'
import './gallery.css'

/** 🖼 Gallery in the top strip: a small chooser for the guided tour (#/gallery) and Art Gallery mode (#/gallery/art). */
export function GalleryButton() {
  const [open, setOpen] = useState(false)
  useOnePop('gallery', open, () => setOpen(false))
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false) } }
    document.addEventListener('pointerdown', away)
    window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc) }
  }, [open])
  const go = (hash: string) => { setOpen(false); location.hash = hash }
  return (
    <div className="kg-gal" ref={box}>
      <button className={'kg-gal-btn' + (open ? ' on' : '')} aria-expanded={open} aria-haspopup="menu" aria-label="Gallery" title="Gallery: a guided tour, or calm Art Gallery mode"
        onClick={() => setOpen((v) => !v)}>
        <span aria-hidden>🖼</span> <span className="kg-gal-t">Gallery</span>
      </button>
      {open && (
        <div className="kg-gal-pop" role="menu" aria-label="Gallery">
          <button role="menuitem" onClick={() => go('#/gallery')} autoFocus>
            <b>▶ Guided tour</b><span>Koog shows you everything it can do, all by itself</span>
          </button>
          <button role="menuitem" onClick={() => go('#/gallery/art')}>
            <b>🖼 Art Gallery mode</b><span>Full screen moving art and calm music, loops forever</span>
          </button>
        </div>
      )}
    </div>
  )
}
