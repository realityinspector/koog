// Notes | code | English, aligned word by word. One column per word, three rows (data-row="notes|code|en").
// Color (Okabe-Ito) AND a shape mark show each word kind. The word being heard gets a steady underline, never a blink.
import type { Chord, Sentence, WordKind, WordSlot } from '../../../koogalien/data/types'
import { lexById } from '../../../koogalien/data/lexicon'
import { printWord } from '../../../koogalien/lang/print'
import { describeSentence } from './describe'

export const KIND_LOOK: Record<WordKind, { color: string; mark: string; label: string }> = {
  greeting: { color: '#E69F00', mark: '●', label: 'greeting' },
  noun: { color: '#56B4E9', mark: '■', label: 'thing' },
  verb: { color: '#D55E00', mark: '▲', label: 'action' },
  pronoun: { color: '#CC79A7', mark: '◆', label: 'who' },
  feeling: { color: '#F0E442', mark: '♥', label: 'feeling' },
  question: { color: '#0072B2', mark: '?', label: 'question' },
  color: { color: '#009E73', mark: '◐', label: 'color' },
  number: { color: '#999999', mark: '#', label: 'number' },
  connector: { color: '#B07AA1', mark: '+', label: 'link' },
  name: { color: '#8CD17D', mark: '@', label: 'name' },
  code: { color: '#76B7B2', mark: '{', label: 'code' },
  closer: { color: '#BBBBBB', mark: '⏺', label: 'end' },
  control: { color: '#BBBBBB', mark: '⚙', label: 'control' },
}

export function MiniStrip({ chord }: { chord: Chord }) {
  return (
    <span className="kgx-mini" aria-hidden="true">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((d) => <i key={d} className={chord.includes(d as never) ? 'on' : ''} />)}
    </span>
  )
}

function kindOf(w: WordSlot): WordKind {
  if (w.kind === 'digit') return 'number'
  if (w.kind === 'spelled') return 'name'
  return (w.id && lexById(w.id)?.kind) || 'code'
}

function safeCode(w: WordSlot): string { try { return printWord(w) } catch { return w.en } }

export function SentenceRibbon({ sentence, playing, listening, compact, onPick }: {
  sentence: Sentence | null; playing: number | null; listening?: { chords: Chord[]; half?: number | null; spelling?: boolean }; compact?: boolean
  onPick?: (index: number, id: string) => void
}) {
  const words = sentence?.words ?? []
  const pend = listening?.chords ?? []
  const closer = sentence ? sentence.end : null
  return (
    <div className={'kgx-ribbon' + (compact ? ' compact' : '')} role="group" aria-label={describeSentence(sentence)}>
      {words.length === 0 && pend.length === 0 ? <p className="kgx-empty">Your sentence shows up here: notes, code and English, lined up word by word.</p> : null}
      <ol className="kgx-cols">
        {words.map((w, i) => {
          const k = KIND_LOOK[kindOf(w)]
          const alts = (w.alts ?? []).map((a) => ({ id: a.id, en: lexById(a.id)?.en ?? a.id }))
          const options = w.status === 'maybe' ? [...(w.id ? [{ id: w.id, en: w.en }] : []), ...alts] : []
          return (
            <li key={i} className={'kgx-col' + (w.status !== 'ok' ? ' ' + w.status : '') + (playing === i ? ' playing' : '')} data-word={i}
              data-status={w.status} style={{ ['--kc' as string]: k.color }} aria-current={playing === i ? 'true' : undefined}>
              <div className="kgx-cell notes" data-row="notes">
                {w.chords.length ? w.chords.map((c, j) => <MiniStrip key={j} chord={c} />) : <span className="kgx-dim">?</span>}
              </div>
              <div className="kgx-cell code" data-row="code"><code>{safeCode(w)}</code></div>
              <div className="kgx-cell en" data-row="en">
                <span className="kgx-kind" title={k.label} aria-hidden="true">{k.mark}</span>
                <span>{(w.id && lexById(w.id)?.emoji) || ''} {w.en}</span>
                {w.tone.loud !== 'normal' ? <small> ({w.tone.loud})</small> : null}
                {w.tone.mods.some((m) => m.name === 'wobble') ? <small title="wobble means excited"> ~wobble</small> : null}
              </div>
              {options.length ? (
                <div className="kgx-maybe">
                  <small>Did you mean?</small>
                  {options.map((o) => <button key={o.id} type="button" onClick={() => onPick?.(i, o.id)}>{o.en}</button>)}
                </div>
              ) : null}
              {w.status === 'unknown' ? <div className="kgx-maybe"><small>I do not know that one. Try again, or write it in quotes to spell it.</small></div> : null}
            </li>
          )
        })}
        {closer ? (
          <li className="kgx-col closer" data-word="end" style={{ ['--kc' as string]: KIND_LOOK.closer.color }}>
            <div className="kgx-cell notes" data-row="notes"><MiniStrip chord={closer === '.' ? [5, 8] : closer === '?' ? [2, 5] : [1, 3, 5, 8]} /></div>
            <div className="kgx-cell code" data-row="code"><code>{closer}</code></div>
            <div className="kgx-cell en" data-row="en"><span>{closer === '.' ? 'end' : closer === '?' ? 'ask' : 'shout'}</span></div>
          </li>
        ) : null}
        {pend.length || listening?.half ? (
          <li className="kgx-col listening" aria-hidden="true">
            <div className="kgx-cell notes" data-listening="1">{pend.map((c, j) => <MiniStrip key={j} chord={c} />)}{listening?.half ? <span className="kgx-dim">{listening.half}…</span> : null}</div>
            <div className="kgx-cell code"><code>…</code></div>
            <div className="kgx-cell en">Listening…</div>
          </li>
        ) : null}
      </ol>
    </div>
  )
}
