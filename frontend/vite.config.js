import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Use proovid.de API - works reliably, CORS configured for proovid.ai frontend
    'import.meta.env.VITE_API_URL': '"https://api.proovid.de"'
  }
})