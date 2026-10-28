import { create } from 'zustand'

export interface NoteEvent {
  id: number
  note: number
  name: string
  velocity: number
  on: boolean
}

export interface AppState {
  // persisted (sessionStorage)
  counter: number
  text: string
  recentNotes: NoteEvent[]
  // not persisted
  midiSupported: boolean
  midiConnected: boolean
  midiInputName: string | null
  midiOutputName: string | null
  midiError: string | null
}

const KEY = 'koog:state:v1'
const PERSISTED = ['counter', 'text', 'recentNotes'] as const

function load(): Partial<AppState> {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const initial: AppState = {
  counter: 0,
  text: '',
  recentNotes: [],
  midiSupported: true,
  midiConnected: false,
  midiInputName: null,
  midiOutputName: null,
  midiError: null,
  ...load(),
}

// The instance lives in import.meta.hot.data so it survives edits to this file.
// Add new state fields by extending AppState; call useAppStore.setState({...}) from anywhere.
const hot = import.meta.hot
export const useAppStore = (hot?.data.store as ReturnType<typeof makeStore> | undefined) ?? makeStore()

function makeStore() {
  const store = create<AppState>()(() => initial)
  let t: number | undefined
  store.subscribe((s) => {
    clearTimeout(t)
    t = window.setTimeout(() => {
      try {
        const out: Record<string, unknown> = {}
        for (const k of PERSISTED) out[k] = s[k]
        sessionStorage.setItem(KEY, JSON.stringify(out))
      } catch { /* storage unavailable */ }
    }, 100)
  })
  // flush on unload so a full reload never loses the last edit
  window.addEventListener('pagehide', () => {
    const s = store.getState()
    try {
      const out: Record<string, unknown> = {}
      for (const k of PERSISTED) out[k] = s[k]
      sessionStorage.setItem(KEY, JSON.stringify(out))
    } catch { /* ignore */ }
  })
  return store
}

// Vite only detects the literal `import.meta.hot.accept(` text, so keep it spelled out.
if (import.meta.hot) {
  import.meta.hot.data.store = useAppStore
  import.meta.hot.accept()
}
