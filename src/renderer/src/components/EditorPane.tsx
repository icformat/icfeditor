import { useEffect, useRef } from 'react'
import Editor, { type Monaco, type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { registerIcfLanguage } from './icfLanguage'
import { registerIcfHover } from './icfHover'
import { commitEditorChange } from './editorChange'
import { recordCursor, takePendingCursor } from '../actions/session'
import { useDocumentStore } from '../stores/documentStore'
import { useUiStore } from '../stores/uiStore'
import type { ResolvedTheme } from '../models/settings'

/** Imperative handle the panels use to drive the editor viewport. */
export interface EditorController {
  revealRecord: (recordIndex: number) => void
  revealLine: (line: number) => void
  /** Character offsets of the current selection in the model text, or null if empty. */
  getSelectionOffsets: () => { start: number; end: number } | null
}

interface EditorPaneProps {
  resolvedTheme: ResolvedTheme
  /** Receives an imperative controller bound to this editor instance. */
  onReady: (controller: EditorController) => void
}

/**
 * Monaco wrapper — the source of truth for document text. Edits flow into the
 * document store (which re-parses, debounced inside the store) and validation
 * diagnostics flow back as editor markers. In View mode the editor is
 * read-only (Prompt.md §Modes).
 */
export function EditorPane({ resolvedTheme, onReady }: EditorPaneProps) {
  const active = useDocumentStore((s) => s.documents.find((d) => d.id === s.activeId) ?? null)
  const diagnostics = useDocumentStore((s) => s.diagnostics)
  const index = useDocumentStore((s) => s.index)
  const selectRecord = useUiStore((s) => s.selectRecord)
  const setCursorLine = useUiStore((s) => s.setCursorLine)
  const bookmarks = active?.bookmarks

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const bookmarkDecorations = useRef<string[]>([])
  // Scroll-position indicator (the floating record-id pill). Driven imperatively
  // via these refs so scroll ticks never re-render the editor.
  const scrollHintRef = useRef<HTMLDivElement | null>(null)
  const scrollHintTimer = useRef<number | null>(null)

  const handleMount: OnMount = (instance, monaco) => {
    editorRef.current = instance
    monacoRef.current = monaco
    registerIcfLanguage(monaco)
    registerIcfHover(monaco)
    monaco.editor.setTheme(resolvedTheme === 'dark' ? 'icf-dark' : 'icf-light')

    // Bind imperative helpers for the command bus + panels (nav, jump-to-line).
    const revealLine = (line: number) => {
      if (!editorRef.current || line < 1) return
      editorRef.current.revealLineNearTop(line)
      editorRef.current.setPosition({ lineNumber: line, column: 1 })
      editorRef.current.focus()
    }
    onReady({
      revealLine,
      revealRecord: (recordIndex: number) => {
        const loc = useDocumentStore.getState().index?.records[recordIndex]
        if (loc) revealLine(loc.startLine)
      },
      getSelectionOffsets: () => {
        const ed = editorRef.current
        const model = ed?.getModel()
        const selection = ed?.getSelection()
        if (!ed || !model || !selection || selection.isEmpty()) return null
        return {
          start: model.getOffsetAt(selection.getStartPosition()),
          end: model.getOffsetAt(selection.getEndPosition())
        }
      }
    })

    // Shift + mouse wheel scrolls one record at a time (Prompt.md §Record Navigation).
    instance.getDomNode()?.addEventListener(
      'wheel',
      (event: WheelEvent) => {
        if (!event.shiftKey) return
        event.preventDefault()
        const records = useDocumentStore.getState().index?.records ?? []
        if (records.length === 0) return
        const top = instance.getVisibleRanges()[0]?.startLineNumber ?? 1
        const direction = event.deltaY > 0 ? 1 : -1
        const currentIdx = Math.max(0, records.findIndex((r) => r.startLine >= top))
        const nextIdx = Math.min(records.length - 1, Math.max(0, currentIdx + direction))
        const loc = records[nextIdx]
        instance.revealLineNearTop(loc.startLine)
        useUiStore.getState().selectRecord(nextIdx)
      },
      { passive: false }
    )

    // Scroll-position indicator: while scrolling, show the id of the record at
    // the top of the viewport in a pill that tracks the scrollbar thumb (where
    // the cursor is during a drag), then fades out shortly after scrolling stops.
    const recordLabelForLine = (line: number): string | null => {
      const records = useDocumentStore.getState().index?.records ?? []
      if (records.length === 0) return null
      // Last record whose startLine <= line (binary search — fast on 100k records).
      let lo = 0
      let hi = records.length - 1
      let found = -1
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        if (records[mid].startLine <= line) {
          found = mid
          lo = mid + 1
        } else {
          hi = mid - 1
        }
      }
      if (found < 0) return null
      const rec = records[found]
      return rec.id ?? `Record ${rec.index + 1}`
    }

    instance.onDidScrollChange((e) => {
      if (!e.scrollTopChanged) return
      const hint = scrollHintRef.current
      if (!hint) return
      const topLine = instance.getVisibleRanges()[0]?.startLineNumber ?? 1
      const label = recordLabelForLine(topLine)
      if (!label) {
        hint.style.opacity = '0'
        return
      }
      hint.textContent = `📄 ${label}`
      // Vertically align the pill with the scroll thumb, inset from top/bottom.
      const viewportH = instance.getLayoutInfo().height
      const maxScroll = Math.max(1, instance.getScrollHeight() - viewportH)
      const ratio = Math.min(1, Math.max(0, e.scrollTop / maxScroll))
      const inset = 40
      hint.style.top = `${inset + ratio * Math.max(0, viewportH - inset * 2)}px`
      hint.style.opacity = '1'
      if (scrollHintTimer.current) window.clearTimeout(scrollHintTimer.current)
      scrollHintTimer.current = window.setTimeout(() => {
        if (scrollHintRef.current) scrollHintRef.current.style.opacity = '0'
      }, 800)
    })

    // Track the caret line (for bookmark toggling), select the enclosing record,
    // and record the caret per file for session restore.
    instance.onDidChangeCursorPosition((e) => {
      const line = e.position.lineNumber
      setCursorLine(line)
      const state = useDocumentStore.getState()
      const records = state.index?.records ?? []
      const rec = records.find((r) => line >= r.startLine && line <= r.endLine)
      if (rec) selectRecord(rec.index)
      const doc = state.active()
      if (doc) recordCursor(doc.path ?? doc.id, line, e.position.column)
    })

    // Apply a saved caret for the document shown at mount (session restore).
    applyPendingCursor()
  }

  /** Moves the caret to the active document's saved position, once per tab. */
  const applyPendingCursor = () => {
    const doc = useDocumentStore.getState().active()
    if (!doc || !editorRef.current) return
    const cursor = takePendingCursor(doc.path ?? doc.id)
    if (!cursor) return
    editorRef.current.setPosition({ lineNumber: cursor.line, column: cursor.column })
    editorRef.current.revealLineNearTop(cursor.line)
  }

  // Re-theme when the resolved theme changes.
  useEffect(() => {
    monacoRef.current?.editor.setTheme(resolvedTheme === 'dark' ? 'icf-dark' : 'icf-light')
  }, [resolvedTheme])

  // Clear the scroll-indicator fade timer on unmount.
  useEffect(() => {
    return () => {
      if (scrollHintTimer.current) window.clearTimeout(scrollHintTimer.current)
    }
  }, [])

  // When switching documents, restore that tab's saved caret (once per tab).
  // The editor model has already swapped by the time this passive effect runs.
  useEffect(() => {
    applyPendingCursor()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id])

  // Push validation diagnostics into Monaco as squiggly markers.
  useEffect(() => {
    const monaco = monacoRef.current
    const model = editorRef.current?.getModel()
    if (!monaco || !model) return
    const markers = diagnostics
      .filter((d) => d.line > 0)
      .map((d) => ({
        severity: d.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
        message: `${d.code}: ${d.message}`,
        startLineNumber: d.line,
        endLineNumber: d.line,
        startColumn: 1,
        endColumn: model.getLineMaxColumn(d.line)
      }))
    monaco.editor.setModelMarkers(model, 'icf', markers)
  }, [diagnostics, index])

  // Render bookmarks as gutter glyphs (Prompt.md §Editor Features).
  useEffect(() => {
    const monaco = monacoRef.current
    const editorInstance = editorRef.current
    if (!monaco || !editorInstance) return
    const decorations = (bookmarks ?? []).map((line) => ({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        glyphMarginClassName: 'icf-bookmark-glyph',
        glyphMarginHoverMessage: { value: 'Bookmark' }
      }
    }))
    bookmarkDecorations.current = editorInstance.deltaDecorations(
      bookmarkDecorations.current,
      decorations
    )
  }, [bookmarks])

  if (!active) {
    return (
      <div className="flex h-full items-center justify-center text-app-muted">
        <div className="text-center">
          <p className="text-lg">No file open</p>
          <p className="mt-1 text-sm">Open an .icf or .icx file, or create a new document.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full">
      <Editor
        height="100%"
        language="icf"
        theme={resolvedTheme === 'dark' ? 'icf-dark' : 'icf-light'}
        value={active.text}
        path={active.id}
        onChange={commitEditorChange}
        onMount={handleMount}
        options={{
          readOnly: active.mode === 'view',
          fontFamily: 'var(--app-font-mono)',
          fontSize: 13,
          minimap: { enabled: true },
          glyphMargin: true,
          folding: true,
          renderWhitespace: 'boundary',
          tabSize: 2,
          insertSpaces: true,
          wordWrap: 'off',
          scrollBeyondLastLine: false
        }}
      />
      {/* Scroll-position indicator: the record id at the top of the viewport,
          shown only while scrolling (opacity toggled imperatively in handleMount). */}
      <div
        ref={scrollHintRef}
        aria-hidden
        style={{ top: 40 }}
        className="pointer-events-none absolute right-6 z-20 max-w-[45%] truncate rounded-md border border-app-border bg-app-surface/95 px-2 py-1 text-xs font-medium text-app-text opacity-0 shadow-md transition-opacity duration-200"
      />
    </div>
  )
}
