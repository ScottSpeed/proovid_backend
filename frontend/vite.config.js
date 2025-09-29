import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Use proovid.de domain for API calls
    'import.meta.env.VITE_API_URL': '"https://api.proovid.de"'
  }
})