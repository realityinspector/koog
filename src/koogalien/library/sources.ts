// Pure data: the public-domain books in the Library and how each is cut into chapters. Every book here was first published in the US in 1930 or earlier
// (checked by scripts/library-fixtures.ts, which fails on a year after 1930). `file` is the raw download in private/library-raw/ (gitignored, untrusted text).
export type Cut =
  | { how: 'single'; start: RegExp; end?: RegExp }
  | { how: 'headings'; re: RegExp; titleNext?: boolean }
  | { how: 'toc'; tocFrom: RegExp; skip?: number }

export interface Source {
  id: string; title: string; author: string; year: number; gutenberg: number; file: string
  cut: Cut
  /** chapters shipped in the repo; the rest only with `npm run build:library -- --all` */
  ship: number
  /** cover art: two colours, a symbol key (see cover.tsx) */
  cover: { a: string; b: string; art: string }
  blurb: string
}

export const SOURCES: Source[] = [
  { id: 'peter-rabbit', title: 'The Tale of Peter Rabbit', author: 'Beatrix Potter', year: 1902, gutenberg: 14838, file: 'pg14838.txt',
    cut: { how: 'single', start: /^Once upon a time there were four little Rabbits/, end: /^THE END\b/ }, ship: 1,
    cover: { a: '#6aa84f', b: '#cfe8b8', art: 'rabbit' }, blurb: 'A naughty rabbit sneaks into Mr. McGregor\'s garden.' },
  { id: 'velveteen-rabbit', title: 'The Velveteen Rabbit', author: 'Margery Williams', year: 1922, gutenberg: 11757, file: 'pg11757.txt',
    cut: { how: 'single', start: /^HERE was once a velveteen rabbit/ }, ship: 1,
    cover: { a: '#c08457', b: '#f3dfc8', art: 'heart' }, blurb: 'How toys become real.' },
  { id: 'aesops-fables', title: 'Aesop\'s Fables', author: 'Aesop', year: 1867, gutenberg: 21, file: 'pg21.txt',
    cut: { how: 'toc', tocFrom: /^\s*AESOP’S FABLES\s*$/ }, ship: 30,
    cover: { a: '#b7791f', b: '#f6e3b4', art: 'fox' }, blurb: 'Short animal stories, each with a lesson.' },
  { id: 'alice', title: 'Alice\'s Adventures in Wonderland', author: 'Lewis Carroll', year: 1865, gutenberg: 11, file: 'pg11.txt',
    cut: { how: 'headings', re: /^CHAPTER [IVXL]+\.$/, titleNext: true }, ship: 6,
    cover: { a: '#5b6fd6', b: '#d7dcff', art: 'clock' }, blurb: 'Down the rabbit-hole into a strange world.' },
  { id: 'wizard-of-oz', title: 'The Wonderful Wizard of Oz', author: 'L. Frank Baum', year: 1900, gutenberg: 55, file: 'pg55.txt',
    cut: { how: 'headings', re: /^Chapter [IVXL]+$/, titleNext: true }, ship: 6,
    cover: { a: '#2f9e6b', b: '#d3f2e1', art: 'road' }, blurb: 'A cyclone carries Dorothy to the Land of Oz.' },
  { id: 'grimms-fairy-tales', title: 'Grimms\' Fairy Tales', author: 'Jacob and Wilhelm Grimm', year: 1823, gutenberg: 2591, file: 'pg2591.txt',
    cut: { how: 'toc', tocFrom: /^CONTENTS:\s*$/ }, ship: 8,
    cover: { a: '#7b4a9e', b: '#e7d6f3', art: 'castle' }, blurb: 'Old tales of princes, frogs and clever tailors.' },
  { id: 'just-so-stories', title: 'Just So Stories', author: 'Rudyard Kipling', year: 1902, gutenberg: 2781, file: 'pg2781.txt',
    cut: { how: 'toc', tocFrom: /^TABLE OF CONTENTS:\s*$/ }, ship: 4,
    cover: { a: '#d9822b', b: '#fbe3c5', art: 'whale' }, blurb: 'How the whale got his throat and the camel his hump.' },
  { id: 'wind-in-the-willows', title: 'The Wind in the Willows', author: 'Kenneth Grahame', year: 1908, gutenberg: 289, file: 'pg289.txt',
    cut: { how: 'headings', re: /^[IVXL]+\.$/, titleNext: true }, ship: 3,
    cover: { a: '#2b8a8a', b: '#cdeeee', art: 'river' }, blurb: 'Mole, Rat and Toad on the river bank.' },
  { id: 'peter-pan', title: 'Peter Pan', author: 'J. M. Barrie', year: 1911, gutenberg: 16, file: 'pg16.txt',
    cut: { how: 'headings', re: /^Chapter [IVXL]+\.$/, titleNext: true }, ship: 4,
    cover: { a: '#1f3b73', b: '#ffe08a', art: 'star' }, blurb: 'The boy who would not grow up.' },
  { id: 'black-beauty', title: 'Black Beauty', author: 'Anna Sewell', year: 1877, gutenberg: 271, file: 'pg271.txt',
    cut: { how: 'headings', re: /^\d\d [A-Z].*$/ }, ship: 6,
    cover: { a: '#3b3b4f', b: '#d9d9e8', art: 'horse' }, blurb: 'A horse tells the story of his life.' },
  { id: 'secret-garden', title: 'The Secret Garden', author: 'Frances Hodgson Burnett', year: 1911, gutenberg: 113, file: 'pg113.txt',
    cut: { how: 'headings', re: /^CHAPTER [IVXL]+\.?$/, titleNext: true }, ship: 4,
    cover: { a: '#4a8f3a', b: '#e1f3d4', art: 'flower' }, blurb: 'A lonely girl finds a locked garden.' },
  { id: 'christmas-carol', title: 'A Christmas Carol', author: 'Charles Dickens', year: 1843, gutenberg: 46, file: 'pg46.txt',
    cut: { how: 'headings', re: /^STAVE [IVXL]+:\s+\S.*$/ }, ship: 2,
    cover: { a: '#a3262a', b: '#f7d9d9', art: 'candle' }, blurb: 'Scrooge meets three spirits on Christmas Eve.' },
]
export const US_PD_LAST_YEAR = 1930
