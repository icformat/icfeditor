import { create } from 'zustand'
import type { DocumentIndex, EditorMode, OpenDocument } from '../models/document'
import type { TreeNode } from '../models/tree'
import type { Diagnostic } from '../services/ICFValidatorService'
import { services } from '../services/container'
import { useUiStore } from './uiStore'
import { buildTree } from '../validators/buildTree'
import { toggleBookmark as toggleBookmarkLine } from '../utils/bookmarks'
import { debounce } from '../utils/debounce'
import { normalizeOnOpen } from '../utils/normalizeOnOpen'
import type { DiskState } from '../utils/diskState'
import { nextId } from '../utils/id'
import { baseName, extensionOf } from '../utils/format'

const EMPTY_ICF = `@kind icf
@version 1.0

@schema

@data
`

interface DocumentState {
  documents: OpenDocument[]
  activeId: string | null
  /** Derived projections of the active document, recomputed on parse. */
  index: DocumentIndex | null
  tree: TreeNode[]
  diagnostics: Diagnostic[]

  active(): OpenDocument | null
  /** Creates a blank untitled document; `atStart` inserts it before the other tabs. */
  newDocument(atStart?: boolean): void
  openFile(path: string, content: string, disk?: DiskState | null, activate?: boolean): void
  setActive(id: string): void
  closeDocument(id: string): void
  updateText(id: string, text: string): void
  setMode(id: string, mode: EditorMode): void
  markSaved(id: string, path: string, disk?: DiskState | null): void
  /** Replaces a document's content with a fresh on-disk version (external reload). */
  reloadDocument(id: string, content: string, disk: DiskState): void
  /** Records the current disk signature as acknowledged (external change kept). */
  acknowledgeDisk(id: string, disk: DiskState): void
  /** Detaches from a deleted file: drops the disk baseline and marks unsaved. */
  detachFromDisk(id: string): void
  /** Opens an in-memory document with no path (e.g. a generated ICX); returns its id. */
  openVirtual(fileName: string, content: string, kind: 'icf' | 'icx', activate?: boolean): string
  /** Structural record edits on the active document (Prompt.md §Editor Features). */
  editRecord(op: RecordOp, recordIndex: number | null): void
  /** Generates an ICX (with checksums) from the active doc and opens it as a tab. */
  regenerateIcx(): Promise<void>
  /** Toggles the collapse state of a tree node for the active document. */
  toggleCollapse(nodeId: string): void
  /** Toggles a bookmark on the given line of the active document. */
  toggleBookmark(line: number): void
  /** Clears all bookmarks in the active document. */
  clearBookmarks(): void
  /** Re-parse + re-validate + rebuild projections for the active document. */
  refreshActive(): void
}

/** Structural record operations dispatched to {@link RecordEditService}. */
export type RecordOp = 'insert' | 'duplicate' | 'clone' | 'delete' | 'moveUp' | 'moveDown'

/**
 * Debounce window for the keystroke → parse/validate/tree pipeline. Typing only
 * mutates the (cheap) text; the expensive reparse runs on the trailing edge so
 * it stays off the keystroke path even for very large files (Prompt.md
 * §Performance — "background validation").
 */
const REPARSE_DEBOUNCE_MS = 160

