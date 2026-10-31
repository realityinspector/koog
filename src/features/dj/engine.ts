// DJ engine: two synthesized decks (4 stems each), EQ, volume, crossfader, tempo, sync, cue, loops, sampler and
// stem pads, master FX (echo / filter sweep / riser). Web Audio, no React in here.
// Ported from mixtrack-academy/public/js/audio.js.
//
// SAFETY: master gain = MASTER_CAP (0.12) x outputScale() (the app volume / mute), live, then a limiter.
// The AudioContext is only created on a user gesture (a click, a key press, or sticky activation from one earlier).
// State lives in import.meta.hot.data (an edit never cuts the music or leaks a context); pagehide / dispose() silences and closes everything.
//
// Feeds: onDjMessage(raw MIDI) -> map.decode -> dispatch(). The on-screen UI calls dispatch() too. Tests: injectDj(bytes).
// Publishes: the beat clock (./clock), LEDs (sendToDj), and a view snapshot for the UI (subscribe/getVersion/getView).
import { outputScale, useAudioSettings } from '../../music/audioSettings'
import { onDjMessage, sendToDj, useDevices } from '../../music/devices'
import type { Key } from '../../music/theory'
import { decode, ledBytes, type DeckId, type DjAction } from './map'
import { BEAT, LEN, TRACKS, renderAll } from './synth'
import { emitBeat, setClockSource } from './clock'
import { emitAction, isDeaf } from './tap'

export const MASTER_CAP = 0.12 // hard ceiling on the master gain, whatever the volume slider says
export const MODES = ['CUES', 'LOOP', 'SAMPLER', 'STEMS'] as const
export const LOOP_BEATS = [0.5, 1, 2, 4]
export type FxKind = 'echo' | 'sweep' | 'riser'
const LOOKAHEAD = 0.1 // seconds booked ahead
const TICK_MS = 25
const DECKS: DeckId[] = ['A', 'B']

interface Intent { vol: number; tempo: number; hi: number; mid: number; low: number }
export interface DeckView {
  playing: boolean; preview: boolean; mode: number; loopLen: number; lastCue: number; held: boolean[]; mask: number[]
  vol: number; tempo: number; hi: number; mid: number; low: number; synced: boolean; bpm: number; trackName: string; key: Key
}
export interface DjView {
  ready: boolean; loading: boolean; needsTap: boolean; suspended: boolean
  A: DeckView; B: DeckView; xf: number
  anyPlaying: boolean
  /** the deck that is playing AND audible in the mix, the louder one if both (drives the key and the beat clock) */
  lead: DeckId | null
  fx: FxKind | null
}
export interface PadEvent { deck: DeckId; n: number; mode: number }

