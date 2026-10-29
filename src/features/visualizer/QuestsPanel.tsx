import { useEffect, useRef, useState } from 'react'
import { celebrate } from '../celebrate/celebrate'
import { pload, psave } from '../../profile/profile'
import type { SynthParams } from '../synth-history/params'
import { QUESTS } from './quests'

type Done = Record<string, string | true>

export function QuestsPanel({ params }: { params: SynthParams }) {
  const [done, setDone] = useState<Done>(() => pload<Done>('patchquests', {}))
  const [sel, setSel] = useState<string>(() => (QUESTS.find((q) => !pload<Done>('patchquests', {})[q.id]) ?? QUESTS[0]).id)
  const [name, setName] = useState('')
  const q = QUESTS.find((x) => x.id === sel)!
  const passing = !q.free && q.check(params)
  const was = useRef({ id: sel, pass: passing })

  const win = (id: string, value: string | true = true) => {
    const quest = QUESTS.find((x) => x.id === id)!
    setDone((d) => {
      if (d[id]) return d
      const next = { ...d, [id]: value }
      psave('patchquests', next)
      return next
    })
    celebrate({ kind: 'best', title: `Patch Quest: ${quest.name}!`, emoji: '🧩' })
  }

  // Award only when the patch flips from "not there yet" to "there": the kid did it.
  useEffect(() => {
    const prev = was.current
    was.current = { id: sel, pass: passing }
    if (prev.id === sel && !prev.pass && passing && !done[sel]) win(sel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passing, sel])

  const count = QUESTS.filter((x) => done[x.id]).length
  const isDone = !!done[q.id]

  return (
    <section className="pq" aria-label="Patch quests">
      <h4>🧩 Quests <span className="pq-count">{count}/{QUESTS.length}</span></h4>
      <div className="pq-list" role="group" aria-label="Choose a quest">
        {QUESTS.map((x) => (
          <button key={x.id} className={'pq-dot' + (x.id === sel ? ' on' : '') + (done[x.id] ? ' done' : '')} title={x.name}
            aria-label={x.name + (done[x.id] ? ' (done)' : '')} aria-pressed={x.id === sel} onClick={() => setSel(x.id)}>
            {done[x.id] ? '✅' : x.emoji}
          </button>
        ))}
      </div>
      <div className="pq-card">
        <b>{q.emoji} {q.name}</b>
        <p><strong>Goal:</strong> {q.goal}</p>
        <p><strong>Hint:</strong> {q.hint}</p>
        <p className="pq-watch"><strong>👀 Watch:</strong> {q.watch}</p>
        {q.free && !isDone && (
          <div className="pq-name">
            <input value={name} maxLength={24} placeholder="Name your sound" aria-label="Sound name" onChange={(e) => setName(e.target.value)} />
            <button className="pq-go" disabled={!name.trim()} onClick={() => win(q.id, name.trim())}>Done!</button>
          </div>
        )}
        <div className={'pq-status' + (isDone || passing ? ' ok' : '')} aria-live="polite">
          {isDone
            ? `✅ ${q.cheer}${typeof done[q.id] === 'string' ? ` "${done[q.id]}" is in the hall of fame.` : ''}`
            : passing ? '✅ Your patch matches!' : q.free ? 'Name it, then press Done.' : 'Not yet. Tweak the knobs below.'}
        </div>
      </div>
    </section>
  )
}
