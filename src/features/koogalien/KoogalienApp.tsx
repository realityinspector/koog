// The Koogalien app shell. First run: the Koog Alien's welcome lesson. After that: a home screen with three big choices
// (Learn words, Write a message, Play games). The Word book (dictionary) is a small button in the header, not a tab.
// Every screen has the same header: ← Home (when you are not home), the title, 📚 Word book, ✕ Store.
import { Suspense, lazy, useEffect, useMemo, useState, type ComponentType } from 'react'
import { makeHost } from './host'
import { Writer } from './Writer'
import { Home, type Screen } from './home/Home'
import { Intro } from './intro/Intro'
import { useKoogalien, koogalienActions } from './store'
import { KOOGALIEN_NAME } from './brand'
import { startLetterKeys } from './letterKeys'
import { loadPrefs, savePrefs } from './ui/prefs'
import { fromShare } from '../../koogalien/lang/share'
import { print } from '../../koogalien/lang/print'
import { PROGRESS_KEY, recordWord, sanitize } from '../../koogalien/learn/progress'
import type { KoogalienHost } from '../../koogalien/ports'
import './koogalien.css'

type Tabbed = ComponentType<{ host: KoogalienHost }>
const dict = import.meta.glob('./dictionary/Dictionary.tsx') as Record<string, () => Promise<{ default: Tabbed }>>
const learn = import.meta.glob('./learn/EchoGame.tsx') as Record<string, () => Promise<{ default: Tabbed }>>
const Soon: Tabbed = () => <p className="kgx-soon">Coming soon!</p>
const pick = (g: Record<string, () => Promise<{ default: Tabbed }>>) => { const l = Object.values(g)[0]; return l ? lazy(l) : Soon }
const Dictionary = pick(dict)
const Learn = pick(learn)
const Games = pick(import.meta.glob('./games/GamesHub.tsx') as Record<string, () => Promise<{ default: Tabbed }>>)

const Library = pick(import.meta.glob('./library/Library.tsx') as Record<string, () => Promise<{ default: Tabbed }>>)

const TITLES: Record<Screen, string> = { home: KOOGALIEN_NAME, write: '✍️ Write a message', learn: '📖 Learn words', games: '🎮 Games', library: '📚 Read a book', dictionary: '📚 Word book' }
const hasShare = () => /[?&]m=/.test(location.hash)

export default function KoogalienApp({ kore }: { kore: unknown }) {
  const host = useMemo(() => makeHost(kore), [kore])
  const tab = useKoogalien((s) => s.tab) as Screen
  const go = (s: Screen) => koogalienActions.setTab(s as never)
  // a shared message link skips the welcome lesson and opens the Writer
  const [intro, setIntro] = useState(() => !loadPrefs(host).introDone && !hasShare())
  useEffect(() => startLetterKeys(), [])
  useEffect(() => {
    const m = /[?&]m=([^&]+)/.exec(location.hash)
    if (!m) { go('home'); return }
    try { const p = fromShare(decodeURIComponent(m[1])); if (p.sentence) { koogalienActions.setCode(print(p.sentence)); go('write') } } catch { /* a bad link just opens empty */ }
  }, [])
  const finishIntro = (how: 'finished' | 'skipped') => {
    if (how === 'finished') {
      // the lesson taught hello and world: put them in the word list so the home screen can say "You know 2 words!"
      let p = sanitize(host.progress.load(PROGRESS_KEY, null))
      for (const id of ['hello', 'world']) if (!p.words[id]?.rung) p = recordWord(p, id, true, 2, Date.now())
      try { host.progress.save(PROGRESS_KEY, p) } catch { /* ignore */ }
    }
    savePrefs(host, { introDone: true })
    go('home'); setIntro(false)
  }
  const replay = () => { savePrefs(host, { introDone: false }); setIntro(true) }
  const screen: Screen = intro ? 'home' : tab
  return (
    <div className="kgx-app">
      <header className="kgx-head">
        {!intro && screen !== 'home' ? <button type="button" className="kgx-back" onClick={() => go('home')}>← Home</button> : null}
        <h1>{intro ? KOOGALIEN_NAME + ': welcome!' : TITLES[screen]}</h1>
        {!intro && screen !== 'dictionary' ? <button type="button" className="kgx-book" onClick={() => go('dictionary')} title="Word book: look up any Koogalien word" aria-label="Word book">📚<span className="hide-sm"> Word book</span></button> : null}
        <button type="button" className="kgx-exit" onClick={() => host.exit()} title="Back to the Koog Store" aria-label="Close Koogalien and go back to the Koog Store">✕ Store</button>
      </header>
      <Suspense fallback={<p className="kgx-soon">Loading...</p>}>
        {intro ? <Intro host={host} onDone={finishIntro} />
          : screen === 'home' ? <Home host={host} go={go} replay={replay} />
          : screen === 'games' ? <Games host={host} />
          : screen === 'library' ? <Library host={host} />
          : screen === 'write' ? <Writer host={host} />
          : screen === 'dictionary' ? <Dictionary host={host} />
          : <Learn host={host} />}
      </Suspense>
    </div>
  )
}
