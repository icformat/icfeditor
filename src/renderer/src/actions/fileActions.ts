import { useDocumentStore } from '../stores/documentStore'
import { withUpdatedChecksum } from '../utils/updateChecksum'

/**
 * Imperative file-save helpers shared by the command bus, toolbar, and the
 * unsaved-changes dialog. They live outside the store because they touch the
 * privileged `window.api` bridge (filesystem + native dialogs); the store stays
 * concerned only with in-memory document state.
 *
 * Each function resolves to `true` when the save completed and `false` when the
 * user cancelled (e.g. dismissed the Save-As dialog for an untitled file), so
 * callers can abort a close that depended on saving.
 */

/**
 * Writes a document's content to `path`, first refreshing its `@checksum` over
 * the canonical content (spec §19). The recomputed text is pushed back into the
 * buffer so the editor and the file stay identical (and the doc is marked
 * clean). Recent files and the saved path are updated.
 */
async function persist(id: string, path: string): Promise<void> {
  const store = useDocumentStore.getState()
  const doc = store.documents.find((d) => d.id === id)
  if (!doc) return
  const content = await withUpdatedChecksum(doc.text)
  if (content !== doc.text) store.updateText(doc.id, content)
  const disk = await window.api.writeFile(path, content)
  store.markSaved(doc.id, path, disk)
  await window.api.addRecentFile(path)
}

/** Saves one document by id, prompting for a name when it is untitled. */
export async function saveDocument(id: string): Promise<boolean> {
  const doc = useDocumentStore.getState().documents.find((d) => d.id === id)
  if (!doc) return true
  if (!doc.dirty && doc.path) return true

  let path = doc.path
  if (!path) {
    path = await window.api.saveFileDialog(doc.fileName)
    if (!path) return false // user cancelled the Save-As dialog
  }
  await persist(id, path)
  return true
}

/** Forces a Save-As for one document regardless of whether it has a path. */
export async function saveDocumentAs(id: string): Promise<boolean> {
  const doc = useDocumentStore.getState().documents.find((d) => d.id === id)
  if (!doc) return true
  const path = await window.api.saveFileDialog(doc.fileName)
  if (!path) return false
  await persist(id, path)
  return true
}

/**
 * Saves every dirty document (Prompt.md §Editor Features — "Save All"),
 * offering a name for each untitled file. Returns false as soon as any save is
 * cancelled, leaving the remaining documents untouched.
 */
export async function saveAll(): Promise<boolean> {
  const dirty = useDocumentStore.getState().documents.filter((d) => d.dirty)
  for (const doc of dirty) {
    const ok = await saveDocument(doc.id)
    if (!ok) return false
  }
  return true
}
