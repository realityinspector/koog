import { useEffect, useState } from 'react'
import { useCal, openPanel, closePanel, startLearn, commit, redo, skip, goBack, finishLearning, finishPadMode, answerLed, skipLedTest, replayLed, save, resetDefaults, doExport, importText, reviewSummary, assignUnknown, labelOf, deviceName, hasSavedMap, untested } from './calibrate'
import { useCoop, startCoop, cancelCoop, startSoundcheck, stopSoundcheck, KINDS, KIND_INFO, type CoopKind } from './coop'
import { ControllerPic } from './Controller'
import { currentMap, describeKey } from './map'
import { getView } from './engine'

function Shell({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={'dj-panel' + (wide ? ' wide' : '')} role="dialog" aria-label={title}>
      <header><h2>{title}</h2><button type="button" className="dj-x" onClick={closePanel} aria-label="Close">✕</button></header>
      <div className="dj-panel-body">{children}</div>
    </div>
  )
}

function Backup() {
  const s = useCal()
  const [txt, setTxt] = useState(''), [err, setErr] = useState('')
  return (
    <details className="dj-backup">
      <summary>Share or back up my settings</summary>
      <textarea value={txt || s.exportText} onChange={(e) => setTxt(e.target.value)} placeholder="Press Export to see your settings as text, or paste settings here and press Import." rows={3} aria-label="Controller settings as text" />
      <div className="dj-acts">
        <button type="button" className="dj-b" onClick={() => { doExport(); setTxt('') }}>Export</button>
        <button type="button" className="dj-b" onClick={() => setErr(importText(txt || s.exportText) ?? '')}>Import</button>
        <button type="button" className="dj-b warn" onClick={() => { resetDefaults(); setTxt('') }}>Reset to defaults</button>
      </div>
      {(err || s.savedMsg) && <p className="dj-note">{err || s.savedMsg}</p>}
    </details>
  )
}

