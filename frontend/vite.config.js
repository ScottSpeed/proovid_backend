import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Use CloudFront distribution for HTTPS (solves mixed content error!)
    'import.meta.env.VITE_API_URL': '"https://d3blru1vbxsdqh.cloudfront.net"'
  }
})