// ---------- one deck ----------
class Deck {
  playing = false; preview = false; mask = [1, 1, 1, 1]; srcs: AudioBufferSourceNode[] = []
  pos0 = 0; t0 = 0; curRate = 1; override: number | null = null
  mode = 0; loopLen = 0; loopStart = 0; lastCue = -1; held = [false, false, false, false]
  private nt: ReturnType<typeof setTimeout> | null = null
  readonly stemG: GainNode[]; readonly lo: BiquadFilterNode; readonly mid?: BiquadFilterNode; readonly hi: BiquadFilterNode; readonly volG: GainNode; readonly xfG: GainNode
  constructor(private ctx: AudioContext, readonly name: DeckId, private bufs: AudioBuffer[], bus: AudioNode, private intent: Intent, private other: () => Deck) {
    const c = ctx
    this.stemG = bufs.map(() => c.createGain())
    this.lo = c.createBiquadFilter(); this.lo.type = 'lowshelf'; this.lo.frequency.value = 200
    this.mid = c.createBiquadFilter(); this.mid.type = 'peaking'; this.mid.frequency.value = 1000; this.mid.Q.value = 0.7
    this.hi = c.createBiquadFilter(); this.hi.type = 'highshelf'; this.hi.frequency.value = 4000
    this.intent.mid ??= 0.5
    this.volG = c.createGain(); this.xfG = c.createGain()
    this.stemG.forEach((g) => g.connect(this.lo))
    this.lo.connect(this.mid); this.mid.connect(this.hi); this.hi.connect(this.volG); this.volG.connect(this.xfG); this.xfG.connect(bus)
    this.applyVol(); this.applyEQ()
  }
  get rate() { return this.override ?? 1 + (0.5 - this.intent.tempo) * 0.16 }
  get bpm() { return 120 * this.rate }
  pos() {
    if (!this.playing) return this.pos0
    const now = this.ctx.currentTime
    if (now < this.t0) return this.pos0
    let raw = this.pos0 + (now - this.t0) * this.curRate
    if (this.loopLen) { const ls = this.loopStart, le = ls + this.loopLen * BEAT; if (raw >= le) raw = ls + ((raw - ls) % (le - ls)) }
    return ((raw % LEN) + LEN) % LEN
  }
  private rebase() { this.pos0 = this.pos(); this.t0 = this.ctx.currentTime }
  applyRate() {
    const r = this.rate
    if (this.playing) { this.rebase(); this.srcs.forEach((s) => { s.playbackRate.value = r }) }
    this.curRate = r
  }
  private applyLoop() {
    const ls = this.loopLen ? this.loopStart : 0, le = this.loopLen ? ls + this.loopLen * BEAT : LEN
    this.srcs.forEach((s) => { s.loopStart = ls; s.loopEnd = le })
  }
  private begin(offset: number) {
    const c = this.ctx, when = c.currentTime + 0.005
    this.curRate = this.rate
    this.srcs = this.bufs.map((b, i) => {
      const s = c.createBufferSource(); s.buffer = b; s.loop = true; s.playbackRate.value = this.curRate
      s.loopStart = this.loopLen ? this.loopStart : 0; s.loopEnd = this.loopLen ? this.loopStart + this.loopLen * BEAT : LEN
      s.connect(this.stemG[i]); s.start(when, offset); return s
    })
    this.t0 = when; this.pos0 = offset
  }
  halt() {
    if (this.nt) { clearTimeout(this.nt); this.nt = null }
    this.srcs.forEach((s) => { try { s.stop() } catch { /* already stopped */ } s.disconnect() }); this.srcs = []
  }
  play() {
    if (this.playing) { this.pos0 = this.pos(); this.halt(); this.playing = false }
    else { this.begin(this.pos0); this.playing = true }
  }
  jump(offset: number) {
    offset = ((offset % LEN) + LEN) % LEN
    if (this.playing) { this.halt(); this.begin(offset) } else this.pos0 = offset
  }
  cueDown() {
    if (this.playing && !this.preview) { this.pos0 = 0; this.halt(); this.playing = false }
    else if (!this.playing) { this.preview = true; this.begin(this.pos0); this.playing = true }
  }
  cueUp() { if (this.preview) { this.preview = false; this.halt(); this.playing = false; this.pos0 = 0 } }
  applyVol() { this.volG.gain.setTargetAtTime(this.intent.vol * this.intent.vol, this.ctx.currentTime, 0.01) }
  applyEQ() {
    const db = (v: number) => (v < 0.5 ? (-36 * (0.5 - v)) / 0.5 : (9 * (v - 0.5)) / 0.5)
    this.lo.gain.setTargetAtTime(db(this.intent.low), this.ctx.currentTime, 0.02)
    this.hi.gain.setTargetAtTime(db(this.intent.hi), this.ctx.currentTime, 0.02)
    this.mid?.gain.setTargetAtTime(db(this.intent.mid ?? 0.5), this.ctx.currentTime, 0.02)
  }
  setTempo() { this.override = null; this.applyRate() }
  sync() {
    const o = this.other()
    this.override = o.rate; this.applyRate()
    if (o.playing && this.playing) { // line the beats up as well as the speed
      const diff = (o.pos() % BEAT) - (this.pos() % BEAT)
      this.jump(this.pos() + (diff > BEAT / 2 ? diff - BEAT : diff < -BEAT / 2 ? diff + BEAT : diff))
    }
  }
  /** jog: while playing, a nudge (speeds up / slows down the wheel's way); paused, it scrubs. Ticks are signed. */
  nudge(d: number) {
    d = Math.max(-12, Math.min(12, d))
    if (this.playing) {
      this.rebase()
      const r = Math.max(0.05, this.rate * (1 + d * 0.04))
      this.curRate = r; this.srcs.forEach((s) => { s.playbackRate.value = r })
      if (this.nt) clearTimeout(this.nt)
      this.nt = setTimeout(() => { this.nt = null; if (this.playing) { this.rebase(); this.curRate = this.rate; this.srcs.forEach((s) => { s.playbackRate.value = this.rate }) } }, 120)
    } else this.pos0 = (((this.pos0 + d * 0.03) % LEN) + LEN) % LEN
  }
  setLoop(beats: number) {
    this.rebase()
    if (!beats) { this.loopLen = 0; this.applyLoop(); return }
    this.loopStart = Math.floor(this.pos() / BEAT) * BEAT; this.loopLen = beats; this.applyLoop()
  }
  toggleStem(i: number) { this.mask[i] ^= 1; this.stemG[i].gain.setTargetAtTime(this.mask[i] ? 1 : 0, this.ctx.currentTime, 0.02) }
  cycleMode() { if (this.loopLen) this.setLoop(0); this.mode = (this.mode + 1) % MODES.length }
  leds(): Record<string, boolean> {
    const d = this.name, o: Record<string, boolean> = {}
    o[`play.${d}`] = this.playing && !this.preview; o[`cue.${d}`] = this.preview; o[`sync.${d}`] = this.override != null
    for (let i = 0; i < 4; i++) o[`pad${i + 1}.${d}`] = this.mode === 0 ? this.lastCue === i : this.mode === 1 ? this.loopLen === LOOP_BEATS[i] : this.mode === 2 ? this.held[i] : !!this.mask[i]
  return o
  }
  dispose() { this.halt(); this.playing = false; try { this.xfG.disconnect() } catch { /* ignore */ } }
}

