import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const rendererRoot = fileURLToPath(new URL('./src/renderer', import.meta.url))

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': rendererRoot
      }
    },
    plugins: [react(), tailwindcss()],
    root: rendererRoot,
    build: {
      rollupOptions: {
        input: { index: `${rendererRoot}/index.html` }
      }
    }
  }
})
