import type { Monaco } from '@monaco-editor/react'

/** Registered once per Monaco instance. */
let registered = false

/**
 * Registers a lightweight ICF/ICX language with Monaco: directive/section
 * highlighting, the `=`/`-` row markers, master references, field lists, and
 * `<<TAG ... TAG>>` text blocks, plus matching light/dark themes that read our
 * design tokens. Highlighting only — parsing/validation come from `icf.js`.
 */
export function registerIcfLanguage(monaco: Monaco): void {
  if (registered) return
  registered = true

  monaco.languages.register({ id: 'icf', extensions: ['.icf', '.icx'], aliases: ['ICF', 'icf'] })

  monaco.languages.setMonarchTokensProvider('icf', {
    defaultToken: '',
    tokenizer: {
      root: [
        // Section markers and directives.
        [/^@(kind|version|encoding|delimiter|escape|schema|masters|data|metadata|record)\b.*$/, 'keyword.section'],
        [/^@[a-zA-Z][\w.-]*/, 'keyword.directive'],
        // Text block open: switch into verbatim state.
        [/^(\s*)(<<)([A-Za-z_][\w]*)\s*$/, ['', 'delimiter.block', { token: 'type.block', next: '@textblock.$3' }]],
        // Field lists [a, b, c].
        [/\[[^\]]*\]/, 'variable.field'],
        // Row markers.
        [/^\s*=/, 'operator.row'],
        [/^\s*-/, 'operator.row'],
        // Master reference Type:Id within values.
        [/\b[A-Za-z_][\w]*:[A-Za-z0-9_-]+/, 'string.ref'],
        // Object / collection names ending in a colon.
        [/^\s*[A-Za-z_][\w]*\[\]:/, 'type.collection'],
        [/^\s*[A-Za-z_][\w]*:/, 'type.object'],
        [/#.*$/, 'comment']
      ],
      textblock: [
        // Close when we hit `TAG>>` for the captured tag.
        [/^\s*([A-Za-z_]\w*)>>\s*$/, { cases: { '$1==$S2': { token: 'type.block', next: '@pop' }, '@default': 'string' } }],
        [/.*$/, 'string']
      ]
    }
  })

  const rules = [
    { token: 'keyword.section', foreground: '569cd6', fontStyle: 'bold' },
    { token: 'keyword.directive', foreground: 'c586c0' },
    { token: 'type.object', foreground: '4ec9b0' },
    { token: 'type.collection', foreground: '4ec9b0', fontStyle: 'bold' },
    { token: 'type.block', foreground: 'dcdcaa' },
    { token: 'variable.field', foreground: '9cdcfe' },
    { token: 'operator.row', foreground: 'd7ba7d' },
    { token: 'string.ref', foreground: 'ce9178' },
    { token: 'comment', foreground: '6a9955', fontStyle: 'italic' }
  ]

  monaco.editor.defineTheme('icf-dark', {
    base: 'vs-dark',
    inherit: true,
    rules,
    colors: { 'editor.background': '#1e1e1e' }
  })
  monaco.editor.defineTheme('icf-light', {
    base: 'vs',
    inherit: true,
    rules: rules.map((r) => ({ ...r, foreground: r.foreground })),
    colors: { 'editor.background': '#ffffff' }
  })
}
