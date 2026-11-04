import { useEffect, useRef, useState } from 'react'
import './codeexport.css'
import { strudelUrl } from '../../kode/export'

// "</> Code": show a loop, beat or song as text for two free live-coding tools from the education world.
// Copy for Sonic Pi puts the text on the clipboard; Open in Strudel opens strudel.cc with the code already in it (a new tab, only when the
// kid presses the button). Koog never sends code anywhere on its own: the kid pastes it, or opens the page, themselves.
export interface CodeSource { sonic: string; strudel: string }

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch { /* fall back below */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0'
    document.body.appendChild(ta); ta.select()
    const ok = document.execCommand('copy'); ta.remove(); return ok
  } catch { return false }
}

export const STRUDEL_URL_MAX = 6000 // longer than this and some browsers/servers refuse the link: copy instead

export function CodeMenu({ build, disabled, what = 'loop', className = '' }: { build: () => CodeSource | null; disabled?: boolean; what?: string; className?: string }) {
  const [msg, setMsg] = useState(''), [info, setInfo] = useState(false)
  const t = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(t.current), [])
  const say = (m: string) => { setMsg(m); window.clearTimeout(t.current); t.current = window.setTimeout(() => setMsg(''), 4500) }
  const copy = async () => {
    const c = build(); if (!c) { say(`Make a ${what} first, then try again.`); return }
    say((await copyText(c.sonic)) ? 'Copied! Paste into Sonic Pi and press Run' : 'Could not copy. Select the text and copy it yourself.')
  }
  const open = async () => {
    const c = build(); if (!c) { say(`Make a ${what} first, then try again.`); return }
    const url = strudelUrl(c.strudel)
    if (url.length > STRUDEL_URL_MAX) { say((await copyText(c.strudel)) ? 'Too long for a link. Copied! Paste it into strudel.cc and press Ctrl+Enter' : 'Too long for a link.'); return }
    window.open(url, '_blank', 'noopener')
    say('Opened Strudel in a new tab. Press Ctrl+Enter to play.')
  }
  return (
    <span className={'cx ' + className}>
      <details className="cx-menu">
        <summary title="See your music as code, in free coding tools">{'</>'} Code</summary>
        <div className="cx-body">
          <button type="button" className="cx-btn" disabled={disabled} onClick={copy} title={`Copy this ${what} as Sonic Pi code`}>Copy for Sonic Pi</button>
          <button type="button" className="cx-btn" disabled={disabled} onClick={open} title={`Open this ${what} in Strudel (a new tab)`}>Open in Strudel</button>
          <button type="button" className="cx-btn cx-q" aria-expanded={info} onClick={() => setInfo(!info)}>What's this?</button>
          {info && (
            <p className="cx-info">
              <b>Live coding</b> means making music by typing instructions, and changing them while they play. Your {what} is just a list of notes and waits, so Koog
              can write it as code. <b>Sonic Pi</b> and <b>Strudel</b> are free tools made for learning, used in schools. Sonic Pi is a program you install; Strudel runs in the browser.
              Paste the code, press Run, then change a number and press Run again to hear what it does.
            </p>
          )}
        </div>
      </details>
      {msg && <span className="cx-toast" role="status" aria-live="polite" data-cx-toast>{msg}</span>}
    </span>
  )
}
