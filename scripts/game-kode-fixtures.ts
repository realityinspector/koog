// Pure checks for the games' Kode powers: spells, turret programs, combos, looks, variables.
import { applyLook, castMatch, chargesAfter, drillSchedule, expandPattern, exprNotes, intervals, makeExpr, noteOk, phraseText, pushRecent, signMatches, spellDamage, spellPower, turretLane, varLine, varName } from '../src/features/games/gamekode/kodeLogic'
let fails = 0
const eq = (name: string, a: unknown, b: unknown) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ` got ${JSON.stringify(a)} want ${JSON.stringify(b)}`)) }

// BachDoom: call signs and parameter scaling
eq('intervals', intervals([48, 52, 55]), [4, 3])
eq('sign matches in any octave', signMatches([40, 44, 47], [48, 52, 55]), true)
eq('sign rejects other shape', signMatches([40, 43, 47], [48, 52, 55]), false)
eq('sign needs enough notes', signMatches([44, 47], [48, 52, 55]), false)
eq('castMatch picks the spell', castMatch([1, 40, 44, 47], [{ sign: [60, 62, 64] }, { sign: [48, 52, 55] }])?.sign, [48, 52, 55])
eq('recent buffer drops old notes', pushRecent([{ n: 1, t: 0 }], 2, 5000).map((x) => x.n), [2])
eq('higher call sign = more power', [spellPower(60, 58), spellPower(60, 45), spellPower(60, 30)], [3, 2, 1])
eq('damage grows with power', [1, 2, 3].map(spellDamage), [2, 3, 4])
eq('charge every 5 hits, max 3', [chargesAfter(0, 5), chargesAfter(0, 4), chargesAfter(3, 10)], [1, 0, 3])

// Zombie Lanes: sequence + loop
eq('1-3-2-4 x2', expandPattern([1, 3, 2, 4], 2), [1, 3, 2, 4, 1, 3, 2, 4])
eq('repeat clamps', expandPattern([1], 99).length, 4)
eq('turret lanes', [0, 249, 250, 999, 1000].map((x) => turretLane(x, 1000)), [1, 1, 2, 4, 4])

// Jiu-Jitsu: combo drill
const d = drillSchedule([1, 2, 4], 3, 1)
eq('drill x3 = 9 ticks', d.length, 9)
eq('drill order', d.slice(0, 4).map((t) => t.rung), [1, 2, 4, 1])
eq('drill rep numbers', d.map((t) => t.rep), [0, 0, 0, 1, 1, 1, 2, 2, 2])

// Runway: function with parameters
const a = applyLook({ items: [1, 2, 0, 1, 0] }, { root: 7, q: 'major' }, 3)
eq('look applies the chord colour', a.pal, { root: 7, q: 'major' })
eq('look extra from chord root', [a.accIx, a.items], [1, [1, 2, 0, 1, 1]])
eq('same look, other chord, other result', applyLook({ items: [1, 2, 0, 1, 0] }, { root: 9, q: 'minor' }, 3).pal.q, 'minor')

// Phrase Match: variables
const vars = [{ name: varName(0), notes: [60, 64, 67] }, { name: varName(1), notes: [62, 65] }]
eq('variable line', varLine(vars[0]), 'a = "c e g"')
eq('phraseText', phraseText([61, 62]), 'c# d')
eq('expression b a b', exprNotes(vars, ['b', 'a', 'b']), [62, 65, 60, 64, 67, 62, 65])
eq('unknown name is empty', exprNotes(vars, ['z']), [])
eq('expr uses 2+ names', new Set(makeExpr(vars, () => 0)).size >= 2, true)
eq('easy compares note names', [noteOk(60, 72, true), noteOk(60, 72, false)], [true, false])
console.log(fails ? `${fails} FAILED` : 'all game-kode fixtures pass')
process.exit(fails ? 1 : 0)
