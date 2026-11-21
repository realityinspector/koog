// Chat with a Koogalien (units 4 and 5, sentences): a tiny hand-written conversation. The Koogalien asks a question in Koogalien
// (you happy?), the kid answers by playing a sentence (I happy. / no.), the Koogalien replies. No AI, no network: a small dialogue tree.
// Dialogues open up as the kid meets more words. Where wobble is unlocked, a wobbly answer is "excited" and the reply gets excited too.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Chord, Degree, Sentence } from '../../../koogalien/data/types'
import { lexById } from '../../../koogalien/data/lexicon'
import type { KoogalienHost } from '../../../koogalien/ports'
import { itemById } from '../../../koogalien/learn/items'
import { Mascot } from '../learn/Mascot'
import { useChordInput } from '../learn/useChordInput'
import { SentenceRibbon } from '../ribbon/SentenceRibbon'
import { startModInput } from '../play/modInput'
import { MiniPads } from '../learn/MiniPads'
import { DIALOGUES, answer, availableDialogues, closerOf, codeOfSay, dialogueById, englishOfSay, missingFor, newChat, nextLine, sentenceOfSay, skipTurn, wobbleUnlocked, wordOfChord, type ChatState, type Say } from './chat'
import { credit } from './core'
import { exposeForTest, useGamesSave, usePedalNext, useProgress, useStage } from './hooks'
import { GameInput, Results, VoiceBadge } from './Shared'
import type { Ending } from '../../../koogalien/data/types'

interface Line { who: 'alien' | 'kid'; say: Say; wobble: boolean }
const IDLE_MS = 3200

