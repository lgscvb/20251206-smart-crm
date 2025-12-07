import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/proxy': {
        target: 'https://auto.yourspce.org',
        changeOrigin: true,
        secure: false,  // 允許自簽憑證
        rewrite: (path) => path.replace(/^\/proxy/, '')
      }
    }
  }
})
