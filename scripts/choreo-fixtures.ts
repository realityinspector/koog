// Dancer Choreographer fixtures: `npm run check:choreo`. Pure engine only (no browser): routine flatten, when/if evaluation,
// puzzle goals (every reference solution passes at par and the obvious cheats fail), the share-link codec and its fuzz safety.
import {
  BUILTINS, PUZZLE_FNS, tableOf, flatten, checkGoal, blockCount, usesOf, encodeShare, decodeShare, cleanRoutine, matchCall, toKode, shareFromHash,
  repeatLast, addNode, addRule, removeNode, getList, ROOT, stepToken, type Routine, type Fn, type Node, MAX_SHARE,
} from '../src/features/kodeapps/choreographer/engine'
import { PUZZLES } from '../src/features/kodeapps/choreographer/puzzles'

let pass = 0, fail = 0
const ok = (c: boolean, name: string, extra = '') => { if (c) pass++; else { fail++; console.log('FAIL', name, extra) } }
const eq = (a: unknown, b: unknown, name: string) => ok(JSON.stringify(a) === JSON.stringify(b), name, `${JSON.stringify(a)} != ${JSON.stringify(b)}`)

const taught: Fn = { id: 'u1', name: 'Zoom', emoji: '🚀', notes: [60, 62, 64], move: 'moonwalk', vel: 0.6 }
const T = tableOf(BUILTINS, PUZZLE_FNS, [taught])
const R = (nodes: Node[], rules: Routine['rules'] = []): Routine => ({ v: 1, name: 'T', bpm: 100, nodes, rules })
const call = (fn: string, a?: 's' | 'l'): Node => (a ? { k: 'call', fn, a } : { k: 'call', fn })

// ---- flatten: sequence, repeat expansion, timing
{
  const p = flatten(R([call('jump'), call('spin')]), T)
  eq(p.steps.map(stepToken), ['jump', 'spin'], 'sequence order')
  eq(p.steps.map((s) => s.beat), [0, 2], 'sequence beats')
  const r = flatten(R([{ k: 'repeat', n: 3, body: [call('jump'), call('spin')] }]), T)
  eq(r.steps.map(stepToken), ['jump', 'spin', 'jump', 'spin', 'jump', 'spin'], 'repeat expands')
  eq(r.steps.map((s) => s.beat), [0, 2, 4, 6, 8, 10], 'repeat beats')
  ok(r.steps.every((s) => s.anc[0] === '0'), 'repeat ancestors highlight the repeat block')
  const nested = flatten(R([{ k: 'repeat', n: 2, body: [{ k: 'repeat', n: 3, body: [call('clap')] }] }]), T)
  eq(nested.steps.length, 6, 'nested repeat 2x3')
  const huge = flatten(R([{ k: 'repeat', n: 8, body: [{ k: 'repeat', n: 8, body: [{ k: 'repeat', n: 8, body: [call('clap')] }] }] }]), T)
  ok(huge.steps.length <= 64 && huge.capped, 'step cap keeps a runaway repeat small', String(huge.steps.length))
  eq(flatten(R([]), T).steps.length, 0, 'empty routine')
  eq(flatten(R([call('nope')]), T).steps.length, 0, 'unknown function is skipped')
}

// ---- when: reactions against a synthetic event stream
{
  const p = flatten(R([call('clap'), call('clap'), call('clap'), call('clap')], [{ ev: 'kick', body: [call('jump')] }]), T, 'K.S.')
  eq(p.reacts.map((s) => s.beat), [0, 4], 'kick reactions land on kick beats')
  ok(p.reacts.every((s) => s.react === 'kick' && s.move === 'jump'), 'kick reactions are jumps')
  const q = flatten(R([call('tap'), call('boom'), call('tap'), call('boom')], [{ ev: 'loud', body: [call('spin')] }]), T)
  eq(q.reacts.map((s) => s.beat), [2, 6], 'loud rule fires only on loud notes')
  const h = flatten(R([call('dong'), call('ding')], [{ ev: 'high', body: [call('spin')] }]), T)
  eq(h.reacts.map((s) => s.beat), [2], 'high rule fires only on the high note')
  const e = flatten(R([], [{ ev: 'snare', body: [call('clap')] }]), T, 'K.S.')
  eq(e.reacts.map((s) => s.beat), [2, 6], 'rules alone still get music to react to (8 beats)')
  const long = flatten(R([call('jump'), call('jump')], [{ ev: 'kick', body: [call('spin'), call('spin'), call('spin')] }]), T, 'KKKK')
  eq(long.reacts.length, 6, 'a 3-move reaction twice (kicks at 1 and 2 are skipped while it runs)')
  ok(long.reacts[3].beat === 3 && long.reacts[2].beat + 1 <= long.reacts[3].beat, 'reactions never overlap')
  eq(flatten(R([call('jump')], [{ ev: 'kick', body: [] }]), T).reacts.length, 0, 'empty rule does nothing')
}

