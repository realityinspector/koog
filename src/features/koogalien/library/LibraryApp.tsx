// Store frame wrapper: gives the Library a host made from the Kore. (A Koogalien tab can also mount ./Library with its own host.)
import { useMemo } from 'react'
import { makeHost } from '../host'
import Library from './Library'

export default function LibraryApp({ kore }: { kore: unknown }) {
  const host = useMemo(() => makeHost(kore), [kore])
  return <Library host={host} />
}
