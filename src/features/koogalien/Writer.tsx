// The Write screen. Default view: the pads, the ribbon, Next word / Done, Hear it / Clear / Send. Nothing else.
// Everything for grown-ups and tinkerers lives in the "⚙️ More" drawer (code, one key at a time, guess for me, voices, excited voice).
// The Koog Alien reacts to every word you play, in plain words.
import { useEffect, useMemo, useState } from 'react'
import { ALIENS } from '../../koogalien/data/aliens'
import { lexById } from '../../koogalien/data/lexicon'
import type { WordSlot } from '../../koogalien/data/types'
import type { KoogalienHost } from '../../koogalien/ports'
import { PROGRESS_KEY, sanitize } from '../../koogalien/learn/progress'
import { useKoogalien, koogalienActions as act } from './store'
import { startListening } from './listen'
import { SentenceRibbon } from './ribbon/SentenceRibbon'
import { describeSentence } from './ribbon/describe'
import { KoogAlienHost, type HostPose } from './ui/Host'
import { PadStrip } from './ui/PadStrip'
import { savePrefs, useUiPrefs } from './ui/prefs'
import { VOICE_LOOK } from './brand'

/** plain-words feedback for the newest word */
export function wordFeedback(w: WordSlot): { text: string; pose: HostPose } {
  if (w.status === 'ok') return { text: `That's ${w.en}! ${(w.id && lexById(w.id)?.emoji) || '👍'}`, pose: 'cheer' }
  if (w.status === 'maybe') {
    const names = [w.en, ...(w.alts ?? []).map((a) => lexById(a.id)?.en ?? a.id)].filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 3)
    return { text: `Hmm, close to ${names.join(' or ')}? Tap the one you meant.`, pose: 'puzzled' }
  }
  return { text: "I don't know that chord yet. Try another, or look in the 📚 Word book.", pose: 'oops' }
}

