import { useUiStore } from '../stores/uiStore'
import { MergeDialog } from './MergeDialog'
import { SplitDialog } from './SplitDialog'
import { ExportDialog } from './ExportDialog'
import { GoToDialog } from './GoToDialog'
import { AboutDialog } from './AboutDialog'
import { ImportDialog } from './ImportDialog'
import { ConfirmCloseDialog } from './ConfirmCloseDialog'
import { ExternalChangeDialog } from './ExternalChangeDialog'

interface DialogHostProps {
  /** Reveals a record in the editor (used by Go To). */
  onReveal: (recordIndex: number) => void
}

/** Renders whichever modal dialog the UI store currently has open. */
export function DialogHost({ onReveal }: DialogHostProps) {
  const dialog = useUiStore((s) => s.activeDialog)
  const close = useUiStore((s) => s.closeDialog)

  return (
    <>
      {dialog === 'merge' && <MergeDialog onClose={close} />}
      {dialog === 'split' && <SplitDialog onClose={close} />}
      {dialog === 'export' && <ExportDialog onClose={close} />}
      {dialog === 'goto' && <GoToDialog onClose={close} onReveal={onReveal} />}
      {dialog === 'about' && <AboutDialog onClose={close} />}
      {dialog === 'import' && <ImportDialog onClose={close} />}
      {/* These prompts are independent of activeDialog and can appear over it. */}
      <ConfirmCloseDialog />
      <ExternalChangeDialog />
    </>
  )
}
