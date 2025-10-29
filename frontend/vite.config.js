import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Use consistent .ai domain for both frontend and backend API
    'import.meta.env.VITE_API_URL': '"https://api.proovid.ai"'
  }
})