import { Dialog, DialogButton } from './Dialog'
import { useDocumentStore } from '../stores/documentStore'
import { useUiStore } from '../stores/uiStore'
import { saveDocument, saveAll } from '../actions/fileActions'
import { persistSession } from '../actions/session'

/**
 * "Save changes?" prompt shown when closing with unsaved edits (project
 * requirement). Two shapes:
 *  - `tab`: closing one dirty document — Save / Don't Save / Cancel.
 *  - `app`: closing the window with any dirty document — Save All / Don't Save /
 *    Cancel; "Don't Save" and a completed "Save All" both call `forceClose` so
 *    the main process lets the window close.
 */
export function ConfirmCloseDialog() {
  const prompt = useUiStore((s) => s.closePrompt)
  const close = useUiStore((s) => s.closeClosePrompt)
  const documents = useDocumentStore((s) => s.documents)
  const closeDocument = useDocumentStore((s) => s.closeDocument)

  if (!prompt) return null

  if (prompt.kind === 'tab') {
    const doc = documents.find((d) => d.id === prompt.docId)
    if (!doc) {
      close()
      return null
    }
    const onSave = async () => {
      const ok = await saveDocument(doc.id)
      if (ok) closeDocument(doc.id)
      close()
    }
    const onDiscard = () => {
      closeDocument(doc.id)
      close()
    }
    return (
      <Dialog
        title="Save changes?"
        width={420}
        onClose={close}
        footer={
          <>
            <DialogButton onClick={close}>Cancel</DialogButton>
            <DialogButton onClick={onDiscard}>Don&apos;t Save</DialogButton>
            <DialogButton onClick={onSave} variant="primary">
              Save
            </DialogButton>
          </>
        }
      >
        <p>
          Do you want to save the changes you made to <strong>{doc.fileName}</strong>?
        </p>
        <p className="mt-2 text-app-muted">Your changes will be lost if you don&apos;t save them.</p>
      </Dialog>
    )
  }

  // kind === 'app' — only dirty saved files matter (untitled buffers are auto-persisted).
  const dirty = documents.filter((d) => d.dirty && d.path)
  const onSaveAll = async () => {
    const ok = await saveAll()
    close()
    if (ok) {
      await persistSession()
      await window.api.forceClose()
    }
  }
  const onDiscard = async () => {
    close()
    await persistSession()
    await window.api.forceClose()
  }
  return (
    <Dialog
      title="Save changes before closing?"
      width={460}
      onClose={close}
      footer={
        <>
          <DialogButton onClick={close}>Cancel</DialogButton>
          <DialogButton onClick={onDiscard}>Don&apos;t Save</DialogButton>
          <DialogButton onClick={onSaveAll} variant="primary">
            Save All
          </DialogButton>
        </>
      }
    >
      <p>
        You have unsaved changes in <strong>{dirty.length}</strong> file
        {dirty.length === 1 ? '' : 's'}:
      </p>
      <ul className="mt-2 list-disc pl-5 text-app-muted">
        {dirty.map((d) => (
          <li key={d.id}>{d.fileName}</li>
        ))}
      </ul>
    </Dialog>
  )
}
