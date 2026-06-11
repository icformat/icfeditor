import { useState } from 'react'
import { Dialog, DialogButton } from './Dialog'
import { useDocumentStore } from '../stores/documentStore'
import { services } from '../services/container'
import type { SplitOptions, SplitPart, SplitStrategy } from '../models/transform'
import { dirName, joinPath, stripExtension } from '../utils/format'

const STRATEGIES: Array<{ id: SplitStrategy; label: string }> = [
  { id: 'count', label: 'By record count' },
  { id: 'range', label: 'By record range' },
  { id: 'schema', label: 'By schema' },
  { id: 'maxSize', label: 'By max file size (KB)' }
]

/** Split dialog (Prompt.md §Split). Previews parts and writes them to disk. */
export function SplitDialog({ onClose }: { onClose: () => void }) {
  const active = useDocumentStore((s) => s.documents.find((d) => d.id === s.activeId) ?? null)
  const [strategy, setStrategy] = useState<SplitStrategy>('count')
  const [count, setCount] = useState(100)
  const [rangeStart, setRangeStart] = useState(1)
  const [rangeEnd, setRangeEnd] = useState(100)
  const [maxKb, setMaxKb] = useState(64)
  const [parts, setParts] = useState<SplitPart[] | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const options = (): SplitOptions => {
    switch (strategy) {
      case 'count':
        return { strategy, countPerFile: count }
      case 'range':
        return { strategy, range: { start: rangeStart, end: rangeEnd } }
      case 'maxSize':
        return { strategy, maxBytes: maxKb * 1024 }
      case 'schema':
        return { strategy }
    }
  }

  const preview = () => {
    if (!active?.parsed) return
    const base = stripExtension(active.fileName)
    setParts(services.split.split(active.parsed, base, options()))
    setStatus(null)
  }

  const saveAll = async () => {
    if (!parts || !active) return
    let dir = active.path ? dirName(active.path) : ''
    if (!dir) {
      const target = await window.api.saveFileDialog(parts[0].suggestedName)
      if (!target) return
      dir = dirName(target)
    }
    for (const part of parts) {
      await window.api.writeFile(joinPath(dir, part.suggestedName), part.text)
    }
    setStatus(`Wrote ${parts.length} files to ${dir}`)
  }

  return (
    <Dialog
      title="Split ICF"
      width={620}
      onClose={onClose}
      footer={
        <>
          <DialogButton onClick={onClose}>Close</DialogButton>
          <DialogButton onClick={preview} disabled={!active?.parsed}>
            Preview
          </DialogButton>
          <DialogButton onClick={saveAll} variant="primary" disabled={!parts || parts.length === 0}>
            Save all…
          </DialogButton>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={strategy}
          onChange={(e) => setStrategy(e.target.value as SplitStrategy)}
          className="rounded border border-app-border bg-app-bg px-2 py-1"
        >
          {STRATEGIES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>

        {strategy === 'count' && (
          <NumberField label="Records per file" value={count} onChange={setCount} />
        )}
        {strategy === 'range' && (
          <>
            <NumberField label="From" value={rangeStart} onChange={setRangeStart} />
            <NumberField label="To" value={rangeEnd} onChange={setRangeEnd} />
          </>
        )}
        {strategy === 'maxSize' && (
          <NumberField label="Max KB" value={maxKb} onChange={setMaxKb} />
        )}
      </div>

      {parts && (
        <div className="rounded border border-app-border">
          <div className="border-b border-app-border bg-app-bg px-2 py-1 text-app-muted">
            {parts.length} part{parts.length === 1 ? '' : 's'}
          </div>
          <ul className="max-h-56 overflow-auto">
            {parts.map((part) => (
              <li
                key={part.suggestedName}
                className="flex justify-between border-b border-app-border/40 px-2 py-1"
              >
                <span className="font-mono">{part.suggestedName}</span>
                <span className="text-app-muted">{part.recordCount} records</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {status && <p className="mt-2 text-app-success">{status}</p>}
    </Dialog>
  )
}

function NumberField({
  label,
  value,
  onChange
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <label className="flex items-center gap-1">
      <span className="text-app-muted">{label}</span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 rounded border border-app-border bg-app-bg px-2 py-1"
      />
    </label>
  )
}
