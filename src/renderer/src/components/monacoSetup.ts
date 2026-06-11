// Import `edcore.main` — the editor core PLUS all editor contributions (hover,
// find, folding, suggestions…) but WITHOUT the bundled language grammars/workers
// (TS/JSON/CSS/HTML/…). ICF is a custom Monarch language we register ourselves.
// NB: the bare `editor.api` entry omits the contributions, which silently breaks
// features like the hover tooltip — `edcore.main` keeps them while still
// dropping the languages, so the bundle stays far smaller than the full barrel.
import * as monaco from 'monaco-editor/esm/vs/editor/edcore.main'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { loader } from '@monaco-editor/react'

/**
 * Wires `@monaco-editor/react` to the **bundled** editor API instead of its
 * default CDN loader. A desktop app must run fully offline and under the strict
 * CSP (`default-src 'self'`), so no remote fetch is allowed. Only the core
 * editor worker is needed (no language workers). Import this once before the
 * first <Editor> renders.
 */
self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker()
  }
}

loader.config({ monaco })
