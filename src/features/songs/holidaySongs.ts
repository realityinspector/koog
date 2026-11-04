// Holiday songs as data (Thanksgiving + Christmas). Pure module, no state, no UI.
// Every melody is traditional or published in the US before 1930. Melodies were read against public ABC
// transcriptions (Silent Night, Good King Wenceslas and The First Noel against two each), then moved to easy keys.
// checked:false = still needs a grown-up to check it by ear, same meaning as in the classical library.
// Other features import HOLIDAY_SONGS (the Art Gallery uses it for holiday art-mode music).
import type { Key } from '../../music/theory'
import { seq } from '../../music/classical'
import type { Song } from './songs'

export type Season = 'thanksgiving' | 'christmas'
const maj = (tonic: number): Key => ({ tonic, scale: 'major' })

/** one syllable per sounding note. "_" = no new syllable (the note holds the last one). Trailing "-" joins, trailing "/" ends a line. */
function withLyrics(song: Song, text: string): Song {
  const toks = text.trim().split(/\s+/)
  const need = song.notes.filter((n) => n.note != null).length
  if (toks.length !== need) {
    if (import.meta.env?.DEV) console.warn(`[holiday] lyrics for ${song.id}: ${toks.length} syllables for ${need} notes, left out`)
    return song
  }
  let i = 0
  return { ...song, notes: song.notes.map((n) => { if (n.note == null) return n; const t = toks[i++]; return t === '_' ? n : { ...n, lyric: t } }) }
}

const T = (s: Omit<Song, 'tier' | 'season'>): Song => ({ ...s, tier: 'holiday', season: 'thanksgiving' })
const C = (s: Omit<Song, 'tier' | 'season'>): Song => ({ ...s, tier: 'holiday', season: 'christmas' })

