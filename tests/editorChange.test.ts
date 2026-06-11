import { describe, it, expect, beforeEach } from 'vitest'
import { commitEditorChange } from '@renderer/components/editorChange'
import { useDocumentStore } from '@renderer/stores/documentStore'

/** Reset the store between tests (it is a module-level singleton). */
beforeEach(() => {
  useDocumentStore.setState({ documents: [], activeId: null, index: null, tree: [], diagnostics: [] })
})

describe('commitEditorChange (tab-switch corruption guard)', () => {
  it('does NOT write another file\'s text into the previously-active document', () => {
    const store = useDocumentStore.getState()
    store.openFile('a.icf', '@kind icf\n\n@data\n\n@record id=AAA\n\ncustomer:\n  = 1, A\n')
    store.openFile('b.icf', '@kind icf\n\n@data\n\n@record id=BBB\n\ncustomer:\n  = 2, B\n')

    const before = useDocumentStore.getState().documents.map((d) => ({ name: d.fileName, text: d.text }))

    // Simulate the spurious onChange that @monaco-editor/react fires on switch:
    // active is now B, and Monaco echoes B's current text back through onChange.
    const bText = useDocumentStore.getState().documents.find((d) => d.fileName === 'b.icf')!.text
    commitEditorChange(bText)

    const after = useDocumentStore.getState().documents
    // A is untouched (the old bug overwrote it with B's text), B is unchanged…
    expect(after.find((d) => d.fileName === 'a.icf')!.text).toBe(
      before.find((d) => d.name === 'a.icf')!.text
    )
    expect(after.find((d) => d.fileName === 'b.icf')!.text).toBe(bText)
    // …and the no-op echo must not flip the dirty flag.
    expect(after.find((d) => d.fileName === 'b.icf')!.dirty).toBe(false)
  })

  it('persists a genuine edit to the active document only', () => {
    const store = useDocumentStore.getState()
    store.openFile('a.icf', '@kind icf\n\n@data\n')
    store.openFile('b.icf', '@kind icf\n\n@data\n\n@record id=BBB\n')

    const aTextBefore = useDocumentStore.getState().documents.find((d) => d.fileName === 'a.icf')!.text

    // Active is B; the user types, producing new text.
    commitEditorChange('@kind icf\n\n@data\n\n@record id=BBB_EDITED\n')

    const after = useDocumentStore.getState().documents
    expect(after.find((d) => d.fileName === 'b.icf')!.text).toContain('BBB_EDITED')
    expect(after.find((d) => d.fileName === 'b.icf')!.dirty).toBe(true)
    // The non-active document is never touched.
    expect(after.find((d) => d.fileName === 'a.icf')!.text).toBe(aTextBefore)
  })
})
