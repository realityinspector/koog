// The ONLY file that touches the Koog Alien mascot (src/brand/mascot). Found with import.meta.glob so the app still
// compiles if the mascot moves; until it loads (or if it is missing) a plain emoji badge stands in.
import { Suspense, lazy, type ComponentType } from 'react'

export type HostPose = 'wave' | 'listen' | 'teach' | 'cheer' | 'puzzled' | 'oops' | 'sleep'
type MascotProps = { pose?: string; mood?: string; size?: number | string; animated?: boolean; talking?: boolean; labelled?: boolean; title?: string }

const found = import.meta.glob('../../../brand/mascot/KoogAlien.tsx') as Record<string, () => Promise<Record<string, unknown>>>
const loader = Object.values(found)[0]
const Mascot = loader
  ? lazy(async () => { const m = await loader(); return { default: (m.KoogAlien ?? (() => null)) as ComponentType<MascotProps> } })
  : null

const MAP: Record<HostPose, { pose: string; mood: string }> = {
  wave: { pose: 'wave', mood: 'happy' },
  listen: { pose: 'listen', mood: 'curious' },
  teach: { pose: 'sing', mood: 'happy' },
  cheer: { pose: 'cheer', mood: 'excited' },
  puzzled: { pose: 'think', mood: 'curious' },
  oops: { pose: 'oops', mood: 'curious' },
  sleep: { pose: 'sleep', mood: 'happy' },
}
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function KoogAlienHost({ pose, say, size = 120 }: { pose: HostPose; say?: string; size?: number }) {
  const m = MAP[pose]
  const badge = <span className="kgx-badge" style={{ fontSize: size * 0.6 }} role="img" aria-label="the Koog Alien">👽</span>
  return (
    <div className="kgx-host" data-pose={pose}>
      <div className="kgx-host-fig" style={{ width: size }}>
        {Mascot
          ? <Suspense fallback={badge}><Mascot pose={m.pose} mood={m.mood} size={size} animated={!reduced()} talking={pose === 'teach'} /></Suspense>
          : badge}
      </div>
      {say ? <p className="kgx-bubble" aria-live="polite">{say}</p> : null}
    </div>
  )
}
