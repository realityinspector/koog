import { DISHES, ORNAMENT_COLORS } from './data'

/** deterministic spots on the tree for n ornaments (tiers get wider toward the bottom) */
function treeSpots(n: number): { x: number; y: number }[] {
  const tiers = [{ y: 150, w: 70 }, { y: 215, w: 110 }, { y: 285, w: 150 }, { y: 350, w: 190 }]
  const out: { x: number; y: number }[] = []
  const per = Math.max(1, Math.ceil(n / tiers.length))
  for (let i = 0; i < n; i++) {
    const t = tiers[Math.min(tiers.length - 1, Math.floor(i / per))]
    const k = i % per, m = Math.min(per, n - Math.floor(i / per) * per)
    const x = 200 + (m === 1 ? 0 : ((k / (m - 1)) - 0.5) * 2 * t.w * 0.82)
    out.push({ x, y: t.y + ((k % 2) * 14) })
  }
  return out
}

/** Light the Tree: each nailed phrase hangs an ornament; levels add garland lights; Master puts the star on top. */
export function Tree({ count, got, done, pulse, lastGot = -1, frac = 0 }: { count: number; got: number[]; done: boolean[]; pulse: number; lastGot?: number; frac?: number }) {
  const spots = treeSpots(Math.max(1, count))
  const garlands = [{ y: 175, w: 62 }, { y: 245, w: 100 }, { y: 318, w: 140 }]
  const levelsDone = done.filter(Boolean).length
  // 15 lights in 3 strands: each finished rung lights 2.5 of them, and the current run lights more as you go
  const lit = (g: number, b: number) => Math.round(levelsDone * 2.5 + frac * 2.5) > g * 5 + b
  return (
    <svg className="hg-svg hg-tree" viewBox="0 0 400 460" role="img" aria-label={`Christmas tree with ${got.length} ornaments${done[4] ? ' and a star' : ''}`}>
      <rect x="185" y="400" width="30" height="40" rx="3" fill="#7a4b24" />
      {[{ y: 340, w: 170, h: 90 }, { y: 270, w: 140, h: 85 }, { y: 205, w: 110, h: 80 }, { y: 135, w: 80, h: 80 }].map((t, i) => (
        <path key={i} d={`M200 ${t.y - t.h} L${200 - t.w} ${t.y + 10} Q200 ${t.y + 30} ${200 + t.w} ${t.y + 10} Z`} fill={['#1f7a4d', '#238a55', '#2a9a60', '#32aa6b'][i]} stroke="#14573a" strokeWidth="2" />
      ))}
      {garlands.map((g, gi) => (
        <g key={gi}>
          <path d={`M${200 - g.w} ${g.y} Q200 ${g.y + 34} ${200 + g.w} ${g.y}`} fill="none" stroke="#e9d9a6" strokeWidth="2" strokeDasharray="1 5" strokeLinecap="round" opacity=".7" />
          {[0, 1, 2, 3, 4].map((b) => {
            const u = b / 4, x = 200 - g.w + 2 * g.w * u, y = g.y + 34 * 2 * u * (1 - u) * 1.0
            const on = lit(gi, b)
            return <circle key={b} className={'hg-bulb' + (on ? ' on' : '')} style={{ animationDelay: `${(gi * 5 + b) * 0.37}s` }} cx={x} cy={y + 4} r="6" fill={on ? ['#ffd24a', '#ff6b6b', '#6bd1ff', '#9dff7a', '#ff9bf0'][b % 5] : '#3d4a47'} />
          })}
        </g>
      ))}
      {spots.map((s, i) => {
        const on = got.includes(i)
        return (
          <g key={i + '-' + (i === lastGot ? pulse : 0)} className={on ? 'hg-orn on' + (i === lastGot ? ' fresh' : '') : 'hg-orn'}>
            <line x1={s.x} y1={s.y - 12} x2={s.x} y2={s.y - 4} stroke="#d8c9a0" strokeWidth="1.5" opacity={on ? 1 : .25} />
            <circle cx={s.x} cy={s.y + 4} r="10" fill={on ? ORNAMENT_COLORS[i % ORNAMENT_COLORS.length] : 'none'} stroke={on ? '#fff6' : '#ffffff40'} strokeWidth="2" strokeDasharray={on ? '0' : '3 3'} />
            {on && <circle cx={s.x - 3} cy={s.y} r="2.6" fill="#fff" opacity=".7" />}
          </g>
        )
      })}
      <g key={'star' + pulse} className={'hg-star' + (done[4] ? ' on' : '')}>
        <polygon points="200,38 207,58 228,58 211,70 218,90 200,78 182,90 189,70 172,58 193,58" fill={done[4] ? (done[5] ? '#ffe36b' : '#ffd24a') : 'none'} stroke={done[4] ? '#fff2a8' : '#ffffff40'} strokeWidth="2.5" strokeDasharray={done[4] ? '0' : '4 4'} />
      </g>
      <text x="200" y="455" textAnchor="middle" fontSize="12" fill="currentColor" opacity=".6">{done[5] ? 'Master! The star shines.' : done[4] ? 'The star is on top!' : 'Finish Play full to put the star on top'}</text>
    </svg>
  )
}

