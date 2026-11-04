// Koding Kore: the SDK + runtime every Koog Kode app runs on. Docs: docs/KODING_KORE.md
//   import { listApps, getApp, STORE_NAME } from '../kode/kore'      light: types, registry, brand (safe for the store)
//   import { createKore } from '../kode/kore/sdk'                    the SDK (pulls in audio); KoreRunner does this for you
export * from './types'
export { STORE_NAME, KORE_NAME } from './brand'
export { registerApp, listApps, getApp, unregisterApp, validateApp, CONCEPT_IDS } from './registry'
export { CONCEPT_INFO } from './concepts'
export { resolveMotif } from './motifs'
import './apps'
