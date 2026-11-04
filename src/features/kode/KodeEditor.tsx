import { useEffect, useMemo, useRef } from 'react'
import { KEYWORDS } from '../../kode/lang/names'
import type { Diag } from '../../kode/lang/types'

export interface Span { s: number; e: number }

const C_COMMENT = 1, C_KEY = 2, C_STR = 4, C_NUM = 8, C_ACTIVE = 16, C_ERR = 32

/** a class bit for every character: comments, keywords, quoted patterns, numbers (the playing step and errors are added on top) */
function classify(text: string): Uint8Array {
  const cls = new Uint8Array(text.length)
  let i = 0
  while (i < text.length) {
    const eol = text.indexOf('\n', i) < 0 ? text.length : text.indexOf('\n', i)
    let j = i, q = ''
    while (j < eol) {
      const c = text[j]
      if (q) { cls[j] |= C_STR; if (c === q) q = ''; j++; continue }
      if (c === '"' || c === "'") { q = c; cls[j] |= C_STR; j++; continue }
      if (c === '#') { for (let k = j; k < eol; k++) cls[k] |= C_COMMENT; break }
      if (/[A-Za-z]/.test(c)) {
        let k = j; while (k < eol && /[A-Za-z]/.test(text[k])) k++
        if ((KEYWORDS as readonly string[]).includes(text.slice(j, k).toLowerCase())) for (let m = j; m < k; m++) cls[m] |= C_KEY
        j = k; continue
      }
      if (/[0-9.]/.test(c)) { cls[j] |= C_NUM }
      j++
    }
    i = eol + 1
  }
  return cls
}

const NAME: [number, string][] = [[C_COMMENT, 'kd-c'], [C_KEY, 'kd-k'], [C_STR, 'kd-s'], [C_NUM, 'kd-n'], [C_ACTIVE, 'kd-on'], [C_ERR, 'kd-err']]

/**
 * The code box: a transparent <textarea> over a coloured copy of the same text (so the playing step can glow and mistakes are underlined).
 * It is a real text field, so the computer-key piano ignores it (src/music/typing.ts skips textarea) and Ctrl/Cmd+Enter runs the code.
 */
export function KodeEditor({ value, onChange, onRun, active, errors, label }: {
  value: string; onChange: (v: string) => void; onRun: () => void; active: Span[]; errors: Diag[]; label: string
}) {
  const ta = useRef<HTMLTextAreaElement>(null)
  const pre = useRef<HTMLPreElement>(null)
  const base = useMemo(() => classify(value), [value])
  const spans = useMemo(() => {
    const cls = Uint8Array.from(base)
    for (const a of active) for (let i = Math.max(0, a.s); i < Math.min(cls.length, a.e); i++) cls[i] |= C_ACTIVE
    for (const d of errors) for (let i = Math.max(0, d.start); i < Math.min(cls.length, d.end); i++) cls[i] |= C_ERR
    const out: { t: string; c: number }[] = []
    let from = 0
    for (let i = 1; i <= cls.length; i++) if (i === cls.length || cls[i] !== cls[from]) { out.push({ t: value.slice(from, i), c: cls[from] }); from = i }
    return out
  }, [base, active, errors, value])
  const sync = () => { if (pre.current && ta.current) { pre.current.scrollTop = ta.current.scrollTop; pre.current.scrollLeft = ta.current.scrollLeft } }
  useEffect(sync, [value])
  return (
    <div className="kd-ed">
      <pre ref={pre} className="kd-hl" aria-hidden>
        {spans.map((p, i) => <span key={i} className={NAME.filter(([b]) => p.c & b).map(([, n]) => n).join(' ')}>{p.t}</span>)}{'\n '}
      </pre>
      <textarea ref={ta} className="kd-ta" value={value} spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="off" aria-label={label}
        data-kode-input
        onChange={(e) => onChange(e.target.value)} onScroll={sync}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onRun() }
        }} />
    </div>
  )
}
