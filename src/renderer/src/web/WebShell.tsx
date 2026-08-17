import { useEffect } from 'react'
import { App } from '../App'
import { useDocumentStore } from '../stores/documentStore'
import { WebMenuBar } from './WebMenuBar'
import { commandForKey } from './webShortcuts'
import type { WebApi } from './webApi'

/**
 * Web-build wrapper around the shared {@link App}: adds the in-app menu bar,
 * binds the keyboard shortcuts the native menu used to own, and guards the
 * tab against closing with unsaved changes.
 */
export function WebShell({ api }: { api: WebApi }) {
  // Keyboard accelerators (capture phase so the browser's own Ctrl+S / Ctrl+O /
  // Ctrl+F / F5 bindings never fire; Monaco still sees everything unmapped).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const command = commandForKey(e)
      if (!command) return
      e.preventDefault()
      e.stopPropagation()
      api.emitMenuCommand(command)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [api])

  // Warn before leaving the page with unsaved changes to *saved* files
  // (untitled buffers auto-persist to localStorage, mirroring the desktop
  // close flow in useAppCommands).
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!api.closeGuardEnabled) return
      const dirty = useDocumentStore.getState().documents.some((d) => d.dirty && d.path)
      if (dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [api])

  return (
    <div className="flex h-full flex-col">
      <WebMenuBar api={api} />
      <div className="min-h-0 flex-1">
        <App />
      </div>
    </div>
  )
}
