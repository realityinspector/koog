// Book covers drawn in SVG, from scratch: a colour wash, a simple symbol for the story, the title in plain text. No copied artwork.
import type { ReactNode } from 'react'

const ART: Record<string, ReactNode> = {
  rabbit: <g><ellipse cx="50" cy="92" rx="22" ry="20" fill="#fff"/><ellipse cx="40" cy="48" rx="6" ry="20" fill="#fff"/><ellipse cx="60" cy="48" rx="6" ry="20" fill="#fff"/><ellipse cx="40" cy="50" rx="2.5" ry="13" fill="#f4b6c2"/><ellipse cx="60" cy="50" rx="2.5" ry="13" fill="#f4b6c2"/><circle cx="50" cy="74" r="14" fill="#fff"/><circle cx="45" cy="72" r="2" fill="#333"/><circle cx="55" cy="72" r="2" fill="#333"/><circle cx="50" cy="77" r="2" fill="#f4b6c2"/><path d="M10 118h80" stroke="#3f7a2f" strokeWidth="4"/></g>,
  heart: <g><path d="M50 108C14 82 20 48 38 48c8 0 12 5 12 9 0-4 4-9 12-9 18 0 24 34-12 60z" fill="#e8b4a0"/><circle cx="36" cy="62" r="3" fill="#fff"/><path d="M30 118h40" stroke="#8a5a3a" strokeWidth="4"/></g>,
  fox: <g><path d="M24 100l-4-46 22 14h16l22-14-4 46-26 14z" fill="#e07b2e"/><path d="M42 100l8 14 8-14z" fill="#fff"/><circle cx="41" cy="82" r="3" fill="#333"/><circle cx="59" cy="82" r="3" fill="#333"/><circle cx="50" cy="96" r="3" fill="#333"/></g>,
  clock: <g><circle cx="50" cy="76" r="34" fill="#fff"/><circle cx="50" cy="76" r="34" fill="none" stroke="#333" strokeWidth="3"/><path d="M50 76V54M50 76l14 8" stroke="#333" strokeWidth="3" strokeLinecap="round"/><circle cx="50" cy="76" r="3" fill="#333"/></g>,
  road: <g><path d="M42 118l8-70 8 70z" fill="#f2c94c"/><path d="M50 52v10M50 72v10M50 92v10" stroke="#fff" strokeWidth="2"/><circle cx="50" cy="38" r="12" fill="#fff"/><path d="M50 26l3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1z" fill="#2f9e6b"/></g>,
  castle: <g><path d="M20 118V70h14v-10h8v10h16v-10h8v10h14v48z" fill="#e7d6f3"/><path d="M20 70h60M30 60l4-12 4 12M62 60l4-12 4 12" stroke="#4a2c66" strokeWidth="2" fill="none"/><path d="M44 118V96a6 6 0 0112 0v22z" fill="#4a2c66"/></g>,
  whale: <g><path d="M12 92c0-22 24-34 50-30 10 2 18 8 24 18l8-8-2 22c-6 18-30 28-56 22-16-4-24-12-24-24z" fill="#5a7da8"/><circle cx="30" cy="84" r="3" fill="#fff"/><path d="M42 54c-4-8-2-14 4-16M48 54c0-8 4-12 10-12" stroke="#cfe8ff" strokeWidth="3" fill="none"/></g>,
  river: <g><path d="M0 84q12-10 25 0t25 0 25 0 25 0v36H0z" fill="#8fd3d3"/><path d="M0 100q12-10 25 0t25 0 25 0 25 0" stroke="#fff" strokeWidth="2" fill="none"/><path d="M30 84V40M44 84V50M58 84V36" stroke="#2f6a3a" strokeWidth="4"/><ellipse cx="30" cy="38" rx="6" ry="12" fill="#4a9e57"/><ellipse cx="58" cy="34" rx="6" ry="12" fill="#4a9e57"/></g>,
  star: <g><path d="M50 40l9 20 22 3-16 15 4 22-19-11-19 11 4-22-16-15 22-3z" fill="#ffe08a"/><path d="M14 122q36-18 72 0" stroke="#7da6ff" strokeWidth="3" fill="none"/></g>,
  horse: <g><path d="M30 118V82c0-22 10-38 28-42l6-10 4 12c8 4 12 14 12 24-8-4-14-2-18 4v48z" fill="#2c2c3a"/><circle cx="64" cy="54" r="2.5" fill="#fff"/><path d="M44 46c-8 8-10 22-8 36" stroke="#6b6b80" strokeWidth="4" fill="none"/></g>,
  flower: <g><path d="M50 120V80" stroke="#3f7a2f" strokeWidth="4"/><g fill="#f4a6c8"><circle cx="50" cy="62" r="9"/><circle cx="38" cy="72" r="9"/><circle cx="62" cy="72" r="9"/><circle cx="42" cy="54" r="9"/><circle cx="58" cy="54" r="9"/></g><circle cx="50" cy="66" r="7" fill="#ffd54a"/><path d="M50 100q-14-6-18-16M50 104q14-6 18-16" stroke="#3f7a2f" strokeWidth="3" fill="none"/></g>,
  candle: <g><rect x="40" y="70" width="20" height="48" rx="3" fill="#fff"/><path d="M50 40c-9 10-9 18 0 24 9-6 9-14 0-24z" fill="#ffb02e"/><path d="M50 50c-4 5-4 9 0 12 4-3 4-7 0-12z" fill="#ffe08a"/><path d="M26 118h48" stroke="#fff" strokeWidth="4"/></g>,
}

export function Cover({ art, a, b, title, className }: { art: string; a: string; b: string; title: string; className?: string }) {
  const id = 'kglc-' + art
  return (
    <svg className={className} viewBox="0 0 100 140" role="img" aria-label={'Cover of ' + title} preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient></defs>
      <rect width="100" height="140" rx="6" fill={`url(#${id})`} />
      <rect x="4" y="4" width="92" height="132" rx="4" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.5" />
      <g transform="translate(0 6)">{ART[art] ?? ART.star}</g>
      <rect x="6" y="6" width="5" height="128" fill="#000" opacity=".12" />
    </svg>
  )
}
