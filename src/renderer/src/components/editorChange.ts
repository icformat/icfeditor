import { useDocumentStore } from '../stores/documentStore'

/**
 * Commits a Monaco editor change to the store, defensively.
 *
 * Why this isn't just `updateText(active.id, value)` from the render closure:
 * `@monaco-editor/react` re-applies the controlled `value` via `model.setValue`
 * (notably for read-only / View mode), and that fires `onChange` *during a tab
 * switch* using the previous render's closure — whose document id is the one we
 * just left. Persisting that would write the new file's text into the old
 * document (the "shows another file's tree" corruption).
 *
 * Resolving the target from live store state and ignoring no-op echoes (where
 * the value already equals the document's text) makes the write target the
 * document actually in the editor and persist only genuine user edits.
 */
export function commitEditorChange(value: string | null | undefined): void {
  const store = useDocumentStore.getState()
  const target = store.documents.find((d) => d.id === store.activeId)
  const next = value ?? ''
  if (!target || target.text === next) return
  store.updateText(target.id, next)
}
