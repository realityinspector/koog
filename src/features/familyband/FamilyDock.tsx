// Family Band: classics and holiday songs for a few people at once.
// Seats: one foot pedal, one wireless controller, and optional MIDI, real piano, and real guitar.
// The real piano and the real guitar do not plug in. Koog shows the part, and Hear follows one note from the microphone.
// Sing along highlights the words. The guide tune still plays when the words are hidden.
import { useEffect, useState, type ReactNode } from 'react'
import { useScreen } from '../../layout/screenStore'
import { useProfile } from '../../profile/profile'
import { useDevices } from '../../music/devices'
import { unlockHost } from '../../audio/host'
import { usePedal, setFamilyPedal } from '../pedal/pedal'
import { useWireless } from '../gamepad/gamepad'
import { setPadRole, usePadRole } from '../gamepad/padRole'
import type { PadRole } from '../gamepad/padAssign'
import { noteName } from '../../music/theory'
import { useEar } from '../ear/ear'
import { familyRepertoire, familySong, guitarChord, lineText, lyricLines, noteAt, pianoLetters, songKeyLine } from './chart'
import { startGuide, stopClicks, tapClick } from './guide'
import { setFamilyOpen, useFamily } from './store'
import './familyband.css'

const ROLE_NAME: Record<PadRole, string> = { play: 'Play', drums: 'Drums', synth: 'Synth', custom: 'Pro' }

function Heard({ kind }: { kind: 'piano' | 'guitar' }) {
  const on = useEar((s) => s.on)
  const earKind = useEar((s) => s.kind)
  const note = useEar((s) => s.note)
  if (!on || earKind !== kind) return <p>Hear, in the devices menu, follows one note from this seat.</p>
  return <p data-family-heard={note ?? ''}>{note != null ? `Hearing ${noteName(note)}` : 'Listening for a note.'}</p>
}

function Songs() {
  const songId = useFamily((s) => s.songId)
  const rep = familyRepertoire()
  const row = (label: string, songs: { id: string; title: string }[]) => (
    <div className="fb-group">
      <span className="fb-label">{label}</span>
      <div className="fb-songs">
        {songs.map((s) => (
          <button key={s.id} type="button" className={'dp-chip fb-pick' + (s.id === songId ? ' on' : '')} data-family-pick={s.id} aria-pressed={s.id === songId} onClick={() => useFamily.setState({ songId: s.id, playing: false })}>
            {s.title}
          </button>
        ))}
      </div>
    </div>
  )
  return (
    <>
      {row('Classics', rep.classics)}
      {row('Thanksgiving', rep.thanksgiving)}
      {row('Christmas', rep.christmas)}
    </>
  )
}

function Stage({ songId, sing, playing, beat }: { songId: string; sing: boolean; playing: boolean; beat: number }) {
  const song = familySong(songId)
  if (!song) return null
  const lyrics = lyricLines(song)
  const at = noteAt(song, playing ? beat : 0)
  if (playing && beat < 0) {
    const n = Math.min(4, Math.max(1, Math.ceil(-beat)))
    return <div className="fb-stage" data-family-count={n}><b className="fb-count">{n}</b><p className="fb-empty">Listen for the beat, then come in.</p></div>
  }
  if (!sing) {
    return <div className="fb-stage" data-family-chart><p className="fb-empty">Each seat below shows that player&apos;s part.</p></div>
  }
  if (!lyrics) return <div className="fb-stage"><p className="fb-empty" data-lyric="none">This tune has no words. Follow the letters and the chord.</p></div>
  const line = lyrics.lines[lyrics.lineOf[Math.max(0, at.idx)] ?? 0] ?? []
  return (
    <div className="fb-stage">
      <p className="fb-lyric" data-lyric={lineText(line)} aria-live="polite">
        {line.map((s, n) => {
          const prev = line[n - 1]
          const gap = prev && !prev.join ? ' ' : ''
          const cls = at.idx < 0 ? '' : s.i < at.idx ? 'sung' : s.i === at.idx ? 'now' : ''
          return <span key={s.i} className={cls} data-syl={s.i}>{gap}{s.text}</span>
        })}
      </p>
    </div>
  )
}

