import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/meeting-api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/meeting-api/, ''),
      },
    },
  },
  build: {
    // The official LiveKit client is shipped as a single bundled module (~545 kB).
    // Keep an explicit budget rather than pretending it can be split internally.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
            {
              name: 'livekit-client',
              test: /node_modules[\\/]livekit-client[\\/]/,
            },
            {
              name: 'livekit-components',
              test: /node_modules[\\/]@livekit[\\/]components/,
            },
            {
              name: 'livekit-protocol',
              test: /node_modules[\\/](@livekit[\\/]protocol|@bufbuild)[\\/]/,
            },
          ],
        },
      },
    },
  },
})
