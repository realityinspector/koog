// Pure: share links carry the code in the URL hash, nothing networked. Tested by scripts/koogalien-lang-fixtures.ts
import type { Sentence } from '../data/types'
import { LIMITS } from '../data/types'
import { print } from './print'
import { parse, type Program } from './parse'

export const SHARE_PREFIX = 'v1~'

export function toShare(s: Sentence): string {
  const code = SHARE_PREFIX + encodeURIComponent(print(s))
  if (code.length > LIMITS.shareChars) throw new RangeError('That message is too long to share (limit ' + LIMITS.shareChars + ' characters).')
  return code
}

function fail(src: string, message: string, hint?: string): Program {
  return { src, sentence: null, vars: {}, errors: [{ message, start: 0, end: Math.min(src.length, 1), line: 1, col: 1, hint }], says: [] }
}

/** never throws, whatever the input */
export function fromShare(code: string): Program {
  try {
    const c = String(code ?? '')
    if (c.length > LIMITS.shareChars) return fail('', 'This link is too long to be a Koogalien message.')
    const m = /^v(\d{1,3})~/.exec(c)
    if (!m) return fail('', 'This link is not a Koogalien message.', 'Share links start with ' + SHARE_PREFIX)
    if (m[1] !== '1') return fail('', 'This message was made with a newer Koogalien.', 'Update the app to read it.')
    let src: string
    try { src = decodeURIComponent(c.slice(m[0].length)) } catch { return fail('', 'This link got scrambled on the way.', 'Ask for a fresh copy of the link.') }
    return parse(src)
  } catch {
    return fail('', 'This link did not make sense.')
  }
}
