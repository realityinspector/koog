/** Koog's line icons: one stroke weight, currentColor, 24-unit grid. Used for chrome (rail, strip, visual controls); content keeps its emoji. */
const P: Record<string, string> = {
  keys: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M9 5v8 M15 5v8 M12 13v6 M9 13v6 M15 13v6',
  note: 'M9 17V5l11-2v12 M9 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M20 15a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0z M8 6H5.5a2.5 2.5 0 0 0 2.6 4 M16 6h2.5a2.5 2.5 0 0 1-2.6 4 M12 13v4 M8 20h8 M9.5 17h5v3h-5z',
  game: 'M7 8h10a4.5 4.5 0 0 1 4.4 5.5l-.6 2.7a2.3 2.3 0 0 1-3.9 1.1L15 15.5H9l-1.9 1.8a2.3 2.3 0 0 1-3.9-1.1l-.6-2.7A4.5 4.5 0 0 1 7 8z M8 10.5v3 M6.5 12h3 M15.5 11.5h.01 M17.5 13h.01',
  drum: 'M4 9c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z M4 9v7c0 1.7 3.6 3 8 3s8-1.3 8-3V9 M8 12v6 M16 12v6 M8.5 2.5L11 6 M15.5 2.5L13 6',
  knobs: 'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M10.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z M18.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z M8 10L6.6 8.6 M16 10l-1.4-1.4 M6 16h12',
  wrench: 'M14.7 6.3a4 4 0 0 0-5.3 5.3L4 17v3h3l5.4-5.4a4 4 0 0 0 5.3-5.3l-2.4 2.4-2.6-.4-.4-2.6z',
  sliders: 'M6 4v16 M12 4v16 M18 4v16 M4 14h4 M10 8h4 M16 12h4',
  phones: 'M4 15v-3a8 8 0 0 1 16 0v3 M4 15h3v5H5a1 1 0 0 1-1-1z M20 15h-3v5h2a1 1 0 0 0 1-1z',
  loop: 'M17 2l3 3-3 3 M4 11v-1a5 5 0 0 1 5-5h11 M7 22l-3-3 3-3 M20 13v1a5 5 0 0 1-5 5H4',
  scenes: 'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M3 9h18 M8 4l2 5 M14 4l2 5',
  speaker: 'M4 9h3.5L12 5v14l-4.5-4H4z M15.5 9a4 4 0 0 1 0 6 M18 6.5a7.5 7.5 0 0 1 0 11',
  mute: 'M4 9h3.5L12 5v14l-4.5-4H4z M16 9.5l5 5 M21 9.5l-5 5',
  sheet: 'M3 6h18 M3 10h18 M3 14h18 M3 18h18 M15 6v8 M15 14a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  bulb: 'M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z',
  help: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.6v.4 M12 17h.01',
  lock: 'M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z M8 11V8a4 4 0 0 1 8 0v3',
  spark: 'M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
  palette: 'M12 3a9 9 0 0 0 0 18c1 0 1.5-.7 1.5-1.4 0-.9-.7-1.3-.7-2.2 0-.9.7-1.5 1.6-1.5H16a5 5 0 0 0 5-5C21 6.5 17 3 12 3z M7.5 11h.01 M10 7h.01 M14.5 7h.01 M17 10.5h.01',
  expand: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
  burst: 'M12 2v5 M12 17v5 M2 12h5 M17 12h5 M5 5l3 3 M16 16l3 3 M5 19l3-3 M16 8l3-3',
  plug: 'M9 2v5 M15 2v5 M7 7h10v3a5 5 0 0 1-10 0z M12 15v7',
  user: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M4 21a8 8 0 0 1 16 0',
  down: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12 M18 6L6 18',
}
export type IconName = keyof typeof P

export function Icon({ name, size = 18, className }: { name: IconName | string; size?: number; className?: string }) {
  const d = P[name]
  if (!d) return null
  return (
    <svg className={'k-ic' + (className ? ' ' + className : '')} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  )
}
