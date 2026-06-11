/** A persisted caret position within a file. */
export interface SessionCursor {
  line: number
  column: number
}

/** One persisted tab — either a saved file (path) or an untitled buffer (bufferId). */
export interface SessionTab {
  kind: 'icf' | 'icx'
  fileName: string
  /** Absolute path for a saved file, or null for an untitled/in-memory buffer. */
  path: string | null
  /** Temp-buffer id for an untitled document, or null for a saved file. */
  bufferId: string | null
  cursor: SessionCursor | null
}

/**
 * The workspace session saved between runs: every open tab in order (saved files
 * and untitled buffers alike) and which one was active. Untitled buffers carry a
 * `bufferId` referencing their content persisted to a temp file.
 */
export interface SessionState {
  tabs: SessionTab[]
  /** `path` or `bufferId` of the active tab, or null. */
  activeKey: string | null
}
