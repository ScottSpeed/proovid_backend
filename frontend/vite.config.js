import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Emergency fix: Use .de domain (has valid SSL certificate)
    'import.meta.env.VITE_API_URL': '"https://api.proovid.de"'
  }
})