import { useState } from 'react'
import { Dialog, DialogButton } from './Dialog'
import { useDocumentStore } from '../stores/documentStore'
import { services } from '../services/container'
import { extensionOf } from '../utils/format'

interface PickedFile {
  name: string
  content: string
}

/**
 * Import dialog (File ▸ Import…): converts XML / JSON / YAML / CSV to ICF. Each
 * picked file becomes a new ICF tab. The "My CSV has headers" toggle controls
 * whether a CSV's first row names the fields or is treated as data (with
 * auto-named fields); it applies only to CSV files.
 */
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const openVirtual = useDocumentStore((s) => s.openVirtual)
  const [files, setFiles] = useState<PickedFile[]>([])
  const [csvHasHeaders, setCsvHasHeaders] = useState(true)
  const [preferCollections, setPreferCollections] = useState(true)
  const [errors, setErrors] = useState<string[]>([])

  const hasCsv = files.some((f) => extensionOf(f.name) === 'csv')

  const addFiles = async () => {
    const picked = await window.api.importFileDialog()
    if (picked.length > 0) {
      setFiles((prev) => [...prev, ...picked.map((f) => ({ name: f.path, content: f.content }))])
    }
  }

  const runImport = () => {
    const failures: string[] = []
    let imported = 0
    for (const file of files) {
      try {
        const result = services.import.toIcf(file.content, file.name, {
          csvHasHeaders,
          preferCollections
        })
        openVirtual(result.fileName, result.icf, 'icf')
        imported++
      } catch (error) {
        failures.push(`${file.name}: ${(error as Error).message}`)
      }
    }
    if (failures.length > 0) {
      setErrors(failures)
      return
    }
    if (imported > 0) onClose()
  }

  return (
    <Dialog
      title="Import to ICF"
      width={620}
      onClose={onClose}
      footer={
        <>
          <DialogButton onClick={onClose}>Cancel</DialogButton>
          <DialogButton onClick={runImport} variant="primary" disabled={files.length === 0}>
            Import {files.length > 0 ? `(${files.length})` : ''}
          </DialogButton>
        </>
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-app-muted">XML · JSON · YAML · CSV → ICF</span>
        <DialogButton onClick={addFiles}>Add files…</DialogButton>
      </div>

      <ul className="mb-3 rounded border border-app-border">
        {files.map((f, i) => (
          <li key={i} className="flex justify-between border-b border-app-border/40 px-2 py-1">
            <span className="truncate font-mono">{f.name}</span>
            <span className="uppercase text-app-muted">{extensionOf(f.name)}</span>
          </li>
        ))}
        {files.length === 0 && <li className="px-2 py-1 text-app-muted">No files selected</li>}
      </ul>

      <label
        className={`flex items-center gap-2 ${hasCsv ? '' : 'text-app-muted'}`}
        title="Applies to CSV files"
      >
        <input
          type="checkbox"
          checked={csvHasHeaders}
          onChange={(e) => setCsvHasHeaders(e.target.checked)}
        />
        My CSV has headers
        {!hasCsv && <span className="text-app-muted">(no CSV selected)</span>}
      </label>

      <label className="mt-2 flex items-center gap-2" title="Group all rows into one collection">
        <input
          type="checkbox"
          checked={preferCollections}
          onChange={(e) => setPreferCollections(e.target.checked)}
        />
        Prefer collections (one record holding all rows)
      </label>

      <p className="mt-3 text-app-muted">
        Records are unified into one schema using the union of all keys; a record gets an empty
        value where it lacks a key.
      </p>

      {errors.length > 0 && (
        <ul className="mt-2 list-disc pl-4 text-app-error">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
