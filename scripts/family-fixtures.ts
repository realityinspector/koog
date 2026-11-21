// Family Band chart: classics and holiday songs, lyric lines, piano letters, guitar chords.
// The analog seats are names on screen. This file never opens a MIDI port.
import { familyRepertoire, familySong, guitarChord, isFamilySong, lineText, lyricLines, noteAt, pianoLetters } from '../src/features/familyband/chart.ts'
import { SONGS, type Song } from '../src/features/songs/songs.ts'

let passed = 0
let failed = 0
const ok = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) { passed++; return }
  failed++
  console.error('FAIL', name, extra ?? '')
}
const eq = (name: string, got: unknown, want: unknown) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want })

const rep = familyRepertoire()
const ids = [...rep.classics, ...rep.thanksgiving, ...rep.christmas].map((s) => s.id)
ok('every family song is a classic or a holiday', [...rep.classics, ...rep.thanksgiving, ...rep.christmas].every(isFamilySong))
ok('no pop, bang, flex, or classical tune is in the band', ids.every((id) => {
  const s = SONGS.find((x) => x.id === id)!
  return s.tier === 'easy' || s.tier === 'holiday' || s.season != null
}))
ok('twinkle is a classic', rep.classics.some((s) => s.id === 'twinkle'))
ok('ode is a classic', rep.classics.some((s) => s.id === 'ode'))
ok('jingle is a holiday, not a classic', rep.christmas.some((s) => s.id === 'jingle') && !rep.classics.some((s) => s.id === 'jingle'))
ok('overriver is thanksgiving', rep.thanksgiving.some((s) => s.id === 'overriver'))
ok('silent night is christmas', rep.christmas.some((s) => s.id === 'silentnight'))
ok('a pop original stays out', !isFamilySong(SONGS.find((s) => s.id === 'pop-static')!))
ok('no duplicate ids', new Set(ids).size === ids.length)
ok('there is a handful of songs', ids.length >= 15, ids.length)

const tw = familySong('twinkle')!
const ly = lyricLines(tw)!
eq('twinkle opens with the first line', lineText(ly.lines[0]), 'Twinkle twinkle little star')
eq('mary joins the name', lineText(lyricLines(familySong('mary')!)!.lines[0]), 'Mary had a little lamb')
const wordless = SONGS.find((s) => !s.notes.some((n) => n.lyric))
ok('a song with no words has no lyric chart', !!wordless && lyricLines(wordless) == null, wordless?.id)

eq('twinkle starts on C4', pianoLetters(tw, 0).now, 'C4')
eq('the next letters follow', pianoLetters(tw, 0).next.slice(0, 3), ['C4', 'G4', 'G4'])
const at0 = noteAt(tw, 0)
eq('the first sounding note is index 0', at0.idx, 0)
ok('the count-in is before the first note', noteAt(tw, -1).idx === -1 && noteAt(tw, -1).midi == null)

eq('C major bar 1 is I', guitarChord(tw, 0), { roman: 'I', name: 'C' })
eq('C major bar 2 is IV', guitarChord(tw, 4), { roman: 'IV', name: 'F' })
eq('C major bar 3 is V', guitarChord(tw, 8), { roman: 'V', name: 'G' })
eq('C major bar 4 returns to I', guitarChord(tw, 12), { roman: 'I', name: 'C' })

const amin = { key: { tonic: 9, scale: 'minor' }, beatsPerBar: 4, notes: [], harmony: undefined } as unknown as Song
eq('A minor bar 1 is i', guitarChord(amin, 0), { roman: 'i', name: 'Am' })
eq('A minor bar 2 is iv', guitarChord(amin, 4), { roman: 'iv', name: 'Dm' })
eq('A minor bar 3 is V', guitarChord(amin, 8), { roman: 'V', name: 'E' })

const wish = familySong('wewish')!
eq('We Wish You is G', guitarChord(wish, 0).name, 'G')
ok('a written harmony name is used when the song has one', (() => {
  const s = { ...tw, harmony: [{ start: 0, beats: 8, name: 'Cmaj7', pcs: [0, 4, 7, 11], bass: 48 }] } as Song
  return guitarChord(s, 2).name === 'Cmaj7' && guitarChord(s, 9).name === 'G'
})())

console.log(failed ? `${failed} failed, ${passed} passed` : `${passed} passed`)
if (failed) process.exit(1)
