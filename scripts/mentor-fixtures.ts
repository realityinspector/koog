// Mentor ears + mouth checks. Replays synthetic note streams through the real listener (src/features/mentor/listen.ts)
// and asserts which moves fire (critiques, composer quotes, composer styles, and things that must NOT fire), then
// simulates a sloppy and a clean session through the real speech chooser (select.ts) to report the praise/critique mix.
//   npx --no-install tsx scripts/mentor-fixtures.ts        (exit 1 on any failure)
const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size }, clear: () => m.clear() } }
const g = globalThis as Record<string, unknown>
g.localStorage ??= mem(); g.sessionStorage ??= mem()
const noop = () => {}
g.window ??= { addEventListener: noop, removeEventListener: noop, localStorage: g.localStorage, sessionStorage: g.sessionStorage }
g.document ??= { addEventListener: noop, removeEventListener: noop, hidden: false }

const { createListener } = await import('../src/features/mentor/listen')
const { choose } = await import('../src/features/mentor/select')
const allusion = await import('../src/music/allusion')
const { SONGS } = await import('../src/features/songs/songs')
type Move = import('../src/features/mentor/listen').Move
type MoveKind = import('../src/features/mentor/lines').MoveKind
type SelState = import('../src/features/mentor/select').SelState

const index = allusion.buildIndex(allusion.songSources())
const C = { tonic: 0, scale: 'major' as const }
// [note | note[] (a chord), time ms, velocity]
type N = [number | number[], number, number?]

function run(notes: N[], vel = 90): Move[] {
  const out: Move[] = []
  const L = createListener({ key: () => C, index: () => index, meters: () => ({ rhythm: 0.8 }) }, (m) => out.push(m))
  let last = 0
  for (const [n, t, v] of notes) {
    for (let x = last + 100; x < t; x += 100) L.advance(x)
    for (const k of Array.isArray(n) ? n : [n]) L.push(k, v ?? vel, t)
    last = t
  }
  for (let x = last + 100; x < last + 3000; x += 100) L.advance(x)
  return out
}
/** a melody: notes every `ms`, starting at t0 */
const line = (ns: number[], ms: number, t0 = 0, vel?: number): N[] => ns.map((n, i) => [n, t0 + i * ms, vel])
const fromSong = (id: string, bpm?: number, count = 12): N[] => {
  const s = SONGS.find((x) => x.id === id)!, beat = 60000 / (bpm ?? s.bpm)
  const out: N[] = []; let t = 0
  for (const n of s.notes) { if (n.note != null && out.length < count) out.push([n.note, t]); t += n.beats * beat }
  return out
}
let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