// ---------- engine state ----------
interface Core {
  ctx: AudioContext; master: GainNode; limiter: DynamicsCompressorNode; an: AnalyserNode; bus: GainNode
  fxFilter: BiquadFilterNode; echoSend: GainNode; delay: DelayNode; noise: AudioBuffer
  decks: Record<DeckId, Deck>; samples: AudioBuffer[]
}
type Hot = { dj?: Shared }
interface Shared {
  intent: Record<DeckId, Intent>; xf: number; core: Core | null; loading: Promise<boolean> | null; disposed: boolean; needsTap: boolean
  fxNow: { kind: FxKind; until: number } | null; timer: ReturnType<typeof setTimeout> | null; lastBeatIdx: number; beatCount: number
  queue: { a: DjAction; at: number }[]; tempoMsb: Record<DeckId, number>; ledState: Map<string, boolean>
  padListeners: Set<(e: PadEvent) => void>; beatTimers: Set<ReturnType<typeof setTimeout>>; subs: Set<() => void>; version: number; view: DjView | null
}
// ALL state is shared through import.meta.hot.data: an edit swaps the code but the decks keep playing, and importers still holding the old
// functions keep working on the same state.
const S: Shared = (import.meta.hot?.data as Hot | undefined)?.dj ?? {
  intent: { A: { vol: 0.8, tempo: 0.5, hi: 0.5, mid: 0.5, low: 0.5 }, B: { vol: 0.8, tempo: 0.5, hi: 0.5, mid: 0.5, low: 0.5 } }, xf: 0.5, core: null, loading: null, disposed: false,
  needsTap: false, fxNow: null, timer: null, lastBeatIdx: -1, beatCount: 0, queue: [], tempoMsb: { A: 64, B: 64 }, ledState: new Map(), padListeners: new Set(),
  beatTimers: new Set(), subs: new Set(), version: 0, view: null,
}
if (import.meta.hot) (import.meta.hot.data as Hot).dj = S
const { intent, queue, tempoMsb, ledState, padListeners, beatTimers, subs } = S

