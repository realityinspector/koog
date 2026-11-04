// The Dancer's name, chosen by the kid ("✎ Name him" next to the VISUAL menu). Saved per player in this browser only.
import { create } from 'zustand'
import { pkey, useProfile } from '../../profile/profile'

export const NAME_MAX = 16
const KEY = 'dancer.name'

/** keep letters, numbers, spaces and a little punctuation; trim to NAME_MAX */
export function cleanName(s: string): string {
  return s.replace(/[^\p{L}\p{N} '.!-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX)
}

const read = () => { try { return cleanName(localStorage.getItem(pkey(KEY)) ?? '') } catch { return '' } }

export const useDancerName = create<{ name: string }>()(() => ({ name: read() }))

export function setDancerName(s: string) {
  const name = cleanName(s)
  try { if (name) localStorage.setItem(pkey(KEY), name); else localStorage.removeItem(pkey(KEY)) } catch { /* ignore */ }
  useDancerName.setState({ name })
}

// a different player has their own dancer name
useProfile.subscribe(() => useDancerName.setState({ name: read() }))
