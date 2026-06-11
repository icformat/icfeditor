/**
 * Renders the ICF Editor logo SVG into the raster icons electron-builder and
 * Electron need: `build/icon.png` (1024×1024 — Linux, and the source macOS
 * derives `.icns` from) and a multi-resolution `build/icon.ico` (Windows).
 *
 * Pure JS: `@resvg/resvg-js` (no system rasterizer) + `png-to-ico`. Run via
 * `npm run icons` (invoked automatically by the `package` scripts).
 */
import { Resvg } from '@resvg/resvg-js'
import pngToIco from 'png-to-ico'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(resolve(root, 'src/renderer/src/assets/editor-logo.svg'), 'utf-8')
const buildDir = resolve(root, 'build')
mkdirSync(buildDir, { recursive: true })

/** Renders the (square) SVG to a PNG buffer at the given pixel width. */
function renderPng(size) {
  // No background → transparency is preserved (transparent logo variant).
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()
}

// Linux app icon + macOS source (electron-builder derives .icns from a large PNG).
writeFileSync(resolve(buildDir, 'icon.png'), renderPng(1024))

// Windows multi-size .ico.
const icoSizes = [16, 24, 32, 48, 64, 128, 256]
writeFileSync(resolve(buildDir, 'icon.ico'), await pngToIco(icoSizes.map(renderPng)))

console.log('Generated build/icon.png (1024) and build/icon.ico')
