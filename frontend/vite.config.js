import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Use actual ALB endpoint (HTTP since no SSL cert on ALB)
    'import.meta.env.VITE_API_URL': '"http://ui-proov-alb-1535367426.eu-central-1.elb.amazonaws.com"'
  }
})