/// <reference types="vite/client" />

/** App version injected at build time from package.json (both build configs). */
declare const __APP_VERSION__: string

// Vite's client types declare the `*?worker` import form used in monacoSetup.ts.

// `edcore.main` (editor core + all contributions, no languages) ships no .d.ts,
// so alias its types to the editor API surface it re-exports.
declare module 'monaco-editor/esm/vs/editor/edcore.main' {
  export * from 'monaco-editor/esm/vs/editor/editor.api'
}
