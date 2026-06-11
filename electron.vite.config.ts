import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

/**
 * Injects the production Content-Security-Policy into index.html at build time
 * only. In dev (`ctx.server` is set) it is skipped so Vite's inline
 * React-refresh preamble is not blocked — a `script-src 'self'` meta there
 * leaves the renderer blank. Production ships no remote code and treats ICF
 * content as untrusted data.
 */
function injectCsp(): Plugin {
  const csp =
    "default-src 'self'; script-src 'self'; worker-src 'self' blob:; " +
    "style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:;"
  return {
    name: 'inject-csp',
    transformIndexHtml(html, ctx) {
      if (ctx.server) return html
      return html.replace(
        '</title>',
        `</title>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`
      )
    }
  }
}

/**
 * electron-vite drives three independent builds: the Electron main process,
 * the preload bridge, and the React renderer. Each gets its own Rollup config.
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve('src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts') }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react(), injectCsp()],
    build: {
      rollupOptions: {
        input: { index: resolve('src/renderer/index.html') }
      }
    }
  }
})