let fails = 0
const kinds = (ms: Move[]) => ms.map((m) => m.kind)
function expect(name: string, ms: Move[], want: MoveKind[], not: MoveKind[] = [], also?: (ms: Move[]) => string | null) {
  const k = kinds(ms), miss = want.filter((w) => !k.includes(w)), bad = not.filter((w) => k.includes(w)), extra = also?.(ms) ?? null
  const ok = !miss.length && !bad.length && !extra
  if (!ok) fails++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${miss.length ? `  missing: ${miss.join(',')}` : ''}${bad.length ? `  unexpected: ${bad.join(',')}` : ''}${extra ? '  ' + extra : ''}`)
  if (!ok) console.log('      fired:', [...new Set(k)].join(', '))
}
const CRIT: MoveKind[] = ['c-mashing', 'c-banging', 'c-hammered', 'c-nospace', 'c-wrongnote', 'c-wandering', 'c-wobbly', 'c-rushing']
const STYLES: MoveKind[] = ['style-bach', 'style-satie', 'style-beethoven', 'style-mozart', 'style-chopin', 'style-debussy', 'style-joplin']

// ---------- composer recognition ----------
expect('Ode to Joy names Beethoven', run(fromSong('ode')), ['quote'], [], (ms) => {
  const q = ms.find((m) => m.kind === 'quote')
  return q && q.data.who === 'Beethoven' && q.kid[0].startsWith("That's Beethoven! Ode to Joy, from his 9th Symphony, 1824.") ? null : 'no Beethoven line: ' + (q?.kid[0] ?? '-')
})
expect('Ode to Joy in G still names Beethoven', run(fromSong('ode').map(([n, t]) => [(n as number) + 7, t] as N)), ['quote'], [], (ms) => ms.find((m) => m.kind === 'quote')?.data.who === 'Beethoven' ? null : 'no composer')
expect('Twinkle is a traditional folk tune', run(fromSong('twinkle')), ['quote'], [], (ms) => {
  const q = ms.find((m) => m.kind === 'quote')
  return q && q.data.who === '' && /French folk tune/.test(q.kid.join(' ')) ? null : 'no folk line: ' + (q?.kid[0] ?? '-')
})
expect('The Entertainer names Joplin', run(fromSong('entertainer')), ['quote'], [], (ms) => ms.find((m) => m.kind === 'quote')?.data.who === 'Scott Joplin' ? null : 'no composer')
expect('Für Elise names Beethoven', run(fromSong('elise')), ['quote'], [], (ms) => ms.find((m) => m.kind === 'quote')?.data.who === 'Beethoven' ? null : 'no composer')

// ---------- honest critiques ----------
const mash: N[] = []; { let t = 0; for (let i = 0; i < 30; i++) { mash.push([48 + Math.floor(rnd() * 36), t]); t += 120 + rnd() * 80 } }
expect('random mashing is called out', run(mash), ['c-mashing'], STYLES)
expect('slamming clusters 3x is called out', run([[[60, 61, 62, 63, 64], 0], [[55, 56, 57, 58, 59], 900], [[62, 63, 64, 65, 66], 1800]]), ['c-mashing'])
expect('fast chromatic run is NOT mashing', run(line(Array.from({ length: 24 }, (_, i) => 57 + (i % 12)), 90)), [], ['c-mashing'])
expect('fast chords are NOT mashing', run([[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67], [57, 60, 64], [65, 69, 72], [67, 71, 74], [60, 64, 67], [62, 65, 69], [67, 71, 74]].map((c, i) => [c, i * 250] as N)), [], ['c-mashing'])
const bang: N[] = [...line([60, 62, 64, 65, 67, 65, 64, 62], 300, 0).map(([n, t], i) => [n, t, 50 + i * 8] as N), ...line([60, 64, 67, 72, 67, 64, 60, 64, 67, 72, 67, 64], 300, 3000, 122).map(([n, t], i) => [n, t, 118 + (i % 3) * 3] as N)]
expect('banging (real velocity) is called out', run(bang), ['c-banging'])
expect('typing velocity (80-100) never bangs', run(line([60, 64, 67, 72, 67, 64, 60, 64, 67, 72, 67, 64, 60, 64], 300).map(([n, t], i) => [n, t, 80 + ((i * 7) % 21)] as N)), [], ['c-banging', 'style-beethoven'])
expect('fixed velocity 127 never bangs', run(line([60, 64, 67, 72, 67, 64, 60, 64, 67, 72, 67, 64, 60, 64], 300, 0, 127)), [], ['c-banging'])
expect('same note hammered is called out', run(line(Array(11).fill(64), 250)), ['c-hammered'])
expect('three repeated notes are fine', run(line([67, 67, 67, 63, 65, 65, 65, 62], 250)), [], ['c-hammered'])
expect('no rests for 12 s is called out', run(line(Array.from({ length: 48 }, (_, i) => [60, 62, 64, 65, 67, 69, 71, 72][(i * 3) % 8]), 260)), ['c-nospace'])
expect('landing on an out-of-key note is called out', run(line([60, 62, 64, 65, 66], 400)), ['c-wrongnote'], [], (ms) => ms.find((m) => m.kind === 'c-wrongnote')?.data.note === 'F#' ? null : 'wrong note name')
expect('stopping mid-run is called out', run(line([60, 62, 64, 65, 67, 69, 71, 69, 71, 72, 74, 76, 77], 300)), ['c-abrupt'])
expect('wandering out of key is called out', run(line([60, 61, 63, 66, 68, 70, 61, 63], 350)), ['c-wandering'])
const wob: N[] = []; { let t = 0; for (let i = 0; i < 10; i++) { wob.push([[60, 64, 62, 65, 67, 64, 62, 60, 62, 60][i], t]); t += [210, 530, 290, 610, 340, 480, 230, 590, 390, 300][i] } }
expect('wobbly timing is called out', run(wob), ['c-wobbly'])
expect('rushing is called out', run(line([60, 62, 64, 65, 67, 65, 64, 62, 60], 0).map(([n], i) => [n, [0, 500, 1000, 1480, 1880, 2200, 2440, 2620, 2760][i]] as N)), ['c-rushing'])

// ---------- clean playing gets no critique ----------
expect('clean Ode to Joy draws no critique', run(fromSong('ode', undefined, 15)), ['quote'], CRIT)

// ---------- composer style moves ----------
expect('Bach: running sequence', run(line([60, 62, 64, 60, 62, 64, 65, 62, 64, 65, 67, 64], 180)), ['style-bach'])
expect('Bach: plain scale is NOT Bach', run(line([60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79], 180)), [], ['style-bach'])
expect('Mozart: Alberti bass', run(line([48, 55, 52, 55, 48, 55, 52, 55], 220)), ['style-mozart'])
expect('Debussy: whole-tone line', run(line([60, 62, 64, 66, 68, 70, 68, 66], 400)), ['style-debussy'])
expect('Debussy: parallel chords', run([[60, 64, 67], [62, 66, 69], [64, 68, 71], [66, 70, 73]].map((c, i) => [c, i * 700] as N)), ['style-debussy'])
expect('Satie: slow, sparse, a 7th', run([[[43, 47, 50, 54], 0] as N, ...line([66, 69, 67, 66, 61, 59, 61, 62], 1200, 600)]), ['style-satie'])
const rag: N[] = []; { const b = 400; for (let i = 0; i < 4; i++) { rag.push([36 + (i % 2) * 7, i * 2 * b]); rag.push([[52, 55, 60], (i * 2 + 1) * b]); rag.push([72 + (i % 3), i * 2 * b + b * 0.5]); rag.push([76, (i * 2 + 1) * b + b * 0.5]) } rag.sort((a, b2) => a[1] - b2[1]) }
expect('Joplin: oom-pah + syncopation', run(rag), ['style-joplin'])
const cho: N[] = [[36, 0], [43, 150], [48, 300], [52, 450], [55, 600], [76, 650], [52, 750], [48, 900], [79, 1000], [43, 1050]]
expect('Chopin: wide LH sweep + melody', run(cho), ['style-chopin'])
const bee: N[] = [...line([67, 67, 67, 63], 200, 0, 55), ...line([65, 65, 65, 62], 200, 1200, 58), ...line([67, 67, 67, 63], 200, 2400, 120)].map(([n, t, v], i) => [n, t, (v ?? 90) + (i % 3) * 2] as N)
expect('Beethoven: motif + sforzando', run(bee), ['style-beethoven'])

// ---------- speech mix: sloppy vs clean sessions through the real chooser ----------
function speak(ms: Move[]) {
  const counts: Record<string, number> = {}, today: string[] = []
  const st: SelState & { recent: MoveKind[] } = { everSeen: (k) => !!counts[k], seenToday: (k) => today.includes(k), recentKinds: [], recent: [], lastPraise: null, lastCritique: null, critStreak: 0 }
  const pending: { m: Move; at: number }[] = [], topicAt = new Map<string, number>()
  let nextAt = 1500, i = 0
  const said: Move[] = []
  const end = (ms[ms.length - 1]?.t ?? 0) + 9000
  for (let now = 0; now <= end; now += 120) {
    while (i < ms.length && ms[i].t <= now) pending.push({ m: ms[i++], at: now })
    for (let j = pending.length - 1; j >= 0; j--) if (now - pending[j].at > 9000 || now - (topicAt.get(pending[j].m.topic) ?? -1e9) < 20000) pending.splice(j, 1)
    if (now < nextAt || !pending.length) continue
    const s = { ...st, critStreak: st.lastCritique && now - st.lastCritique.at > 20000 ? 0 : st.critStreak }
    const k = choose(pending.map((p) => p.m), s, now)
    if (k < 0) continue
    const m = pending.splice(k, 1)[0].m
    said.push(m); topicAt.set(m.topic, now); nextAt = now + 5000
    st.recentKinds = [...st.recentKinds.slice(-5), m.kind]
    if (m.critique) { st.critStreak = s.critStreak + 1; st.lastCritique = { kind: m.kind, at: now } }
    else { st.critStreak = 0; st.lastPraise = { kind: m.kind, topic: m.topic }; counts[m.kind] = 1; today.push(m.kind) }
  }
  return said
}
function session(kind: 'sloppy' | 'clean'): N[] {
  const out: N[] = []; let t = 0
  for (let rep = 0; rep < 8; rep++) {
    if (kind === 'clean') {
      const id = ['ode', 'twinkle', 'minuet', 'mary', 'ode', 'saints', 'grace', 'jingle'][rep]
      for (const [n, dt] of fromSong(id, undefined, 14)) out.push([n, t + dt])
      t = (out[out.length - 1][1]) + 1500
      for (const [n, dt] of line([60, 62, 64, 60, 62, 64, 65, 62, 64, 65, 67, 64, 72, 71, 67, 65, 64, 62, 60], 220)) out.push([n, t + dt])
      t = out[out.length - 1][1] + 1800
    } else {
      for (let i = 0; i < 14; i++) { out.push([48 + Math.floor(rnd() * 36), t]); t += 110 + rnd() * 90 } // a mash
      t += 1200
      for (let i = 0; i < 9; i++) { out.push([[60, 61, 64, 66, 63, 68, 70, 65, 66][i], t]); t += 200 + rnd() * 600 } // wandering + wobbly
      t += 1200
      for (let i = 0; i < 10; i++) { out.push([64, t]); t += 230 } // hammered
      t += 1400
      for (let i = 0; i < 8; i++) { out.push([[60, 62, 64, 65, 67, 69, 71, 66][i], t]); t += [500, 470, 430, 380, 320, 260, 210, 180][i] } // rushing to a wrong note
      t += 1500
    }
  }
  return out
}
for (const kind of ['sloppy', 'clean'] as const) {
  const said = speak(run(session(kind)))
  const c = said.filter((m) => m.critique).length, p = said.length - c
  console.log(`\n${kind} session (~${Math.round((said[said.length - 1]?.t ?? 0) / 1000)} s): ${said.length} lines, ${c} critique / ${p} praise`)
  console.log('   ' + said.map((m) => m.kind).join(' → '))
  // no praise twice in a row for the same thing
  for (let j = 1; j < said.length; j++) {
    const a = said[j - 1], b = said[j]
    if (!a.critique && !b.critique && a.kind === b.kind) { fails++; console.log(`FAIL same praise twice in a row: ${a.kind}`) }
  }
  if (kind === 'sloppy' && c < p) { fails++; console.log('FAIL sloppy session: critique should be at least as frequent as praise') }
  if (kind === 'clean' && c > p / 3) { fails++; console.log('FAIL clean session: too much critique') }
}

console.log(fails ? `\n${fails} failure(s)` : '\nmentor fixtures: all ok')
process.exit(fails ? 1 : 0)

export {} // a module, so top-level await type-checks in the editor
