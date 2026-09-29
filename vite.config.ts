import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'pockit-offline-assets',
      generateBundle(_options, bundle) {
        const assets = Object.keys(bundle)
          .filter((name) => name.startsWith('assets/') && /\.(?:js|css|woff2?|png|svg)$/.test(name))
          .map((name) => `/${name}`)
        this.emitFile({
          type: 'asset',
          fileName: 'offline-assets.json',
          source: JSON.stringify(assets),
        })
      },
    },
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@supabase/')) return 'supabase'
          if (id.includes('node_modules/lucide-react/')) return 'icons'
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/'))
            return 'react'
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts', 'api/**/*.test.ts'],
  },
})
