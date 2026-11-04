// My Motifs: save a played phrase as a named function, call it by its call sign. A Kore app (see src/kode/kore, docs/KODING_KORE.md).
import { useEffect, useRef, useState } from 'react'
import type { KoreAppProps } from '../../../kode/kore/types'
import { EMOJI_CHOICES, ROUND_EXAMPLE, type Tap } from '../../../kode/kore/motifCore'
import { copyExample, kodeLine, removeMotif, setFreePlay, undoRemove, updateMotif, useMotifs } from '../../../kode/kore/motifs'
import { noteName } from '../../../music/theory'
import './motifs.css'

const GAP_MS = 4000
const signText = (m: { kind: string; sign: { a: number; interval: number; lane?: number } }) =>
  m.kind === 'lane' ? `hit pad ${(m.sign.lane ?? 0) + 1} twice` : `${noteName(m.sign.a)} then ${noteName(m.sign.a + m.sign.interval)}, hold the second`

export default function MyMotifs({ kore }: KoreAppProps) {
  const list = useMotifs((s) => s.list)
  const free = useMotifs((s) => s.free)
  const trash = useMotifs((s) => s.trash)
  const [taps, setTaps] = useState<Tap[]>([])
  const tapsRef = useRef<Tap[]>([])
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [msg, setMsg] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const save = () => {
    const m = kore.motifs.define(tapsRef.current, { name, emoji })
    if (!m) { setMsg('Play at least two notes first, then save.'); return }
    tapsRef.current = []; setTaps([]); setName(''); setEmoji('')
    setMsg(`Saved as ${m.emoji} ${m.name}. Call sign: ${signText(m)}.`)
  }
  const saveRef = useRef(save); saveRef.current = save
  useEffect(() => kore.tokens.on((t) => {
    if (t.src === 'pedal') { if (tapsRef.current.length) saveRef.current(); return }
    if (t.src === 'screen') return
    const last = tapsRef.current[tapsRef.current.length - 1]
    const base = last && t.t - last.t <= GAP_MS ? tapsRef.current : []
    // a tap of a different kind (pad vs key) starts a new phrase
    const same = !base.length || (base[0].pitch != null) === (t.pitch != null)
    tapsRef.current = (same ? base : []).concat({ pitch: t.pitch, lane: t.pitch == null ? t.lane : undefined, t: t.t, vel: t.vel }).slice(-32)
    setTaps(tapsRef.current)
  }), [kore])

  const undo = () => { const m = undoRemove(); if (m) setMsg(`Brought back ${m.emoji} ${m.name}.`) }

  return (
    <div className="mm" data-testid="my-motifs">
      <h2>🧩 My Motifs</h2>
      <p className="mm-sub">Play a short phrase, then stomp the pedal or press Save. It becomes a function you can call.</p>

      <section className="mm-card">
        <div className="mm-row">
          <b>{taps.length ? `${taps.length} note${taps.length === 1 ? '' : 's'} ready` : 'Waiting for your phrase...'}</b>
          <button className="mm-btn" onClick={() => { tapsRef.current = []; setTaps([]) }} disabled={!taps.length}>Clear</button>
        </div>
        <div className="mm-row">
          <input className="mm-in" value={name} maxLength={16} placeholder="Name (or leave blank)" aria-label="Motif name" onChange={(e) => setName(e.target.value)} />
          <button className="mm-btn mm-go" onClick={save} disabled={!taps.length}>Save motif</button>
        </div>
        <div className="mm-emojis" role="group" aria-label="Pick an emoji">
          {EMOJI_CHOICES.map((e) => <button key={e} className={'mm-e' + (emoji === e ? ' on' : '')} aria-pressed={emoji === e} onClick={() => setEmoji(emoji === e ? '' : e)}>{e}</button>)}
        </div>
        {msg && <p className="mm-msg" role="status">{msg}</p>}
      </section>

      <label className="mm-free"><input type="checkbox" checked={free} onChange={(e) => setFreePlay(e.target.checked)} /> Call signs work in free play too</label>

      {trash && <p className="mm-undo" role="status">Deleted {trash.emoji} {trash.name}. <button className="mm-btn" onClick={undo}>Undo</button></p>}

      <ul className="mm-list">
        {list.length === 0 && <li className="mm-empty">No motifs yet. Play a phrase and save it!</li>}
        {list.map((m) => (
          <li key={m.id} className="mm-card" data-motif={m.name}>
            <div className="mm-row">
              <span className="mm-big">{m.emoji}</span>
              <input className="mm-in" defaultValue={m.name} maxLength={16} aria-label={`Rename ${m.name}`} onBlur={(e) => updateMotif(m.id, { name: e.target.value })} />
              <button className="mm-btn mm-go" onClick={() => kore.motifs.call(m.id)} aria-label={`Play ${m.name}`}>▶ Play</button>
            </div>
            <p className="mm-sign">Call sign: {signText(m)} · {m.notes.length} notes</p>
            <div className="mm-row">
              {m.kind === 'pitch' && <>
                <button className="mm-btn" onClick={() => updateMotif(m.id, { transpose: m.transpose - 1 })} aria-label="Lower one">−</button>
                <span>{m.transpose > 0 ? '+' : ''}{m.transpose} semitones</span>
                <button className="mm-btn" onClick={() => updateMotif(m.id, { transpose: m.transpose + 1 })} aria-label="Higher one">+</button>
              </>}
              {[0.5, 1, 2].map((s) => <button key={s} className={'mm-btn' + (m.speed === s ? ' on' : '')} aria-pressed={m.speed === s} onClick={() => updateMotif(m.id, { speed: s })}>{s === 0.5 ? '×½' : `×${s}`}</button>)}
            </div>
            <div className="mm-row">
              <button className="mm-btn" onClick={() => { void navigator.clipboard?.writeText(kodeLine(m)).catch(() => {}); setCopied(m.id) }}>{copied === m.id ? `Copied: ${kodeLine(m)}` : 'Use in Koog Kode'}</button>
              {confirm === m.id
                ? <><button className="mm-btn mm-del" onClick={() => { removeMotif(m.id); setConfirm(null) }}>Yes, delete</button><button className="mm-btn" onClick={() => setConfirm(null)}>Keep</button></>
                : <button className="mm-btn" onClick={() => setConfirm(m.id)} aria-label={`Delete ${m.name}`}>🗑 Delete</button>}
            </div>
          </li>
        ))}
      </ul>

      <section className="mm-card mm-ex">
        <div className="mm-row"><span className="mm-big">{ROUND_EXAMPLE.emoji}</span><b>Round (example)</b>
          <button className="mm-btn" onClick={() => kore.motifs.call('Round')}>▶ Hear it</button>
          <button className="mm-btn" onClick={() => { copyExample(ROUND_EXAMPLE); setMsg('Copied Round into your motifs.') }}>Keep a copy</button></div>
        <p className="mm-sign">This one calls itself again every 2 beats, 4 levels deep, like singing a round. That is recursion.</p>
      </section>
    </div>
  )
}