export default function ChatGame({ host, onBack }: { host: KoogalienHost; onBack: () => void }) {
  const { prog, commit } = useProgress(host)
  const { save, commit: commitSave } = useGamesSave(host)
  const stage = useStage(host)
  const [chat, setChat] = useState<ChatState | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [played, setPlayed] = useState<string[]>([])
  const [excited, setExcited] = useState(false)
  const [fb, setFb] = useState<string>('')
  const [retries, setRetries] = useState(0)
  const [hintOn, setHintOn] = useState(false)
  const [talking, setTalking] = useState(false)
  const ref = useRef<ChatState | null>(null)
  const playedRef = useRef<string[]>([])
  const excitedRef = useRef(false)
  const idle = useRef<number>(0)
  const retriesRef = useRef(0)
  const can = wobbleUnlocked(prog.current.words)
  const open = useMemo(() => availableDialogues(prog.current.words), [prog.current.words])  // eslint-disable-line react-hooks/exhaustive-deps
  exposeForTest('chat', () => ({ chat: ref.current, played: playedRef.current, lines, fb, excited: excitedRef.current, progress: prog.current, save: save.current }))
  useEffect(() => { commitSave((g) => ({ ...g, last: 'chat' })) }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => window.clearTimeout(idle.current), [])
  // the mod wheel (or the Excited button) makes the answer excited, but only where wobble is unlocked
  useEffect(() => startModInput((s) => { if (s.kind === 'wheel' && s.value > 0.4 && can) { excitedRef.current = true; setExcited(true) } }), [can])

  const setC = (c: ChatState | null) => { ref.current = c; setChat(c) }
  const setP = (p: string[]) => { playedRef.current = p; setPlayed(p) }

  const speak = async (say: Say, wobble: boolean, voice: string) => {
    setTalking(true)
    try { await stage.saySentence(sentenceOfSay(say, wobble), voice) } finally { setTalking(false) }
  }
  const voiceOf = (c: ChatState | null) => (c ? dialogueById(c.dialogue)?.voice ?? 'pip' : 'pip')

  /** the ladder of help: the first chats glow the next hint note; later ones only on request (after a retry or by pressing Hint) */
  const hintWord = (c: ChatState, got: string[]): string | null => {
    const n = dialogueById(c.dialogue)?.nodes[c.node]; if (!n) return null
    return n.hint.find((w) => !got.includes(w)) ?? null
  }
  const showHint = (c: ChatState, got: string[]) => {
    const w = hintWord(c, got); const e = w ? itemById(w) : null
    if (e) stage.glow(e.chord as readonly Degree[], 2500)
  }
  const helpNow = (c: ChatState, got: string[], tries: number) => {
    const seen = save.current.chat[c.dialogue] ?? 0
    stage.unglow()
    if (seen < 1 || tries >= 1) showHint(c, got)
    else if (seen < 3) stage.later(() => showHint(c, playedRef.current), 4000)
  }

  const begin = async (id: string) => {
    const d = dialogueById(id); if (!d) return
    stage.clearTimers(); stage.unglow(); window.clearTimeout(idle.current)
    const c = newChat(d)
    setC(c); setP([]); setFb(''); setRetries(0); retriesRef.current = 0; setHintOn(false); excitedRef.current = false; setExcited(false)
    const q = d.nodes[d.start].say
    setLines([{ who: 'alien', say: q, wobble: false }])
    await speak(q, false, d.voice)
    helpNow(c, [], 0)
  }

  const submit = async (end: Ending = '.', skipped = false) => {
    const c = ref.current; if (!c || c.done) return
    window.clearTimeout(idle.current)
    const got = playedRef.current
    if (!got.length) return
    const d = dialogueById(c.dialogue)!
    const exc = excitedRef.current
    const res = answer(c, got, exc, can)
    stage.unglow()
    const kidLine: Line = { who: 'kid', say: { words: got, end }, wobble: exc && can }
    host.concepts.mark('event')
    if (got.length >= 2) host.concepts.mark('sequence')
    setP([])
    if (res.event === 'retry' || !res.say) {
      const tries = retriesRef.current + 1; retriesRef.current = tries; setRetries(tries)
      setLines((l) => [...l, kidLine, { who: 'alien', say: res.say ?? d.nodes[c.node].retry, wobble: false }])
      setFb(tries >= 3 ? 'Stuck? Press "Skip this one" and I will show you.' : 'Hmm, I did not get that. Try the hint!')
      setC({ ...c, heard: got })
      await speak(res.say ?? d.nodes[c.node].retry, false, d.voice)
      helpNow(c, [], tries)
      return
    }
    // a good answer: credit the words and move the chat on
    if (!skipped) commit((p) => { let q = p; for (const w of new Set(got)) if (lexById(w)) q = credit(q, w, true, 2, Date.now(), 'echo'); return q })
    host.concepts.mark('condition')
    retriesRef.current = 0; setRetries(0); setFb(''); setHintOn(false)
    setC(res.state)
    const nx = nextLine(res.state)
    setLines((l) => [...l, kidLine, { who: 'alien', say: res.say!, wobble: res.wobble }, ...(nx ? [{ who: 'alien' as const, say: nx, wobble: false }] : [])])
    excitedRef.current = false; setExcited(false)
    await speak(res.say, res.wobble, d.voice)
    if (nx) { await speak(nx, false, d.voice); helpNow(res.state, [], 0) }
    else finish(res.state)
  }

  const finish = (c: ChatState) => {
    commitSave((g) => ({ ...g, chat: { ...g.chat, [c.dialogue]: (g.chat[c.dialogue] ?? 0) + 1 } }))
    host.celebrate('Nice chat!')
  }
  const skip = async () => {
    const c = ref.current; if (!c || c.done) return
    const d = dialogueById(c.dialogue)!
    const node = d.nodes[c.node]
    // the words the kid could not find go back into spaced repetition as due
    commit((p) => { let q = p; for (const w of node.hint) if (lexById(w)) q = credit(q, w, false, 0, Date.now(), 'echo'); return q })
    setP([...node.hint]); stage.unglow()
    await submit('.', true)
  }

  const play = (chord: Chord) => {
    const c = ref.current; if (!c || c.done) return
    const end = closerOf(chord)
    if (end) { if (playedRef.current.length) void submit(end); else setFb('Play a word first, then end with a full stop (sol + high do).'); return }
    if (chord.length < 2) { setFb('One note is a number. I need a word: press two or more keys together.'); return }
    const w = wordOfChord(chord)
    if (!w) { setFb('That chord is not a word I know. Check the Dictionary, or press Hint.'); return }
    setFb('')
    const got = [...playedRef.current, w].slice(0, 6)
    setP(got)
    stage.unglow()
    window.clearTimeout(idle.current)
    idle.current = window.setTimeout(() => { void submit('.') }, IDLE_MS)
  }
  useChordInput(play, !!chat && !chat.done && !talking)
  usePedalNext(() => { if (chat?.done) nextChat(); else if (playedRef.current.length) void submit('.') }, !!chat)

  const nextChat = () => {
    const ids = open.map((d) => d.id); const ix = chat ? ids.indexOf(chat.dialogue) : -1
    void begin(ids[(ix + 1) % ids.length] ?? 'hello')
  }
  const sen = (s: Say, w = false): Sentence => sentenceOfSay(s, w)

  if (!chat) {
    return (
      <section className="kgl kgg" aria-label="Chat with a Koogalien">
        <div className="kgl-stage"><Mascot pose="wave" size={150} say="Let's talk in Koogalien! I will ask, you answer with a sentence." />
          <div className="kgl-prompt">
            <h2>💬 Chat with a Koogalien</h2>
            <p className="kgl-sub">A Koogalien asks something. Play your answer as a sentence, like <code>I happy.</code> or <code>no.</code> It answers back. New chats open as you learn more words.</p>
            <div className="kgg-ships" role="group" aria-label="Pick a chat">
              {DIALOGUES.map((d) => {
                const ok = open.some((x) => x.id === d.id), miss = missingFor(d, prog.current.words)
                return <button key={d.id} type="button" className={'kgl-btn' + (ok ? ' pri' : '')} disabled={!ok} onClick={() => void begin(d.id)} title={ok ? '' : `Learn these first: ${miss.map((m) => lexById(m)?.en ?? m).join(', ')}`}>
                  {d.emoji} {d.title}{ok ? '' : ' 🔒'}{(save.current.chat[d.id] ?? 0) > 0 ? ' ✓' : ''}
                </button>
              })}
            </div>
            {open.length < DIALOGUES.length ? <p className="kgl-coach">Locked chats open when you have met their words in the Echo Game or the other Koogalien games.</p> : null}
            <button type="button" className="kgl-btn" onClick={onBack}>← Back to games</button>
          </div></div>
      </section>
    )
  }
  const d = dialogueById(chat.dialogue)!
  if (chat.done) {
    return (
      <section className="kgl kgg" aria-label="Chat results">
        <Results title="What a nice chat!" pose="cheer" onNext={nextChat} nextLabel="Next chat" onAgain={() => void begin(chat.dialogue)} onBack={onBack}>
          <div className="kgg-log" aria-label="The chat">{lines.map((l, i) => <p key={i} className={'kgg-line ' + l.who}><b>{l.who === 'alien' ? 'Koogalien' : 'You'}:</b> <code>{codeOfSay(l.say, l.wobble)}</code> <span>{englishOfSay(l.say)}{l.wobble ? ' (excited)' : ''}</span></p>)}</div>
        </Results>
      </section>
    )
  }
  const last = [...lines].reverse().find((l) => l.who === 'alien')
  const mine = played.length ? sen({ words: played, end: '.' }, excited && can) : null
  const hintIds = d.nodes[chat.node].hint
  return (
    <section className="kgl kgg" aria-label="Chat with a Koogalien">
      <div className="kgl-top"><h2 style={{ margin: 0 }}>💬 {d.title}</h2><VoiceBadge voice={d.voice} /><span className="kgl-rung">turn {chat.turns + 1}</span></div>
      <div className="kgl-stage">
        <Mascot pose={talking ? 'teach' : 'listen'} size={130} />
        <div className="kgl-prompt">
          <div className="kgg-log" aria-live="polite" aria-label="The chat so far">
            {lines.slice(-6).map((l, i) => <p key={i} className={'kgg-line ' + l.who}><b>{l.who === 'alien' ? 'Koogalien' : 'You'}:</b> <code>{codeOfSay(l.say, l.wobble)}</code> <span>{englishOfSay(l.say)}{l.wobble ? ' (excited)' : ''}</span></p>)}
          </div>
          {last ? <SentenceRibbon sentence={sen(last.say, last.wobble)} playing={null} compact /> : null}
          <p className="kgl-coach">{talking ? 'The Koogalien is talking. Listen...' : played.length ? 'Your answer so far (end with sol + high do, or press Done):' : 'Your turn! Answer with a word or a short sentence.'}</p>
          {mine ? <SentenceRibbon sentence={mine} playing={null} compact /> : null}
          {hintOn || retries >= 1 ? <div className="kgg-hint" aria-label="Hint">Try: {hintIds.map((w) => <span key={w} className="kgg-chip">{itemById(w)?.emoji} {lexById(w)?.en} <MiniPads lit={lexById(w)?.chord as readonly Degree[]} /></span>)}</div> : null}
          <GameInput lit={stage.lit} onChord={play} />
          <div className="kgl-row">
            <button type="button" className="kgl-btn pri" onClick={() => void submit('.')} disabled={!played.length}>Done</button>
            <button type="button" className="kgl-btn" onClick={() => { setP([]); stage.unglow() }} disabled={!played.length}>Clear</button>
            <button type="button" className="kgl-btn" onClick={() => last && void speak(last.say, last.wobble, d.voice)}>🔊 Hear it again</button>
            <button type="button" className="kgl-btn" onClick={() => { setHintOn(true); showHint(chat, played) }}>💡 Hint</button>
            {can ? <button type="button" className={'kgl-btn' + (excited ? ' on' : '')} aria-pressed={excited} onClick={() => { excitedRef.current = !excited; setExcited(!excited) }}>〰 Excited (wobble)</button> : null}
            {retries >= 3 ? <button type="button" className="kgl-btn" onClick={() => void skip()}>Skip this one</button> : null}
            <button type="button" className="kgl-btn" onClick={onBack}>← Back</button>
          </div>
          <p className="kgl-fb bad" aria-live="polite">{fb}</p>
        </div>
      </div>
    </section>
  )
}
