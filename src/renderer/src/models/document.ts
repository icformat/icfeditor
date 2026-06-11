import type { IcfDocument } from 'icf.js'
import type { Diagnostic } from './validation'
import type { DiskState } from '../utils/diskState'

/** Which file kind a tab holds; drives ICX-specific affordances. */
export type DocumentKind = 'icf' | 'icx'

/** Editor interaction mode (Prompt.md §Modes). */
export type EditorMode = 'view' | 'edit'

/**
 * A single open document tab. The `text` field is the source of truth (it is
 * what Monaco holds and what gets saved); `parsed` is the derived model and is
 * recomputed, debounced, on every text change. `parsed` may be null briefly
 * before the first parse completes.
 */
export interface OpenDocument {
  id: string
  /** Absolute path on disk, or null for an unsaved buffer. */
  path: string | null
  fileName: string
  kind: DocumentKind
  text: string
  parsed: IcfDocument | null
  diagnostics: Diagnostic[]
  mode: EditorMode
  /** True when `text` differs from the last saved content. */
  dirty: boolean
  /**
   * Last-known on-disk signature for external-change detection, or null for
   * untitled/in-memory documents. Updated on open, save, and reload.
   */
  disk: DiskState | null
  /** Per-record / per-section collapse state, keyed by node id. */
  collapsed: Record<string, boolean>
  /** Bookmarked line numbers. */
  bookmarks: number[]
  /**
   * One-off informational notices about this document (e.g. auto-indentation
   * applied on open). Merged into the Problems list until the first edit.
   */
  notices: Diagnostic[]
}

/** Maps a record to its location in the text buffer, built after each parse. */
export interface RecordLocation {
  index: number
  id: string | null
  uuid: string | null
  schemaId: string | null
  /** 1-based line where the `@record` directive sits. */
  startLine: number
  /** 1-based line of the last line belonging to this record. */
  endLine: number
}

/** A derived index over a parsed document, reused by navigation/search/filters. */
export interface DocumentIndex {
  records: RecordLocation[]
  /** recordId -> location, for O(1) Go-To. */
  byId: Map<string, RecordLocation>
  /** schemaId -> record indices, for schema filters. */
  bySchema: Map<string, number[]>
}