function Seat({ id, on, title, flash, children }: { id: string; on: boolean; title: string; flash?: boolean; children: ReactNode }) {
  return (
    <section className={'fb-seat' + (flash ? ' flash' : '')} data-seat={id} data-seat-on={on ? '1' : '0'}>
      <h4>{title}</h4>
      {children}
    </section>
  )
}

function FamilyPanel() {
  const sing = useFamily((s) => s.sing)
  const songId = useFamily((s) => s.songId)
  const playing = useFamily((s) => s.playing)
  const beat = useFamily((s) => s.beat)
  const midiOn = useFamily((s) => s.midi)
  const pianoOn = useFamily((s) => s.piano)
  const guitarOn = useFamily((s) => s.guitar)
  const taps = useFamily((s) => s.pedalTaps)
  const pedalDown = usePedal((s) => s.down)
  const pedalReady = usePedal((s) => !!(s.code || s.midi))
  const pads = useWireless((s) => s.pads)
  const role = usePadRole((s) => s.role)
  const devices = useDevices((s) => s.devices)
  const [flash, setFlash] = useState(false)
  const song = familySong(songId)
  const letters = song ? pianoLetters(song, playing ? beat : 0) : { now: '', next: [] }
  const chord = song ? guitarChord(song, playing ? beat : 0) : { roman: '', name: '' }
  const pianos = devices.filter((d) => d.connected && d.role === 'piano')

  useEffect(() => {
    setFamilyPedal({
      onPress: () => { tapClick(); useFamily.setState((s) => ({ pedalTaps: s.pedalTaps + 1 })) },
      onRelease: () => {},
    })
    return () => { setFamilyPedal(null); stopClicks() }
  }, [])

  useEffect(() => {
    if (!taps) return
    setFlash(true)
    const t = window.setTimeout(() => setFlash(false), 220)
    return () => window.clearTimeout(t)
  }, [taps])

  useEffect(() => {
    if (!playing || !song) return
    const guide = startGuide(song)
    if (!guide) { useFamily.setState({ playing: false }); return }
    let raf = 0
    const frame = () => {
      const b = guide.beatNow()
      const at = noteAt(song, b)
      const floor = Math.floor(b)
      const cur = useFamily.getState()
      if (cur.noteIdx !== at.idx || cur.beatFloor !== floor || Math.abs(cur.beat - b) > 0.2) {
        useFamily.setState({ beat: b, noteIdx: at.idx, beatFloor: floor })
      }
      if (b > at.endBeat + 0.6) { useFamily.setState({ playing: false }); return }
      raf = requestAnimationFrame(frame)
    }
    const b0 = guide.beatNow()
    useFamily.setState({ beat: b0, noteIdx: noteAt(song, b0).idx, beatFloor: Math.floor(b0) })
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); guide.stop() }
  }, [playing, song])

  const toggleSeat = (key: 'midi' | 'piano' | 'guitar') => useFamily.setState((s) => ({ [key]: !s[key] }))

  return (
    <div className="dp-dock fb-dock" role="region" aria-label="Family Band" data-family-dock onPointerDown={(e) => e.stopPropagation()}>
      <div className="fb">
        <div className="fb-head">
          <h3>Family Band</h3>
          <button type="button" className={'dp-chip' + (sing ? ' on' : '')} aria-pressed={sing} data-family-sing={sing ? '1' : '0'} onClick={() => useFamily.setState((s) => ({ sing: !s.sing }))}>Sing along</button>
          <button type="button" className={'dp-big play' + (playing ? ' on' : '')} data-family-play={playing ? '1' : '0'} onClick={() => {
            const next = !useFamily.getState().playing
            if (next) void unlockHost()
            useFamily.setState({ playing: next })
          }}>{playing ? 'Stop' : 'Play'}</button>
          <span className="fb-note">{song ? `${song.title} · ${songKeyLine(song)}` : 'Pick a song'}</span>
          <button type="button" className="dp-chip fb-x" onClick={() => setFamilyOpen(false)}>✕ Close</button>
        </div>
        <Songs />
        <Stage songId={songId} sing={sing} playing={playing} beat={beat} />
        <div className="fb-seats">
          <Seat id="pedal" on flash={flash || pedalDown} title="Foot pedal">
            <p className="fb-now" data-pedal-flash={flash || pedalDown ? '1' : '0'}>{flash || pedalDown ? 'Beat' : 'Ready'}</p>
            <p>One person. A tap marks the beat for the band. Closing Family Band gives the pedal its saved job back.</p>
            {!pedalReady && <p>Set the foot pedal up in the devices menu, then a tap marks the beat.</p>}
          </Seat>
          <Seat id="pad" on title="Wireless controller">
            <p>{pads.length ? 'Connected.' : 'Press a button on the wireless controller after it is paired.'}</p>
            <p>{role === 'play' ? 'Play is on. Directions and the face buttons play the melody.' : `It is set to ${ROLE_NAME[role]}. Set to Play and the buttons play the melody.`}</p>
            {role !== 'play' && <button type="button" className="dp-chip" data-family-set-play onClick={() => setPadRole('play')}>Set to Play</button>}
          </Seat>
          <Seat id="midi" on={midiOn} title="MIDI keyboard">
            <button type="button" className={'dp-chip' + (midiOn ? ' on' : '')} aria-pressed={midiOn} onClick={() => toggleSeat('midi')}>{midiOn ? 'In the band' : 'Add this player'}</button>
            {midiOn && <p>{pianos.length ? `Connected: ${pianos.map((d) => d.name).join(', ')}. It plays the melody.` : 'Plug in a MIDI keyboard. The notes it plays join the band.'}</p>}
            {!midiOn && <p>This seat is sitting out.</p>}
          </Seat>
          <Seat id="piano" on={pianoOn} title="Real piano">
            <button type="button" className={'dp-chip' + (pianoOn ? ' on' : '')} aria-pressed={pianoOn} onClick={() => toggleSeat('piano')}>{pianoOn ? 'In the band' : 'Add this player'}</button>
            {pianoOn && <>
              <p className="fb-now" data-piano-note={letters.now}>{letters.now || '…'}</p>
              {letters.next.length > 0 && <p>Next {letters.next.join(' ')}</p>}
              <p>Play these letters on a real piano. It stays in the room with you.</p>
              <Heard kind="piano" />
            </>}
            {!pianoOn && <p>This seat is sitting out.</p>}
          </Seat>
          <Seat id="guitar" on={guitarOn} title="Real guitar">
            <button type="button" className={'dp-chip' + (guitarOn ? ' on' : '')} aria-pressed={guitarOn} onClick={() => toggleSeat('guitar')}>{guitarOn ? 'In the band' : 'Add this player'}</button>
            {guitarOn && <>
              <p className="fb-now" data-chord={chord.name}>{chord.name}</p>
              <p data-chord-roman={chord.roman}>{chord.roman}</p>
              <p>Play this chord on a real guitar. It stays in the room with you.</p>
              <Heard kind="guitar" />
            </>}
            {!guitarOn && <p>This seat is sitting out.</p>}
          </Seat>
        </div>
      </div>
    </div>
  )
}

export function FamilyDock() {
  const open = useFamily((s) => s.open)
  const screen = useScreen((s) => s.screen)
  const mode = useProfile((s) => s.mode)
  if (!open || screen !== 'play' || mode === 'dad') return null
  return <FamilyPanel />
}
