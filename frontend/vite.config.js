import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backend = process.env.API_TARGET || 'http://127.0.0.1:3000'
const media = process.env.MEDIA_TARGET || 'http://127.0.0.1:8888'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/img': { target: media, changeOrigin: true },
      '/gif': { target: media, changeOrigin: true }
    }
  },
  build: {
    modulePreload: {
      resolveDependencies: (filename, deps) => {
        // Exclude heavy 860kB exercise-db from initial index.html modulepreload
        return deps.filter(dep => !dep.includes('exercise-db'))
      }
    },
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('exercises-data.js')) {
            return 'exercise-db'
          }
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react'
            }
            if (id.includes('zustand')) {
              return 'vendor-state'
            }
          }
        }
      }
    }
  }
})