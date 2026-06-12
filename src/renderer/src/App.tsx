import { useCallback, useEffect, useMemo, useRef } from 'react'
import { EditorPane, type EditorController } from './components/EditorPane'
import { Toolbar } from './components/Toolbar'
import { TabBar } from './components/TabBar'
import { StatusBar } from './components/StatusBar'
import { SchemaFilter } from './components/SchemaFilter'
import { Splitter } from './components/Splitter'
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

  // Resizable layout dimensions + the editor maximize toggle.
  const sidebarWidth = useUiStore((s) => s.sidebarWidth)
  const propertiesHeight = useUiStore((s) => s.propertiesHeight)
  const bottomPanelHeight = useUiStore((s) => s.bottomPanelHeight)
  const maximized = useUiStore((s) => s.editorMaximized)
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth)
  const setPropertiesHeight = useUiStore((s) => s.setPropertiesHeight)
  const setBottomPanelHeight = useUiStore((s) => s.setBottomPanelHeight)
  const toggleMaximized = useUiStore((s) => s.toggleEditorMaximized)

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
        {/* Left sidebar: outline + record properties. Hidden when maximized. */}
        {!maximized && (
          <>
            <aside
              className="flex shrink-0 flex-col border-r border-app-border bg-app-surface"
              style={{ width: sidebarWidth }}
            >
              <SectionHeader label="Explorer" />
              <SchemaFilter />
              <div className="min-h-0 flex-1">
                {/* Key by document so the virtualized tree fully re-initializes (and
                    re-measures) when the active tab changes, rather than reusing a
                    stale virtualizer instance from the previous document. */}
                <TreePanel key={activeId ?? 'none'} onReveal={revealNode} />
              </div>
              <Splitter
                axis="y"
                invert
                value={propertiesHeight}
                min={96}
                max={480}
                onChange={setPropertiesHeight}
                ariaLabel="Resize properties panel"
              />
              <SectionHeader label="Properties" />
              <div
                className="shrink-0 overflow-auto"
                style={{ height: propertiesHeight }}
              >
                <PropertiesPanel />
              </div>
            </aside>
            <Splitter
              axis="x"
              value={sidebarWidth}
              min={180}
              max={640}
              onChange={setSidebarWidth}
              ariaLabel="Resize sidebar"
            />
          </>
        )}

        {/* Center: the Monaco editor. */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <EditorPane resolvedTheme={resolvedTheme} onReady={(c) => (controller.current = c)} />
            <button
              type="button"
              onClick={toggleMaximized}
              title={maximized ? 'Restore layout' : 'Maximize editor'}
              aria-label={maximized ? 'Restore layout' : 'Maximize editor'}
              aria-pressed={maximized}
              className="absolute right-3 top-2 z-10 rounded border border-app-border bg-app-surface/90 p-1 text-app-muted shadow-sm hover:bg-app-surface-hover hover:text-app-text"
            >
              <MaximizeIcon maximized={maximized} />
            </button>
          </div>

          {/* Bottom panel with tabs. Hidden when maximized. */}
          {!maximized && (
            <>
              <Splitter
                axis="y"
                invert
                value={bottomPanelHeight}
                min={96}
                max={640}
                onChange={setBottomPanelHeight}
                ariaLabel="Resize bottom panel"
              />
              <div
                className="flex shrink-0 flex-col bg-app-surface"
                style={{ height: bottomPanelHeight }}
              >
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
            </>
          )}
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

/** Corner-bracket glyph: outward = maximize, inward = restore. */
function MaximizeIcon({ maximized }: { maximized: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {maximized ? (
        <path d="M6 2.5v3.5H2.5M10 2.5v3.5h3.5M6 13.5v-3.5H2.5M10 13.5v-3.5h3.5" />
      ) : (
        <path d="M2.5 6V2.5H6M13.5 6V2.5H10M2.5 10v3.5H6M13.5 10v3.5H10" />
      )}
    </svg>
  )
}
