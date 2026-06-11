import { useDocumentStore } from '../stores/documentStore'
import { useUiStore } from '../stores/uiStore'

/** Open-document tabs, like editor tabs in VS Code. */
export function TabBar() {
  const documents = useDocumentStore((s) => s.documents)
  const activeId = useDocumentStore((s) => s.activeId)
  const setActive = useDocumentStore((s) => s.setActive)
  const close = useDocumentStore((s) => s.closeDocument)
  const newDocument = useDocumentStore((s) => s.newDocument)
  const openClosePrompt = useUiStore((s) => s.openClosePrompt)

  // A dirty tab prompts to save before closing; a clean tab closes immediately.
  const requestClose = (id: string) => {
    const doc = documents.find((d) => d.id === id)
    if (doc?.dirty) openClosePrompt({ kind: 'tab', docId: id })
    else close(id)
  }

  return (
    <div
      className="flex border-b border-app-border bg-app-surface"
      role="tablist"
      aria-label="Open documents"
    >
      {/* Document tabs scroll horizontally; the New-file button stays pinned to
          the right edge of the window, so new/right tabs slide under it. */}
      <div className="flex min-w-0 flex-1 overflow-x-auto">
        {documents.map((doc) => (
        <div
          key={doc.id}
          role="tab"
          aria-selected={doc.id === activeId}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setActive(doc.id)
            }
          }}
          onClick={() => setActive(doc.id)}
          className={`flex cursor-pointer items-center gap-2 border-r border-app-border px-3 py-1.5 text-xs ${
            doc.id === activeId ? 'bg-app-bg text-app-text' : 'text-app-muted hover:bg-app-surface-hover'
          }`}
        >
          <span className="opacity-70">{doc.kind === 'icx' ? '🔢' : '📄'}</span>
          <span>{doc.fileName}</span>
          {doc.dirty && <span className="text-app-accent">●</span>}
            <button
              title="Close"
              aria-label={`Close ${doc.fileName}`}
              onClick={(e) => {
                e.stopPropagation()
                requestClose(doc.id)
              }}
              className="ml-1 rounded px-1 hover:bg-app-surface-hover"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        title="New file"
        aria-label="New file"
        onClick={() => newDocument()}
        className="shrink-0 border-l border-app-border px-3 py-1.5 text-sm text-app-muted hover:bg-app-surface-hover hover:text-app-text"
      >
        ＋
      </button>
    </div>
  )
}
