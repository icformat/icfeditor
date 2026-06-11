import { useDocumentStore } from '../stores/documentStore'
import { useUiStore } from '../stores/uiStore'
import { diskChange } from '../utils/diskState'

/**
 * Checks whether the document's on-disk file has been modified or deleted since
 * it was last opened/saved, and — if so — raises the external-change prompt.
 *
 * Called when a document becomes active (e.g. clicking its tab). Untitled docs,
 * docs without a baseline, and unchanged files are no-ops. A guard re-checks the
 * active id after the async stat so switching away cancels a stale prompt, and
 * an already-open prompt is not replaced.
 */
export async function checkExternalChange(docId: string): Promise<void> {
  if (!window.api || useUiStore.getState().externalPrompt) return

  const doc = useDocumentStore.getState().documents.find((d) => d.id === docId)
  if (!doc || !doc.path || !doc.disk) return

  const current = await window.api.statFile(doc.path)
  const change = diskChange(doc.disk, current)
  if (change === 'same' || change === 'unknown') return

  // Only prompt if this document is still the active one and nothing else popped.
  const ui = useUiStore.getState()
  if (useDocumentStore.getState().activeId !== docId || ui.externalPrompt) return

  ui.openExternalPrompt({ docId, kind: change === 'deleted' ? 'deleted' : 'modified', current })
}
