// Regenerates the Koog Alien static assets: npx tsx scripts/mascot-assets.ts
import { writeFileSync } from 'node:fs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { KoogAlien, KoogAlienIcon } from '../src/brand/mascot/KoogAlien'
import { MOODS, POSES, KOOG_ALIEN_COLORS as C, poseLabel } from '../src/brand/mascot/alienData'

const strip = (s: string) => s.replace(/ data-(pose|mood)="[^"]*"/g, '')
const svg = (p: any, extra = '') => strip(renderToStaticMarkup(h(KoogAlien, p))).replace('<svg ', `<svg ${extra}`)

writeFileSync('public/koog-alien.svg', svg({ pose: 'wave', size: 400 }) + '\n')
const icon = renderToStaticMarkup(h(KoogAlienIcon, { size: 64 })).replace('fill="currentColor"', `fill="${C.plum}"`)
writeFileSync('public/koog-alien-icon.svg', icon + '\n')

const cw = 190, ch = 240
const cells: string[] = []
const nest = (p: any, x: number, y: number, w: number) => {
  const s = svg({ ...p, size: w, labelled: false }).replace(/ width="[^"]*"/, ` x="${x}" y="${y}" width="${w}"`).replace(/ height="[^"]*"/, ` height="${w * 1.1}"`).replace(/ style="[^"]*"/, '')
  return s.replace(/ id="/g, ` id="${p.pose}${p.mood}`).replace(/url\(#/g, `url(#${p.pose}${p.mood}`).replace(/ aria-hidden="true"/, '')
}
POSES.forEach((pose, i) => {
  const x = 30 + i * cw
  cells.push(nest({ pose, mood: 'happy' }, x, 90, 160), `<text x="${x + 80}" y="285" text-anchor="middle" class="l">${poseLabel(pose)}</text>`)
})
MOODS.forEach((mood, i) => {
  const x = 30 + i * cw
  cells.push(nest({ pose: 'wave', mood }, x, 360, 160), `<text x="${x + 80}" y="555" text-anchor="middle" class="l">${mood}</text>`)
})
cells.push(`<g transform="translate(${30 + 5 * cw + 20} 400)" color="${C.cream}">${[16, 24, 32, 48].map((s, i) => `<g transform="translate(${i * 0} ${i * 0})"></g>`).join('')}</g>`)
const iconRow = [16, 24, 32, 48].map((s, i) => `<g transform="translate(${1010 + i * 0} ${0})"></g>`).join('')
void iconRow
const tiny = [16, 24, 32, 48].map((s, i) => {
  const x = 30 + 5 * cw + 10 + (i % 2) * 70, y = 380 + Math.floor(i / 2) * 80
  return renderToStaticMarkup(h(KoogAlienIcon, { size: s })).replace('<svg ', `<svg x="${x}" y="${y}" `).replace(/ style="[^"]*"/, '').replace('fill="currentColor"', `fill="${C.cream}"`) + `<text x="${x + s / 2}" y="${y + s + 16}" text-anchor="middle" class="l" style="font-size:11px">${s}px</text>`
}).join('')
const W = 30 * 2 + 8 * cw
const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 620" width="${W}" height="620" role="img" aria-label="Koog Alien character sheet: eight poses and five moods">
<title>The Koog Alien: character sheet</title>
<style>.l{font:700 17px system-ui,sans-serif;fill:#fff4d8;text-transform:capitalize}.h{font:800 30px system-ui,sans-serif;fill:#ffc35a}.s{font:600 14px system-ui,sans-serif;fill:#b9b0ff}</style>
<rect width="${W}" height="620" rx="22" fill="#1b1430"/>
<text x="30" y="46" class="h">The Koog Alien</text><text x="30" y="68" class="s">Poses (happy)</text>
<text x="30" y="340" class="s">Moods (waving)</text><text x="${30 + 5 * cw + 10}" y="340" class="s">One-colour icon</text>
${cells.join('\n')}
${tiny}
</svg>
`
writeFileSync('docs/images/koog-alien-sheet.svg', out)
console.log('ok', out.length)
