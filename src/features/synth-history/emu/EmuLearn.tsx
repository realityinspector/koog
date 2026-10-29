// "Learn a piece": a public-domain song for this instrument. Lights the next key, shows a small note highway,
// and advances when onJudge reports the right note. Publishes to the sheet-music overlay (owner 'emu').
import { useEffect, useMemo, useRef, useState } from 'react'
import { SONGS, type Song } from '../../songs/songs'
import { clearScore, setScore, setScorePos } from '../../../music/scoreStore'
import { clearGuide, setGuide } from '../../../music/guide'
import { onJudge } from '../../../music/judge'

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const nn = (n: number) => NAMES[n % 12] + (Math.floor(n / 12) - 1)

export function EmuLearn({ ids, why, open }: { ids: string[]; why: string; open: boolean }) {
  const songs = useMemo(() => ids.map((id) => SONGS.find((s) => s.id === id)).filter((s): s is Song => !!s), [ids])
  const [sel, setSel] = useState(0)
  const [on, setOn] = useState(false)
  const [pos, setPos] = useState(0)
  const song = songs[sel]
  const ref = useRef({ pos: 0, song: song as Song | undefined, on: false })
  ref.current.song = song; ref.current.on = on
  const skipRests = (s: Song, p: number) => { while (p < s.notes.length && s.notes[p].note == null) p++; return p }

  const apply = (s: Song, p: number) => {
    ref.current.pos = p; setPos(p)
    if (p >= s.notes.length) { setGuide([], 'gold'); return }
    setGuide([s.notes[p].note!], 'next')
    setScorePos(p)
  }
  const start = () => {
    if (!song) return
    setScore({ owner: 'emu', title: song.title, notes: song.notes, key: song.key, bpm: song.bpm })
    setOn(true)
    apply(song, skipRests(song, 0))
  }
  const stop = () => { setOn(false); setPos(0); ref.current.pos = 0; clearGuide(); clearScore('emu') }

  useEffect(() => onJudge((e) => {
    const r = ref.current
    if (!r.on || !r.song || e.type !== 'note') return
    const s = r.song
    if (r.pos >= s.notes.length) return
    if (e.g.note === s.notes[r.pos].note) {
      setScorePos(r.pos + 1, 'hit')
      apply(s, skipRests(s, r.pos + 1))
    }
  }), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { clearGuide(); clearScore('emu') }, [])

  const upcoming: number[] = []
  if (on && song) for (let i = pos; i < song.notes.length && upcoming.length < 10; i++) if (song.notes[i].note != null) upcoming.push(song.notes[i].note!)
  const total = song ? song.notes.filter((n) => n.note != null).length : 0
  const done = song ? song.notes.slice(0, pos).filter((n) => n.note != null).length : 0
  return (
    <>
      <div className="emu-pop emu-learn" hidden={!open}>
        <h4>🎼 Learn a piece</h4>
        {!songs.length ? <p className="emu-dim">Pieces for this instrument are still being added.</p> : (
          <>
            <p className="emu-dim">{why}</p>
            <div className="emu-learn-row">
              <select value={sel} aria-label="Piece" onChange={(e) => { stop(); setSel(+e.target.value) }}>
                {songs.map((s, i) => <option key={s.id} value={i}>{s.title}</option>)}
              </select>
              <button className="emu-btn big" onClick={on ? stop : start}>{on ? '■ Stop' : '▶ Start'}</button>
            </div>
            <p className="emu-dim">Lit keys on the keyboard show what to play next. The sheet music button shows the score.</p>
          </>
        )}
      </div>
      {on && song && (
        <div className="emu-hwy" aria-live="polite">
          <b>{song.title}</b>
          {upcoming.length ? upcoming.map((n, i) => <span key={i} className={i === 0 ? 'now' : ''} style={{ opacity: 1 - i * 0.07 }}>{nn(n)}</span>) : <b>🎉 You played it all!</b>}
          <small>{done}/{total}</small>
          <button className="emu-btn" onClick={stop}>■</button>
        </div>
      )}
    </>
  )
}
