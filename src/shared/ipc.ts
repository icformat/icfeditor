/**
 * IPC contract shared by the Electron main process and the renderer.
 *
 * Channel names live here as constants so both sides import the same strings,
 * and the {@link IpcApi} interface is the exact shape exposed on `window.api`
 * by the preload bridge. The renderer never touches Node or the filesystem
 * directly — every privileged operation goes through one of these methods.
 */

export const IpcChannels = {
  openFileDialog: 'dialog:openFile',
  importFileDialog: 'dialog:importFile',
  saveFileDialog: 'dialog:saveFile',
  readFile: 'fs:readFile',
  writeFile: 'fs:writeFile',
  getRecentFiles: 'recent:get',
  addRecentFile: 'recent:add',
  clearRecentFiles: 'recent:clear',
  getSetting: 'settings:get',
  setSetting: 'settings:set',
  statFile: 'fs:statFile',
  writeBuffer: 'buffer:write',
  readBuffer: 'buffer:read',
  pruneBuffers: 'buffer:prune',
  forceClose: 'app:forceClose',
  // main -> renderer pushes
  menuCommand: 'menu:command',
  openPath: 'app:openPath'
} as const

/** On-disk signature used to detect external modification/deletion. */
export interface FileStat {
  mtimeMs: number
  size: number
}

/** A file the renderer asked to be read, with its text content and disk signature. */
export interface FilePayload {
  path: string
  content: string
  mtimeMs: number
  size: number
}

/** Options passed to the native open dialog. */
export interface OpenDialogOptions {
  multi?: boolean
}

/** Editor file filters used by both open and save dialogs. */
export const ICF_FILE_FILTERS = [
  { name: 'ICF / ICX files', extensions: ['icf', 'icx'] },
  { name: 'ICF document', extensions: ['icf'] },
  { name: 'ICX index', extensions: ['icx'] },
  { name: 'All files', extensions: ['*'] }
]

/** Filters for the Import dialog (XML / JSON / YAML / CSV → ICF). */
export const IMPORT_FILE_FILTERS = [
  { name: 'Importable files', extensions: ['json', 'yaml', 'yml', 'xml', 'csv'] },
  { name: 'JSON', extensions: ['json'] },
  { name: 'YAML', extensions: ['yaml', 'yml'] },
  { name: 'XML', extensions: ['xml'] },
  { name: 'CSV', extensions: ['csv'] }
]

/** Menu/global commands forwarded from main to the renderer command bus. */
export type MenuCommand =
  | 'file.new'
  | 'file.open'
  | 'file.save'
  | 'file.saveAs'
  | 'file.saveAll'
  | 'file.import'
  | 'app.requestClose'
  | 'edit.undo'
  | 'edit.redo'
  | 'edit.find'
  | 'edit.replace'
  | 'edit.toggleBookmark'
  | 'edit.nextBookmark'
  | 'edit.clearBookmarks'
  | 'view.toggleMode'
  | 'view.toggleTheme'
  | 'view.toggleAutosave'
  | 'icx.regenerate'
  | 'doc.validate'
  | 'doc.export'
  | 'transform.merge'
  | 'transform.split'
  | 'record.previous'
  | 'record.next'
  | 'record.goto'
  | 'record.insert'
  | 'record.duplicate'
  | 'record.delete'
  | 'help.about'

/** The surface exposed on `window.api`. */
export interface IpcApi {
  openFileDialog(options?: OpenDialogOptions): Promise<FilePayload[]>
  importFileDialog(): Promise<FilePayload[]>
  saveFileDialog(defaultPath?: string): Promise<string | null>
  readFile(path: string): Promise<FilePayload>
  writeFile(path: string, content: string): Promise<FileStat>
  /** Disk signature of a path, or null when it no longer exists. */
  statFile(path: string): Promise<FileStat | null>
  /** Persists an untitled buffer's content to a temp file keyed by `id`. */
  writeBuffer(id: string, content: string): Promise<void>
  /** Reads a previously persisted buffer, or null if it is gone. */
  readBuffer(id: string): Promise<string | null>
  /** Deletes any persisted buffers whose id is not in `keepIds`. */
  pruneBuffers(keepIds: string[]): Promise<void>
  getRecentFiles(): Promise<string[]>
  addRecentFile(path: string): Promise<string[]>
  clearRecentFiles(): Promise<void>
  getSetting<T = unknown>(key: string): Promise<T | undefined>
  setSetting(key: string, value: unknown): Promise<void>
  /** Closes the window, bypassing the unsaved-changes guard (already handled). */
  forceClose(): Promise<void>
  onMenuCommand(handler: (command: MenuCommand) => void): () => void
  onOpenPath(handler: (path: string) => void): () => void
  platform: NodeJS.Platform
}
