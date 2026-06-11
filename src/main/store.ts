import Store from 'electron-store'

/**
 * Persistent app settings (theme, recent files, panel layout, autosave…).
 * Backed by electron-store so it survives restarts. The renderer reaches this
 * through the `settings:*` and `recent:*` IPC channels — never directly.
 */
interface SettingsSchema {
  recentFiles: string[]
  [key: string]: unknown
}

const MAX_RECENT = 12

const store = new Store<SettingsSchema>({
  name: 'icf-editor-settings',
  defaults: { recentFiles: [] }
})

export const settings = {
  get<T>(key: string): T | undefined {
    return store.get(key) as T | undefined
  },
  set(key: string, value: unknown): void {
    store.set(key, value)
  },
  getRecentFiles(): string[] {
    return store.get('recentFiles', [])
  },
  addRecentFile(path: string): string[] {
    const existing = store.get('recentFiles', []).filter((p) => p !== path)
    const next = [path, ...existing].slice(0, MAX_RECENT)
    store.set('recentFiles', next)
    return next
  },
  clearRecentFiles(): void {
    store.set('recentFiles', [])
  }
}
