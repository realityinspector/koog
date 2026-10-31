import { useEffect } from 'react'
import { startStack } from './stack'

/** Mount once inside .kg-display: starts the bottom-stack measuring (see stack.ts and the map in instrument.css). */
export function StackLayout() {
  useEffect(() => startStack(), [])
  return null
}
