// The shelf: book metadata (small, always loaded) and the lazy edition loader (each book is its own chunk, fetched from this app's own files, never the network).
import meta from '../../../koogalien/library/catalog.json'
import type { Edition } from '../../../koogalien/library/types'

export interface BookMeta {
  id: string; title: string; author: string; year: number; source: number; blurb: string
  cover: { a: string; b: string; art: string }
  chapters: number; totalChapters: number; partial: boolean; lines: number; bytes: number
}
export const BOOKS: BookMeta[] = meta as BookMeta[]
const loaders = import.meta.glob('../../../koogalien/library/editions/*.json') as Record<string, () => Promise<{ default: Edition }>>

export async function loadEdition(id: string): Promise<Edition | null> {
  const key = Object.keys(loaders).find((k) => k.endsWith('/' + id + '.json'))
  if (!key) return null
  const m = await loaders[key]()
  const e = m.default
  return e && Array.isArray(e.chapters) ? e : null
}
