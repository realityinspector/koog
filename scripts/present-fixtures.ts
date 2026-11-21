// Fixtures for Presentation mode (src/features/synth-history/present): decks, quizzes, photos and the deck-file checker.
// Run: npm run check:present
import { existsSync } from 'node:fs'
import { DECKS, KID_MAX, parseDeck } from '../src/features/synth-history/present/decks'
import { QUIZZES } from '../src/features/synth-history/present/quizzes'
import { PICS } from '../src/features/synth-history/present/pics'

let fails = 0, passes = 0
const ok = (name: string, cond: boolean, extra = '') => { if (cond) passes++; else { fails++; console.log('FAIL', name, extra) } }

for (const [id, p] of Object.entries(PICS)) {
  ok(`photo ${id} exists`, existsSync('public/synth-pics/' + p.file))
  ok(`photo ${id} has a credit and a license`, !!p.by && !!p.license && p.page.startsWith('https://commons.wikimedia.org/wiki/File:'))
  ok(`photo ${id} is open-licensed`, /public domain|CC BY/i.test(p.license), p.license)
}
for (const d of DECKS) {
  ok(`${d.id}: has slides`, d.slides.length >= 5)
  d.slides.forEach((s, i) => {
    const w = `${d.id} #${i + 1}`
    ok(`${w}: one short kid line`, s.kid.length > 0 && s.kid.length <= KID_MAX && !s.kid.includes('\n'), String(s.kid.length))
    ok(`${w}: has technical lines`, s.tech.length > 0)
    ok(`${w}: photos known`, (!s.pic || s.pic in PICS) && (!s.pic2 || s.pic2 in PICS))
    ok(`${w}: kid line is not just the tech text`, !s.tech.includes(s.kid))
  })
  const rt = parseDeck(JSON.parse(JSON.stringify(d)))
  ok(`${d.id}: round-trips through parseDeck`, 'deck' in rt && rt.deck.slides.length === d.slides.length)
}
ok('the Moog and Kurzweil deck mentions the Grammy and touch', DECKS.some((d) => d.slides.some((s) => /Grammy/.test(s.title + s.kid + s.tech.join()))) && DECKS.some((d) => d.slides.some((s) => /touch/i.test(s.title))))
ok('any trackpad claim carries the "no source" caveat', DECKS.every((d) => d.slides.every((s) => !/trackpad/i.test(s.kid + s.tech.join(' ')) || /no source/i.test(s.tech.join(' ')))))
ok('at least three quizzes', QUIZZES.length >= 3)
for (const z of QUIZZES) for (const [i, q] of z.qs.entries()) {
  const w = `${z.id} Q${i + 1}`
  ok(`${w}: answer index in range`, Number.isInteger(q.a) && q.a >= 0 && q.a < q.o.length)
  ok(`${w}: 2 to 4 distinct options`, q.o.length >= 2 && q.o.length <= 4 && new Set(q.o).size === q.o.length)
  ok(`${w}: kid one-liner and tech note`, q.kid.length > 0 && q.kid.length <= KID_MAX && q.tech.length > 0, String(q.kid.length))
  ok(`${w}: photo known`, !q.pic || q.pic in PICS)
}
for (const z of QUIZZES) ok(`${z.id}: right answers are not always the first option`, new Set(z.qs.map((q) => q.a)).size > 1)
// parseDeck rejects bad input
for (const [name, bad] of [['null', null], ['no title', { slides: [{ title: 'a', kid: 'b' }] }], ['no slides', { title: 'x', slides: [] }], ['no kid line', { title: 'x', slides: [{ title: 'a' }] }], ['long kid line', { title: 'x', slides: [{ title: 'a', kid: 'z'.repeat(KID_MAX + 1) }] }], ['tech not a list', { title: 'x', slides: [{ title: 'a', kid: 'b', tech: 'nope' }] }]] as const)
  ok(`parseDeck rejects: ${name}`, 'error' in parseDeck(bad))
const g = parseDeck({ title: 'My deck', slides: [{ title: 'Hi', kid: 'Hello!', pic: 'nope' }] })
ok('parseDeck accepts a minimal deck and drops an unknown photo', 'deck' in g && g.deck.slides[0].pic === undefined && g.deck.slides[0].tech.length === 0)
// the featured reading: pronunciation and the cousins are in, and it does not claim a headquarters
const ser = DECKS.find((d) => d.featured)
ok('there is one featured deck, with 7 readings', !!ser && DECKS.filter((d) => d.featured).length === 1 && ser.slides.every((x) => !!x.read && !!x.cue))
ok('the reading includes Moog, the pronunciation and the cousins', !!ser && /vogue/.test(ser.slides.map((x) => x.read).join(' ')) && /Moog Inc/.test(ser.slides.map((x) => x.read).join(' ')))
ok('the reading says Moog rhymes with vogue and not moo-g', !!ser && /rhymes with vogue/.test(ser.slides[1].read ?? '') && /NOT “moo-g/.test(ser.slides[1].read ?? ''))
console.log(`present fixtures: ${passes} passed, ${fails} failed`)
if (fails) process.exit(1)