function Teach() {
  const s = useCal()
  const step = s.steps[s.i]
  if (s.phase === 'intro') return (
    <Shell title="🎚️ Teach Koog your controller">
      <div className="dj-cols">
        <div className="dj-say">
          <p className="dj-big">Let's teach Koog your DJ controller!</p>
          <p>I'll ask you to press or turn one thing at a time. You can skip any of them.</p>
          <p className="dj-dim">Controller: <b>{s.device}</b> {hasSavedMap(s.device) ? '· already taught once' : ''}</p>
          <div className="dj-acts"><button type="button" className="dj-b big" onClick={startLearn}>Start ▶</button></div>
          <Backup />
        </div>
        <ControllerPic ctl={{}} />
      </div>
    </Shell>
  )
  if (s.phase === 'learn' && step) return (
    <Shell title={`🎚️ Teach Koog · ${s.i + 1} of ${s.steps.length}`}>
      <div className="dj-bar-prog"><i style={{ width: `${(s.i / s.steps.length) * 100}%` }} /></div>
      <div className="dj-cols">
        <div className="dj-say">
          <p className="dj-big" aria-live="polite">{step.prompt}</p>
          {!s.got && <p className="dj-dim">{s.heard || (step.kind === 'button' ? 'Waiting for a press…' : 'Waiting…')} {step.kind !== 'button' && <span className="dj-dots2" aria-hidden>{[0, 1].map((n) => <i key={n} className={s.progress * 2 > n ? 'on' : ''} />)}</span>}</p>}
          {s.got && <p className="dj-got">✅ Got it: <b>{s.got.text}</b></p>}
          {s.conflict && <p className="dj-warn" role="alert">⚠️ {s.conflict}</p>}
          {step.optional && !s.got && <p className="dj-dim">Optional: some controllers don't have this.</p>}
          <div className="dj-acts">
            {s.got && <button type="button" className="dj-b big" onClick={commit}>{s.conflict ? 'Use anyway' : 'Next ▶'}</button>}
            {s.got && <button type="button" className="dj-b" onClick={redo}>Redo</button>}
            {!s.got && <button type="button" className="dj-b" onClick={skip}>Skip</button>}
            <button type="button" className="dj-b" onClick={goBack} disabled={s.i === 0}>◀ Back</button>
            <button type="button" className="dj-b" onClick={finishLearning}>That's enough</button>
          </div>
        </div>
        <ControllerPic ctl={Object.fromEntries(Object.keys(s.draft).map((k) => [k, { v: 0, n: 1 }]))} target={step.id} showTested noQ />
      </div>
    </Shell>
  )
  if (s.phase === 'padmode') return (
    <Shell title="🎚️ Do the pads change?">
      <div className="dj-cols"><div className="dj-say">
        <p className="dj-big">{s.padStage === 1 ? 'Press PAD MODE on the LEFT deck' : s.padStage === 2 ? 'Now press PAD 1' : 'Thanks!'}</p>
        <p className="dj-dim">{s.padNote || 'This shows whether the pads send new notes in each mode.'}</p>
        <div className="dj-acts"><button type="button" className="dj-b big" onClick={finishPadMode}>{s.padStage === 0 ? 'Next ▶' : 'Skip'}</button></div>
      </div>
      <ControllerPic ctl={{}} target={s.padStage === 1 ? 'padmode.A' : s.padStage === 2 ? 'pad1.A' : null} /></div>
    </Shell>
  )
  if (s.phase === 'led') {
    const id = s.ledQueue[s.ledI]
    return (
      <Shell title="💡 Light test">
        <div className="dj-cols"><div className="dj-say">
          {id ? <>
            <p className="dj-big">Did <b>{labelOf(id)}</b> light up?</p>
            <p className="dj-dim">It blinks slowly. {s.ledI + 1} of {s.ledQueue.length}</p>
            <div className="dj-acts"><button type="button" className="dj-b big" onClick={() => answerLed(true)} aria-label="Yes, it lit up">👍</button><button type="button" className="dj-b big no" onClick={() => answerLed(false)} aria-label="No light">👎</button>
              <button type="button" className="dj-b" onClick={replayLed}>Again</button></div>
          </> : <p className="dj-big">Nothing to test.</p>}
          <div className="dj-acts"><button type="button" className="dj-b" onClick={skipLedTest}>Skip the light test</button></div>
        </div><ControllerPic ctl={{}} target={id} /></div>
      </Shell>
    )
  }
  const r = reviewSummary()
  return (
    <Shell title={s.phase === 'done' ? '🎉 All done' : '📋 Check and save'}>
      <div className="dj-cols"><div className="dj-say">
        {s.phase === 'review' && <>
          <p className="dj-big">I learned {r.learned} controls.</p>
          <p className="dj-dim">{r.skipped} skipped{r.ledOff.length ? ` · no light on ${r.ledOff.length} button${r.ledOff.length > 1 ? 's' : ''}` : ''}{s.padStep ? ` · pads shift by ${s.padStep}` : ''}</p>
          {r.conflicts.map((c) => <p key={c} className="dj-warn">⚠️ {c}</p>)}
          <div className="dj-acts"><button type="button" className="dj-b big" onClick={save}>Save ✔</button><button type="button" className="dj-b" onClick={startLearn}>Start over</button></div>
        </>}
        {s.phase === 'done' && <><p className="dj-big">{s.savedMsg}</p><p className="dj-dim">Try the 🔍 Knob check to see it all work.</p>
          <div className="dj-acts"><button type="button" className="dj-b big" onClick={() => openPanel('knob')}>🔍 Knob check</button><button type="button" className="dj-b" onClick={closePanel}>Close</button></div></>}
        <Backup />
      </div><ControllerPic ctl={Object.fromEntries(Object.keys(s.draft).map((k) => [k, { v: 0, n: 1 }]))} showTested noQ /></div>
    </Shell>
  )
}

function Unknowns({ hint }: { hint?: string | null }) {
  const s = useCal()
  const ids = Object.keys(currentMap())
  const all = [...new Set([...ids, ...s.steps.map((x) => x.id)])]
  const [pick, setPick] = useState<Record<string, string>>({})
  if (!s.unknown.length) return null
  return (
    <div className="dj-unk">
      {s.unknown.slice(0, 2).map((u) => (
        <div key={u.key} className="dj-unk-row">
          <span>I heard <b>{u.text}</b>{u.count > 1 ? ` ×${u.count}` : ''}. Assign it?</span>
          {hint && <button type="button" className="dj-b" onClick={() => assignUnknown(u.key, hint)}>It's {labelOf(hint)}</button>}
          <select aria-label="Which control is that?" value={pick[u.key] ?? ''} onChange={(e) => setPick({ ...pick, [u.key]: e.target.value })}>
            <option value="">Which control?</option>
            {all.map((id) => <option key={id} value={id}>{labelOf(id)}</option>)}
          </select>
          <button type="button" className="dj-b" disabled={!pick[u.key]} onClick={() => assignUnknown(u.key, pick[u.key])}>Assign</button>
        </div>
      ))}
    </div>
  )
}

function Knob() {
  const s = useCal()
  const missing = untested()
  const total = Object.keys(currentMap()).length
  return (
    <Shell title="🔍 Knob check" wide>
      <div className="dj-knob">
        <ControllerPic ctl={s.ctl} interactive showTested />
        <div className="dj-knob-side">
          <p className="dj-big sm">{total - missing.length} of {total} tested</p>
          <p className="dj-dim">Touch every control. It lights up when Koog hears it. You can click the picture too.</p>
          <div className="dj-raw" aria-live="off" data-testid="raw">{s.last ? <><b>{s.last.text}</b>{s.last.id && <span> → {labelOf(s.last.id)}</span>}</> : 'Nothing heard yet…'}</div>
          {missing.length > 0 && <div className="dj-miss"><b>Not tested yet:</b> {missing.map((id) => <span key={id} className="chip">{labelOf(id)}</span>)}</div>}
          {missing.length === 0 && <p className="dj-got">✅ Every control works!</p>}
          <div className="dj-acts"><button type="button" className="dj-b" onClick={() => openPanel('teach')}>🎚️ Teach again</button></div>
        </div>
      </div>
      <Unknowns />
    </Shell>
  )
}

function Soundcheck() {
  const s = useCal(), sc = useCoop((x) => x.sc)
  useEffect(() => { startSoundcheck(); return () => stopSoundcheck() }, [])
  if (!sc) return null
  // the first control the DJ still has to touch: a stray message can be taught right here
  const pending = sc.items.find((i) => i.who === 'dj' && !i.done)?.needs.find((id) => !s.ctl[id]) ?? null
  const dj = sc.items.filter((i) => i.who === 'dj'), pn = sc.items.filter((i) => i.who === 'piano')
  const line = (list: typeof dj) => list.map((i) => <li key={i.id} className={i.done ? 'ok' : ''}><span aria-hidden>{i.done ? '✔' : '○'}</span> {i.label}{i.sub && !i.done ? ` (${i.sub})` : ''}</li>)
  const left = sc.items.filter((i) => !i.done).length
  return (
    <Shell title="🎤 Soundcheck" wide>
      <div className={'dj-sc' + (sc.live ? ' live' : '')}>
        {sc.live && <div className="dj-lights" aria-hidden><i /><i /><i /></div>}
        <div className="dj-sc-top">
          <p className="dj-big">{sc.live ? '🎶 The band is LIVE!' : left ? `Band ready: ${sc.items.length - left} of ${sc.items.length}` : 'All set!'}</p>
          {!hasSavedMap(s.device) && !sc.live && <button type="button" className="dj-b" onClick={() => openPanel('teach')}>First time? 🎚️ Teach Koog your controller</button>}
        </div>
        <Unknowns hint={pending} />
        <div className="dj-sc-cols">
          <div className="dj-sc-col"><h3>🎧 DJ</h3><ul>{line(dj)}</ul><p className="dj-dim">Press, slide and turn. Koog is listening.</p></div>
          <div className="dj-sc-col"><h3>🎹 Piano</h3><ul>{line(pn)}</ul><p className="dj-dim">{pn[0] && !pn[0].done ? 'Play C D E F G A B C. The lit key is next.' : pn[1] && !pn[1].done ? 'Play C, E and G together.' : 'Piano is ready!'}</p></div>
          <div className="dj-sc-pic"><ControllerPic ctl={s.ctl} target={pending} interactive /></div>
        </div>
        {s.last && !sc.live && <div className="dj-raw">{s.last.text}</div>}
      </div>
    </Shell>
  )
}

export function DjPanels() {
  const p = useCal((s) => s.panel)
  if (p === 'teach') return <Teach />
  if (p === 'knob') return <Knob />
  if (p === 'soundcheck') return <Soundcheck />
  return null
}

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n)
export function BandMenu({ onClose }: { onClose: () => void }) {
  const band = useCoop((s) => s.band)
  const playing = getView().anyPlaying
  return (
    <div className="dj-menu" role="menu">
      <div className="dj-menu-col"><div className="dj-menu-h">Setup</div>
      <button type="button" role="menuitem" onClick={() => { onClose(); openPanel('teach') }}>🎚️ Teach Koog your controller</button>
      <button type="button" role="menuitem" onClick={() => { onClose(); openPanel('knob') }}>🔍 Knob check</button>
      <button type="button" role="menuitem" onClick={() => { onClose(); openPanel('soundcheck') }}>🎤 Soundcheck <small>{band.soundchecks ? `done ${band.soundchecks}×` : ''}</small></button>
      </div><div className="dj-menu-col"><div className="dj-menu-h">Team challenges <small>{playing ? '' : '(starts deck A)'}</small></div>
      {KINDS.map((k) => (
        <button key={k} type="button" role="menuitem" onClick={() => { onClose(); void startCoop(k) }}>
          {KIND_INFO[k].emoji} {KIND_INFO[k].title} <small>🎧 🎹 {stars(band.stars[k])}</small>
        </button>
      ))}
      </div>
    </div>
  )
}

/** The shared card during a challenge: who does what, shared stars, a celebration at the end. */
export function CoopCard() {
  const a = useCoop((s) => s.active)
  if (!a) return null
  const info = KIND_INFO[a.kind]
  return (
    <div className={'dj-coop' + (a.done ? ' done' : '') + (a.phase === 'between' && a.msg.startsWith('🎉') ? ' won' : '')} role="status" aria-live="polite">
      <div className="dj-coop-h"><b>{info.emoji} {info.title}</b><span>Round {Math.min(a.round, 3)}/3</span>
        <span className="dj-coop-st" aria-label={`${a.stars} shared stars`}>{stars(a.stars)}</span>
        <button type="button" className="dj-x sm" onClick={cancelCoop} aria-label="Stop the challenge">✕</button></div>
      {!a.done && a.phase !== 'between' && <div className="dj-coop-who">
        <div className="dj-badge dj"><span aria-hidden>🎧</span> {a.dj}</div>
        <div className="dj-badge pn"><span aria-hidden>🎹</span> {a.piano}</div>
      </div>}
      {a.kind === 'drop' && a.phase === 'hold' && <div className="dj-coop-beats" aria-hidden>{[0, 1, 2, 3].map((n) => <i key={n} className={a.beats > n ? 'on' : ''} />)}</div>}
      {a.msg && <div className="dj-coop-msg">{a.msg}</div>}
    </div>
  )
}
void describeKey; void deviceName
