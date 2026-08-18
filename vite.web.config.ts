import { readFileSync } from 'node:fs'
import { rename } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

/**
 * Standalone Vite config for the **web build** of the ICF Editor — the same
 * renderer as the desktop app, bundled as a static site for icformat.org
 * (deployed by copying `dist-web/` to the site's `/editor/` folder). The
 * desktop (Electron) build stays in electron.vite.config.ts; this config
 * exists so `npm run build:web` needs no Electron at all.
 */

/** Same production CSP as the desktop renderer (see electron.vite.config.ts). */
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

/** The entry is web.html (index.html belongs to the desktop build) — publish it as index.html. */
function publishAsIndexHtml(outDir: string): Plugin {
  return {
    name: 'publish-as-index-html',
    async closeBundle() {
      // closeBundle also runs when the build FAILED (nothing was written) —
      // swallow the missing-file case so the real build error surfaces.
      await rename(resolve(outDir, 'web.html'), resolve(outDir, 'index.html')).catch(() => {})
    }
  }
}

const outDir = resolve(import.meta.dirname, 'dist-web')

export default defineConfig({
  root: 'src/renderer',
  define: {
    __APP_VERSION__: JSON.stringify(
      (JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf-8')) as {
        version: string
      }).version
    )
  },
  // Relative asset URLs so the app works from any mount point (e.g. /editor/).
  base: './',
  resolve: {
    alias: {
      '@renderer': resolve(import.meta.dirname, 'src/renderer/src'),
      '@shared': resolve(import.meta.dirname, 'src/shared')
    }
  },
  plugins: [react(), injectCsp(), publishAsIndexHtml(outDir)],
  build: {
    // Modern baseline: esbuild ≥0.28 no longer down-levels to vite 5's legacy
    // default targets, and the editor assumes current browsers anyway (File
    // System Access API, Monaco).
    target: 'es2022',
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: { web: resolve(import.meta.dirname, 'src/renderer/web.html') }
    }
  }
})
