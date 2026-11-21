// Photos for the presentation (public/synth-pics/*.jpg). Every one is public domain or Creative Commons, copied from Wikimedia
// Commons at 640 px wide. The credit line shows under the picture. Add a photo = drop the file in public/synth-pics and add a row here.
export interface Pic { file: string; alt: string; by: string; license: string; page: string }
const C = (t: string) => 'https://commons.wikimedia.org/wiki/File:' + t.replace(/ /g, '_')
export const PICS = {
  tube: { file: 'tube.jpg', alt: 'A glass vacuum tube', by: 'Masaki Ikeda', license: 'Public domain', page: C('RCA ’808’ Power Vacuum Tube.jpg') },
  novachord: { file: 'novachord.jpg', alt: 'Inside a Novachord: rows of vacuum tubes', by: 'Hollow Sun', license: 'CC BY 3.0', page: C('Novachord insides1.jpg') },
  moog: { file: 'moog.jpg', alt: 'Bob Moog', by: 'Moog Music / Norlin', license: 'Public domain', page: C('Bob Moog3.jpg') },
  minimoog: { file: 'minimoog.jpg', alt: 'A Minimoog Model D synthesizer', by: '1904.CC', license: 'CC BY 4.0', page: C('Minimoog Model D Synthesizer at SMEM Playroom.jpg') },
  sid: { file: 'sid.jpg', alt: 'The MOS 6581 SID sound chip', by: 'mariom990', license: 'Public domain', page: C('MOS Technology SID 6581.jpg') },
  z80: { file: 'z80.jpg', alt: 'A Zilog Z80 processor chip', by: 'Gennadiy Shvets', license: 'CC BY 2.5', page: C('Zilog Z80.jpg') },
  m68000: { file: 'm68000.jpg', alt: 'The silicon die of a Motorola 68000 processor', by: 'Pauli Rautakorpi', license: 'CC BY 3.0', page: C('Motorola 68000 die.JPG') },
  ym2612: { file: 'ym2612.jpg', alt: 'A Yamaha YM2612 FM sound chip', by: 'Baz1521', license: 'CC BY-SA 3.0', page: C('Yamaha YM2612 chip.jpg') },
  dx7: { file: 'dx7.jpg', alt: 'A Yamaha DX7 synthesizer', by: 'Finnianhughes101', license: 'Public domain', page: C('YAMAHA DX7.jpg') },
  k250: { file: 'k250.jpg', alt: 'A Kurzweil K250', by: 'Ellen / Clusternote', license: 'CC BY 2.0', page: C('Kurzweil K250 (small).jpg') },
  voyager: { file: 'voyager.jpg', alt: 'A Minimoog Voyager with its touch pad', by: 'Kimi95', license: 'CC BY 3.0', page: C('Minimoog voyager.jpg') },
  fairlight: { file: 'fairlight.jpg', alt: 'A Fairlight CMI', by: 'Thomas Kriese', license: 'CC BY 2.0', page: C('Fairlight CMI.jpg') },
} satisfies Record<string, Pic>
export type PicId = keyof typeof PICS
export const picUrl = (id: PicId) => '/synth-pics/' + PICS[id].file
