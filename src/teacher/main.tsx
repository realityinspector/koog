import { createRoot } from 'react-dom/client'
import '../ui/tokens.css'
import './teacher.css'
import { isWebDemo, isUnlocked } from '../web/webDemo'
import { Teacher } from './Teacher'

if (isWebDemo() && !isUnlocked()) {
  location.replace('../')
} else {
  createRoot(document.getElementById('root')!).render(<Teacher />)
}
