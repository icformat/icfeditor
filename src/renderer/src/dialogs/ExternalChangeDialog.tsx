import { Dialog, DialogButton } from './Dialog'
import { useDocumentStore } from '../stores/documentStore'
import { useUiStore } from '../stores/uiStore'

/**
 * Prompts when the active document's file changed on disk outside the editor
 * (detected on tab activation):
 *  - modified → Reload from disk / Keep current,
 *  - deleted  → Remove from workspace / Keep open.
 */
export function ExternalChangeDialog() {
  const prompt = useUiStore((s) => s.externalPrompt)
  const close = useUiStore((s) => s.closeExternalPrompt)
  const documents = useDocumentStore((s) => s.documents)
  const reloadDocument = useDocumentStore((s) => s.reloadDocument)
  const acknowledgeDisk = useDocumentStore((s) => s.acknowledgeDisk)
  const detachFromDisk = useDocumentStore((s) => s.detachFromDisk)
  const closeDocument = useDocumentStore((s) => s.closeDocument)

  if (!prompt) return null
  const doc = documents.find((d) => d.id === prompt.docId)
  if (!doc) {
    close()
    return null
  }

  if (prompt.kind === 'modified') {
    const reload = async () => {
      if (doc.path && prompt.current) {
        const file = await window.api.readFile(doc.path)
        reloadDocument(doc.id, file.content, { mtimeMs: file.mtimeMs, size: file.size })
      }
      close()
    }
    const keep = () => {
      // Acknowledge the on-disk change so we don't prompt again for it.
      if (prompt.current) acknowledgeDisk(doc.id, prompt.current)
      close()
    }
    return (
      <Dialog
        title="File changed on disk"
        width={460}
        onClose={keep}
        footer={
          <>
            <DialogButton onClick={keep}>Keep current</DialogButton>
            <DialogButton onClick={reload} variant="primary">
              Reload
            </DialogButton>
          </>
        }
      >
        <p>
          <strong>{doc.fileName}</strong> has been modified outside the editor.
        </p>
        <p className="mt-2 text-app-muted">
          Reload it from disk{doc.dirty ? ' (your unsaved changes will be lost)' : ''}, or keep the
          version in the editor.
        </p>
      </Dialog>
    )
  }

  // kind === 'deleted'
  const remove = () => {
    closeDocument(doc.id)
    close()
  }
  const keep = () => {
    detachFromDisk(doc.id)
    close()
  }
  return (
    <Dialog
      title="File deleted on disk"
      width={460}
      onClose={keep}
      footer={
        <>
          <DialogButton onClick={keep}>Keep open</DialogButton>
          <DialogButton onClick={remove} variant="primary">
            Remove from workspace
          </DialogButton>
        </>
      }
    >
      <p>
        <strong>{doc.fileName}</strong> has been deleted from disk.
      </p>
      <p className="mt-2 text-app-muted">
        Remove it from the workspace, or keep it open as an unsaved buffer (Save will recreate the
        file).
      </p>
    </Dialog>
  )
}
