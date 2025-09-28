import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Override VITE_API_URL to empty string for direct backend access
    'import.meta.env.VITE_API_URL': '""'
  }
})