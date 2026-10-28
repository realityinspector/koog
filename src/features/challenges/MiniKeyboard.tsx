import type { View } from './defs'

const LO = 48, HI = 84
const BLACK = new Set([1, 3, 6, 8, 10])

export function MiniKeyboard({ v }: { v: View }) {
  const whites: number[] = [], blacks: number[] = []
  for (let n = LO; n <= HI; n++) (BLACK.has(n % 12) ? blacks : whites).push(n)
  const w = 100 / whites.length
  const cls = (n: number) =>
    'chk-key' +
    (v.targetMidi.includes(n) ? ' tm' : v.targets.includes(n % 12) ? ' t' : '') +
    (v.base.includes(n) ? ' b' : '') +
    (v.held.includes(n) ? ' h' : '')
  return (
    <div className="chk">
      {whites.map((n, i) => (
        <div key={n} className={cls(n) + ' w'} style={{ left: `${i * w}%`, width: `${w}%` }}>
          {n % 12 === 0 && <span>C{Math.floor(n / 12) - 1}</span>}
        </div>
      ))}
      {blacks.map((n) => {
        const idx = whites.filter((x) => x < n).length
        return <div key={n} className={cls(n) + ' bk'} style={{ left: `${idx * w - w * 0.3}%`, width: `${w * 0.6}%` }} />
      })}
    </div>
  )
}