const hasActivation = () => (typeof navigator !== 'undefined' && (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive) === true
const masterLevel = () => MASTER_CAP * outputScale()

// ---------- view / subscription ----------
export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const getVersion = () => S.version
function emit() { S.version++; S.view = null; subs.forEach((f) => f()); syncLeds() }
function deckView(d: DeckId): DeckView {
  const k = S.core?.decks[d]
  return {
    playing: !!k?.playing, preview: !!k?.preview, mode: k?.mode ?? 0, loopLen: k?.loopLen ?? 0, lastCue: k?.lastCue ?? -1,
    held: k ? [...k.held] : [false, false, false, false], mask: k ? [...k.mask] : [1, 1, 1, 1],
    ...intent[d], mid: intent[d].mid ?? 0.5, synced: k?.override != null, bpm: k ? k.bpm : 120 * (1 + (0.5 - intent[d].tempo) * 0.16), trackName: TRACKS[d].name, key: TRACKS[d].key,
  }
}
const weight = (d: DeckId) => intent[d].vol ** 2 * Math.cos(((d === 'A' ? S.xf : 1 - S.xf) * Math.PI) / 2)
/** the louder audible playing deck, or null */
function leadDeck(): DeckId | null {
  if (!S.core) return null
  const on = DECKS.filter((d) => S.core!.decks[d].playing && weight(d) > 0.02)
  if (!on.length) return null
  return on.length === 1 ? on[0] : weight('A') >= weight('B') ? 'A' : 'B'
}
export function getView(): DjView {
  if (S.view) return S.view
  const anyPlaying = !!S.core && DECKS.some((d) => S.core!.decks[d].playing)
  S.view = { ready: !!S.core, loading: !!S.loading && !S.core, needsTap: S.needsTap, suspended: S.core?.ctx.state === 'suspended', A: deckView('A'), B: deckView('B'), xf: S.xf, anyPlaying, lead: leadDeck(), fx: S.fxNow && S.core && S.fxNow.until > S.core.ctx.currentTime ? S.fxNow.kind : null }
  return S.view
}
/** seconds into the 8 s loop, for the spinning jog rings */
export const getDeckPos = (d: DeckId) => S.core?.decks[d].pos() ?? 0
export const getDeckRate = (d: DeckId) => S.core?.decks[d].rate ?? 1
export const getDeckPlaying = (d: DeckId) => !!S.core?.decks[d].playing
/** 0..1 peak of the master output (after the limiter): proof the graph makes sound */
export function peak(): number {
  if (!S.core) return 0
  const buf = new Float32Array(S.core.an.fftSize)
  S.core.an.getFloatTimeDomainData(buf)
  let m = 0
  for (const x of buf) m = Math.max(m, Math.abs(x))
  return m
}
/** the current master gain target (cap x app volume), for checks */
export const masterGain = () => S.core?.master.gain.value ?? 0
export const onPad = (fn: (e: PadEvent) => void) => { padListeners.add(fn); return () => { padListeners.delete(fn) } }
/** audio-clock seconds until the next bar line of the lead deck (null if nothing plays) */
export function secondsToBar(): number | null {
  const l = leadDeck() ?? DECKS.find((d) => S.core?.decks[d].playing) ?? null
  if (!S.core || !l) return null
  const k = S.core.decks[l], bp = k.pos() / BEAT
  return ((4 - (bp % 4)) * BEAT) / k.rate
}

// ---------- LEDs ----------
function syncLeds() {
  if (!S.core) return
  const want: Record<string, boolean> = { ...S.core.decks.A.leds(), ...S.core.decks.B.leds() }
  for (const [id, on] of Object.entries(want)) {
    if (ledState.get(id) === on) continue
    ledState.set(id, on)
    const b = ledBytes(id, on)
    if (b) sendToDj(b)
  }
}
/** forget what the LEDs were told, then send them all again (after calibration changed which buttons have LEDs) */
export function resyncLeds() { ledsDark(); ledState.clear(); syncLeds() }
function ledsDark() {
  for (const [id, on] of ledState) { if (on) { const b = ledBytes(id, false); if (b) sendToDj(b) } }
  ledState.clear()
}

// ---------- audio graph ----------
function buildCore(ctx: AudioContext, bufs: Awaited<ReturnType<typeof renderAll>>): Core {
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -10; limiter.knee.value = 6; limiter.ratio.value = 20; limiter.attack.value = 0.003; limiter.release.value = 0.12
  const master = ctx.createGain(); master.gain.value = 0
  const an = ctx.createAnalyser(); an.fftSize = 1024
  master.connect(limiter); limiter.connect(an); limiter.connect(ctx.destination)
  const bus = ctx.createGain()
  const fxFilter = ctx.createBiquadFilter(); fxFilter.type = 'lowpass'; fxFilter.frequency.value = 20000; fxFilter.Q.value = 1.5
  bus.connect(fxFilter); fxFilter.connect(master)
  // echo throw: send -> delay (dotted eighth) -> tone -> back to master, with a little feedback
  const echoSend = ctx.createGain(); echoSend.gain.value = 0
  const delay = ctx.createDelay(2); delay.delayTime.value = BEAT * 0.75
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2800
  const fb = ctx.createGain(); fb.gain.value = 0.42
  const ret = ctx.createGain(); ret.gain.value = 0.8
  fxFilter.connect(echoSend); echoSend.connect(delay); delay.connect(tone); tone.connect(fb); fb.connect(delay); tone.connect(ret); ret.connect(master)
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const nd = noise.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
  const decks = {} as Record<DeckId, Deck>
  const other = (d: DeckId) => () => decks[d === 'A' ? 'B' : 'A']
  decks.A = new Deck(ctx, 'A', bufs.A, bus, intent.A, other('A'))
  decks.B = new Deck(ctx, 'B', bufs.B, bus, intent.B, other('B'))
  applyXf(decks)
  master.gain.setValueAtTime(0, ctx.currentTime)
  master.gain.linearRampToValueAtTime(masterLevel(), ctx.currentTime + 0.05)
  return { ctx, master, limiter, an, bus, fxFilter, echoSend, delay, noise, decks, samples: bufs.samples }
}
function applyXf(decks = S.core?.decks) {
  if (!decks) return
  const t = decks.A.xfG.context.currentTime
  decks.A.xfG.gain.setTargetAtTime(Math.cos((S.xf * Math.PI) / 2), t, 0.01)
  decks.B.xfG.gain.setTargetAtTime(Math.cos(((1 - S.xf) * Math.PI) / 2), t, 0.01)
}
const applyMaster = () => {
  if (!S.core) return
  const t = S.core.ctx.currentTime
  S.core.master.gain.cancelScheduledValues(t)
  S.core.master.gain.setValueAtTime(S.core.master.gain.value, t)
  S.core.master.gain.linearRampToValueAtTime(masterLevel(), t + 0.05)
}

/** Create the audio (call from a click or key press) and render the stems. Safe to call again. */
export function ensure(): Promise<boolean> {
  if (S.disposed) return Promise.resolve(false)
  if (S.core) { void S.core.ctx.resume().catch(() => {}); S.needsTap = false; return Promise.resolve(true) }
  if (S.loading) return S.loading
  S.loading = (async () => {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctor()
      void ctx.resume().catch(() => {})
      emit()
      const bufs = await renderAll()
      if (S.disposed) { void ctx.close().catch(() => {}); return false }
      S.core = buildCore(ctx, bufs)
      S.needsTap = false
      setClockSource(clockSource)
      for (const q of queue.splice(0)) if (performance.now() - q.at < 8000) apply(q.a)
      emit()
      return true
    } catch (e) { console.error('[dj] audio failed', e); return false } finally { S.loading = null; emit() }
  })()
  emit()
  return S.loading
}

