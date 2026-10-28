import './harmony.css'
import { useHarmonyStore } from '../../music/harmonyStore'
import { PC_NAMES, SCALE_LABEL, inKey, keyName, pc, type ScaleType } from '../../music/theory'

const LO = 48
const HI = 84
const BLACK = new Set([1, 3, 6, 8, 10])
const SCALE_OPTS: ScaleType[] = ['major', 'minor', 'majorPentatonic', 'minorPentatonic', 'blues']

function mult(streak: number) {
  if (streak >= 32) return 'ON FIRE'
  if (streak >= 16) return 'x3'
  if (streak >= 8) return 'x2'
  return ''
}

export function HarmonyHud() {
  const { key, autoDetect, streak, bestStreak, accuracy, chord, heldNotes, lastJudgement, setKey, setAutoDetect } = useHarmonyStore()
  const held = new Set(heldNotes)
  const keys: number[] = []
  for (let n = LO; n <= HI; n++) keys.push(n)
  const isCant = (t: number, s: ScaleType) => key.tonic === t && key.scale === s
  const cant = (t: number) => { setAutoDetect(false); setKey({ tonic: t, scale: 'majorPentatonic' }) }
  const m = mult(streak)
  return (
    <section className="hh" aria-label="Harmony">
      <div className="grp">
        <span className="lbl">Key</span>
        <select value={key.tonic} onChange={(e) => setKey({ ...key, tonic: +e.target.value })}>
          {PC_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
        </select>
        <select value={key.scale} onChange={(e) => setKey({ ...key, scale: e.target.value as ScaleType })}>
          {SCALE_OPTS.map((s) => <option key={s} value={s}>{SCALE_LABEL[s]}</option>)}
        </select>
        <button className={autoDetect ? 'on' : ''} onClick={() => setAutoDetect(!autoDetect)} title="Let the app listen and guess your key">
          Auto-detect
        </button>
      </div>
      <div className="grp" title="Can't-miss mode: every key in the set sounds good">
        <button className={isCant(0, 'majorPentatonic') ? 'on' : ''} onClick={() => cant(0)}>Can't-miss: white</button>
        <button className={isCant(6, 'majorPentatonic') ? 'on' : ''} onClick={() => cant(6)}>Can't-miss: black</button>
      </div>
      <div className="grp" title="Share of your last 24 notes that fit the key">
        <span className="lbl">In key</span>
        <div className="meter"><i style={{ width: `${Math.round(accuracy * 100)}%` }} /></div>
        <span>{Math.round(accuracy * 100)}%</span>
      </div>
      <div className="grp">
        <span className="lbl">Streak</span>
        <b className="streak" key={streak}>{streak}</b>
        {m && <span className="mult">{m}</span>}
        <span className="lbl">best {bestStreak}</span>
        {lastJudgement === 'out' && <span className="lbl">spicy note</span>}
      </div>
      <div className="chord" title={keyName(key)}>{chord ?? ' '}</div>
      <div className="strip" aria-hidden>
        {keys.map((n) => {
          const cls = [
            inKey(n, key) && 'k',
            pc(n - key.tonic) === 0 && 'tn',
            pc(n - key.tonic) === 0 && 't',
            BLACK.has(pc(n)) && 'bl',
            held.has(n) && 'h',
          ].filter(Boolean).join(' ')
          return <b key={n} className={cls} />
        })}
      </div>
    </section>
  )
}
