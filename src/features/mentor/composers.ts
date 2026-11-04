// Who wrote it: composer, year and one true, kid-sized fact for every tune the Mentor can recognise.
// Keyed by song id (src/features/songs/songs.ts + src/music/classical.ts). Only pre-1930 / traditional works.
// who = null means a traditional tune (no single composer): the Mentor says "a traditional folk tune".
// Pure data, no state.
export interface PieceInfo {
  /** short composer name as a kid would say it ("Beethoven"), or null for traditional tunes */
  who: string | null
  /** the piece, as a phrase that fits after the composer: "Ode to Joy, from his 9th Symphony" */
  piece: string
  year: string
  /** one short true fact, a full sentence */
  fact: string
  /** for traditional tunes: where it comes from ("an English folk song") */
  trad?: string
}

export const PIECES: Record<string, PieceInfo> = {
  buns: { who: null, trad: 'an old English street-seller\'s song', piece: 'Hot Cross Buns', year: 'around 1760', fact: 'Sellers sang it on the street to advertise their buns.' },
  mary: { who: null, trad: 'a traditional tune', piece: 'Mary Had a Little Lamb', year: '1830', fact: 'The words were written by Sarah Josepha Hale and were said to be based on a real girl and her lamb.' },
  twinkle: { who: null, trad: 'a French folk tune', piece: 'Twinkle, Twinkle, Little Star', year: '1761', fact: 'Mozart wrote twelve variations on this exact tune.' },
  ode: { who: 'Beethoven', piece: 'Ode to Joy, from his 9th Symphony', year: '1824', fact: 'He was almost completely deaf when he wrote it.' },
  lune: { who: null, trad: 'a French folk song', piece: 'Au Clair de la Lune', year: 'the 1700s', fact: 'The title means "By the Light of the Moon".' },
  jingle: { who: 'James Lord Pierpont', piece: 'Jingle Bells', year: '1857', fact: 'Its first title was "One Horse Open Sleigh".' },
  bday: { who: 'the Hill sisters', piece: 'Happy Birthday', year: '1893', fact: 'The tune started life as a classroom song called "Good Morning to All".' },
  saints: { who: null, trad: 'an American spiritual', piece: 'When the Saints Go Marching In', year: 'around 1896', fact: 'New Orleans jazz bands made it famous.' },
  grace: { who: null, trad: 'an American folk hymn tune', piece: 'Amazing Grace', year: '1835', fact: 'The words came first (John Newton, 1779); this tune was matched to them later.' },
  brahms: { who: 'Brahms', piece: 'his Lullaby', year: '1868', fact: 'He wrote it as a gift for a friend\'s new baby.' },
  minuet: { who: 'Christian Petzold', piece: 'Minuet in G', year: 'around 1725', fact: 'It was in Bach\'s family notebook, so people thought Bach wrote it for about 200 years.' },
  prelude: { who: 'Bach', piece: 'the Prelude in C, from The Well-Tempered Clavier', year: '1722', fact: 'He wrote a prelude in every one of the 24 keys.' },
  greensleeves: { who: null, trad: 'an English folk song', piece: 'Greensleeves', year: 'the 1500s', fact: 'Legend says King Henry VIII wrote it, but almost certainly he didn\'t.' },
  elise: { who: 'Beethoven', piece: 'Für Elise', year: 'around 1810', fact: 'Nobody published it until 40 years after he died.' },
  king: { who: 'Grieg', piece: 'In the Hall of the Mountain King, from Peer Gynt', year: '1875', fact: 'It starts tiptoeing, then gets faster and louder until it explodes.' },
  canon: { who: 'Pachelbel', piece: 'Canon in D', year: 'around 1680', fact: 'The same short bass line repeats 28 times under the whole piece.' },
  korobeiniki: { who: null, trad: 'a Russian folk song', piece: 'Korobeiniki', year: '1861', fact: 'It\'s about traveling peddlers selling goods at a fair.' },
  entertainer: { who: 'Scott Joplin', piece: 'The Entertainer', year: '1902', fact: 'Joplin was called the King of Ragtime.' },
  turkish: { who: 'Mozart', piece: 'the Turkish March, from his Piano Sonata No. 11', year: 'around 1783', fact: 'It copies the sound of Turkish military bands, which were all the rage in Vienna.' },
  toccata: { who: 'Bach', piece: 'the Toccata in D minor', year: 'around 1704', fact: 'It was written for a giant pipe organ.' },
  beethoven5: { who: 'Beethoven', piece: 'the opening of his 5th Symphony', year: '1808', fact: 'He built the whole first movement out of that short-short-short-long idea.' },
  nachtmusik: { who: 'Mozart', piece: 'Eine kleine Nachtmusik', year: '1787', fact: 'The title means "a little night music".' },
  bumblebee: { who: 'Rimsky-Korsakov', piece: 'Flight of the Bumblebee', year: '1900', fact: 'In the opera, a prince gets turned into a bumblebee.' },
  susanna: { who: 'Stephen Foster', piece: 'Oh! Susanna', year: '1848', fact: 'Gold Rush miners sang it on their way to California.' },
  cucaracha: { who: null, trad: 'a Mexican folk song', piece: 'La Cucaracha', year: 'the 1800s', fact: 'It got really famous during the Mexican Revolution in the 1910s.' },
  surprise: { who: 'Haydn', piece: 'the Surprise Symphony', year: '1791', fact: 'The story goes that the sudden loud chord was there to wake up sleepy listeners.' },
  yankee: { who: null, trad: 'a traditional tune', piece: 'Yankee Doodle', year: 'around 1755', fact: 'British soldiers sang it to tease the Americans, who then took it as their own.' },
  deckhalls: { who: null, trad: 'a Welsh folk tune', piece: 'Deck the Halls', year: 'the 1700s', fact: 'It started out as a New Year\'s Eve song.' },
  wewish: { who: null, trad: 'an English carol', piece: 'We Wish You a Merry Christmas', year: 'centuries ago', fact: 'Carolers sang it door to door, hoping for treats.' },
  oldmac: { who: null, trad: 'a traditional song', piece: 'Old MacDonald Had a Farm', year: '1917', fact: 'Each verse adds an animal, so the song keeps growing.' },
  // classical library (only recognised once a grown-up has checked the melody by ear)
  invention1: { who: 'Bach', piece: 'Invention No. 1', year: '1723', fact: 'He wrote the Inventions to teach his students to play two lines at once.' },
  morning: { who: 'Grieg', piece: 'Morning Mood, from Peer Gynt', year: '1875', fact: 'It paints a sunrise in sound.' },
  moonlight: { who: 'Beethoven', piece: 'the Moonlight Sonata', year: '1801', fact: 'A music critic gave it the "Moonlight" nickname after Beethoven died.' },
  habanera: { who: 'Bizet', piece: 'the Habanera, from the opera Carmen', year: '1875', fact: 'Its bass line uses a dance rhythm from Cuba.' },
  newworld: { who: 'Dvořák', piece: 'the Largo from the New World Symphony', year: '1893', fact: 'He wrote it while living in America.' },
  gymnopedie: { who: 'Satie', piece: 'Gymnopédie No. 1', year: '1888', fact: 'He marked it to be played "slow and sorrowful".' },
  jesu: { who: 'Bach', piece: 'Jesu, Joy of Man\'s Desiring', year: '1723', fact: 'The flowing line in triplets floats over a slow hymn.' },
  spring: { who: 'Vivaldi', piece: 'Spring, from The Four Seasons', year: '1725', fact: 'Each season came with a poem describing what the music paints.' },
  bluedanube: { who: 'Johann Strauss II', piece: 'The Blue Danube', year: '1866', fact: 'It became one of the most famous waltzes ever written.' },
}

/** the piece info for a recognised song id, or null */
export const pieceOf = (id: string): PieceInfo | null => PIECES[id] ?? null