// ---------- the clock feed ----------
const clockSource = () => {
  if (!S.core) return null
  const d = leadDeck() ?? DECKS.find((x) => S.core!.decks[x].playing) ?? null
  if (!d) return null
  const k = S.core.decks[d]
  return { bpm: k.bpm, beatPos: k.pos() / BEAT, deck: d }
}
function tick() {
  S.timer = null
  if (!S.core) return
  const s = clockSource()
  if (s) {
    const bp = s.beatPos, rate = s.bpm / 120, nextIdx = Math.floor(bp) + 1
    const until = ((nextIdx - bp) * BEAT) / rate
    if (until < LOOKAHEAD && nextIdx !== S.lastBeatIdx) {
      S.lastBeatIdx = nextIdx
      const idx = nextIdx % 16, bpm = s.bpm
      const h = setTimeout(() => { beatTimers.delete(h); emitBeat({ n: ++S.beatCount, beat: idx % 4, bar: Math.floor(idx / 4) % 4, bpm, time: performance.now() }) }, Math.max(0, until * 1000))
      beatTimers.add(h)
    }
  } else S.lastBeatIdx = -1
  if (S.core.decks.A.playing || S.core.decks.B.playing) S.timer = setTimeout(tick, TICK_MS)
}
const ensureTick = () => { if (!S.timer && S.core) S.timer = setTimeout(tick, 0) }