// ---------- Thanksgiving ----------
const THANKSGIVING: Song[] = [
  T({ id: 'overriver', title: 'Over the River and Through the Wood', origin: 'Words by Lydia Maria Child; traditional tune', year: '1844', key: maj(0), bpm: 100, checked: false,
    hook: 'Off to grandmother\'s house in the sleigh. Rolling, bouncy rhythm: long-long-short.',
    notes: seq(`G4:.75 G4:.75 G4:.5 G4:.75 E4:.75 F4:.5 G4:1.5 A4:.5 G4:1.5 G4:.5
      C5:.75 C5:.75 C5:.5 B4:1.5 A4:.5 G4:3 G4:.5 G4:.5
      F4:.75 F4:.75 F4:.5 F4:1.5 F4:.5 E4:.75 E4:.75 E4:.5 E4:1.5 E4:.5
      D4:1.5 D4:.5 D4:1.5 E4:.5 D4:2 G4:2
      G4:.75 G4:.75 G4:.5 G4:.75 E4:.75 F4:.5 G4:1.5 A4:.5 G4:1.5 G4:.5
      C5:1.5 C5:.5 B4:1.5 A4:.5 G4:3 G4:.5 G4:.5
      C5:1.5 C5:.5 B4:1.5 A4:.5 G4:1.5 E4:.5 C4:1.5 D4:.5
      E4:.75 G4:.75 F4:.5 E4:1.5 D4:.5 C4:4`) }),
  T({ id: 'gather', title: 'We Gather Together', origin: 'Dutch hymn "Wilt heden nu treden" (words 1597, English 1894)', year: '1597', key: maj(2), bpm: 92, checked: false, beatsPerBar: 3, pickup: 1,
    hook: 'A calm hymn of thanks. Each line climbs, then settles back down.',
    notes: seq(`A4:1 A4:1.5 B4:.5 A4:1 F#4:1.5 G4:.5 A4:1 G4:1.5 F#4:.5 E4:1 F#4:1 D4:1
      A4:1 A4:1.5 B4:.5 C#5:1 D5:1.5 E5:.5 C#5:1 B4:1.5 A4:.5 B4:1 A4:2 A4:1
      A4:1.5 B4:.5 C#5:1 D5:2 A4:1 A4:1.5 B4:.5 G4:.5 A4:.5 G4:1 D4:1 G4:1
      G4:1.5 A4:.5 B4:.5 G4:.5 A4:1.5 G4:.5 F#4:1 G4:1 E4:2 D4:3`) }),
  T({ id: 'thankful', title: 'Come, Ye Thankful People, Come', origin: 'Words by Henry Alford; tune by George Elvey', year: '1844', key: maj(5), bpm: 100, checked: false,
    hook: 'The harvest-home hymn. Big, proud tune that leaps up and rolls home.',
    notes: seq(`A4:1.5 A4:.5 C5:1 A4:1 F4:1 G4:1 A4:2
      A4:1.5 A4:.5 C5:1 A4:1 F4:1 G4:1 A4:2
      A4:1.5 A4:.5 Bb4:1 Bb4:1 G4:1.5 G4:.5 A4:2
      A4:1 B4:1 C5:1 F4:1 E4:1 D4:1 C4:2
      E4:1.5 E4:.5 G4:1 E4:1 F4:1 G4:1 A4:2
      A4:1.5 A4:.5 C5:1 A4:1 Bb4:1 C5:1 D5:2
      D5:1.5 D5:.5 Bb4:1 G4:1 C5:1.5 C5:.5 A4:2
      Bb4:1 D5:1 C5:1 F4:1 A4:1 G4:1 F4:2`) }),
  T({ id: 'simplegifts', title: 'Simple Gifts', origin: 'Shaker song by Joseph Brackett', year: '1848', key: maj(7), bpm: 104, checked: false, pickup: 1,
    hook: 'Bows and turns. Same shape twice, then the "turn, turn" part.',
    notes: seq(`D4:.5 D4:.5
      G4:1 G4:.5 A4:.5 B4:.5 G4:.5 B4:.5 C5:.5
      D5:1 D5:.5 C5:.5 B4:1 A4:.5 G4:.5
      A4:1 A4:1 A4:1 G4:1
      A4:.5 B4:.5 A4:.5 F#4:.5 D4:1 D4:1
      G4:.5 F#4:.5 G4:.5 A4:.5 B4:.5 A4:.5 B4:.5 C5:.5
      D5:1 D5:.5 C5:.5 B4:1 A4:.5 G4:.5
      A4:1 A4:1 B4:1 B4:.5 A4:.5
      G4:1 G4:.5 G4:.5 G4:2
      D5:2 B4:1.5 A4:.5
      B4:.5 C5:.5 B4:.5 A4:.5 G4:1.5 A4:.5
      B4:1 B4:.5 C5:.5 D5:1 C5:.5 B4:.5
      A4:1 A4:.5 B4:.5 A4:1 D4:1
      G4:2 G4:1.5 A4:.5
      B4:1 B4:.5 C5:.5 D5:1 C5:.5 B4:.5
      A4:1 A4:1 B4:1 B4:.5 A4:.5
      G4:1 G4:1 G4:2`) }),
]