export const useDocumentStore = create<DocumentState>((set, get) => {
  const scheduleRefresh = debounce(() => get().refreshActive(), REPARSE_DEBOUNCE_MS)

  return {
  documents: [],
  activeId: null,
  index: null,
  tree: [],
  diagnostics: [],

  active() {
    const { documents, activeId } = get()
    return documents.find((d) => d.id === activeId) ?? null
  },

  newDocument(atStart = false) {
    const doc: OpenDocument = {
      id: nextId('doc'),
      path: null,
      fileName: 'untitled.icf',
      kind: 'icf',
      text: EMPTY_ICF,
      parsed: null,
      diagnostics: [],
      mode: 'edit',
      dirty: false,
      disk: null,
      collapsed: {},
      bookmarks: [],
      notices: []
    }
    set((s) => ({
      documents: atStart ? [doc, ...s.documents] : [...s.documents, doc],
      activeId: doc.id
    }))
    get().refreshActive()
  },

  openFile(path, content, disk = null, activate = true) {
    const existing = get().documents.find((d) => d.path === path)
    if (existing) {
      if (activate) {
        set({ activeId: existing.id })
        get().refreshActive()
      }
      return
    }
    const kind = extensionOf(path) === 'icx' ? 'icx' : 'icf'

    // Normalize on open for readability, reporting each rewrite in the Problems
    // tab. The indent pass is guarded so it never corrupts a parseable document
    // (see normalizeOnOpen); verbatim text blocks are preserved by both passes.
    const countErrors = (t: string) =>
      services.validator.validate(t).filter((d) => d.severity === 'error').length
    const { text, spacedLines, indentedLines } = normalizeOnOpen(content, countErrors)
    const notices: Diagnostic[] = []
    if (spacedLines.length > 0) {
      notices.push({
        severity: 'info',
        code: 'DIRECTIVE_SPACING',
        message: `Inserted a blank line above ${spacedLines.length} section directive${
          spacedLines.length === 1 ? '' : 's'
        } on open (lines ${formatLineList(spacedLines)}).`,
        line: spacedLines[0]
      })
    }
    if (indentedLines.length > 0) {
      notices.push({
        severity: 'info',
        code: 'AUTO_INDENT',
        message: `Auto-indented ${indentedLines.length} unindented line${
          indentedLines.length === 1 ? '' : 's'
        } on open (lines ${formatLineList(indentedLines)}).`,
        line: indentedLines[0]
      })
    }

    const doc: OpenDocument = {
      id: nextId('doc'),
      path,
      fileName: baseName(path),
      kind,
      text,
      parsed: null,
      diagnostics: [],
      mode: 'view',
      dirty: false,
      disk,
      collapsed: {},
      bookmarks: [],
      notices
    }
    set((s) => ({
      documents: [...s.documents, doc],
      activeId: activate ? doc.id : s.activeId
    }))
    get().refreshActive()
    void services.settings.addRecentFile(path)
  },

  setActive(id) {
    set({ activeId: id })
    get().refreshActive()
  },

  closeDocument(id) {
    set((s) => {
      const documents = s.documents.filter((d) => d.id !== id)
      const activeId = s.activeId === id ? (documents[0]?.id ?? null) : s.activeId
      return { documents, activeId }
    })
    get().refreshActive()
  },

  updateText(id, text) {
    // The text update is cheap and immediate (Monaco already shows it); the
    // expensive reparse/validate/tree rebuild is debounced off the keystroke
    // path so large files stay responsive while typing. Open-time notices (e.g.
    // auto-indent) are cleared on the first edit since their line refs go stale.
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id
          ? {
              ...d,
              text,
              dirty: d.path !== null || text.length > 0 ? true : d.dirty,
              notices: []
            }
          : d
      )
    }))
    if (get().activeId === id) scheduleRefresh()
  },

  setMode(id, mode) {
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, mode } : d))
    }))
  },

  markSaved(id, path, disk = null) {
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id ? { ...d, path, fileName: baseName(path), dirty: false, disk } : d
      )
    }))
  },

  reloadDocument(id, content, disk) {
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id ? { ...d, text: content, dirty: false, disk, notices: [] } : d
      )
    }))
    if (get().activeId === id) get().refreshActive()
  },

  acknowledgeDisk(id, disk) {
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, disk } : d))
    }))
  },

  detachFromDisk(id) {
    // The backing file is gone; keep the buffer but drop the baseline (so we stop
    // re-prompting) and mark it unsaved so the user is nudged to re-save.
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, disk: null, dirty: true } : d))
    }))
  },

  openVirtual(fileName, content, kind, activate = true) {
    const doc: OpenDocument = {
      id: nextId('doc'),
      path: null,
      fileName,
      kind,
      text: content,
      parsed: null,
      diagnostics: [],
      mode: 'view',
      dirty: true,
      disk: null,
      collapsed: {},
      bookmarks: [],
      notices: []
    }
    set((s) => ({
      documents: [...s.documents, doc],
      activeId: activate ? doc.id : s.activeId
    }))
    get().refreshActive()
    return doc.id
  },

  editRecord(op, recordIndex) {
    const doc = get().active()
    const index = get().index
    if (!doc || !index || doc.mode !== 'edit') return
    if (op !== 'insert' && recordIndex === null) return

    const svc = services.recordEdit
    let result
    switch (op) {
      case 'insert':
        result = svc.insertRecord(doc.text, index, services.parser.parse(doc.text), recordIndex)
        break
      case 'duplicate':
        result = svc.duplicateRecord(doc.text, index, recordIndex!)
        break
      case 'clone':
        result = svc.cloneRecord(doc.text, index, recordIndex!)
        break
      case 'delete':
        result = svc.deleteRecord(doc.text, index, recordIndex!)
        break
      case 'moveUp':
        result = svc.moveRecordUp(doc.text, index, recordIndex!)
        break
      case 'moveDown':
        result = svc.moveRecordDown(doc.text, index, recordIndex!)
        break
    }
    get().updateText(doc.id, result.text)
    // Structural edits do line surgery, so the index must be rebuilt now (not on
    // the debounce) before another edit reads it.
    get().refreshActive()
    useUiStore.getState().selectRecord(result.selectIndex)
  },

  async regenerateIcx() {
    const doc = get().active()
    if (!doc) return
    const parsed = services.parser.parse(doc.text)
    const icx = await services.icxGenerator.generateFull(parsed, {
      sourceFileName: doc.fileName,
      sourceText: doc.text
    })
    const icxText = services.writer.write(icx)
    const baseFileName = doc.fileName.replace(/\.icf$/i, '')
    get().openVirtual(`${baseFileName}.icx`, icxText, 'icx')
  },

  toggleCollapse(nodeId) {
    const doc = get().active()
    if (!doc) return
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === doc.id
          ? { ...d, collapsed: { ...d.collapsed, [nodeId]: !d.collapsed[nodeId] } }
          : d
      )
    }))
  },

  toggleBookmark(line) {
    const doc = get().active()
    if (!doc || line < 1) return
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === doc.id ? { ...d, bookmarks: toggleBookmarkLine(d.bookmarks, line) } : d
      )
    }))
  },

  clearBookmarks() {
    const doc = get().active()
    if (!doc) return
    set((s) => ({
      documents: s.documents.map((d) => (d.id === doc.id ? { ...d, bookmarks: [] } : d))
    }))
  },

  refreshActive() {
    const doc = get().active()
    if (!doc) {
      set({ index: null, tree: [], diagnostics: [] })
      return
    }
    // Parse leniently so partial input still renders; validate for diagnostics.
    const parsed = services.parser.parse(doc.text)
    const validatorDiagnostics = services.validator.validate(doc.text)
    // Open-time notices (e.g. auto-indent) ride along until the first edit.
    const diagnostics = [...doc.notices, ...validatorDiagnostics]
    const index = services.parser.buildIndex(doc.text, parsed)
    const tree = buildTree(parsed, index, diagnostics, doc.text)
    set((s) => ({
      index,
      tree,
      diagnostics,
      documents: s.documents.map((d) => (d.id === doc.id ? { ...d, parsed, diagnostics } : d))
    }))
  }
  }
})

/** Compresses a sorted line list to a compact display string, e.g. "3, 5–8, 12". */
function formatLineList(lines: number[]): string {
  if (lines.length === 0) return ''
  const sorted = [...lines].sort((a, b) => a - b)
  const ranges: string[] = []
  let start = sorted[0]
  let prev = sorted[0]
  for (let i = 1; i <= sorted.length; i++) {
    const n = sorted[i]
    if (n === prev + 1) {
      prev = n
      continue
    }
    ranges.push(start === prev ? `${start}` : `${start}–${prev}`)
    if (n !== undefined) {
      start = n
      prev = n
    }
  }
  // Cap the display so a fully-flat file doesn't print thousands of numbers.
  if (ranges.length > 8) return `${ranges.slice(0, 8).join(', ')}, …`
  return ranges.join(', ')
}
