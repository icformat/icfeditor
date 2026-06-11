import { useEffect, useRef } from 'react'
import { useUiStore } from '../stores/uiStore'
import { useDocumentStore } from '../stores/documentStore'
import { services } from '../services/container'

/** How often autosave scans for dirty documents to persist. */
const AUTOSAVE_INTERVAL_MS = 5000

/**
 * Autosave (Prompt.md §Editor Features). When enabled, periodically writes any
 * dirty document that already has a path; unsaved (pathless) buffers are left
 * alone since they need a Save-As target. The preference is loaded from and
 * persisted through SettingsService.
 */
export function useAutosave(): void {
  const autosave = useUiStore((s) => s.autosave)
  const loaded = useRef(false)

  // Load the persisted preference once.
  useEffect(() => {
    void services.settings.get<boolean>('autosave').then((value) => {
      loaded.current = true
      if (value !== undefined) useUiStore.getState().setAutosave(value)
    })
  }, [])

  // Persist on change (but not before the initial load has run).
  useEffect(() => {
    if (loaded.current) void services.settings.set('autosave', autosave)
  }, [autosave])

  // Periodic flush of dirty, saved documents.
  useEffect(() => {
    if (!autosave) return
    const id = setInterval(async () => {
      const { documents, markSaved } = useDocumentStore.getState()
      for (const doc of documents) {
        if (doc.dirty && doc.path) {
          await window.api.writeFile(doc.path, doc.text)
          markSaved(doc.id, doc.path)
        }
      }
    }, AUTOSAVE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [autosave])
}
