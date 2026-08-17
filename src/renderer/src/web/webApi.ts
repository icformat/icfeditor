import type {
  FilePayload,
  FileStat,
  IpcApi,
  MenuCommand,
  OpenDialogOptions
} from '@shared/ipc'
import { uniqueName } from './pathNames'

/**
 * Browser implementation of the {@link IpcApi} bridge, used by the web build
 * hosted on icformat.org. The renderer is written against `window.api` only,
 * so implementing this one interface with browser primitives gives the full
 * editor without touching any feature code.
 *
 * File access strategy:
 *  - **Chromium / Edge** — the File System Access API. Picked files keep a
 *    `FileSystemFileHandle`, so Save writes back to the real file, `statFile`
 *    sees live disk state (external-change detection works), and handles are
 *    persisted in IndexedDB so "Open Recent" survives a reload.
 *  - **Firefox / Safari** — a hidden `<input type=file>` for opening and a
 *    download for saving. Stats are snapshots taken at open/save time so the
 *    external-change logic stays quiet.
 *
 * Settings, untitled-buffer autosaves, and the recent list live in
 * `localStorage`; handles live in IndexedDB (they are structured-cloneable).
 */

// ---- File System Access API (not yet in TS's lib.dom) ----------------------

interface PickerType {
  description: string
  accept: Record<string, string[]>
}

interface OpenPickerOptions {
  multiple?: boolean
  types?: PickerType[]
}

interface SavePickerOptions {
  suggestedName?: string
  types?: PickerType[]
}

type PermissionKind = 'granted' | 'denied' | 'prompt'

interface FsHandle extends FileSystemFileHandle {
  queryPermission?(desc: { mode: 'read' | 'readwrite' }): Promise<PermissionKind>
  requestPermission?(desc: { mode: 'read' | 'readwrite' }): Promise<PermissionKind>
}

declare global {
  interface Window {
    showOpenFilePicker?(options?: OpenPickerOptions): Promise<FsHandle[]>
    showSaveFilePicker?(options?: SavePickerOptions): Promise<FsHandle>
  }
}

const ICF_TYPES: PickerType[] = [
  { description: 'ICF / ICX files', accept: { 'text/plain': ['.icf', '.icx'] } }
]
const IMPORT_TYPES: PickerType[] = [
  {
    description: 'Importable files',
    accept: {
      'application/json': ['.json'],
      'text/plain': ['.yaml', '.yml', '.csv'],
      'application/xml': ['.xml']
    }
  }
]
const ICF_ACCEPT = '.icf,.icx'
const IMPORT_ACCEPT = '.json,.yaml,.yml,.xml,.csv'

const SETTING_PREFIX = 'icf-editor.setting.'
const BUFFER_PREFIX = 'icf-editor.buffer.'
const RECENT_KEY = 'icf-editor.recent'
const MAX_RECENT = 12

// ---- IndexedDB persistence for file handles --------------------------------

