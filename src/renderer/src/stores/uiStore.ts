import { create } from 'zustand'
import type { ThemePreference } from '../models/settings'
import type { DiskState } from '../utils/diskState'

/** Persisted, resizable layout dimensions (px). Defaults match the old fixed
 *  Tailwind sizes: w-72 / h-56 / h-64. Stored in localStorage so the user's
 *  pane sizes survive restarts. */
export interface LayoutSizes {
  sidebarWidth: number
  propertiesHeight: number
  bottomPanelHeight: number
}

const LAYOUT_KEY = 'icfeditor.layout'
const LAYOUT_DEFAULTS: LayoutSizes = {
  sidebarWidth: 288,
  propertiesHeight: 224,
  bottomPanelHeight: 256
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

function loadLayout(): LayoutSizes {
  if (typeof localStorage === 'undefined') return LAYOUT_DEFAULTS
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (!raw) return LAYOUT_DEFAULTS
    const p = JSON.parse(raw) as Partial<LayoutSizes>
    return {
      sidebarWidth: clamp(Number(p.sidebarWidth) || LAYOUT_DEFAULTS.sidebarWidth, 160, 800),
      propertiesHeight: clamp(Number(p.propertiesHeight) || LAYOUT_DEFAULTS.propertiesHeight, 80, 640),
      bottomPanelHeight: clamp(Number(p.bottomPanelHeight) || LAYOUT_DEFAULTS.bottomPanelHeight, 80, 720)
    }
  } catch {
    return LAYOUT_DEFAULTS
  }
}

function saveLayout(sizes: LayoutSizes): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(
      LAYOUT_KEY,
      JSON.stringify({
        sidebarWidth: sizes.sidebarWidth,
        propertiesHeight: sizes.propertiesHeight,
        bottomPanelHeight: sizes.bottomPanelHeight
      })
    )
  } catch {
    /* storage may be unavailable (private mode / quota) — sizes stay in-memory */
  }
}

/** Which side/bottom panels are visible (VS Code-like layout). */
export type PanelId = 'tree' | 'properties' | 'validation' | 'search' | 'statistics' | 'tips'

/** Modal dialogs (Prompt.md §Merge/§Split/§Export/§Help). */
export type DialogId = 'merge' | 'split' | 'export' | 'goto' | 'about' | 'import'

/**
 * An in-flight close that is blocked on unsaved changes. `tab` closes a single
 * document (identified by `docId`); `app` closes the whole window.
 */
export interface ClosePrompt {
  kind: 'tab' | 'app'
  docId?: string
}

/** A document whose on-disk file changed externally, awaiting the user's choice. */
export interface ExternalPrompt {
  docId: string
  kind: 'modified' | 'deleted'
  /** Current disk signature (null when deleted) — used to acknowledge the change. */
  current: DiskState | null
}

interface UiState {
  theme: ThemePreference
  /** Visible panels. Tree + properties default on, like an IDE. */
  panels: Record<PanelId, boolean>
  /** The active bottom panel tab. */
  activeBottomPanel: 'validation' | 'search' | 'statistics' | 'icx' | 'tips'
  /** Selected record index in the tree/record viewer, or null. */
  selectedRecord: number | null
  /** Current 1-based caret line in the editor (drives bookmark toggling). */
  cursorLine: number
  /** Schema ids the record list is filtered to (empty = show all). */
  schemaFilter: string[]
  /** The currently open modal dialog, or null. */
  activeDialog: DialogId | null
  /** A close blocked on unsaved changes, or null. */
  closePrompt: ClosePrompt | null
  /** An external file change awaiting the user's reload/remove decision, or null. */
  externalPrompt: ExternalPrompt | null
  /** Periodically write dirty, saved documents to disk (Prompt.md §Editor Features). */
  autosave: boolean
  /** Resizable pane dimensions (px), persisted to localStorage. */
  sidebarWidth: number
  propertiesHeight: number
  bottomPanelHeight: number
  /** When true, the editor body fills the window (sidebar + bottom panel hidden). */
  editorMaximized: boolean

  setTheme(theme: ThemePreference): void
  setSidebarWidth(width: number): void
  setPropertiesHeight(height: number): void
  setBottomPanelHeight(height: number): void
  toggleEditorMaximized(): void
  setAutosave(enabled: boolean): void
  openClosePrompt(prompt: ClosePrompt): void
  closeClosePrompt(): void
  openExternalPrompt(prompt: ExternalPrompt): void
  closeExternalPrompt(): void
  togglePanel(panel: PanelId): void
  setBottomPanel(panel: UiState['activeBottomPanel']): void
  selectRecord(index: number | null): void
  setCursorLine(line: number): void
  setSchemaFilter(ids: string[]): void
  openDialog(dialog: DialogId): void
  closeDialog(): void
}

export const useUiStore = create<UiState>((set) => ({
  theme: 'system',
  panels: {
    tree: true,
    properties: true,
    validation: true,
    search: false,
    statistics: false,
    tips: false
  },
  activeBottomPanel: 'validation',
  selectedRecord: null,
  cursorLine: 1,
  schemaFilter: [],
  activeDialog: null,
  closePrompt: null,
  externalPrompt: null,
  autosave: false,
  ...loadLayout(),
  editorMaximized: false,

  setTheme: (theme) => set({ theme }),
  setSidebarWidth: (sidebarWidth) =>
    set((s) => {
      saveLayout({ ...s, sidebarWidth })
      return { sidebarWidth }
    }),
  setPropertiesHeight: (propertiesHeight) =>
    set((s) => {
      saveLayout({ ...s, propertiesHeight })
      return { propertiesHeight }
    }),
  setBottomPanelHeight: (bottomPanelHeight) =>
    set((s) => {
      saveLayout({ ...s, bottomPanelHeight })
      return { bottomPanelHeight }
    }),
  toggleEditorMaximized: () => set((s) => ({ editorMaximized: !s.editorMaximized })),
  setAutosave: (autosave) => set({ autosave }),
  openClosePrompt: (closePrompt) => set({ closePrompt }),
  closeClosePrompt: () => set({ closePrompt: null }),
  openExternalPrompt: (externalPrompt) => set({ externalPrompt }),
  closeExternalPrompt: () => set({ externalPrompt: null }),
  togglePanel: (panel) => set((s) => ({ panels: { ...s.panels, [panel]: !s.panels[panel] } })),
  setBottomPanel: (activeBottomPanel) => set({ activeBottomPanel }),
  selectRecord: (selectedRecord) => set({ selectedRecord }),
  setCursorLine: (cursorLine) => set({ cursorLine }),
  setSchemaFilter: (schemaFilter) => set({ schemaFilter }),
  openDialog: (activeDialog) => set({ activeDialog }),
  closeDialog: () => set({ activeDialog: null })
}))
