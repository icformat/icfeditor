import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { readFile, writeFile, stat, mkdir, readdir, unlink } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  IpcChannels,
  ICF_FILE_FILTERS,
  IMPORT_FILE_FILTERS,
  type FilePayload,
  type FileStat,
  type OpenDialogOptions
} from '../shared/ipc.js'
import { settings } from './store.js'
import { buildMenu } from './menu.js'

/** Reads a file's text plus its disk signature (mtime + size). */
async function readPayload(path: string): Promise<FilePayload> {
  const [content, s] = await Promise.all([readFile(path, 'utf-8'), stat(path)])
  return { path, content, mtimeMs: s.mtimeMs, size: s.size }
}

/** Directory holding persisted untitled buffers (session restore). */
const bufferDir = (): string => join(app.getPath('userData'), 'session-buffers')
/** A buffer id reduced to a safe file name. */
const bufferFile = (id: string): string => join(bufferDir(), id.replace(/[^A-Za-z0-9_-]/g, '_'))

/**
 * Registers every IPC handler the renderer relies on. All filesystem access is
 * confined to this module; the renderer only ever sees resolved strings.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(
    IpcChannels.openFileDialog,
    async (event, options: OpenDialogOptions = {}): Promise<FilePayload[]> => {
      const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
      const result = await dialog.showOpenDialog(win!, {
        title: 'Open ICF / ICX file',
        filters: ICF_FILE_FILTERS,
        properties: options.multi ? ['openFile', 'multiSelections'] : ['openFile']
      })
      if (result.canceled) return []
      return Promise.all(result.filePaths.map(readPayload))
    }
  )

  ipcMain.handle(IpcChannels.importFileDialog, async (event): Promise<FilePayload[]> => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, {
      title: 'Import XML / JSON / YAML / CSV',
      filters: IMPORT_FILE_FILTERS,
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled) return []
    return Promise.all(result.filePaths.map(readPayload))
  })

  ipcMain.handle(
    IpcChannels.saveFileDialog,
    async (event, defaultPath?: string): Promise<string | null> => {
      const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
      const result = await dialog.showSaveDialog(win!, {
        title: 'Save file',
        defaultPath: defaultPath ? basename(defaultPath) : 'untitled.icf',
        filters: ICF_FILE_FILTERS
      })
      return result.canceled ? null : (result.filePath ?? null)
    }
  )

  ipcMain.handle(IpcChannels.readFile, (_e, path: string): Promise<FilePayload> => readPayload(path))

  ipcMain.handle(
    IpcChannels.writeFile,
    async (_e, path: string, content: string): Promise<FileStat> => {
      await writeFile(path, content, 'utf-8')
      const s = await stat(path)
      return { mtimeMs: s.mtimeMs, size: s.size }
    }
  )

  ipcMain.handle(IpcChannels.statFile, async (_e, path: string): Promise<FileStat | null> => {
    try {
      const s = await stat(path)
      return { mtimeMs: s.mtimeMs, size: s.size }
    } catch {
      return null // missing / inaccessible
    }
  })

  ipcMain.handle(IpcChannels.writeBuffer, async (_e, id: string, content: string): Promise<void> => {
    await mkdir(bufferDir(), { recursive: true })
    await writeFile(bufferFile(id), content, 'utf-8')
  })

  ipcMain.handle(IpcChannels.readBuffer, async (_e, id: string): Promise<string | null> => {
    try {
      return await readFile(bufferFile(id), 'utf-8')
    } catch {
      return null
    }
  })

  ipcMain.handle(IpcChannels.pruneBuffers, async (_e, keepIds: string[]): Promise<void> => {
    try {
      const keep = new Set(keepIds.map((id) => basename(bufferFile(id))))
      for (const name of await readdir(bufferDir())) {
        if (!keep.has(name)) await unlink(join(bufferDir(), name)).catch(() => {})
      }
    } catch {
      // No buffer dir yet — nothing to prune.
    }
  })

  ipcMain.handle(IpcChannels.getRecentFiles, () => settings.getRecentFiles())
  ipcMain.handle(IpcChannels.addRecentFile, (_e, path: string) => {
    const list = settings.addRecentFile(path)
    buildMenu() // refresh the Open Recent submenu
    return list
  })
  ipcMain.handle(IpcChannels.clearRecentFiles, () => {
    settings.clearRecentFiles()
    buildMenu()
  })

  ipcMain.handle(IpcChannels.getSetting, (_e, key: string) => settings.get(key))
  ipcMain.handle(IpcChannels.setSetting, (_e, key: string, value: unknown) =>
    settings.set(key, value)
  )
}
