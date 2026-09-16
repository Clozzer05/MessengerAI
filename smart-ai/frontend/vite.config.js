import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Some third-party packages ship Next.js directives like "use client".
        // Vite/Rollup ignores them for SPA builds, so silence this noisy warning.
        if (
          warning?.code === 'MODULE_LEVEL_DIRECTIVE' &&
          typeof warning?.message === 'string' &&
          warning.message.includes("'use client'")
        ) {
          return
        }
        warn(warning)
      },
    },
  },
  define: {
    global: 'window',
    'process.env': {},
  },
  resolve: {
    alias: {
      events: 'events',
      stream: 'readable-stream',
      buffer: 'buffer',
      process: 'process/browser',
    },
  },
  optimizeDeps: {
    include: ['buffer', 'events', 'readable-stream', 'process/browser', 'simple-peer', 'phaser', 'colyseus.js'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5001',
        ws: true,
      },
      '/uploads': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/colyseus': {
        target: 'ws://localhost:2567',
        ws: true,
        rewrite: (path) => path.replace(/^\/colyseus/, ''),
      },
    },
  },
})
