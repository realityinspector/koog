import { createRoot } from 'react-dom/client'
import '../ui/tokens.css'
import './teacher.css'
import { Teacher } from './Teacher'

createRoot(document.getElementById('root')!).render(<Teacher />)
