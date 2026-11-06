// The first-run lesson: the Koog Alien teaches "hello", then "world", then both together, one step at a time.
// The keys light on the real keybed (host.guide) AND on the on-screen pads. A key press from anywhere (keys, pads, a mouse
// click on a pad) counts; the chord window is generous (3 s) so a mouse can build a chord one pad at a time.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { KoogalienHost } from '../../../koogalien/ports'
import type { Chord, Degree } from '../../../koogalien/data/types'
import { midiOfDegree } from '../../../koogalien/data/degrees'
import { onToken, startKode } from '../../../kode/tokens'
import { degreeOfToken } from '../../../koogalien/learn/chordWindow'
import { sayChords } from '../learn/say'
import { KoogAlienHost, type HostPose } from '../ui/Host'
import { PadStrip } from '../ui/PadStrip'
import { padName, useUiPrefs } from '../ui/prefs'

export const HELLO: Degree[] = [1, 6]
export const WORLD: Degree[] = [1, 5, 8]
const WINDOW_MS = 3000
interface Step { id: string; say: string; targets: Degree[][]; word?: string }
export const INTRO_STEPS: Step[] = [
  { id: 'hi', say: "Hi! I speak Koogalien. Every word is a chord. Let's say hello!", targets: [] },
  { id: 'hello', say: 'A chord is keys played together. Press the two glowing keys to say hello!', targets: [HELLO], word: 'hello' },
  { id: 'world', say: 'Now the word world. Press the three glowing keys!', targets: [WORLD], word: 'world' },
  { id: 'both', say: 'Now say it all: hello first, then world.', targets: [HELLO, WORLD] },
]

export function Intro({ host, onDone }: { host: KoogalienHost; onDone: (how: 'finished' | 'skipped') => void }) {
  const solfege = useUiPrefs((s) => s.solfege)
  const [step, setStep] = useState(0)
  const [sub, setSub] = useState(0)
  const [pressed, setPressed] = useState<Degree[]>([])
  const [done, setDone] = useState(false)
  const [say, setSay] = useState(INTRO_STEPS[0].say)
  const [pose, setPose] = useState<HostPose>('wave')
  const down = useRef<{ d: Degree; t: number }[]>([])
  const voice = useRef<{ stop(): void } | null>(null)
  const st = INTRO_STEPS[step]
  const target = st.targets[sub] ?? []
  const wantNames = target.map((d) => padName(d, solfege)).join(', ')

  const light = useCallback((c: readonly Degree[]) => {
    try { host.guide.clear(); if (c.length) host.guide.show(c.map((d) => midiOfDegree(d, 60))) } catch { /* the keybed guide is optional */ }
  }, [host])

  // each step (or sub-target) starts: say it and light the keys
  useEffect(() => {
    down.current = []; setPressed([]); setSub(0); setDone(false)
    const s = INTRO_STEPS[step]
    setSay(s.say); setPose(s.id === 'hi' ? 'wave' : 'teach')
    light(s.targets[0] ?? [])
    return () => { try { host.guide.clear() } catch { /* ignore */ } }
  }, [step, host, light])

  useEffect(() => () => { voice.current?.stop(); try { host.guide.clear() } catch { /* ignore */ } }, [host])

  const finishStep = useCallback((chords: Chord[], text: string) => {
    setDone(true); setPose('cheer'); setSay(text); light([])
    voice.current?.stop(); voice.current = sayChords(host, chords, 'pip')
  }, [host, light])

  const press = useCallback((d: Degree) => {
    const s = INTRO_STEPS[step]
    if (!s.targets.length || done) return
    const want = s.targets[sub]
    const now = performance.now()
    if (!want.includes(d)) {
      down.current = []; setPressed([]); setPose('oops')
      setSay(`Oops, that key is not glowing. Press ${want.map((x) => padName(x, solfege)).join(', ')} (the glowing ones).`)
      light(want); return
    }
    down.current = [...down.current.filter((p) => now - p.t < WINDOW_MS && p.d !== d), { d, t: now }]
    const got = down.current.map((p) => p.d)
    setPressed(got)
    if (!want.every((x) => got.includes(x))) { setPose('listen'); setSay(`Good! ${want.length - got.length} more glowing ${want.length - got.length === 1 ? 'key' : 'keys'}.`); return }
    down.current = []
    if (sub + 1 < s.targets.length) {
      setSub(sub + 1); setPressed([]); setPose('cheer'); setSay("That's hello! 👋 Now world: press the three glowing keys.")
      light(s.targets[sub + 1]); voice.current?.stop(); voice.current = sayChords(host, [want as unknown as Chord], 'pip')
      return
    }
    if (s.id === 'hello') finishStep([HELLO as unknown as Chord], "That's hello! 👋 Hear how it sounds? Every word has its own chord.")
    else if (s.id === 'world') finishStep([WORLD as unknown as Chord], "That's world! 🌍 Two words down.")
    else finishStep([HELLO, WORLD] as unknown as Chord[], "You wrote a sentence! In code it looks like: say hello world. 🎉")
  }, [step, sub, done, host, light, finishStep, solfege])

  const pressRef = useRef(press)
  pressRef.current = press
  useEffect(() => {
    const stop = startKode()
    const off = onToken((t) => { const d = degreeOfToken(t); if (d) pressRef.current(d) })
    return () => { off(); stop() }
  }, [])

  const last = step === INTRO_STEPS.length - 1
  const canNext = st.targets.length === 0 || done
  const next = () => { if (last) { onDone('finished'); return } setStep(step + 1) }

  return (
    <section className="kgx-intro" aria-label="Welcome lesson" data-step={st.id} data-done={done ? '1' : '0'}>
      <p className="kgx-intro-count" aria-label={`Step ${step + 1} of ${INTRO_STEPS.length}`}>
        {INTRO_STEPS.map((s, i) => <i key={s.id} className={i === step ? 'now' : i < step ? 'past' : ''} />)}
      </p>
      <KoogAlienHost pose={pose} say={say} size={130} />
      {st.targets.length ? (
        <>
          <p className="kgx-intro-want">{done ? '✔ Done!' : `Press: ${wantNames}${st.targets.length > 1 ? ` (${sub + 1} of ${st.targets.length})` : ''}`}</p>
          <PadStrip lit={pressed} hint={done ? [] : target} />
        </>
      ) : null}
      {done && last ? <p className="kgx-intro-code"><code>say hello world.</code></p> : null}
      <div className="kgx-intro-actions">
        <button type="button" className="kgx-big" onClick={next} disabled={!canNext}>{last ? 'Finish ✔' : step === 0 ? "Let's go ▶" : 'Next ▶'}</button>
        <button type="button" className="kgx-link" onClick={() => { voice.current?.stop(); onDone('skipped') }}>Skip intro</button>
      </div>
    </section>
  )
}
