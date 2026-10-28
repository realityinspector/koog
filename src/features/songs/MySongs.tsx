import { useEffect, useRef, useState } from 'react'
import { onNote } from '../../music/notes'
import type { Song } from './songs'
import { clean, makeSong, quantize, type RawEvent } from './recording'

const EMOJI = ['🎵', '🎹', '🔥', '⚡', '🌙', '🚀', '👻', '🎸', '💜', '🌈', '🐝', '✨']
const SILENCE_MS = 8000

interface Props { mine: Song[]; setMine: (l: Song[]) => void; onPick: (id: string) => void }

export function MySongs({ mine, setMine, onPick }: Props) {
  const [sheet, setSheet] = useState<'none' | 'list' | 'rec'>('none')
  const [bpm, setBpm] = useState(100)
  const [countIn, setCountIn] = useState(true)
  const [phase, setPhase] = useState<'idle' | 'count' | 'rec' | 'review'>('idle')
  const [count, setCount] = useState(0)
  const [take, setTake] = useState<ReturnType<typeof quantize>>(null)
  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState(EMOJI[0])
  const [err, setErr] = useState('')
  const [delId, setDelId] = useState<string | null>(null)
  const [renId, setRenId] = useState<string | null>(null)
  const [renVal, setRenVal] = useState('')
  const [importText, setImportText] = useState('')
  const [showIO, setShowIO] = useState(false)

  const ev = useRef<RawEvent[]>([])
  const t0 = useRef(0)
  const lastAct = useRef(0)
  const held = useRef(0)
  const recording = useRef(false)
  const ctx = useRef<AudioContext | null>(null)
  const timers = useRef<number[]>([])
  const bpmRef = useRef(bpm); bpmRef.current = bpm

  const cleanupAudio = () => { try { ctx.current?.close() } catch { /* ignore */ } ctx.current = null }
  const clearTimers = () => { timers.current.forEach((t) => { clearTimeout(t); clearInterval(t) }); timers.current = [] }

  useEffect(() => onNote((e) => {
    if (!recording.current) return
    const now = performance.now()
    ev.current.push({ note: e.note, t: now - t0.current, on: e.on })
    held.current += e.on ? 1 : -1
    if (held.current < 0) held.current = 0
    lastAct.current = now
  }), [])
  useEffect(() => () => { recording.current = false; clearTimers(); cleanupAudio() }, [])

  const stop = () => {
    if (!recording.current && phase !== 'count') return
    recording.current = false; clearTimers(); cleanupAudio()
    const q = quantize(ev.current, bpmRef.current)
    if (!q) { setErr('No notes caught. Check the keyboard is connected and try again.'); setPhase('idle'); return }
    setTake(q); setTitle(''); setPhase('review')
  }

  const beginRec = () => {
    ev.current = []; held.current = 0; t0.current = performance.now(); lastAct.current = t0.current; recording.current = true
    setPhase('rec')
    timers.current.push(window.setInterval(() => {
      if (recording.current && held.current === 0 && performance.now() - lastAct.current > SILENCE_MS) stop()
    }, 500))
  }

  const record = () => {
    setErr(''); setTake(null)
    if (!countIn) { beginRec(); return }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const c = new Ctx(); ctx.current = c // created on click
    const spb = 60 / bpm
    const master = c.createGain(); master.gain.value = 0.08; master.connect(c.destination)
    for (let i = 0; i < 4; i++) {
      const o = c.createOscillator(), g = c.createGain()
      o.frequency.value = i === 0 ? 1000 : 800
      const s = c.currentTime + 0.05 + i * spb
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(1, s + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.06)
      o.connect(g); g.connect(master); o.start(s); o.stop(s + 0.08)
    }
    setPhase('count'); setCount(4)
    for (let i = 1; i <= 4; i++) timers.current.push(window.setTimeout(() => (i < 4 ? setCount(4 - i) : (cleanupAudio(), beginRec())), (0.05 + i * spb) * 1000))
  }

  const save = () => {
    if (!take) return
    const s = makeSong(title, emoji, bpm, take)
    setMine([s, ...mine]); setTake(null); setPhase('idle')
  }
  const doRename = (id: string) => { setMine(mine.map((s) => (s.id === id ? { ...s, title: renVal.trim().slice(0, 40) || s.title } : s))); setRenId(null) }
  const doImport = () => {
    try {
      const arr = JSON.parse(importText)
      const list = (Array.isArray(arr) ? arr : [arr]).map(clean).filter((x): x is Song => !!x)
      if (!list.length) { setErr('Nothing usable in that text.'); return }
      const have = new Set(mine.map((m) => m.id))
      setMine([...list.map((s) => (have.has(s.id) ? { ...s, id: s.id + Math.random().toString(36).slice(2, 5) } : s)), ...mine])
      setImportText(''); setErr(`Imported ${list.length} song${list.length > 1 ? 's' : ''}.`)
    } catch { setErr('That does not look like exported JSON.') }
  }
  const exportText = JSON.stringify(mine.map(({ id, title, year, bpm, hook, notes }) => ({ id, title, year, bpm, hook, notes })))

  const busy = phase === 'count' || phase === 'rec'
  const close = () => { if (!busy) setSheet('none') }

  return (
    <>
      <button className={'btn rec-btn' + (busy ? ' live' : '')} onClick={() => setSheet('rec')}>{busy ? '● Recording' : '● Record'}</button>
      <button className="btn-ghost" onClick={() => setSheet('list')}>My Songs ({mine.length})</button>
      {sheet !== 'none' && (
        <div className="ms-sheet" role="dialog" aria-label="My Songs">
          <div className="ms-head">
            <b>{sheet === 'rec' ? '🎙️ Record a song' : '🎙️ My Songs'}</b>
            <span className="grow" />
            {sheet === 'rec' ? <button className="btn-ghost" disabled={busy} onClick={() => setSheet('list')}>My Songs ({mine.length})</button>
              : <button className="btn-ghost" onClick={() => setSheet('rec')}>● Record</button>}
            {sheet === 'list' && <button className="btn-ghost" onClick={() => setShowIO(!showIO)}>Export / Import</button>}
            <button className="btn-ghost" disabled={busy} onClick={close}>✕ Close</button>
          </div>
          <div className="ms-body">
            {err && <div className="msg">{err}</div>}
            {sheet === 'list' && (
              <>
                <div className="chips">
                  {mine.map((s) => (
                    <span key={s.id} className="chip mine">
                      {renId === s.id ? (
                        <>
                          <input value={renVal} maxLength={40} autoFocus onChange={(e) => setRenVal(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') doRename(s.id) }} />
                          <button className="mini" onClick={() => doRename(s.id)}>OK</button>
                        </>
                      ) : delId === s.id ? (
                        <>
                          <span>Delete "{s.title}"?</span>
                          <button className="mini danger" onClick={() => { setMine(mine.filter((m) => m.id !== s.id)); setDelId(null) }}>Yes</button>
                          <button className="mini" onClick={() => setDelId(null)}>No</button>
                        </>
                      ) : (
                        <>
                          <button className="mini play" onClick={() => { setSheet('none'); onPick(s.id) }}>{s.hook} {s.title}</button>
                          <button className="mini" title="Rename" onClick={() => { setRenId(s.id); setRenVal(s.title) }}>rename</button>
                          <button className="mini" title="Delete" onClick={() => setDelId(s.id)}>x</button>
                        </>
                      )}
                    </span>
                  ))}
                  {!mine.length && <span className="sub">Nothing here yet. Know a song by ear? Tap Record.</span>}
                </div>
                {showIO && (
                  <div className="rec">
                    <div className="sub">Backup: copy this text and keep it somewhere safe.</div>
                    <textarea readOnly rows={2} value={exportText} onFocus={(e) => e.currentTarget.select()} />
                    <div className="sub">Restore: paste exported text here.</div>
                    <textarea rows={2} value={importText} onChange={(e) => setImportText(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
                    <button className="btn-ghost" onClick={doImport}>Import</button>
                  </div>
                )}
              </>
            )}
            {sheet === 'rec' && (
              phase === 'review' && take ? (
                <div className="rec">
                  <div className="sub">Got {take.filter((n) => n.note != null).length} notes. Name it and pick an emoji.</div>
                  <div className="bar">
                    <input placeholder="Song title" value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
                    <button className="btn" onClick={save}>Save</button>
                    <button className="btn-ghost" onClick={() => { setTake(null); setPhase('idle') }}>Discard</button>
                  </div>
                  <div className="emojis">{EMOJI.map((e) => <button key={e} className={'mini' + (e === emoji ? ' sel' : '')} onClick={() => setEmoji(e)}>{e}</button>)}</div>
                </div>
              ) : (
                <div className="rec">
                  <div className="bar">
                    <label>bpm <input type="number" min={40} max={220} value={bpm} disabled={phase !== 'idle'} onChange={(e) => setBpm(Math.max(40, Math.min(220, +e.target.value || 100)))} style={{ width: 70 }} onKeyDown={(e) => e.stopPropagation()} /></label>
                    <label><input type="checkbox" checked={countIn} disabled={phase !== 'idle'} onChange={(e) => setCountIn(e.target.checked)} /> Count-in</label>
                    {phase === 'idle' ? <button className="btn rec-btn" onClick={record}>● Record</button> : <button className="btn rec-btn live" onClick={stop}>■ Stop</button>}
                  </div>
                  <div className="sub">
                    {phase === 'count' ? `Count-in: ${count}` : phase === 'rec' ? 'Recording... play it, then press Stop (or just pause for 8 seconds).' : 'Play the melody; chords become their top note.'}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </>
  )
}
