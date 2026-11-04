// Timers that run in a Web Worker. A page's own setTimeout / setInterval are slowed to 1 per second when the tab is hidden and
// delayed by anything busy on the main thread's timer queue; a worker's timers are not throttled that way, so the looper's
// scheduler tick, the master clock and the note timers keep time. The callback still runs on the main thread (the message back).
// Falls back to the page's own timers if a worker cannot be made. API: wTimeout(fn, ms) / wInterval(fn, ms) -> id, wClear(id).
type Hot = { w?: { worker: Worker | null; fns: Map<number, { fn: () => void; once: boolean }>; seq: number; fb: Map<number, number> } }
const hot = (import.meta.hot?.data ?? {}) as Hot
const CODE = `const T=new Map();onmessage=e=>{const m=e.data;
if(m.k==='t')T.set(m.id,setTimeout(()=>{T.delete(m.id);postMessage(m.id)},m.ms));
else if(m.k==='i')T.set(m.id,setInterval(()=>postMessage(m.id),m.ms));
else if(m.k==='c'){clearTimeout(T.get(m.id));clearInterval(T.get(m.id));T.delete(m.id)}}`
const W = hot.w ?? { worker: null as Worker | null, fns: new Map<number, { fn: () => void; once: boolean }>(), seq: 0, fb: new Map<number, number>() }
function ensure(): Worker | null {
  if (W.worker) return W.worker
  try {
    const url = URL.createObjectURL(new Blob([CODE], { type: 'text/javascript' }))
    const w = new Worker(url)
    URL.revokeObjectURL(url)
    w.onmessage = (e: MessageEvent<number>) => {
      const f = W.fns.get(e.data); if (!f) return
      if (f.once) W.fns.delete(e.data)
      try { f.fn() } catch (err) { console.error('[worker timer]', err) }
    }
    W.worker = w
  } catch { W.worker = null }
  return W.worker
}
function add(fn: () => void, ms: number, once: boolean): number {
  const id = ++W.seq, w = ensure()
  if (!w) { W.fb.set(id, once ? window.setTimeout(fn, ms) : window.setInterval(fn, ms)); return id }
  W.fns.set(id, { fn, once })
  w.postMessage({ k: once ? 't' : 'i', id, ms: Math.max(0, ms) })
  return id
}
export const wTimeout = (fn: () => void, ms: number): number => add(fn, ms, true)
export const wInterval = (fn: () => void, ms: number): number => add(fn, ms, false)
export function wClear(id: number) {
  if (!id) return
  if (W.fb.has(id)) { clearTimeout(W.fb.get(id)); clearInterval(W.fb.get(id)); W.fb.delete(id); return }
  if (W.fns.delete(id)) W.worker?.postMessage({ k: 'c', id })
}
/** is a real worker running the timers (false = fallback to page timers) */
export const workerTimersOn = () => !!ensure()

if (import.meta.hot) { import.meta.hot.data.w = W; import.meta.hot.accept() }
