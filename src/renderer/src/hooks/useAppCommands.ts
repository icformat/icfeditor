import { useCallback, useEffect } from 'react'
import type { MenuCommand } from '@shared/ipc'
import { useDocumentStore } from '../stores/documentStore'
import { useUiStore } from '../stores/uiStore'
import type { ThemePreference } from '../models/settings'
import { nextBookmark } from '../utils/bookmarks'
import { saveDocument, saveDocumentAs, saveAll } from '../actions/fileActions'
import { persistSession } from '../actions/session'

/** Editor navigation callbacks the command bus drives (bound to Monaco). */
export interface CommandNav {
  revealRecord: (recordIndex: number) => void
  revealLine: (line: number) => void
}

/** Cycles light -> dark -> system. */
const THEME_CYCLE: Record<ThemePreference, ThemePreference> = {
  light: 'dark',
  dark: 'system',
  system: 'light'
}

/**
 * The renderer's command bus. Maps {@link MenuCommand}s (from the app menu via
 * IPC, and from the in-app key handler) to store actions and navigation. A
 * single dispatcher keeps the menu, keyboard, and toolbar in lock-step.
 *
 * Record navigation needs to move the editor caret, so the caller passes a
 * `revealRecord` callback bound to the Monaco instance.
 */
export function useAppCommands(nav: CommandNav) {
  const dispatch = useCallback(
    async (command: MenuCommand) => {
      const revealRecord = nav.revealRecord
      const docStore = useDocumentStore.getState()
      const uiStore = useUiStore.getState()
      const active = docStore.active()

      switch (command) {
        case 'file.new':
          docStore.newDocument()
          break

        case 'file.open': {
          const files = await window.api.openFileDialog({ multi: true })
          for (const file of files) {
            docStore.openFile(file.path, file.content, { mtimeMs: file.mtimeMs, size: file.size })
          }
          break
        }

        case 'file.save':
          if (active) await saveDocument(active.id)
          break

        case 'file.saveAs':
          if (active) await saveDocumentAs(active.id)
          break

        case 'file.saveAll':
          await saveAll()
          break

        case 'file.import':
          uiStore.openDialog('import')
          break

        case 'app.requestClose':
          // Window close requested by the main process. Prompt only for dirty
          // *saved* files (untitled buffers are auto-persisted to the session);
          // otherwise persist the session and let the close proceed.
          if (docStore.documents.some((d) => d.dirty && d.path)) uiStore.openClosePrompt({ kind: 'app' })
          else {
            await persistSession()
            await window.api.forceClose()
          }
          break

        case 'view.toggleMode':
          if (active) docStore.setMode(active.id, active.mode === 'edit' ? 'view' : 'edit')
          break

        case 'view.toggleTheme':
          uiStore.setTheme(THEME_CYCLE[uiStore.theme])
          break

        case 'view.toggleAutosave':
          uiStore.setAutosave(!uiStore.autosave)
          break

        case 'doc.validate':
          uiStore.setBottomPanel('validation')
          docStore.refreshActive()
          break

        case 'record.previous': {
          const current = uiStore.selectedRecord ?? 0
          const next = Math.max(0, current - 1)
          uiStore.selectRecord(next)
          revealRecord(next)
          break
        }

        case 'record.next': {
          const total = docStore.index?.records.length ?? 0
          const current = uiStore.selectedRecord ?? -1
          const next = Math.min(total - 1, current + 1)
          if (next >= 0) {
            uiStore.selectRecord(next)
            revealRecord(next)
          }
          break
        }

        case 'record.goto':
          uiStore.openDialog('goto')
          break

        case 'record.insert':
          docStore.editRecord('insert', uiStore.selectedRecord)
          break

        case 'record.duplicate':
          if (uiStore.selectedRecord !== null) docStore.editRecord('duplicate', uiStore.selectedRecord)
          break

        case 'record.delete':
          if (uiStore.selectedRecord !== null) docStore.editRecord('delete', uiStore.selectedRecord)
          break

        case 'icx.regenerate':
          await docStore.regenerateIcx()
          uiStore.setBottomPanel('icx')
          break

        case 'doc.export':
          uiStore.openDialog('export')
          break

        case 'transform.merge':
          uiStore.openDialog('merge')
          break

        case 'transform.split':
          uiStore.openDialog('split')
          break

        case 'edit.find':
        case 'edit.replace':
          uiStore.setBottomPanel('search')
          break

        case 'help.about':
          uiStore.openDialog('about')
          break

        case 'edit.toggleBookmark':
          docStore.toggleBookmark(uiStore.cursorLine)
          break

        case 'edit.nextBookmark': {
          const target = nextBookmark(active?.bookmarks ?? [], uiStore.cursorLine)
          if (target !== null) {
            nav.revealLine(target)
            uiStore.setCursorLine(target)
          }
          break
        }

        case 'edit.clearBookmarks':
          docStore.clearBookmarks()
          break

        // Undo/redo are handled by Monaco's own buffer; nothing to do here.
        case 'edit.undo':
        case 'edit.redo':
          break
      }
    },
    [nav]
  )

  // Bridge menu commands and OS file-open events from the main process. Guarded
  // so the renderer still mounts when opened outside Electron (e.g. a plain
  // browser tab at the Vite dev URL), where the preload bridge is absent.
  useEffect(() => {
    if (!window.api) return
    const offMenu = window.api.onMenuCommand((cmd) => void dispatch(cmd))
    const offOpen = window.api.onOpenPath((path) => {
      void window.api
        .readFile(path)
        .then((f) =>
          useDocumentStore.getState().openFile(f.path, f.content, { mtimeMs: f.mtimeMs, size: f.size })
        )
    })
    return () => {
      offMenu()
      offOpen()
    }
  }, [dispatch])

  // In-app keyboard shortcuts that have no menu accelerator.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F7') void dispatch('record.previous')
      else if (e.key === 'F8') void dispatch('record.next')
      else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm') void dispatch('view.toggleMode')
      else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v') void dispatch('view.toggleTheme')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [dispatch])

  return dispatch
}
