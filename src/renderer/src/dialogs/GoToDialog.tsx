import { useState } from 'react'
import { Dialog, DialogButton } from './Dialog'
import { useDocumentStore } from '../stores/documentStore'
import { useUiStore } from '../stores/uiStore'

interface GoToDialogProps {
  onClose: () => void
  onReveal: (recordIndex: number) => void
}

/** Go To Record dialog (Prompt.md §Record Navigation, Ctrl+G). */
export function GoToDialog({ onClose, onReveal }: GoToDialogProps) {
  const total = useDocumentStore((s) => s.index?.records.length ?? 0)
  const selectRecord = useUiStore((s) => s.selectRecord)
  const [value, setValue] = useState('')

  const go = () => {
    const n = Number(value)
    if (!Number.isFinite(n) || total === 0) return onClose()
    const idx = Math.min(total, Math.max(1, Math.round(n))) - 1
    selectRecord(idx)
    onReveal(idx)
    onClose()
  }

  return (
    <Dialog
      title="Go To Record"
      width={360}
      onClose={onClose}
      footer={
        <>
          <DialogButton onClick={onClose}>Cancel</DialogButton>
          <DialogButton onClick={go} variant="primary" disabled={total === 0}>
            Go
          </DialogButton>
        </>
      }
    >
      <label className="block">
        <span className="mb-1 block text-app-muted">Record number (1–{total})</span>
        <input
          autoFocus
          type="number"
          min={1}
          max={total}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          className="w-full rounded border border-app-border bg-app-bg px-2 py-1 outline-none focus:border-app-accent"
        />
      </label>
    </Dialog>
  )
}
