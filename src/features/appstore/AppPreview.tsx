import { conceptInfo } from './concepts'
import type { KodeApp } from '../../kode/kore'

const hue = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360; return h }
export const SLIDES = ['Play', 'Code', 'Power'] as const

/** A small drawn picture of an app (no external images): falling notes, code lines, or the concept badge. Pure SVG, still. */
export function AppPreview({ app, slide = 0, label }: { app: KodeApp; slide?: number; label?: string }) {
  const h = hue(app.id)
  const c1 = `hsl(${h} 70% 55%)`, c2 = `hsl(${(h + 60) % 360} 75% 62%)`
  const bg = `hsl(${h} 45% 14%)`
  const gid = 'g' + app.id.replace(/[^a-z0-9]/gi, '') + slide
  return (
    <svg className="as-prev" viewBox="0 0 320 180" role="img" aria-label={label ?? `${app.name}: a picture of the ${SLIDES[slide % 3]} screen`} preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient></defs>
      <rect width="320" height="180" fill={bg} />
      {slide % 3 === 0 && <g>
        {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={20 + i * 56} y={0} width={44} height={128} fill="rgba(255,255,255,.04)" rx={6} />)}
        {[[0, 14, 30], [1, 52, 24], [2, 86, 34], [3, 30, 26], [4, 70, 30], [2, 8, 22]].map(([l, y, hh], i) => <rect key={i} x={24 + l * 56} y={y} width={36} height={hh} rx={8} fill={`url(#${gid})`} opacity={0.95 - i * 0.08} />)}
        {Array.from({ length: 14 }, (_, i) => <rect key={i} x={12 + i * 21.5} y={136} width={19} height={38} rx={3} fill="#f4f2ff" opacity={0.9} />)}
        {[1, 2, 4, 5, 6, 8, 9, 11, 12].map((i) => <rect key={i} x={12 + i * 21.5 - 6} y={136} width={12} height={24} rx={2} fill="#17132f" />)}
      </g>}
      {slide % 3 === 1 && <g>
        <rect x={18} y={16} width={284} height={148} rx={10} fill="rgba(0,0,0,.45)" stroke="rgba(255,255,255,.18)" />
        {[[0, 90, c2], [14, 150, c1], [14, 110, '#6cffa8'], [0, 120, c2], [14, 170, c1], [14, 70, '#4fd8ff'], [0, 100, c2]].map(([ind, w, col], i) => <rect key={i} x={34 + (ind as number)} y={30 + i * 18} width={w as number} height={8} rx={4} fill={col as string} opacity={0.9} />)}
        <text x={286} y={156} fontSize={22} textAnchor="end">{app.icon}</text>
      </g>}
      {slide % 3 === 2 && <g>
        {app.concepts.slice(0, 3).map((c, i, a) => {
          const x = 160 + (i - (a.length - 1) / 2) * 84
          return <g key={c}><circle cx={x} cy={84} r={34} fill={`url(#${gid})`} /><circle cx={x} cy={84} r={34} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={3} /><text x={x} y={96} fontSize={34} textAnchor="middle">{conceptInfo(c).icon}</text><text x={x} y={142} fontSize={12} fontWeight={700} textAnchor="middle" fill="#f4f2ff">{conceptInfo(c).name}</text></g>
        })}
        <text x={160} y={26} fontSize={12} textAnchor="middle" fill="#c9c4e6" letterSpacing="2">YOU EARN</text>
      </g>}
    </svg>
  )
}