// ---------- sampler (hits land on the 16th grid when close) ----------
function sample(n: number) {
  if (!S.core) return
  const c = S.core.ctx
  const s = c.createBufferSource(); s.buffer = S.core.samples[n]
  const g = c.createGain(); g.gain.value = 0.9
  s.connect(g); g.connect(S.core.bus)
  let when = c.currentTime
  const lead = leadDeck()
  if (lead) {
    const k = S.core.decks[lead], grid = BEAT / 4
    const until = (grid - (k.pos() % grid)) / k.rate
    if (until <= 0.07) when += until
  }
  s.start(when)
}

// ---------- master FX (piano -> DJ). One at a time, with a breather between. ----------
export function fx(kind: FxKind): boolean {
  if (!S.core) return false
  const { ctx } = S.core, t = ctx.currentTime
  const lead = DECKS.find((d) => S.core!.decks[d].playing)
  if (!lead) return false
  if (S.fxNow && S.fxNow.until + 0.6 > t) return false
  const beatS = BEAT / S.core.decks[lead].rate
  let len = 0
  if (kind === 'echo') {
    S.core.delay.delayTime.setTargetAtTime(beatS * 0.75, t, 0.01)
    const g = S.core.echoSend.gain
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.6, t + 0.03); g.setValueAtTime(0.6, t + beatS); g.linearRampToValueAtTime(0, t + beatS + 0.08)
    len = beatS * 4
  } else if (kind === 'sweep') {
    const f = S.core.fxFilter.frequency
    f.cancelScheduledValues(t); f.setValueAtTime(20000, t); f.exponentialRampToValueAtTime(650, t + beatS * 1.5); f.exponentialRampToValueAtTime(20000, t + beatS * 4)
    len = beatS * 4
  } else {
    // riser: noise swelling up to the next bar line, then a soft thump
    let r = secondsToBar() ?? beatS * 4
    if (r < beatS * 1.5) r += beatS * 4
    r = Math.min(r, beatS * 8)
    const src = ctx.createBufferSource(); src.buffer = S.core.noise; src.loop = true
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(6500, t + r)
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + r); g.gain.linearRampToValueAtTime(0, t + r + 0.04)
    src.connect(bp); bp.connect(g); g.connect(S.core.master); src.start(t); src.stop(t + r + 0.06)
    const o = ctx.createOscillator(), og = ctx.createGain()
    o.frequency.setValueAtTime(95, t + r); o.frequency.exponentialRampToValueAtTime(38, t + r + 0.3)
    og.gain.setValueAtTime(0.0001, t); og.gain.setValueAtTime(0.9, t + r); og.gain.exponentialRampToValueAtTime(0.0001, t + r + 0.55)
    o.connect(og); og.connect(S.core.master); o.start(t + r); o.stop(t + r + 0.6)
    len = r + 0.6
  }
  S.fxNow = { kind, until: t + len }
  emit()
  setTimeout(() => { if (S.fxNow && S.fxNow.kind === kind) { emit() } }, len * 1000 + 50)
  return true
}