// ---------- Christmas (new here; Jingle Bells, Deck the Halls and We Wish You a Merry Christmas keep their original entries below) ----------
const CHRISTMAS: Song[] = [
  C({ id: 'silentnight', title: 'Silent Night', origin: 'Franz Gruber', year: '1818', key: maj(0), bpm: 66, checked: true, beatsPerBar: 3, style: 'block',
    hook: 'The lullaby. Long-short-long in threes, and a slow climb to the high notes.',
    notes: seq(`G4:1.5 A4:.5 G4:1 E4:3 G4:1.5 A4:.5 G4:1 E4:3 D5:2 D5:1 B4:3 C5:2 C5:1 G4:3
      A4:2 A4:1 C5:1.5 B4:.5 A4:1 G4:1.5 A4:.5 G4:1 E4:3
      A4:2 A4:1 C5:1.5 B4:.5 A4:1 G4:1.5 A4:.5 G4:1 E4:3
      D5:2 D5:1 F5:1.5 D5:.5 B4:1 C5:3 E5:3 C5:1 G4:1 E4:1 G4:1.5 F4:.5 D4:1 C4:6`) }),
  C({ id: 'joyworld', title: 'Joy to the World', origin: 'Words by Isaac Watts; tune "Antioch"', year: '1719', key: maj(0), bpm: 112, checked: false,
    hook: 'A whole scale tumbling down from the high C. Then the four-note "and heaven and nature sing".',
    notes: seq(`C5:1 B4:.75 A4:.25 G4:1.5 F4:.5 E4:1 D4:1 C4:1.5 G4:.5
      A4:1.5 A4:.5 B4:1.5 B4:.5 C5:1.5 C5:.5
      C5:.5 B4:.5 A4:.5 G4:.5 G4:.75 F4:.25 E4:.5 C5:.5
      C5:.5 B4:.5 A4:.5 G4:.5 G4:.75 F4:.25 E4:.5 E4:.5
      E4:.5 E4:.5 E4:.5 E4:.25 F4:.25 G4:1.5 F4:.25 E4:.25
      D4:.5 D4:.5 D4:.5 D4:.25 F4:.25 F4:1.5 E4:.25 D4:.25
      C4:.5 C5:1 A4:.5 G4:.75 F4:.25 E4:.5 F4:.5 E4:1 D4:1 C4:2`) }),
  C({ id: 'christmastree', title: 'O Christmas Tree', origin: 'German folk song "O Tannenbaum"', year: '1824', key: maj(7), bpm: 96, checked: false, beatsPerBar: 3, pickup: 1,
    hook: 'The tree song. Same line comes back at the end.',
    notes: seq(`D4:1 G4:.75 G4:.25 G4:1 A4:1 B4:.75 B4:.25 B4:1.5 B4:.5 A4:.5 B4:.5 C5:1 F#4:1 A4:1 G4:1
      R:.5 D5:.5 D5:.5 B4:.5 E5:1.5 D5:.5 D5:.5 C5:.5 C5:1.5 C5:.5 C5:.5 A4:.5 D5:1.5 C5:.5 C5:.5 B4:.5 B4:1 D4:1
      G4:.75 G4:.25 G4:1 A4:1 B4:.75 B4:.25 B4:1.5 B4:.5 A4:.5 B4:.5 C5:1 F#4:1 A4:1 G4:1`) }),
  C({ id: 'jollynick', title: 'Jolly Old St. Nicholas', origin: 'Words by Emily Huntington Miller; traditional tune', year: '1865', key: maj(7), bpm: 108, checked: false,
    hook: 'Lean in close. Whispered verse, with a little tune that steps down and back up.',
    notes: seq(`B4:.5 B4:.5 B4:.5 B4:.5 A4:.5 A4:.5 A4:1 G4:.5 G4:.5 G4:.5 G4:.5 B4:2
      E4:.5 E4:.5 E4:.5 E4:.5 D4:.5 D4:.5 G4:1 F#4:.5 G4:.5 A4:.5 B4:.5 A4:2
      B4:.5 B4:.5 B4:.5 B4:.5 A4:.5 A4:.5 A4:1 G4:.5 G4:.5 G4:.5 G4:.5 B4:2
      E4:.5 E4:.5 E4:.5 E4:.5 D4:.5 D4:.5 G4:1 A4:.5 G4:.5 A4:.5 B4:.5 G4:2`) }),
  C({ id: 'housetop', title: 'Up on the Housetop', origin: 'Benjamin Hanby', year: '1864', key: maj(7), bpm: 116, checked: false, style: 'oompah',
    hook: 'Click, click, click. A bouncy verse and a "Ho ho ho" chorus.',
    notes: seq(`D5:1 D5:.5 E5:.5 D5:1 B4:.5 A4:.5 G4:1 B4:1 D5:2
      E5:1 E5:1 D5:1 B4:1 A4:1 D5:1 D5:2
      D5:1 D5:.5 E5:.5 D5:1 B4:.5 A4:.5 G4:1 B4:1 D5:2
      E5:1 E5:.5 E5:.5 D5:.5 D5:.5 B4:1 A4:1 D5:1 G4:2
      C5:1 C5:1 E5:2 D5:1 D5:.5 D5:.5 B4:2
      A4:1 C5:1 C5:2 B4:1 D5:.5 D5:.5 G4:1 B4:1
      D5:1 D5:.5 E5:.5 D5:1 B4:1 C5:1 D5:1 E5:1 R:1
      D5:1 D5:.5 E5:.5 D5:.5 D5:.5 B4:1 A4:1 D5:1 G4:1 R:1`) }),
  C({ id: 'firstnoel', title: 'The First Noel', origin: 'Traditional English carol', year: '1823', key: maj(0), bpm: 92, checked: true, beatsPerBar: 3, pickup: 1,
    hook: 'The verse tune twice, then the big "No-el, No-el" chorus.',
    notes: seq(`E4:.5 D4:.5 C4:1.5 D4:.5 E4:.5 F4:.5 G4:2 A4:.5 B4:.5 C5:1 B4:1 A4:1 G4:2 A4:.5 B4:.5 C5:1 B4:1 A4:1 G4:1 A4:1 B4:1 C5:1 G4:1 F4:1 E4:2 E4:.5 D4:.5
      C4:1.5 D4:.5 E4:.5 F4:.5 G4:2 A4:.5 B4:.5 C5:1 B4:1 A4:1 G4:2 A4:.5 B4:.5 C5:1 B4:1 A4:1 G4:1 A4:1 B4:1 C5:1 G4:1 F4:1 E4:2 E4:.5 D4:.5
      C4:1.5 D4:.5 E4:.5 F4:.5 G4:2 C5:.5 B4:.5 A4:2 A4:1 G4:3 C5:1 B4:1 A4:1 G4:1 A4:1 B4:1 C5:1 G4:1 F4:1 E4:3`) }),
  C({ id: 'wenceslas', title: 'Good King Wenceslas', origin: 'Words by J. M. Neale; tune from 1582', year: '1853', key: maj(7), bpm: 104, checked: true,
    hook: 'A story-song about snow and kindness. The tune repeats, then swoops up high.',
    notes: seq(`G4:1 G4 G4 A4 G4 G4 D4:2 E4:1 D4 E4 F#4 G4:2 G4:2
      G4:1 G4 G4 A4 G4 G4 D4:2 E4:1 D4 E4 F#4 G4:2 G4:2
      D5:1 C5 B4 A4 B4 A4 G4:2 E4:1 D4 E4 F#4 G4:2 G4:2
      D4:1 D4 E4 F#4 G4 G4 A4:2 D5:1 C5 B4 A4 G4:2 C5:2 G4:4`) }),
  C({ id: 'awaymanger', title: 'Away in a Manger', origin: 'Words from the 1880s; tune by James R. Murray', year: '1887', key: maj(7), bpm: 72, checked: false, beatsPerBar: 3, pickup: 1,
    hook: 'A sleepy lullaby that drifts down from the high D.',
    notes: seq(`D5:1 D5:1.5 C5:.5 B4:1 B4:1 A4:1 G4:1 G4:1 F#4:1 E4:1 D4:2
      D4:1 D4:1.5 E4:.5 D4:1 D4:1 A4:1 F#4:1 E4:1 D4:1 G4:1 B4:2
      D5:1 D5:1.5 C5:.5 B4:1 B4:1 A4:1 G4:1 G4:1 F#4:1 E4:1 D4:2
      D4:1 C5:1.5 B4:.5 A4:1 B4:1 A4:1 G4:1 A4:1 E4:1 F#4:1 G4:3`) }),
]