/** Harvest Feast: each nailed phrase puts a dish on the table; levels add decorations; Master brings the turkey. */
export function Feast({ count, got, done, pulse, lastGot = -1 }: { count: number; got: number[]; done: boolean[]; pulse: number; lastGot?: number; frac?: number }) {
  const n = Math.max(1, count)
  const cols = Math.min(n, 6), rows = Math.ceil(n / cols)
  const slot = (i: number) => {
    const r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, n - r * cols)
    const x = 300 + (c - (inRow - 1) / 2) * 78, y = 150 + r * 62 - (rows - 1) * 22
    return { x, y }
  }
  return (
    <svg className="hg-svg hg-feast" viewBox="0 0 600 340" role="img" aria-label={`Feast table with ${got.length} dishes${done[4] ? ' and a turkey' : ''}`}>
      <ellipse cx="300" cy="170" rx="285" ry="125" fill="#8b5a2b" stroke="#5e3b19" strokeWidth="4" />
      <ellipse cx="300" cy="166" rx="262" ry="106" fill="#c0562b" opacity=".92" />
      <ellipse cx="300" cy="166" rx="262" ry="106" fill="none" stroke="#f5c542" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" />
      {Array.from({ length: n }, (_, i) => {
        const p = slot(i), on = got.includes(i)
        return (
          <g key={i + '-' + (i === lastGot ? pulse : 0)} className={on ? 'hg-dish on' + (i === lastGot ? ' fresh' : '') : 'hg-dish'}>
            <circle cx={p.x} cy={p.y} r="26" fill="#fff8e7" opacity={on ? 1 : .35} stroke="#e7d8b4" strokeWidth="3" />
            {on && <text x={p.x} y={p.y + 11} textAnchor="middle" fontSize="32">{DISHES[i % DISHES.length]}</text>}
          </g>
        )
      })}
      {done[0] && <text x="40" y="70" fontSize="30">🕯️</text>}
      {done[0] && <text x="530" y="70" fontSize="30">🕯️</text>}
      {done[1] && <text x="70" y="290" fontSize="32">🎃</text>}
      {done[2] && <text x="500" y="290" fontSize="32">🌽</text>}
      {done[3] && <text x="285" y="48" fontSize="30">🍂</text>}
      {done[5] && <text x="300" y="262" textAnchor="middle" fontSize="30">👑</text>}
      {!done[0] && <text x="40" y="70" fontSize="30" opacity=".15">🕯️</text>}
      <g key={'t' + pulse} className={'hg-turkey' + (done[4] ? ' on' : '')}>
        <text x="300" y="320" textAnchor="middle" fontSize="44" opacity={done[4] ? 1 : .18}>🦃</text>
      </g>
      <text x="300" y="336" textAnchor="middle" fontSize="12" fill="currentColor" opacity=".6">{done[5] ? 'Master chef! The whole feast is served.' : done[4] ? 'The feast is served!' : 'Finish Play full to serve the turkey'}</text>
    </svg>
  )
}
