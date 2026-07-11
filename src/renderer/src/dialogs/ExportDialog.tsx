import { useEffect, useState } from 'react'
import { Dialog, DialogButton } from './Dialog'
import { useDocumentStore } from '../stores/documentStore'
import { services } from '../services/container'
import type { ExportFormat } from '../models/export'
import { stripExtension } from '../utils/format'

const FORMATS: Array<{ id: ExportFormat; label: string }> = [
  { id: 'icf', label: 'ICF' },
  { id: 'icfResolved', label: 'ICF (resolved — defaults & overrides applied)' },
  { id: 'icx', label: 'ICX index' },
  { id: 'jsonPretty', label: 'JSON (pretty)' },
  { id: 'jsonCompact', label: 'JSON (compact)' },
  { id: 'csv', label: 'CSV' },
  { id: 'xml', label: 'XML' },
  { id: 'yaml', label: 'YAML' }
]

/** Export dialog (Prompt.md §Export). Serializes via ExportService, saves via IPC. */
export function ExportDialog({ onClose }: { onClose: () => void }) {
  const active = useDocumentStore((s) => s.documents.find((d) => d.id === s.activeId) ?? null)
  const [format, setFormat] = useState<ExportFormat>('jsonPretty')
  const [status, setStatus] = useState<string | null>(null)
  const [preview, setPreview] = useState('')

  // Export is async (ICX computes checksums + positions), so the preview is
  // recomputed in an effect whenever the format or document changes.
  useEffect(() => {
    let live = true
    if (!active?.parsed) {
      setPreview('')
      return
    }
    void services.export
      .export(active.parsed, format, { sourceFileName: active.fileName, sourceText: active.text })
      .then((result) => {
        if (live) setPreview(result.content.slice(0, 600))
      })
    return () => {
      live = false
    }
  }, [active?.parsed, active?.text, active?.fileName, format])

  const doExport = async () => {
    if (!active?.parsed) return
    const result = await services.export.export(active.parsed, format, {
      sourceFileName: active.fileName,
      sourceText: active.text
    })
    const base = stripExtension(active.fileName)
    const target = await window.api.saveFileDialog(`${base}.${result.extension}`)
    if (!target) return
    await window.api.writeFile(target, result.content)
    setStatus(`Exported to ${target}`)
  }

  return (
    <Dialog
      title="Export"
      width={640}
      onClose={onClose}
      footer={
        <>
          <DialogButton onClick={onClose}>Close</DialogButton>
          <DialogButton onClick={doExport} variant="primary" disabled={!active?.parsed}>
            Export…
          </DialogButton>
        </>
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-app-muted">Format</span>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as ExportFormat)}
          className="rounded border border-app-border bg-app-bg px-2 py-1"
        >
          {FORMATS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-1 text-app-muted">Preview</div>
      <pre className="max-h-64 overflow-auto rounded border border-app-border bg-app-bg p-2 font-mono text-[11px]">
        {preview}
        {preview.length === 600 ? '\n…' : ''}
      </pre>
      {status && <p className="mt-2 text-app-success">{status}</p>}
    </Dialog>
  )
}
