import type { Monaco } from '@monaco-editor/react'
import { useDocumentStore } from '../stores/documentStore'
import { resolveFieldAt } from '../utils/recordFieldAt'

let registered = false

/**
 * Registers the View-mode hover tooltip for ICF: hovering a record value shows
 * its schema key (e.g. `InvoiceNo`), and hovering a master id / `Type:Id`
 * reference shows the full master record as a key/value table. Disabled in Edit
 * mode (per the requirement) and only active when the document parses.
 *
 * Registered once per Monaco instance; reads the active document from the store
 * (the single editor always shows the active document).
 */
export function registerIcfHover(monaco: Monaco): void {
  if (registered) return
  registered = true

  monaco.languages.registerHoverProvider('icf', {
    provideHover(model, position) {
      const active = useDocumentStore.getState().active()
      if (!active || active.mode !== 'view' || !active.parsed) return null

      const info = resolveFieldAt(model.getValue(), position.lineNumber, position.column, active.parsed)
      if (!info) return null

      const contents: Array<{ value: string }> = []
      if (info.master) {
        const heading = info.fieldName
          ? `**${info.master.type}** master — \`${info.fieldName}\``
          : `**${info.master.type}** master`
        const rows = info.master.fields.map((f) => `| ${f.key} | ${f.value} |`).join('\n')
        contents.push({ value: `${heading}\n\n| Field | Value |\n| --- | --- |\n${rows}` })
      } else if (info.fieldName) {
        contents.push({ value: `**${info.fieldName}**` })
      }
      if (contents.length === 0) return null

      return {
        range: new monaco.Range(position.lineNumber, info.startColumn, position.lineNumber, info.endColumn),
        contents
      }
    }
  })
}
