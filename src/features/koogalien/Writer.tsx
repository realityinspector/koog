// The Write tab: play (or tap pads) -> see notes, code and English -> Hear it -> read it back. The Koog Alien hosts.
import { useEffect, useMemo, useState } from 'react'
import { ALIENS } from '../../koogalien/data/aliens'
import type { KoogalienHost } from '../../koogalien/ports'
import { useKoogalien, koogalienActions as act } from './store'
import { startListening } from './listen'
import { SentenceRibbon } from './ribbon/SentenceRibbon'
import { describeSentence } from './ribbon/describe'
import { KoogAlienHost, type HostPose } from './ui/Host'
import { PadStrip } from './ui/PadStrip'
import { VOICE_LOOK, KOOGALIEN_NAME } from './brand'

export function Writer({ host }: { host: KoogalienHost }) {
  const s = useKoogalien()
  const [playing, setPlaying] = useState(false)
  useEffect(() => { act.init(host); return startListening(host) }, [host])

  const words = s.sentence?.words ?? []
  const unsure = words.some((w) => w.status !== 'ok')
  const busy = s.listening.chords.length > 0 || !!s.listening.half || s.lit.length > 0
  const pose: HostPose = playing ? 'teach' : unsure ? 'puzzled' : s.ended && words.length ? 'cheer' : busy ? 'listen' : 'wave'
  const say = playing ? 'Listen to how it sounds!'
    : unsure ? 'Hmm, one word is a little off. Pick the one you meant.'
    : s.ended && words.length ? 'Nice! Press Hear it to hear it back.'
    : busy ? 'I am listening...'
    : 'Play two notes together for a word. Try C and A for hello, rest, then C, G and high C for world.'
  const live = useMemo(() => describeSentence(s.ended ? s.sentence : null), [s.ended, s.sentence])

  const hear = () => {
    if (playing) { act.stopHearing(); setPlaying(false); return }
    const h = act.hear(host); if (!h) return
    setPlaying(true); void h.done.then(() => setPlaying(false))
  }
  const copy = async () => {
    const code = act.share(); if (!code) return
    const url = location.origin + location.pathname + '#/koogalien?m=' + code
    try { await navigator.clipboard.writeText(url); act.setStatus('Link copied. Anyone with Koogalien can open it and hear it.') } catch { act.setStatus('Copy this link: ' + url) }
  }

  return (
    <section className="kgx-writer">
      <KoogAlienHost pose={pose} say={say} size={110} />
      <PadStrip lit={s.lit} homeC={s.homeC} />
      <div className="kgx-controls">
        <button type="button" onClick={() => act.boundary('word')} title="A pause between words (same as tapping the pedal)">Space</button>
        <span className="kgx-end" role="group" aria-label="End the sentence">
          <button type="button" onClick={() => act.boundary('end', '.')} title="End with a full stop">End .</button>
          <button type="button" onClick={() => act.boundary('end', '?')} title="End as a question">?</button>
          <button type="button" onClick={() => act.boundary('end', '!')} title="End loud!">!</button>
        </span>
        <label className="kgx-check" title="Keys stay lit until you press OK, so you can build a chord one key at a time">
          <input type="checkbox" checked={s.chordBuilder} onChange={(e) => act.setChordBuilder(e.target.checked)} /> Chord builder
        </label>
        {s.chordBuilder ? <button type="button" className="ok" onClick={() => act.commit()}>OK</button> : null}
      </div>

      <SentenceRibbon sentence={s.sentence} playing={s.playingWord} listening={s.listening} onPick={act.confirmAlt} />

      <label className="kgx-code-l" htmlFor="kgx-code">{KOOGALIEN_NAME} code</label>
      <textarea id="kgx-code" className="kgx-code" rows={3} spellCheck={false} value={s.code} placeholder="say hello world."
        onChange={(e) => act.setCode(e.target.value)} aria-describedby="kgx-errs" />
      <div id="kgx-errs" className="kgx-errs">
        {s.codeErrors.map((d, i) => <p key={i}>{d.message}{d.hint ? ` ${d.hint}` : ''}</p>)}
      </div>

      <div className="kgx-controls">
        <button type="button" className="hear" onClick={hear} disabled={!words.length}>{playing ? 'Stop' : 'Hear it'}</button>
        <button type="button" onClick={() => { act.clear(); setPlaying(false) }}>Clear</button>
        <button type="button" onClick={copy} disabled={!words.length} title="Makes a link you can paste to a friend. Nothing is sent anywhere.">Copy link</button>
      </div>

      <div className="kgx-controls voices" role="radiogroup" aria-label="Who speaks">
        {ALIENS.map((a) => {
          const look = VOICE_LOOK[a.id] ?? { color: '#999', mark: a.name[0] }
          return (
            <button key={a.id} type="button" role="radio" aria-checked={s.alien === a.id} className={'kgx-voice' + (s.alien === a.id ? ' on' : '')}
              style={{ ['--kc' as string]: look.color }} onClick={() => act.setAlien(a.id)} title={`${a.name} has their own sound`}>
              <b aria-hidden="true">{look.mark}</b> {a.emoji} {a.name}
            </button>
          )
        })}
        <label className="kgx-wob" title="Wobble means excited. Hold it up while you play a word and the word wobbles.">
          Wobble <input type="range" min={0} max={1} step={0.05} value={s.wobble} onChange={(e) => act.setWobble(Number(e.target.value))} aria-label="Wobble, excited" />
        </label>
        <label className="kgx-check" title="When I am not sure which word you meant, take my best guess without asking">
          <input type="checkbox" checked={s.autoAccept} onChange={(e) => act.setAutoAccept(e.target.checked)} /> Auto-accept best guess
        </label>
      </div>

      {s.outbox.length ? (
        <details className="kgx-box"><summary>Outbox ({s.outbox.length})</summary>
          <ul>{s.outbox.map((o, i) => <li key={i}><button type="button" onClick={() => { try { act.loadCode(decodeURIComponent(o.code.replace(/^v1~/, ''))) } catch { /* ignore */ } }}>{o.en}</button></li>)}</ul>
        </details>
      ) : null}

      <p className="kgx-status" aria-live="polite">{s.status}</p>
      <p className="kgx-sr" role="status" aria-live="polite">{live}</p>
    </section>
  )
}
