import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/proxy': {
        target: 'http://34.83.87.103',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/proxy/, '')
      }
    }
  }
})