// ---- if/else against the notes before it
{
  const ifn = (): Node => ({ k: 'if', c: 'high', then: [call('wl')], else: [call('wr')] })
  eq(flatten(R([call('ding'), ifn()]), T).steps.map(stepToken), ['sway', 'waveL'], 'if: high note -> then')
  eq(flatten(R([call('dong'), ifn()]), T).steps.map(stepToken), ['sway', 'waveR'], 'if: low note -> else')
  eq(flatten(R([ifn()]), T).steps.map(stepToken), ['waveR'], 'if with nothing before it: quiet low default -> else')
  const loud: Node = { k: 'if', c: 'loud', then: [call('spin')], else: [call('clap')] }
  eq(flatten(R([call('boom'), loud, call('tap'), loud]), T).steps.map(stepToken), ['sway', 'spin', 'sway', 'clap'], 'if: loud vs soft')
  const inRepeat = flatten(R([{ k: 'repeat', n: 2, body: [call('ding'), ifn(), call('dong'), ifn()] }]), T)
  eq(inRepeat.steps.map(stepToken), ['sway', 'waveL', 'sway', 'waveR', 'sway', 'waveL', 'sway', 'waveR'], 'if inside repeat')
}

// ---- blocks + concept use
{
  eq(blockCount(R([{ k: 'repeat', n: 4, body: [call('jump')] }])), 2, 'repeat + body = 2 blocks')
  eq(blockCount(R([{ k: 'if', c: 'high', then: [call('wl')], else: [call('wr')] }], [{ ev: 'kick', body: [call('jump')] }])), 5, 'if(3) + rule(2)')
  const u = usesOf(R([{ k: 'repeat', n: 2, body: [call('u1', 'l')] }], [{ ev: 'kick', body: [call('jump')] }]), T)
  ok(u.repeat && u.when && u.fn && u.param && !u.cond, 'usesOf finds repeat, when, taught fn and parameter')
  ok(!usesOf(R([{ k: 'repeat', n: 2, body: [] }]), T).repeat, 'an empty repeat is not "using" repeat')
}

// ---- editing helpers
{
  let r = addNode(R([]), ROOT, call('jump'))
  r = repeatLast(r, ROOT)
  eq(r.nodes[0].k === 'repeat' && (r.nodes[0] as { n: number }).n, 2, 'wrap last in a repeat x2')
  r = repeatLast(r, ROOT); r = repeatLast(r, ROOT)
  eq((r.nodes[0] as { n: number }).n, 4, 'again cycles x3, x4')
  r = repeatLast(r, ROOT)
  eq((r.nodes[0] as { n: number }).n, 2, 'cycle wraps back to x2')
  const body = getList(r, { parent: '0', part: '' })
  ok(!!body && body.length === 1, 'getList reaches a repeat body')
  r = addRule(r, 'kick'); r = addNode(r, { parent: 'r0', part: '' }, call('spin'))
  eq(r.rules[0].body.length, 1, 'rule body gets a block')
  r = removeNode(r, 'r0')
  eq(r.rules.length, 0, 'remove a rule')
  r = removeNode(r, '0.0')
  eq((r.nodes[0] as { body: Node[] }).body.length, 0, 'remove a block inside a repeat')
}

// ---- call signs
{
  const fl = [...BUILTINS, ...PUZZLE_FNS]
  const hop = PUZZLE_FNS.find((f) => f.id === 'jump')!
  eq(matchCall([40, 60, 64, 67], fl)?.fn.id, 'jump', 'call sign matches the tail of what was played')
  eq(matchCall([60, 64, 67], fl)?.a, 'm', 'same pitch = normal size')
  eq(matchCall([72, 76, 79], fl)?.a, 'l', 'played higher = big (a parameter)')
  eq(matchCall([48, 52, 55], fl)?.a, 's', 'played lower = small')
  eq(matchCall([62, 66, 69], fl)?.fn.id, 'jump', 'a call sign works in any key')
  ok(matchCall([60, 64], [hop]) === null, 'half a motif is not a call')
}