const LYRICS: Record<string, string> = {
  silentnight: `Si- lent night _/ ho- ly night _/ all is calm all is bright/ round yon vir _ gin moth- er and child/ ho- ly in- fant so ten- der and mild/ sleep in hea- ven- ly peace _/ sleep in hea- ven _ ly peace/`,
  christmastree: `O Christ- mas tree/ O Christ- mas tree/ how are thy leaves so ver- dant/ not on- ly in the sum- mer time/ but ev'n in win- ter is thy prime/ O Christ- mas tree/ O Christ- mas tree/ how are thy leaves so ver- dant/`,
  jollynick: `Jol- ly old Saint Nich- o- las/ lean your ear this way/ don't you tell a sin- gle soul/ what I'm going to say/ Christ- mas Eve is com- ing soon/ now you dear old man/ whis- per what you'll bring to me/ tell me if you can/`,
  housetop: `Up on the house- top _ rein- deer pause/ out jumps good old San- ta Claus/ down through the chim- ney with lots of toys/ all for the lit- tle ones' Christ- mas joys/ ho ho ho who would- n't go/ ho ho ho who would- n't go/ O up on the house- top click click click/ down through the chim- ney with good Saint Nick/`,
  wenceslas: `Good King Wen- ces- las looked out/ on the Feast of Ste- phen/ when the snow lay round a- bout/ deep and crisp and e- ven/ bright- ly shone the moon that night/ though the frost was cru- el/ when a poor man came in sight/ gath- er- ing win- ter fu- el/`,
  awaymanger: `A- way in a man- ger/ no crib for a bed/ the lit- tle Lord Je- sus laid down his sweet head/ the stars in the sky _ looked down where he lay/ the lit- tle Lord Je- sus a- sleep in the hay/`,
  thankful: `Come ye thank- ful peo- ple come/ raise the song of har- vest home/ all is safe- ly gath- ered in/ ere the win- ter storms be- gin/ God our Mak- er doth pro- vide/ for our wants to be sup- plied/ come to God's own tem- ple come/ raise the song of har- vest home/`,
}

