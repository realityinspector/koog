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

const css = `
.hh{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;background:#1f2026;border-radius:12px;padding:8px 12px;color:#e8e8ee;font-size:13px}
.hh select,.hh button{background:#2a2b33;color:#e8e8ee;border:1px solid #3a3b45;border-radius:8px;padding:4px 8px;font:inherit;cursor:pointer}
.hh button.on{background:linear-gradient(90deg,#7c5cff,#ff5da2);border-color:transparent}
.hh .grp{display:flex;align-items:center;gap:6px}
.hh .lbl{opacity:.6;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.hh .meter{width:90px;height:8px;background:#2a2b33;border-radius:4px;overflow:hidden}
.hh .meter i{display:block;height:100%;background:linear-gradient(90deg,#7c5cff,#ff5da2);transition:width .3s}
.hh .chord{font-size:22px;font-weight:700;min-width:130px;background:linear-gradient(90deg,#7c5cff,#ff5da2);-webkit-background-clip:text;background-clip:text;color:transparent}
.hh .mult{font-weight:800;color:#ff5da2}
.hh .strip{display:flex;height:28px;flex:1 1 260px;min-width:220px;gap:1px}
.hh .strip b{flex:1;border-radius:2px;background:#2a2b33;transition:background .1s}
.hh .strip b.k{background:#4b3fa0}
.hh .strip b.t{background:#ff5da2}
.hh .strip b.bl{height:68%}
.hh .strip b.h{background:#fff}
`

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
      <style>{css}</style>
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
        <b>{streak}</b>
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