// ---------- controls ----------
function apply(a: DjAction) {
  if (!S.core) return
  if (a.id === 'xfade') { S.xf = a.value; applyXf(); emit(); return }
  if (!a.deck) return
  const d = S.core.decks[a.deck], it = intent[a.deck]
  switch (a.id) {
    case 'play': if (a.value) { d.play(); ensureTick() } break
    case 'cue': if (a.value) { d.cueDown(); ensureTick() } else d.cueUp(); break
    case 'sync': if (a.value) d.sync(); break
    case 'padmode': if (a.value) d.cycleMode(); break
    case 'pad1': case 'pad2': case 'pad3': case 'pad4': {
      const n = Number(a.id[3]) - 1
      if (a.value) {
        d.held[n] = true
        if (d.mode === 0) { d.jump((n * LEN) / 4); d.lastCue = n }
        else if (d.mode === 1) d.setLoop(d.loopLen === LOOP_BEATS[n] ? 0 : LOOP_BEATS[n])
        else if (d.mode === 2) sample(n)
        else d.toggleStem(n)
        for (const f of [...padListeners]) { try { f({ deck: a.deck, n, mode: d.mode }) } catch (e) { console.error('[dj pad]', e) } }
      } else d.held[n] = false
      break
    }
    case 'vol': it.vol = a.value; d.applyVol(); break
    case 'tempo': {
      if (a.fine) a.value = (tempoMsb[a.deck] * 128 + a.value) / 16383 // LSB arrived: refine the MSB we have
      else tempoMsb[a.deck] = Math.round(a.value * 127)
      it.tempo = a.value; d.setTempo(); break
    }
    case 'hi': it.hi = a.value; d.applyEQ(); break
    case 'mid': it.mid = a.value; d.applyEQ(); break
    case 'low': it.low = a.value; d.applyEQ(); break
    case 'jogtouch': return // nothing to do yet: the calibration and the knob check watch it
    case 'jog': d.nudge(a.value); return // no UI refresh for every tick
  }
  ensureTick()
  emit()
}
/** One entry for MIDI and the on-screen deck. Before the audio exists, presses are held for a few seconds. */
export function dispatch(a: DjAction) {
  if (S.disposed) return
  emitAction(a)
  if (!S.core) {
    if (a.id === 'jog') return
    queue.push({ a, at: performance.now() }); if (queue.length > 24) queue.shift()
    if (hasActivation()) void ensure(); else { S.needsTap = true; emit() }
    return
  }
  if (S.core.ctx.state === 'suspended') void S.core.ctx.resume().catch(() => {})
  apply(a)
}
/** Raw MIDI bytes as if they came from onDjMessage (also the test hook). */
export function injectDj(bytes: ArrayLike<number>) { const a = decode(bytes); if (a) dispatch(a); return a }

/** Silence everything now (stop both decks, clear FX). The audio graph stays. */
export function panic() {
  if (!S.core) return
  for (const d of DECKS) { S.core.decks[d].cueUp(); if (S.core.decks[d].playing) S.core.decks[d].play() }
  const t = S.core.ctx.currentTime
  S.core.echoSend.gain.cancelScheduledValues(t); S.core.echoSend.gain.setValueAtTime(0, t)
  S.core.fxFilter.frequency.cancelScheduledValues(t); S.core.fxFilter.frequency.setValueAtTime(20000, t)
  S.fxNow = null
  emit()
}
/** Stop everything and release the audio device. */
export function dispose() {
  S.disposed = true
  if (S.timer) { clearTimeout(S.timer); S.timer = null }
  beatTimers.forEach(clearTimeout); beatTimers.clear()
  setClockSource(null)
  ledsDark()
  const c = S.core
  S.core = null; S.loading = null; S.view = null
  if (c) {
    DECKS.forEach((d) => c.decks[d].dispose())
    try { c.master.gain.cancelScheduledValues(c.ctx.currentTime); c.master.gain.setValueAtTime(c.master.gain.value, c.ctx.currentTime); c.master.gain.linearRampToValueAtTime(0, c.ctx.currentTime + 0.03) } catch { /* ignore */ }
    setTimeout(() => { try { c.master.disconnect() } catch { /* ignore */ } void c.ctx.close().catch(() => {}) }, 100)
  }
  subs.forEach((f) => f())
}

// ---------- wiring ----------
const offMsg = onDjMessage((data) => { if (isDeaf()) return; const a = decode(data); if (a) dispatch(a) })
const offSettings = useAudioSettings.subscribe(applyMaster)
const offDevices = useDevices.subscribe(() => { ledState.clear(); syncLeds() }) // a controller (re)appeared: relight it
// A tap or key press wakes a suspended context, and creates the audio if a controller press was waiting for one.
const onGesture = () => { if (S.core) { if (S.core.ctx.state === 'suspended') void S.core.ctx.resume().catch(() => {}) } else if (S.needsTap) void ensure() }
window.addEventListener('pointerdown', onGesture, true)
window.addEventListener('keydown', onGesture, true)
const onHide = () => dispose()
window.addEventListener('pagehide', onHide)

if (import.meta.hot) {
  // The decks keep playing through an edit (state is in hot.data); only the listeners are swapped.
  import.meta.hot.dispose(() => {
    offMsg(); offSettings(); offDevices()
    window.removeEventListener('pointerdown', onGesture, true)
    window.removeEventListener('keydown', onGesture, true)
    window.removeEventListener('pagehide', onHide)
  })
  import.meta.hot.accept()
}
