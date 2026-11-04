// Per-player storage for the Kore. Defaults to the profile store (pload/psave); tests swap in a memory map with setKV.
import { pload, psave } from '../../profile/profile'

interface KV { load<T>(key: string, fallback: T): T; save(key: string, value: unknown): void }
const real: KV = { load: pload, save: psave }
let impl: KV = real
export const kvLoad = <T,>(key: string, fallback: T): T => impl.load(key, fallback)
export const kvSave = (key: string, value: unknown) => impl.save(key, value)
export const setKV = (kv: KV | null) => { impl = kv ?? real }
/** the namespaced key an app's own data lives under */
export const appKey = (appId: string, key: string) => `kore.${appId}.${key}`
