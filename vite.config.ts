import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, host: 'localhost' },
  // two pages: the app (/) and the teacher demo (/teacher/)
  build: { rollupOptions: { input: { main: 'index.html', teacher: 'teacher/index.html' } } },
})