const DB_NAME = 'icf-editor-web'
const DB_STORE = 'handles'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idb<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | undefined> {
  try {
    const db = await openDb()
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, mode)
      const req = run(tx.objectStore(DB_STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return undefined // private mode / storage disabled — degrade silently
  }
}

// ---- the API ---------------------------------------------------------------

/** Extra members the web shell uses on top of the shared IPC surface. */
export interface WebApi extends IpcApi {
  /** Publishes a menu command to the command bus (the web menu bar calls this). */
  emitMenuCommand(command: MenuCommand): void
  /** Publishes an open-by-path request (the Open Recent menu calls this). */
  emitOpenPath(path: string): void
  /** True when the browser supports real save-back (File System Access API). */
  readonly canSaveInPlace: boolean
  /** Cleared by forceClose so the beforeunload guard lets the window go. */
  readonly closeGuardEnabled: boolean
}

export function createWebApi(): WebApi {
  const handles = new Map<string, FsHandle>()
  /** Content snapshots for fallback-opened files (no handle to re-read). */
  const contents = new Map<string, string>()
  /** Last-known stats, used when no live handle stat is available. */
  const stats = new Map<string, FileStat>()
  const menuHandlers = new Set<(command: MenuCommand) => void>()
  const openHandlers = new Set<(path: string) => void>()
  const fsAccess = typeof window.showOpenFilePicker === 'function'
  let closeGuard = true

  function utf8Stat(content: string): FileStat {
    return { mtimeMs: Date.now(), size: new TextEncoder().encode(content).length }
  }

  /** Registers a handle under a unique pseudo-path (its file name). */
  async function registerHandle(handle: FsHandle): Promise<string> {
    for (const [path, existing] of handles) {
      try {
        if (await existing.isSameEntry(handle)) return path
      } catch {
        /* ignore and keep looking */
      }
    }
    const path = uniqueName([...handles.keys(), ...contents.keys()], handle.name)
    handles.set(path, handle)
    void idb('readwrite', (s) => s.put(handle, path))
    return path
  }

  async function payloadFromHandle(path: string, handle: FsHandle): Promise<FilePayload> {
    const file = await handle.getFile()
    const stat: FileStat = { mtimeMs: file.lastModified, size: file.size }
    stats.set(path, stat)
    return { path, content: await file.text(), ...stat }
  }

  /** Fallback open: a hidden file input; resolves [] when dismissed. */
  function pickWithInput(accept: string, multiple: boolean): Promise<File[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = accept
      input.multiple = multiple
      input.style.display = 'none'
      document.body.appendChild(input)
      input.onchange = () => {
        resolve([...(input.files ?? [])])
        input.remove()
      }
      // `cancel` fires on modern browsers when the dialog is dismissed.
      input.oncancel = () => {
        resolve([])
        input.remove()
      }
      input.click()
    })
  }

  async function openFiles(types: PickerType[], accept: string, multiple: boolean): Promise<FilePayload[]> {
    if (fsAccess) {
      try {
        const picked = await window.showOpenFilePicker!({ multiple, types })
        return await Promise.all(
          picked.map(async (handle) => payloadFromHandle(await registerHandle(handle), handle))
        )
      } catch {
        return [] // user cancelled the picker
      }
    }
    const files = await pickWithInput(accept, multiple)
    return Promise.all(
      files.map(async (file) => {
        const path = uniqueName([...handles.keys(), ...contents.keys()], file.name)
        const content = await file.text()
        const stat: FileStat = { mtimeMs: file.lastModified, size: file.size }
        contents.set(path, content)
        stats.set(path, stat)
        return { path, content, ...stat }
      })
    )
  }

  /** Fallback save: hand the browser a download. */
  function download(name: string, content: string): void {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  function readRecent(): string[] {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      const list = raw ? (JSON.parse(raw) as unknown) : []
      return Array.isArray(list) ? list.filter((p): p is string => typeof p === 'string') : []
    } catch {
      return []
    }
  }

  function writeRecent(list: string[]): void {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list))
    } catch {
      /* quota / private mode */
    }
  }

  /** Finds a live or persisted handle for a pseudo-path (recents, reloads). */
  async function resolveHandle(path: string): Promise<FsHandle | null> {
    const live = handles.get(path)
    if (live) return live
    const stored = await idb<FsHandle>('readonly', (s) => s.get(path))
    if (!stored) return null
    // Reloaded handles need their permission re-confirmed (requires a user
    // gesture — recents clicks and session restores after a click qualify;
    // a denied/failed prompt just means the file can't be reopened).
    try {
      if ((await stored.queryPermission?.({ mode: 'readwrite' })) !== 'granted') {
        if ((await stored.requestPermission?.({ mode: 'readwrite' })) !== 'granted') return null
      }
    } catch {
      return null
    }
    handles.set(path, stored)
    return stored
  }

  return {
    async openFileDialog(options?: OpenDialogOptions) {
      return openFiles(ICF_TYPES, ICF_ACCEPT, options?.multi ?? false)
    },

    async importFileDialog() {
      return openFiles(IMPORT_TYPES, IMPORT_ACCEPT, true)
    },

    async saveFileDialog(defaultPath?: string) {
      const suggestedName = defaultPath?.split(/[\\/]/).pop() || 'untitled.icf'
      if (!fsAccess) return suggestedName // writeFile will download under this name
      try {
        const handle = await window.showSaveFilePicker!({ suggestedName, types: ICF_TYPES })
        return await registerHandle(handle)
      } catch {
        return null // cancelled
      }
    },

    async readFile(path: string) {
      const handle = await resolveHandle(path)
      if (handle) return payloadFromHandle(path, handle)
      const content = contents.get(path)
      const stat = stats.get(path)
      if (content !== undefined && stat) return { path, content, ...stat }
      throw new Error(`"${path}" is not available in this browser session`)
    },

    async writeFile(path: string, content: string) {
      const handle = await resolveHandle(path)
      if (handle) {
        const writable = await handle.createWritable()
        await writable.write(content)
        await writable.close()
        const file = await handle.getFile()
        const stat: FileStat = { mtimeMs: file.lastModified, size: file.size }
        stats.set(path, stat)
        return stat
      }
      download(path.split(/[\\/]/).pop() || path, content)
      contents.set(path, content)
      const stat = utf8Stat(content)
      stats.set(path, stat)
      return stat
    },

    async statFile(path: string) {
      const handle = handles.get(path)
      if (handle) {
        try {
          const file = await handle.getFile()
          const stat: FileStat = { mtimeMs: file.lastModified, size: file.size }
          stats.set(path, stat)
          return stat
        } catch (err) {
          // Deleted/moved on disk → report deletion; permission hiccups fall
          // back to the last-known snapshot so no false "deleted" prompt fires.
          if ((err as DOMException)?.name === 'NotFoundError') return null
        }
      }
      return stats.get(path) ?? null
    },

    async writeBuffer(id: string, content: string) {
      try {
        localStorage.setItem(BUFFER_PREFIX + id, content)
      } catch {
        /* quota exceeded — autosave of untitled buffers degrades */
      }
    },

    async readBuffer(id: string) {
      return localStorage.getItem(BUFFER_PREFIX + id)
    },

    async pruneBuffers(keepIds: string[]) {
      const keep = new Set(keepIds.map((id) => BUFFER_PREFIX + id))
      const drop: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(BUFFER_PREFIX) && !keep.has(key)) drop.push(key)
      }
      drop.forEach((key) => localStorage.removeItem(key))
    },

    async getRecentFiles() {
      return readRecent()
    },

    async addRecentFile(path: string) {
      const list = [path, ...readRecent().filter((p) => p !== path)].slice(0, MAX_RECENT)
      writeRecent(list)
      return list
    },

    async clearRecentFiles() {
      writeRecent([])
      void idb('readwrite', (s) => s.clear())
    },

    async getSetting<T = unknown>(key: string) {
      try {
        const raw = localStorage.getItem(SETTING_PREFIX + key)
        return raw === null ? undefined : (JSON.parse(raw) as T)
      } catch {
        return undefined
      }
    },

    async setSetting(key: string, value: unknown) {
      try {
        localStorage.setItem(SETTING_PREFIX + key, JSON.stringify(value))
      } catch {
        /* quota / private mode */
      }
    },

    async forceClose() {
      closeGuard = false
      window.close()
    },

    onMenuCommand(handler) {
      menuHandlers.add(handler)
      return () => menuHandlers.delete(handler)
    },

    onOpenPath(handler) {
      openHandlers.add(handler)
      return () => openHandlers.delete(handler)
    },

    platform: (/mac/i.test(navigator.platform || navigator.userAgent)
      ? 'darwin'
      : 'win32') as NodeJS.Platform,

    emitMenuCommand(command) {
      menuHandlers.forEach((h) => h(command))
    },

    emitOpenPath(path) {
      openHandlers.forEach((h) => h(path))
    },

    canSaveInPlace: fsAccess,

    get closeGuardEnabled() {
      return closeGuard
    }
  }
}