export function Writer({ host }: { host: KoogalienHost }) {
  const s = useKoogalien()
  const solfege = useUiPrefs((u) => u.solfege)
  const [playing, setPlaying] = useState(false)
  const [more, setMore] = useState(false)
  const [editing, setEditing] = useState(false)
  useEffect(() => { act.init(host); return startListening(host) }, [host])
  const known = useMemo(() => Object.values(sanitize(host.progress.load(PROGRESS_KEY, null)).words).filter((w) => w.rung).length, [host])
  const unlocked = known >= 4 || s.outbox.length > 0 || s.wobble > 0

  const words = s.sentence?.words ?? []
  const last = words[words.length - 1]
  const unsure = words.some((w) => w.status === 'maybe')
  const busy = s.listening.chords.length > 0 || !!s.listening.half || s.lit.length > 0
  const fb = last ? wordFeedback(unsure ? words.find((w) => w.status === 'maybe')! : last) : null
  const pose: HostPose = playing ? 'teach' : busy ? 'listen' : s.ended && words.length && !unsure && fb?.pose === 'cheer' ? 'cheer' : fb ? fb.pose : 'wave'
  const say = playing ? 'Listen to how it sounds!'
    : busy ? 'I am listening...'
    : unsure ? fb!.text
    : s.ended && words.length ? 'Nice! Press Hear it, or Send it to a friend.'
    : fb ? (fb.pose === 'cheer' ? `${fb.text} Play another word, or press Done.` : fb.text)
    : 'Play two keys together to make a word. C and A together say hello!'
  const live = useMemo(() => describeSentence(s.ended ? s.sentence : null), [s.ended, s.sentence])

  const hear = () => {
    if (playing) { act.stopHearing(); setPlaying(false); return }
    const h = act.hear(host); if (!h) return
    setPlaying(true); void h.done.then(() => setPlaying(false))
  }
  const send = async () => {
    const code = act.share(); if (!code) return
    const url = location.origin + location.pathname + '#/koogalien?m=' + code
    try { await navigator.clipboard.writeText(url); act.setStatus('Sent! The link is copied. Paste it to a friend and they can hear it. Nothing leaves this computer.') } catch { act.setStatus('Copy this link for your friend: ' + url) }
  }

  return (
    <section className="kgx-writer">
      <KoogAlienHost pose={pose} say={say} size={96} />
      {s.chordBuilder ? <p className="kgx-note">One key at a time is on: press the keys, then <button type="button" className="ok" onClick={() => act.commit()}>OK</button></p> : null}
      <PadStrip lit={s.lit} homeC={s.homeC} />
      <div className="kgx-primary kgx-controls" role="group" aria-label="Word endings">
        <button type="button" onClick={() => act.boundary('word')} title="Finish this word and start the next one (same as one tap on the pedal)">Next word ➜</button>
        <button type="button" onClick={() => act.boundary('end', '.')} title="Finish the message (same as two quick taps on the pedal)">Done ✓</button>
        <span className="kgx-sub kgx-pedal">or tap the pedal: once = next word, twice = done</span>
      </div>

      <SentenceRibbon sentence={s.sentence} playing={s.playingWord} listening={s.listening} onPick={act.confirmAlt} />
      <p className="kgx-codeline" aria-label="The code for your message">In code: <code>{s.code || 'say hello world.'}</code></p>

      <div className="kgx-primary kgx-controls" role="group" aria-label="Your message">
        <button type="button" className="hear" onClick={hear} disabled={!words.length}>{playing ? '■ Stop' : '🔊 Hear it'}</button>
        <button type="button" onClick={() => { act.clear(); setPlaying(false) }}>Clear</button>
        <button type="button" onClick={send} disabled={!words.length} title="Makes a link you can paste to a friend. Nothing is sent anywhere else.">📨 Send</button>
      </div>
      <p className="kgx-status" aria-live="polite">{s.status.startsWith('Koogalien says') ? '' : s.status}</p>

      <button type="button" className="kgx-more-btn" aria-expanded={more} aria-controls="kgx-more" onClick={() => setMore((v) => !v)}>⚙️ More {more ? '▴' : '▾'}</button>
      {more ? (
        <div id="kgx-more" className="kgx-more" role="region" aria-label="More options">
          <div className="kgx-row">
            <button type="button" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>{editing ? 'Done editing' : '✏️ Edit code'}</button>
            <button type="button" onClick={() => act.boundary('end', '?')} title="Finish as a question">? Ask</button>
            <button type="button" onClick={() => act.boundary('end', '!')} title="Finish as a shout">! Shout</button>
          </div>
          {editing ? (
            <div>
              <label className="kgx-code-l" htmlFor="kgx-code">Type your message as code</label>
              <textarea id="kgx-code" className="kgx-code" rows={3} spellCheck={false} value={s.code} placeholder="say hello world."
                onChange={(e) => act.setCode(e.target.value)} aria-describedby="kgx-errs" />
              <div id="kgx-errs" className="kgx-errs">{s.codeErrors.map((d, i) => <p key={i}>{d.message}{d.hint ? ` ${d.hint}` : ''}</p>)}</div>
            </div>
          ) : null}
          <div className="kgx-row">
            <label className="kgx-check" title="Keys stay lit until you press OK, so you can build a chord one key at a time">
              <input type="checkbox" checked={s.chordBuilder} onChange={(e) => act.setChordBuilder(e.target.checked)} /> One key at a time
            </label>
            {s.chordBuilder ? <button type="button" className="ok" onClick={() => act.commit()}>OK</button> : null}
            <label className="kgx-check" title="When I am not sure which word you meant, I pick my best guess without asking">
              <input type="checkbox" checked={s.autoAccept} onChange={(e) => act.setAutoAccept(e.target.checked)} /> Guess for me
            </label>
            <label className="kgx-check" title="Show do re mi instead of note letters">
              <input type="checkbox" checked={solfege} onChange={(e) => savePrefs(host, { solfege: e.target.checked })} /> Show do-re-mi names
            </label>
          </div>
          <div className="kgx-row voices" role="radiogroup" aria-label="Who speaks">
            {ALIENS.map((a) => {
              const look = VOICE_LOOK[a.id] ?? { color: '#999', mark: a.name[0] }
              return (
                <button key={a.id} type="button" role="radio" aria-checked={s.alien === a.id} className={'kgx-voice' + (s.alien === a.id ? ' on' : '')}
                  style={{ ['--kc' as string]: look.color }} onClick={() => act.setAlien(a.id)} title={`${a.name} has their own sound`}>
                  <b aria-hidden="true">{look.mark}</b> {a.emoji} {a.name}
                </button>
              )
            })}
          </div>
          <div className="kgx-row">
            {unlocked ? (
              <label className="kgx-wob" title="Hold it up while you play a word and the word sounds excited (it wobbles).">
                Excited voice <input type="range" min={0} max={1} step={0.05} value={s.wobble} onChange={(e) => act.setWobble(Number(e.target.value))} aria-label="Excited voice" />
              </label>
            ) : <span className="kgx-sub">🔒 Excited voice unlocks when you know 4 words (or send a message).</span>}
          </div>
          {s.outbox.length ? (
            <div className="kgx-box"><b>Sent messages ({s.outbox.length})</b>
              <ul>{s.outbox.map((o, i) => <li key={i}><button type="button" onClick={() => { try { act.loadCode(decodeURIComponent(o.code.replace(/^v1~/, ''))) } catch { /* ignore */ } }}>{o.en}</button></li>)}</ul>
            </div>
          ) : null}
        </div>
      ) : null}
      <p className="kgx-sr" role="status" aria-live="polite">{live}</p>
    </section>
  )
}
