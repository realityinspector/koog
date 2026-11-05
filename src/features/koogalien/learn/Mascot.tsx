// Thin door to the Koog Alien host (ui/Host.tsx is the only file that touches the mascot). Falls back to an emoji if Host.tsx is absent.
import type { ComponentType } from 'react'

type HostProps = { pose: 'wave' | 'listen' | 'teach' | 'cheer' | 'puzzled' | 'sleep'; say?: string; size?: number }
const found = import.meta.glob('../ui/Host.tsx', { eager: true }) as Record<string, { KoogAlienHost?: ComponentType<HostProps> }>
const Host = Object.values(found)[0]?.KoogAlienHost

export function Mascot({ pose, say, size = 96 }: HostProps) {
  if (Host) return <Host pose={pose} say={say} size={size} />
  return <div className="kgl-fallback"><span role="img" aria-label="the Koog Alien" style={{ fontSize: size * 0.6 }}>👽</span>{say ? <p>{say}</p> : null}</div>
}