// ---------- the three that were already in Koog's warm-ups (kept there too; lyrics and style come from songs.ts) ----------
const EXISTING: Song[] = [
  { id: 'jingle', title: 'Jingle Bells', origin: 'James Lord Pierpont', year: '1857', key: maj(0), bpm: 126, tier: 'medium', season: 'christmas',
    notes: seq('E4:1 E4 E4:2 E4:1 E4 E4:2 E4:1 G4 C4:1.5 D4:.5 E4:4 F4:1 F4 F4:1.5 F4:.5 F4:1 E4 E4 E4:.5 E4:.5 E4:1 D4 D4 E4 D4:2 G4:2') },
  { id: 'deckhalls', title: 'Deck the Halls', origin: 'Welsh folk tune', year: '1700s', key: maj(0), bpm: 132, tier: 'medium', season: 'christmas', hook: 'fa la la la la, la la la la!',
    notes: seq('G5:1.5 F5:.5 E5:1 D5:1 C5:1 D5:1 E5:1 C5:1 D5:1.5 E5:.5 F5:1 D5:1 E5:1.5 D5:.5 C5:1 B4:1 C5:4') },
  { id: 'wewish', title: 'We Wish You a Merry Christmas', origin: 'English traditional carol', year: '1500s', key: maj(7), bpm: 132, tier: 'medium', season: 'christmas', hook: 'bring us some figgy pudding',
    notes: seq('D4:1 G4:1 G4:.5 A4:.5 G4:.5 F#4:.5 E4:1 E4:1 E4:1 A4:1 A4:.5 B4:.5 A4:.5 G4:.5 F#4:1 D4:1 D4:1 B4:1 B4:.5 C5:.5 B4:.5 A4:.5 G4:1 E4:1 D4:.5 D4:.5 E4:1 A4:1 F#4:1 G4:3') },
]

export const HOLIDAY_SONGS: Song[] = [
  ...THANKSGIVING,
  ...EXISTING,
  ...CHRISTMAS,
].map((s) => (LYRICS[s.id] ? withLyrics(s, LYRICS[s.id]) : s))

/** the order the Songs tab and the holiday games list them in */
export const HOLIDAY_ORDER: Record<Season, string[]> = {
  thanksgiving: ['overriver', 'gather', 'thankful', 'simplegifts'],
  christmas: ['jingle', 'deckhalls', 'wewish', 'silentnight', 'joyworld', 'christmastree', 'jollynick', 'housetop', 'firstnoel', 'wenceslas', 'awaymanger'],
}
export const SEASON_LABEL: Record<Season, string> = { thanksgiving: '🦃 Thanksgiving', christmas: '🎄 Christmas' }
