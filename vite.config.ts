import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/roblox': {
        target: 'https://apis.roblox.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/roblox/, ''),
        secure: false,
      },
      '/api/games': {
        target: 'https://games.roblox.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/games/, ''),
      },
      '/api/thumbnails': {
        target: 'https://thumbnails.roblox.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/thumbnails/, ''),
      }
    }
  }
})
