// The living notebook. It listens to notes and to which screen is open, and it saves per player.
// Airplane or not, this stays on the computer. The page never sends the notebook anywhere.
import { create } from 'zustand'
import { onNote } from '../../music/notes'
import { playLocal } from '../../music/localNotes'
import { onProfileChange, pload, psave } from '../../profile/profile'
import { useScreen } from '../../layout/screenStore'
import { SONGS } from '../songs/songs'
import type { Sentence } from '../../koogalien/data/types'
import { chordsToMidi, sanitizeMemory, step, type AlienMemory, type Obs, type TuneRef } from './agent'

const KEY = 'alien.agent'
type Say = Sentence

interface AlienState {
  memory: AlienMemory
  sentence: Say | null
  code: string
  open: boolean
  armFresh: boolean
  setOpen: (open: boolean) => void
  ask: (text: string) => void
  forgetWord: (id: string) => void
  forgetSong: (id: string) => void
  armEmpty: () => void
  hear: () => void
}

let tunes: TuneRef[] | null = null
function songCatalog(): TuneRef[] {
  if (tunes) return tunes
  tunes = SONGS.map((s) => ({
    id: s.id,
    title: s.title,
    notes: s.notes.map((n) => n.note).filter((n): n is number => n != null).slice(0, 8),
  })).filter((t) => t.notes.length >= 4)
  return tunes
}

function load(): AlienMemory {
  return sanitizeMemory(pload<unknown>(KEY, null))
}

const hot = import.meta.hot
export const useAlien = (hot?.data.alienStore as ReturnType<typeof make> | undefined) ?? make()

function make() {
  return create<AlienState>((set, get) => ({
    memory: load(),
    sentence: null,
    code: '',
    open: false,
    armFresh: false,
    setOpen: (open) => set({ open, armFresh: open ? get().armFresh : false }),
    ask: (text) => apply({ kind: 'ask', text }),
    forgetWord: (id) => apply({ kind: 'forget-word', id }),
    forgetSong: (id) => apply({ kind: 'forget-song', id }),
    armEmpty: () => {
      if (!get().armFresh) { set({ armFresh: true }); return }
      apply({ kind: 'fresh' })
      set({ armFresh: false, sentence: null, code: '' })
    },
    hear: () => playSentence(get().sentence),
  }))
}

function apply(obs: Obs) {
  const cur = useAlien.getState()
  const out = step(cur.memory, obs, songCatalog())
  if (out.memory !== cur.memory) psave(KEY, out.memory)
  useAlien.setState({
    memory: out.memory,
    sentence: obs.kind === 'ask' ? out.sentence : cur.sentence,
    code: obs.kind === 'ask' ? out.code : cur.code,
    armFresh: obs.kind === 'fresh' ? false : cur.armFresh,
  })
}

let playGen = 0
function playSentence(sentence: Say | null) {
  if (!sentence) return
  const chords = chordsToMidi(sentence)
  const token = ++playGen
  chords.forEach((c, i) => {
    setTimeout(() => {
      if (token !== playGen) return
      for (const n of c) playLocal(n, 88, true)
      setTimeout(() => { if (token === playGen) for (const n of c) playLocal(n, 0, false) }, 200)
    }, i * 300)
  })
}

const phrase: number[] = []
let rest: ReturnType<typeof setTimeout> | undefined

function flush() {
  const notes = phrase.slice()
  phrase.length = 0
  if (notes.length) apply({ kind: 'notes', notes, book: true, yours: true, count: true })
}

function bind() {
  const offs: Array<() => void> = []
  offs.push(onNote((e) => {
    if (!e.on || e.velocity <= 0) return
    phrase.push(e.note)
    if (phrase.length > 16) phrase.shift()
    const mem = useAlien.getState().memory
    const tune = step(mem, { kind: 'notes', notes: phrase, book: true }, songCatalog())
    if (tune.said) apply({ kind: 'notes', notes: phrase.slice(), book: true })
    else if (mem.pose !== 'listen') useAlien.setState({ memory: { ...mem, pose: 'listen' } })
    if (rest) clearTimeout(rest)
    rest = setTimeout(flush, 800)
  }))
  offs.push(useScreen.subscribe((s, prev) => {
    if (s.screen === prev.screen && s.game === prev.game) return
    apply({ kind: 'place', place: s.screen, game: s.game })
  }))
  offs.push(onProfileChange(() => {
    phrase.length = 0
    if (rest) clearTimeout(rest)
    useAlien.setState({ memory: load(), sentence: null, code: '', armFresh: false })
  }))
  const here = useScreen.getState()
  apply({ kind: 'place', place: here.screen, game: here.game })
  // He keeps studying with the panel closed. One try, then the checks. Slow on purpose.
  const soon = setTimeout(() => apply({ kind: 'study', notes: phrase.slice() }), 1500)
  const clock = setInterval(() => apply({ kind: 'study', notes: phrase.slice() }), 12000)
  return () => { offs.forEach((f) => f()); if (rest) clearTimeout(rest); clearTimeout(soon); clearInterval(clock) }
}

hot?.data.alienOff?.()
const alienOff = bind()
if (hot) {
  hot.data.alienStore = useAlien
  hot.data.alienOff = alienOff
  hot.dispose(alienOff)
}
