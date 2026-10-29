// Sanity check for the classical library: node-free run via `npx tsx scripts/check-classical.ts`
import { CLASSICAL, CHROMATIC_OK } from '../src/music/classical'
const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10]
let bad = 0
for (const s of CLASSICAL) {
  const notes = s.notes.filter((n) => n.note != null).map((n) => n.note as number)
  const errs: string[] = []
  if (!notes.length) errs.push('no notes')
  for (const n of s.notes) {
    if (!Number.isFinite(n.beats) || n.beats <= 0) errs.push('bad beats ' + n.beats)
    if (n.note != null && (!Number.isFinite(n.note) || n.note < 48 || n.note > 84)) errs.push('out of range ' + n.note)
  }
  const sc = (s.key.scale === 'minor' ? MIN : MAJ).map((x) => (x + s.key.tonic) % 12)
  // minor keys: also accept the raised 7th (harmonic) and 6th (melodic)
  if (s.key.scale === 'minor') sc.push((s.key.tonic + 11) % 12, (s.key.tonic + 9) % 12)
  const inKey = notes.filter((n) => sc.includes(n % 12)).length / notes.length
  const flag = inKey < 0.8 ? (CHROMATIC_OK.has(s.id) ? 'chromatic (allowed)' : 'LOW IN-KEY') : ''
  if (inKey < 0.8 && !CHROMATIC_OK.has(s.id)) errs.push('in-key ' + inKey.toFixed(2))
  if (s.tier !== 'classical' || s.checked !== false) errs.push('tier/checked')
  console.log(s.id.padEnd(12), notes.length + ' notes', 'inKey', (inKey * 100).toFixed(0) + '%', 'range', Math.min(...notes) + '-' + Math.max(...notes), flag, errs.length ? 'ERR ' + errs.join('; ') : 'ok')
  bad += errs.length
}
console.log(bad ? 'FAILED' : 'ALL OK'); process.exit(bad ? 1 : 0)
