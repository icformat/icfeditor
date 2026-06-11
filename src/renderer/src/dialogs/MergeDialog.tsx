import { useState } from 'react'
import type { IcfDocument } from 'icf.js'
import { Dialog, DialogButton } from './Dialog'
import { useDocumentStore } from '../stores/documentStore'
import { services } from '../services/container'
import type { MergePreview } from '../models/transform'

interface Source {
  name: string
  doc: IcfDocument
}

/** Merge dialog (Prompt.md §Merge). Combines the active file with added files. */
export function MergeDialog({ onClose }: { onClose: () => void }) {
  const active = useDocumentStore((s) => s.documents.find((d) => d.id === s.activeId) ?? null)
  const openVirtual = useDocumentStore((s) => s.openVirtual)

  const [sources, setSources] = useState<Source[]>(() =>
    active?.parsed ? [{ name: active.fileName, doc: active.parsed }] : []
  )
  const [preview, setPreview] = useState<MergePreview | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const addFiles = async () => {
    const files = await window.api.openFileDialog({ multi: true })
    const added = files.map((f) => ({ name: f.path, doc: services.parser.parse(f.content) }))
    setSources((prev) => [...prev, ...added])
    setPreview(null)
  }

  const runPreview = () => {
    setPreview(services.merge.preview(sources.map((s) => s.doc)))
    setStatus(null)
  }

  const saveMerged = async () => {
    if (!preview) return
    const target = await window.api.saveFileDialog('merged.icf')
    if (!target) return
    await window.api.writeFile(target, preview.resultText)
    setStatus(`Saved merged file to ${target}`)
  }

  const openMerged = () => {
    if (!preview) return
    openVirtual('merged.icf', preview.resultText, 'icf')
    onClose()
  }

  return (
    <Dialog
      title="Merge ICF files"
      width={640}
      onClose={onClose}
      footer={
        <>
          <DialogButton onClick={onClose}>Close</DialogButton>
          <DialogButton onClick={runPreview} disabled={sources.length < 2}>
            Preview
          </DialogButton>
          <DialogButton onClick={openMerged} disabled={!preview}>
            Open result
          </DialogButton>
          <DialogButton onClick={saveMerged} variant="primary" disabled={!preview}>
            Save…
          </DialogButton>
        </>
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-app-muted">Sources ({sources.length})</span>
        <DialogButton onClick={addFiles}>Add files…</DialogButton>
      </div>
      <ul className="mb-3 rounded border border-app-border">
        {sources.map((s, i) => (
          <li key={i} className="flex justify-between border-b border-app-border/40 px-2 py-1">
            <span className="truncate font-mono">{s.name}</span>
            <span className="text-app-muted">{s.doc.getRecordCount()} records</span>
          </li>
        ))}
        {sources.length === 0 && <li className="px-2 py-1 text-app-muted">No sources</li>}
      </ul>

      {sources.length < 2 && (
        <p className="text-app-muted">Add at least one more file to merge.</p>
      )}

      {preview && (
        <div className="rounded border border-app-border p-2">
          <div className="grid grid-cols-2 gap-1">
            <Stat label="Merged records" value={preview.mergedRecordCount} />
            <Stat label="Master entries" value={preview.mergedMasterCount} />
            <Stat label="Duplicates removed" value={preview.deduplicatedMasters} />
            <Stat label="Conflicts" value={preview.conflicts.length} />
          </div>
          {preview.conflicts.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-app-warning">
              {preview.conflicts.map((c, i) => (
                <li key={i}>{c.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {status && <p className="mt-2 text-app-success">{status}</p>}
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-app-muted">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}
