// Boss mode UI state (not kid progress): performance "stage" view, diagnostics drawer, and a cheap load meter.
// The load meter is a timer-lag probe, NOT a requestAnimationFrame loop: Boss mode never runs the visualizer's rAF.
import { create } from 'zustand'

const hot = import.meta.hot?.data as { store?: ReturnType<typeof make> } | undefined
function make() { return create<{ stage: boolean; diag: boolean; load: number; page: 'a' | 'b' }>()(() => ({ stage: false, diag: false, load: 0, page: 'a' })) }
export const useBoss = hot?.store ?? make()
export const setStage = (stage: boolean) => useBoss.setState({ stage })
export const setPage = (page: 'a' | 'b') => useBoss.setState({ page })
export const setDiag = (diag: boolean) => useBoss.setState({ diag })

let probe = 0
/** refcounted 500 ms probe: how late did the timer fire (0..100). Starts with the workspace, stops with it. */
export function startLoadProbe() {
  if (probe) return () => {}
  let last = performance.now(), avg = 0
  probe = window.setInterval(() => {
    const now = performance.now(), lag = Math.max(0, now - last - 500); last = now
    avg = avg * 0.6 + Math.min(100, lag / 2) * 0.4
    const v = Math.round(avg)
    if (v !== useBoss.getState().load) useBoss.setState({ load: v })
  }, 500)
  return () => { clearInterval(probe); probe = 0 }
}
if (import.meta.hot) { import.meta.hot.data.store = useBoss; import.meta.hot.dispose(() => { clearInterval(probe); probe = 0 }); import.meta.hot.accept() }