// ---- puzzles
{
  eq(PUZZLES.length, 12, 'twelve puzzles')
  for (const p of PUZZLES) {
    const fns = tableOf(PUZZLE_FNS.filter((f) => p.fns.includes(f.id)), p.teach ? [taught] : [])
    const res = checkGoal(p.goal, p.solution, fns, p.par, p.drums)
    ok(res.ok, `puzzle ${p.n} solution passes`, res.problems.join(' | '))
    ok(res.blocks === p.par, `puzzle ${p.n} solution is exactly par`, `${res.blocks} vs ${p.par}`)
    eq(res.stars, 3, `puzzle ${p.n} solution earns 3 stars`)
    ok(!checkGoal(p.goal, R([]), fns, p.par, p.drums).ok, `puzzle ${p.n}: an empty routine fails`)
    ok(p.hints.length >= 2, `puzzle ${p.n} has hints`)
  }
  const p2 = PUZZLES[1], f2 = tableOf(PUZZLE_FNS)
  const cheat = checkGoal(p2.goal, R([call('jump'), call('jump'), call('jump'), call('jump')]), f2, p2.par)
  ok(!cheat.ok && cheat.problems.some((s) => /repeat/i.test(s)) && cheat.problems.some((s) => /Too many/.test(s)), 'puzzle 2: four separate jumps is refused')
  const p3 = PUZZLES[2]
  ok(!checkGoal(p3.goal, R([call('jump')]), f2, p3.par).ok, 'puzzle 3: a plain jump is not a rule')
  ok(checkGoal(p3.goal, R([], [{ ev: 'snare', body: [call('jump')] }]), f2, p3.par).problems.length > 0, 'puzzle 3: the wrong drum fails')
  const p6 = PUZZLES[5]
  ok(!checkGoal(p6.goal, R([call('ding'), call('wl'), call('dong'), call('wr')]), f2, p6.par).ok, 'puzzle 6: hard-coding the waves without an if fails')
  const slow = checkGoal(PUZZLES[3].goal, R([call('jump'), call('jump'), call('spin'), call('jump'), call('jump'), call('spin')]), f2, 4)
  ok(slow.ok && slow.blocks === 6 && slow.stars === 2, 'puzzle 4: copying without a repeat still passes with 2 stars', JSON.stringify(slow.problems))
  const p7 = PUZZLES[6]
  ok(!checkGoal(p7.goal, R([{ k: 'repeat', n: 3, body: [call('moon')] }]), tableOf(PUZZLE_FNS), p7.par).ok, 'puzzle 7: a ready-made move does not count, you must teach one')
  const p10 = PUZZLES[9]
  ok(!checkGoal(p10.goal, R([{ k: 'repeat', n: 4, body: [call('jump')] }]), f2, p10.par).ok, 'puzzle 10: all-medium jumps fail')
}

