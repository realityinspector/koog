import { useEffect, useState } from 'react'
import { getSynth } from '../synth-history/engine'
import type { SynthParams } from '../synth-history/params'
/** live Koog synth parameters */
export function useSyncParams(): SynthParams {
  const [p, setP] = useState<SynthParams>(() => ({ ...getSynth().params }))
  useEffect(() => getSynth().onParams?.((x) => setP({ ...x })), [])
  return p
}
