import { useEffect, useRef, useState } from 'react'
import { onJudge, type JudgeEvent } from '../../music/judge'
import { useScreen } from '../../layout/screenStore'
import { pload, psave } from '../../profile/profile'

type TipId = 'fizzle' | 'boom' | 'resolve' | 'cadence' | 'motif' | 'charged'
// [short label, the full lesson shown the first few times]
const TIPS: Record<TipId, [string, string]> = {
  fizzle: ['💨 Fizzle!', '💨 Fizzle! That was a tone cluster (forearm power). Charge ⚡ BOOM by playing in key, THEN slam it for a real finale.'],
  boom: ['⚡ BOOM!', '⚡ BOOM! Tone clusters are a real technique. Henry Cowell played the piano with his whole forearm back in 1917.'],
  resolve: ['✨ Release!', '✨ Tension → release! An out-of-key note that steps back into the key is how songs get exciting.'],
  cadence: ['🏁 Cadence!', '🏁 Cadence! You ended on the home note. That\'s how music says "end of sentence".'],
  motif: ['🔁 Motif!', '🔁 Motif! You repeated a pattern. Beethoven built a whole symphony out of a four-note motif.'],
  charged: ['⚡ BOOM ready!', '⚡ BOOM is charged! Now a forearm slam becomes a finale instead of a fizzle.'],
}
const LESSONS = 3 // full explanation this many times per kid, then just the short label
const ALWAYS: TipId[] = ['boom', 'charged']

/** Little coach captions on the display when the judge spots a musical moment. */
export function CoachTips() {
  const screen = useScreen((s) => s.screen)
  const [tip, setTip] = useState<{ id: TipId; text: string; n: number } | null>(null)
  const last = useRef(0)
  const n = useRef(0)

  useEffect(() => {
    let hide: ReturnType<typeof setTimeout> | undefined
    const off = onJudge((e: JudgeEvent) => {
      const id: TipId | null = e.type === 'cluster' ? (e.boom ? 'boom' : 'fizzle') : e.type === 'resolve' || e.type === 'cadence' || e.type === 'motif' || e.type === 'charged' ? e.type : null
      if (!id) return
      const now = performance.now()
      if (!ALWAYS.includes(id) && now - last.current < 2500) return
      last.current = now
      const seen = pload<Partial<Record<TipId, number>>>('coach', {})
      const times = seen[id] ?? 0
      psave('coach', { ...seen, [id]: times + 1 })
      const long = times < LESSONS
      setTip({ id, text: TIPS[id][long ? 1 : 0], n: ++n.current })
      clearTimeout(hide)
      hide = setTimeout(() => setTip(null), long ? 4200 : 1800)
    })
    return () => { off(); clearTimeout(hide) }
  }, [])

  if (!tip || screen !== 'play') return null
  return <div key={tip.n} className={'coach coach-' + tip.id} role="status">{tip.text}</div>
}
