import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/progress/' : '/',
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3002' } },
})
