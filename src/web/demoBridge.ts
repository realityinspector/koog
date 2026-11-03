// Embedded Koog (?embed) <-> teacher demo page. Posts live notes and harmony state to the parent window,
// and re-dispatches computer-key events the parent forwards (musical typing listens on window).
import { onNote } from '../music/notes'
import { useHarmonyStore, judge } from '../music/harmonyStore'
import { PC_NAMES, SCALE_LABEL } from '../music/theory'

const post = (msg: unknown) => { try { window.parent.postMessage(msg, location.origin) } catch { /* ignore */ } }

function snapshot() {
  const s = useHarmonyStore.getState()
  return {
    type: 'koog:harmony',
    keyName: `${PC_NAMES[s.key.tonic]} ${SCALE_LABEL[s.key.scale]}`,
    chord: s.chord,
    accuracy: s.accuracy,
    streak: s.streak,
    judgement: s.lastJudgement,
  }
}

let offNote: (() => void) | undefined
let offHarm: (() => void) | undefined
let timer: number | undefined
let last = 0

function flush() {
  timer = undefined
  last = performance.now()
  post(snapshot())
}
function schedule() {
  if (timer !== undefined) return
  const wait = Math.max(0, 100 - (performance.now() - last))
  timer = window.setTimeout(flush, wait)
}

function onMessage(e: MessageEvent) {
  if (e.origin !== location.origin || e.source !== window.parent) return
  const d = e.data
  if (!d || d.type !== 'koog:key' || (d.kind !== 'keydown' && d.kind !== 'keyup')) return
  window.dispatchEvent(new KeyboardEvent(d.kind, { code: String(d.code), key: String(d.key ?? ''), repeat: !!d.repeat, bubbles: true }))
}

export function startDemoBridge() {
  stopDemoBridge()
  offNote = onNote((n) => {
    post({ type: 'koog:note', note: n.note, on: n.on, velocity: n.velocity, name: n.name, judgement: n.on ? judge(n.note) : null })
  })
  offHarm = useHarmonyStore.subscribe(schedule)
  window.addEventListener('message', onMessage)
  post(snapshot())
  post({ type: 'koog:ready' })
}
export function stopDemoBridge() {
  offNote?.(); offHarm?.(); offNote = offHarm = undefined
  if (timer !== undefined) { clearTimeout(timer); timer = undefined }
  window.removeEventListener('message', onMessage)
}

startDemoBridge()
if (import.meta.hot) import.meta.hot.dispose(stopDemoBridge)
