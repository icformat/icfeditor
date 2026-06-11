import { useDocumentStore } from '../stores/documentStore'
import { debounce } from '../utils/debounce'
import type { OpenDocument } from '../models/document'
import type { SessionState, SessionTab, SessionCursor } from '../models/session'

const SESSION_KEY = 'session'

/**
 * Live caret positions keyed by a tab's identity — its file `path` for saved
 * documents, or its document id for untitled buffers — plus the keys whose saved
 * caret has already been applied (so restore happens once per tab).
 */
const cursors: Record<string, SessionCursor> = {}
const restored = new Set<string>()
let tracking = false
let initialized = false

/** The persistence key for a document: its path, or its id when untitled. */
const tabKey = (doc: OpenDocument): string => doc.path ?? doc.id

/** Records the caret position of the given tab (called as the user moves it). */
export function recordCursor(key: string, line: number, column: number): void {
  cursors[key] = { line, column }
  schedulePersist()
}

/**
 * Returns the saved caret for a tab the first time it is requested (so it is
 * applied once on restore / first activation), then defers to the editor.
 */
export function takePendingCursor(key: string): SessionCursor | null {
  if (restored.has(key)) return null
  restored.add(key)
  return cursors[key] ?? null
}

/** Builds the session (tabs in order + active key) from the document store. */
function buildSession(): SessionState {
  const { documents, activeId } = useDocumentStore.getState()
  const tabs: SessionTab[] = documents.map((d) => ({
    kind: d.kind,
    fileName: d.fileName,
    path: d.path,
    bufferId: d.path ? null : d.id,
    cursor: cursors[tabKey(d)] ?? null
  }))
  const active = documents.find((d) => d.id === activeId)
  return { tabs, activeKey: active ? tabKey(active) : null }
}

/**
 * Persists the session: writes every untitled buffer's content to a temp file,
 * prunes temp files for buffers that are gone, then saves the session metadata.
 * Awaitable so it can run synchronously on the close path.
 */
export async function persistSession(): Promise<void> {
  if (!window.api) return
  const { documents } = useDocumentStore.getState()
  const keepIds: string[] = []
  for (const doc of documents) {
    if (!doc.path) {
      keepIds.push(doc.id)
      await window.api.writeBuffer(doc.id, doc.text)
    }
  }
  await window.api.pruneBuffers(keepIds)
  await window.api.setSetting(SESSION_KEY, buildSession())
}

const schedulePersist = debounce(() => void persistSession(), 600)

/** Starts persisting the session whenever the open documents/active tab change. */
export function startSessionTracking(): void {
  if (tracking) return
  tracking = true
  useDocumentStore.subscribe(() => schedulePersist())
}

/**
 * Reopens the previous session: saved files are read from disk and untitled
 * buffers from their temp files, in the original tab order, then the active tab
 * is restored. Missing files/buffers are skipped. Returns whether anything was
 * restored.
 */
export async function restoreSession(): Promise<boolean> {
  if (!window.api) return false
  const session = await window.api.getSetting<SessionState>(SESSION_KEY)
  if (!session || !Array.isArray(session.tabs) || session.tabs.length === 0) return false

  const store = useDocumentStore.getState()
  const keyToId: Record<string, string> = {}
  let firstId: string | null = null

  // Open every tab WITHOUT activating it, so the editor mounts only once — on the
  // final active document — rather than flipping through each restored tab while
  // Monaco loads (which left the editor showing a stale document).
  for (const tab of session.tabs) {
    if (tab.path) {
      try {
        const file = await window.api.readFile(tab.path)
        store.openFile(file.path, file.content, { mtimeMs: file.mtimeMs, size: file.size }, false)
        const doc = useDocumentStore.getState().documents.find((d) => d.path === file.path)
        if (doc) {
          keyToId[tab.path] = doc.id
          if (tab.cursor) cursors[tab.path] = tab.cursor
          firstId ??= doc.id
        }
      } catch {
        // File moved/deleted since last run — skip it.
      }
    } else if (tab.bufferId) {
      const content = await window.api.readBuffer(tab.bufferId)
      if (content !== null) {
        const id = store.openVirtual(tab.fileName, content, tab.kind, false)
        keyToId[tab.bufferId] = id
        if (tab.cursor) cursors[id] = tab.cursor // restore caret under the new id
        firstId ??= id
      }
    }
  }

  if (!firstId) return false
  // Activate the saved active tab (or the first restored tab) exactly once.
  const activeTarget = (session.activeKey && keyToId[session.activeKey]) || firstId
  useDocumentStore.getState().setActive(activeTarget)
  return true
}

/**
 * One-time launch sequence: start session tracking, restore the previous
 * session, and open a blank document if nothing was restored. Guarded so React
 * StrictMode's double-invoked effect doesn't restore (and duplicate untitled
 * buffers) twice.
 */
export async function initWorkspace(): Promise<void> {
  if (initialized) return
  initialized = true
  startSessionTracking()
  await restoreSession()
  if (useDocumentStore.getState().documents.length === 0) {
    useDocumentStore.getState().newDocument()
  }
}
