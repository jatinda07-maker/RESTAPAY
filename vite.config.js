import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('xlsx')) return 'xlsx'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('react') || id.includes('scheduler')) return 'react-vendor'
          if (id.includes('lucide-react')) return 'icons'
          return 'vendor'
        }
      }
    }
  }
})
