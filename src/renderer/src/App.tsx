import { useCallback, useEffect, useMemo, useRef } from 'react'
import { EditorPane, type EditorController } from './components/EditorPane'
import { Toolbar } from './components/Toolbar'
import { TabBar } from './components/TabBar'
import { StatusBar } from './components/StatusBar'
import { SchemaFilter } from './components/SchemaFilter'
import { TreePanel } from './panels/TreePanel'
import { PropertiesPanel } from './panels/PropertiesPanel'
import { ValidationPanel } from './panels/ValidationPanel'
import { SearchPanel } from './panels/SearchPanel'
import { StatisticsPanel } from './panels/StatisticsPanel'
import { IcxComparePanel } from './panels/IcxComparePanel'
import { TipsPanel } from './panels/TipsPanel'
import { DialogHost } from './dialogs/DialogHost'
import { useTheme } from './hooks/useTheme'
import { useAppCommands } from './hooks/useAppCommands'
import { useAutosave } from './hooks/useAutosave'
import { checkExternalChange } from './actions/externalCheck'
import { initWorkspace } from './actions/session'
import { useUiStore } from './stores/uiStore'
import { useDocumentStore } from './stores/documentStore'

/** Bottom-panel tab definitions. */
const BOTTOM_TABS = [
  { id: 'validation', label: 'Problems' },
  { id: 'search', label: 'Search' },
  { id: 'statistics', label: 'Statistics' },
  { id: 'icx', label: 'ICX Compare' },
  { id: 'tips', label: 'Tips' }
] as const

export function App() {
  const resolvedTheme = useTheme()
  useAutosave()
  const controller = useRef<EditorController | null>(null)
  const documents = useDocumentStore((s) => s.documents)
  const activeId = useDocumentStore((s) => s.activeId)

  // The command bus needs to move the editor caret; bind it to the controller.
  // The ref is stable, so memoize the nav object to avoid re-subscribing menus.
  const nav = useMemo(
    () => ({
      revealRecord: (recordIndex: number) => controller.current?.revealRecord(recordIndex),
      revealLine: (line: number) => controller.current?.revealLine(line)
    }),
    []
  )
  const dispatch = useAppCommands(nav)

  const activeBottom = useUiStore((s) => s.activeBottomPanel)
  const setBottom = useUiStore((s) => s.setBottomPanel)

  const revealLine = useCallback((line: number) => controller.current?.revealLine(line), [])
  const revealNode = useCallback(
    (line: number, recordIndex?: number) => {
      if (recordIndex !== undefined) {
        useUiStore.getState().selectRecord(recordIndex)
        controller.current?.revealRecord(recordIndex)
      } else {
        controller.current?.revealLine(line)
      }
    },
    []
  )

  // Restore the previous session once on launch (idempotent — guarded against
  // StrictMode's double-invoked effect), then keep the editor non-empty.
  const restoreDone = useRef(false)
  useEffect(() => {
    void initWorkspace().finally(() => {
      restoreDone.current = true
    })
  }, [])

  // After restore, keep a blank document when the user closes the last tab.
  useEffect(() => {
    if (restoreDone.current && useDocumentStore.getState().documents.length === 0) {
      useDocumentStore.getState().newDocument()
    }
  }, [documents.length])

  // On switching documents, clear state that belonged to the previous one:
  // the schema filter (so it can't silently hide records here) and the record
  // selection / caret line (so the Properties panel reflects this document).
  // Then check whether the now-active file changed on disk (external edit/delete).
  useEffect(() => {
    const ui = useUiStore.getState()
    ui.setSchemaFilter([])
    ui.selectRecord(null)
    ui.setCursorLine(1)
    if (activeId) void checkExternalChange(activeId)
  }, [activeId])

  return (
    <div className="flex h-full flex-col bg-app-bg text-app-text">
      <Toolbar dispatch={dispatch} />
      <TabBar />

      <div className="flex min-h-0 flex-1">
        {/* Left sidebar: outline + record properties. */}
        <aside className="flex w-72 flex-col border-r border-app-border bg-app-surface">
          <SectionHeader label="Explorer" />
          <SchemaFilter />
          <div className="min-h-0 flex-1">
            {/* Key by document so the virtualized tree fully re-initializes (and
                re-measures) when the active tab changes, rather than reusing a
                stale virtualizer instance from the previous document. */}
            <TreePanel key={activeId ?? 'none'} onReveal={revealNode} />
          </div>
          <SectionHeader label="Properties" />
          <div className="h-56 overflow-auto border-t border-app-border">
            <PropertiesPanel />
          </div>
        </aside>

        {/* Center: the Monaco editor. */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <EditorPane resolvedTheme={resolvedTheme} onReady={(c) => (controller.current = c)} />
          </div>

          {/* Bottom panel with tabs. */}
          <div className="flex h-64 flex-col border-t border-app-border bg-app-surface">
            <div className="flex border-b border-app-border" role="tablist" aria-label="Tools">
              {BOTTOM_TABS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeBottom === tab.id}
                  onClick={() => setBottom(tab.id)}
                  className={`px-3 py-1 text-xs ${
                    activeBottom === tab.id
                      ? 'border-b-2 border-app-accent text-app-text'
                      : 'text-app-muted hover:text-app-text'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1" role="tabpanel">
              {activeBottom === 'validation' && <ValidationPanel onJump={revealLine} />}
              {activeBottom === 'search' && (
                <SearchPanel
                  onJump={revealLine}
                  getSelection={() => controller.current?.getSelectionOffsets() ?? null}
                />
              )}
              {activeBottom === 'statistics' && <StatisticsPanel />}
              {activeBottom === 'icx' && <IcxComparePanel />}
              {activeBottom === 'tips' && <TipsPanel />}
            </div>
          </div>
        </main>
      </div>

      <StatusBar />

      <DialogHost onReveal={(recordIndex) => controller.current?.revealRecord(recordIndex)} />
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="bg-app-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-app-muted">
      {label}
    </div>
  )
}