// ---- Koog Kode-style text
{
  const t = toKode(R([{ k: 'repeat', n: 4, body: [call('u1')] }], [{ ev: 'kick', body: [call('jump')] }]), T)
  ok(/repeat 4 \{/.test(t) && /when kick \{/.test(t) && /fn zoom = notes/.test(t) && /tempo 100/.test(t), 'toKode reads like code', t)
}

// ---- share links
{
  const r = R([{ k: 'repeat', n: 3, body: [call('u1'), call('jump', 'l')] }, { k: 'if', c: 'loud', then: [call('spin')], else: [call('bow')] }], [{ ev: 'kick', body: [call('clap')] }])
  r.name = 'Zoe\'s show'
  const enc = encodeShare(r, T)
  ok(/^[A-Za-z0-9_-]+$/.test(enc) && enc.length < MAX_SHARE, 'share text is URL-safe and short', String(enc.length))
  const dec = decodeShare(enc)
  ok(!!dec, 'share decodes')
  eq(dec?.routine, r, 'share round-trips the routine exactly')
  eq(dec?.fns.map((f) => f.id), ['u1'], 'only the taught function travels')
  eq(dec?.fns[0]?.notes, [60, 62, 64], 'taught function keeps its notes')
  eq(shareFromHash('#choreo=' + enc + '&x=1'), enc, 'hash parsing')
  eq(shareFromHash('#other'), null, 'hash without a routine')

  // hostile / broken input never throws and never gets through
  const bad = (x: unknown) => decodeShare(x) === null
  ok(bad(''), 'empty'); ok(bad(null), 'null'); ok(bad(42), 'number'); ok(bad('!!!'), 'not base64'); ok(bad('a'.repeat(MAX_SHARE + 1)), 'too long')
  const enc64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const base = { v: 1, r: { v: 1, name: 'x', bpm: 100, nodes: [], rules: [] }, f: [] }
  ok(decodeShare(enc64(base)) !== null, 'minimal valid payload')
  ok(bad(enc64({ ...base, v: 2 })), 'wrong version')
  ok(bad(enc64({ ...base, r: { ...base.r, nodes: [{ k: 'call', fn: 'ghost' }] } })), 'unknown function')
  ok(bad(enc64({ ...base, r: { ...base.r, nodes: [{ k: 'eval', code: 'alert(1)' }] } })), 'unknown node kind')
  ok(bad(enc64({ ...base, r: { ...base.r, nodes: [{ k: 'repeat', n: 999, body: [] }] } })), 'repeat count too big')
  ok(bad(enc64({ ...base, r: { ...base.r, rules: [{ ev: 'explode', body: [] }] } })), 'unknown event')
  ok(bad(enc64({ ...base, f: [{ id: 'u1', name: 'x', emoji: '🎵', notes: [60], move: 'jump', vel: 1 }] })), 'function with 1 note')
  ok(bad(enc64({ ...base, f: [{ id: 'U1;', name: 'x', emoji: '🎵', notes: [60, 62], move: 'jump', vel: 1 }] })), 'bad function id')
  ok(bad(enc64({ ...base, f: [{ id: 'u1', name: 'x', emoji: '🎵', notes: [60, 62], move: 'explode', vel: 1 }] })), 'unknown move')
  ok(bad(enc64({ ...base, f: [{ id: 'jump', name: 'x', emoji: '🎵', notes: [60, 62], move: 'jump', vel: 1 }] })), 'cannot redefine a built-in id')
  let deep: Node = call('jump'); for (let i = 0; i < 10; i++) deep = { k: 'repeat', n: 2, body: [deep] }
  ok(bad(enc64({ ...base, r: { ...base.r, nodes: [deep] } })), 'too deep')
  const many = Array.from({ length: 24 }, () => ({ k: 'repeat', n: 2, body: Array.from({ length: 10 }, () => call('jump')) }))
  ok(bad(enc64({ ...base, r: { ...base.r, nodes: many } })), 'too many blocks')
  const xss = decodeShare(enc64({ ...base, r: { ...base.r, name: '<img src=x onerror=alert(1)>' } }))
  ok(xss?.routine.name === 'My dance', 'a script-looking name is replaced', xss?.routine.name)
  const proto = decodeShare(enc64(JSON.parse('{"v":1,"__proto__":{"x":1},"r":{"v":1,"name":"a","bpm":9999,"nodes":[],"rules":[]},"f":[]}')))
  ok(proto?.routine.bpm === 160, 'bpm clamped', String(proto?.routine.bpm))
  ok(({} as Record<string, unknown>).x === undefined, 'no prototype pollution')

  // fuzz: random garbage, truncations and bit-flips of a good payload must never throw
  let seed = 12345
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000 }
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let threw = 0, accepted = 0
  for (let i = 0; i < 4000; i++) {
    let s: string
    const m = i % 4
    if (m === 0) s = Array.from({ length: Math.floor(rnd() * 200) }, () => alpha[Math.floor(rnd() * alpha.length)]).join('')
    else if (m === 1) s = enc.slice(0, Math.floor(rnd() * enc.length))
    else if (m === 2) { const a = enc.split(''); for (let k = 0; k < 1 + Math.floor(rnd() * 4); k++) a[Math.floor(rnd() * a.length)] = alpha[Math.floor(rnd() * alpha.length)]; s = a.join('') }
    else s = enc64(JSON.parse(JSON.stringify({ ...base, r: { ...base.r, nodes: [{ k: ['call', 'repeat', 'if', 'x'][Math.floor(rnd() * 4)], n: Math.floor(rnd() * 20) - 5, fn: ['jump', 'u1', 'zz'][Math.floor(rnd() * 3)], c: ['high', 'loud', 'q'][Math.floor(rnd() * 3)], body: [], then: [], else: [] }] } })))
    try { const d = decodeShare(s); if (d) { accepted++; flatten(d.routine, tableOf(BUILTINS, PUZZLE_FNS, d.fns)); blockCount(d.routine) } } catch { threw++ }
  }
  eq(threw, 0, 'fuzz: the decoder and everything after it never throw', `${threw} threw, ${accepted} accepted`)
  ok(cleanRoutine({ nodes: 'x', rules: [] }, []) === null, 'cleanRoutine rejects junk')
  ok(cleanRoutine(null, []) === null && cleanRoutine(7, []) === null, 'cleanRoutine rejects non-objects')
}

console.log(`choreo: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
