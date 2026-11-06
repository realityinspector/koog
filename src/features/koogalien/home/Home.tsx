// The Koogalien home screen: three big choices, a progress line and the Koog Alien. Nothing else.
import { useMemo } from 'react'
import type { KoogalienHost } from '../../../koogalien/ports'
import { currentUnit } from '../../../koogalien/learn/ladder'
import { PROGRESS_KEY, sanitize } from '../../../koogalien/learn/progress'
import { KoogAlienHost } from '../ui/Host'

export type Screen = 'home' | 'write' | 'dictionary' | 'learn' | 'games' | 'library'

export function Home({ host, go, replay }: { host: KoogalienHost; go: (s: Screen) => void; replay: () => void }) {
  const prog = useMemo(() => sanitize(host.progress.load(PROGRESS_KEY, null)), [host])
  const known = Object.values(prog.words).filter((w) => w.rung).length
  const unit = currentUnit(prog.words)
  const line = known === 0 ? 'Learn your first word!' : `You know ${known} ${known === 1 ? 'word' : 'words'}!`
  const say = known === 0 ? 'Hi! Pick something to do. I like words.' : known < 6 ? 'Welcome back! Learn a new word, or write a message.' : 'Look how many words you know! What now?'
  return (
    <section className="kgx-home" aria-label="Koogalien home">
      <KoogAlienHost pose={known >= 6 ? 'cheer' : 'wave'} say={say} size={120} />
      <p className="kgx-progress" aria-live="polite"><b>{line}</b>{prog.stars ? ` ⭐ ${prog.stars}` : ''}</p>
      <div className="kgx-choices" role="group" aria-label="What do you want to do?">
        <button type="button" className="kgx-choice learn" onClick={() => go('learn')}><span className="e" aria-hidden="true">📖</span><b>Learn words</b><small>Next up: unit {unit}</small></button>
        <button type="button" className="kgx-choice write" onClick={() => go('write')}><span className="e" aria-hidden="true">✍️</span><b>Write a message</b><small>Play words, then hear them</small></button>
        <button type="button" className="kgx-choice games" onClick={() => go('games')}><span className="e" aria-hidden="true">🎮</span><b>Play games</b><small>Rockets, spelling and more</small></button>
        <button type="button" className="kgx-choice read" onClick={() => go('library')}><span className="e" aria-hidden="true">📚</span><b>Read a book</b><small>Stories you can play along</small></button>
      </div>
      <p className="kgx-home-foot"><button type="button" className="kgx-link" onClick={replay}>Replay intro</button></p>
    </section>
  )
}
