import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/proxy': {
        // 使用 HTTPS 域名而非 HTTP IP（Cloudflare 強制 HTTPS）
        target: 'https://auto.yourspce.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/proxy/, '')
      }
    }
  }
})
