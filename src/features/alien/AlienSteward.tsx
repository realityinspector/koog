import { useEffect, useRef, useState } from 'react'
import { KoogAlien } from '../../brand/mascot/KoogAlien'
import { useOnePop } from '../../ui/onePop'
import { chordWords } from './agent'
import { useAlien } from './alienStore'
import './alien.css'

/** The Agentic Koog Alien stays on the instrument: harbinger of Koogalien, steward of the KOOG. */
export function AlienSteward() {
  const memory = useAlien((s) => s.memory)
  const code = useAlien((s) => s.code)
  const open = useAlien((s) => s.open)
  const armFresh = useAlien((s) => s.armFresh)
  const sentence = useAlien((s) => s.sentence)
  const [text, setText] = useState('')
  const [talk, setTalk] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const seat = useRef<HTMLButtonElement>(null)
  useOnePop('alien', open, () => useAlien.getState().setOpen(false))

  useEffect(() => {
    setTalk(true)
    const t = setTimeout(() => setTalk(false), 1600)
    return () => clearTimeout(t)
  }, [memory.line])

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      const n = e.target as Node
      if (panel.current?.contains(n) || seat.current?.contains(n)) return
      useAlien.getState().setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') useAlien.getState().setOpen(false) }
    document.addEventListener('pointerdown', away)
    window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc) }
  }, [open])

  const ask = (e: React.FormEvent) => {
    e.preventDefault()
    useAlien.getState().ask(text)
  }

  return (
    <div className="ka">
      {open && (
        <div className="ka-panel" ref={panel} role="dialog" aria-label="Agentic Koog Alien">
          <div className="ka-head">
            <div>
              <h2>Agentic Koog Alien</h2>
              <p>Harbinger of Koogalien. Steward of the KOOG.</p>
            </div>
            <button type="button" className="ka-x" aria-label="Close" onClick={() => useAlien.getState().setOpen(false)}>✕</button>
          </div>
          <p className="ka-line" role="status">{memory.line}</p>
          <p className="ka-check">{memory.check}</p>
          <form onSubmit={ask}>
            <input aria-label="English to turn into Koogalien" value={text} placeholder="Type words. I will turn them into notes." onChange={(e) => setText(e.target.value)} />
            <button type="submit" className="ka-go">Say it in notes</button>
          </form>
          {code && (
            <p className="ka-code">
              <span>{code}</span>
              <button type="button" disabled={!sentence} onClick={() => useAlien.getState().hear()}>Hear it</button>
            </p>
          )}
          <p className="ka-count">{memory.words.length} words learned · {memory.songs.length} songs kept · {memory.heard} notes heard · {memory.tries} background {memory.tries === 1 ? 'try' : 'tries'}</p>
          {memory.words.length > 0 && (
            <details>
              <summary>Words I learned</summary>
              <ul className="ka-list">
                {memory.words.map((w) => (
                  <li key={w.id}>
                    <b>{w.en}</b>
                    <span>{w.chord.length ? chordWords(w.chord) : 'spelled'}</span>
                    <button type="button" aria-label={'Let go of ' + w.en} onClick={() => useAlien.getState().forgetWord(w.id)}>✕</button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {memory.songs.length > 0 && (
            <details>
              <summary>Songs I keep</summary>
              <ul className="ka-list">
                {memory.songs.map((s) => (
                  <li key={s.id}>
                    <b>{s.title}</b>
                    <span>{s.from === 'you' ? 'you played this' : 'from the book'}</span>
                    <button type="button" aria-label={'Let go of ' + s.title} onClick={() => useAlien.getState().forgetSong(s.id)}>✕</button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button type="button" className="ka-fresh" onClick={() => useAlien.getState().armEmpty()}>
            {armFresh ? 'Tap again to empty the notebook' : 'Empty the notebook'}
          </button>
        </div>
      )}
      <button
        ref={seat}
        type="button"
        className="ka-seat"
        aria-expanded={open}
        aria-label="Agentic Koog Alien. Harbinger of Koogalien and steward of the KOOG."
        title="Agentic Koog Alien. Harbinger of Koogalien. Steward of the KOOG."
        onClick={() => useAlien.getState().setOpen(!open)}
      >
        <KoogAlien pose={memory.pose} mood={memory.mood} size={76} animated talking={talk} labelled={false} />
      </button>
    </div>
  )
}
