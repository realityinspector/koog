import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './midi/connection' // side effect: opens MIDI once, survives HMR
import './index.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
