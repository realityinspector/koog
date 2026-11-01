import { useEffect, useRef, useState } from 'react'
import { onJudge, type JudgeEvent } from '../../music/judge'
import { useScreen } from '../../layout/screenStore'
import { pload, psave } from '../../profile/profile'
import { useScore } from '../../music/scoreStore'
import { usePhraseView } from '../../music/phrases'
import { useMentor } from '../mentor/mentorStore'

type TipId = 'fizzle' | 'boom' | 'resolve' | 'cadence' | 'motif' | 'charged' | 'phrase'
// [short label, the full lesson shown the first few times]
const TIPS: Record<TipId, [string, string]> = {
  fizzle: ['💨 Fizzle!', '💨 Fizzle! That was a tone cluster (forearm power). Charge ⚡ BOOM by playing in key, THEN slam it for a real finale.'],
  boom: ['⚡ BOOM!', '⚡ BOOM! Tone clusters are a real technique. Henry Cowell played the piano with his whole forearm back in 1917.'],
  resolve: ['✨ Release!', '✨ Tension → release! An out-of-key note that steps back into the key is how songs get exciting.'],
  cadence: ['🏁 Cadence!', '🏁 Cadence! You ended on the home note. That\'s how music says "end of sentence".'],
  motif: ['🔁 Motif!', '🔁 Motif! You repeated a pattern. Beethoven built a whole symphony out of a four-note motif.'],
  phrase: ['🧠 Memorize it?', '🧠 That\'s a phrase! Want to memorize it? Tap 🧠 in SONGS and we\'ll learn it one finger at a time.'],
  charged: ['⚡ BOOM ready!', '⚡ BOOM is charged! Now a forearm slam becomes a finale instead of a fizzle.'],
}
const LESSONS = 3 // full explanation this many times per kid, then just the short label
// the memorize nudge is rare: free play only, every 3rd motif at most, 4 min apart, 6 times per kid
const PHRASE_TIP_COOLDOWN = 4 * 60 * 1000, PHRASE_MAX = 6
const ALWAYS: TipId[] = ['boom', 'charged']

/** Little coach captions on the display when the judge spots a musical moment. */
export function CoachTips() {
  const screen = useScreen((s) => s.screen)
  const [tip, setTip] = useState<{ id: TipId; text: string; n: number } | null>(null)
  const last = useRef(0)
  const n = useRef(0)
  const motifs = useRef(0)
  const lastPhrase = useRef(-Infinity)

  useEffect(() => {
    let hide: ReturnType<typeof setTimeout> | undefined
    const off = onJudge((e: JudgeEvent) => {
      let id: TipId | null = e.type === 'cluster' ? (e.boom ? 'boom' : 'fizzle') : e.type === 'resolve' || e.type === 'cadence' || e.type === 'motif' || e.type === 'charged' ? e.type : null
      if (!id) return
      // Mentor mode is listening: it names these moments itself, so the coach stays quiet (no duplicate captions)
      if (useMentor.getState().on && id !== 'charged') return
      if (id === 'motif') {
        const free = !useScore.getState().score && !usePhraseView.getState().phrase
        const seen = pload<number>('coach.phraseTips', 0)
        if (free && ++motifs.current % 3 === 0 && performance.now() - lastPhrase.current > PHRASE_TIP_COOLDOWN && seen < PHRASE_MAX) {
          lastPhrase.current = performance.now(); psave('coach.phraseTips', seen + 1); id = 'phrase'
        }
      }
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
