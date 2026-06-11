import { contextBridge, ipcRenderer } from 'electron'
import {
  IpcChannels,
  type IpcApi,
  type FilePayload,
  type FileStat,
  type MenuCommand,
  type OpenDialogOptions
} from '../shared/ipc.js'

/**
 * The single privileged surface exposed to the renderer. Everything here is a
 * thin pass-through to a main-process IPC handler — no Node primitives leak
 * across the bridge, satisfying `contextIsolation`.
 */
const api: IpcApi = {
  openFileDialog: (options?: OpenDialogOptions) =>
    ipcRenderer.invoke(IpcChannels.openFileDialog, options) as Promise<FilePayload[]>,
  importFileDialog: () =>
    ipcRenderer.invoke(IpcChannels.importFileDialog) as Promise<FilePayload[]>,
  saveFileDialog: (defaultPath?: string) =>
    ipcRenderer.invoke(IpcChannels.saveFileDialog, defaultPath) as Promise<string | null>,
  readFile: (path: string) =>
    ipcRenderer.invoke(IpcChannels.readFile, path) as Promise<FilePayload>,
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke(IpcChannels.writeFile, path, content) as Promise<FileStat>,
  statFile: (path: string) =>
    ipcRenderer.invoke(IpcChannels.statFile, path) as Promise<FileStat | null>,
  writeBuffer: (id: string, content: string) =>
    ipcRenderer.invoke(IpcChannels.writeBuffer, id, content) as Promise<void>,
  readBuffer: (id: string) =>
    ipcRenderer.invoke(IpcChannels.readBuffer, id) as Promise<string | null>,
  pruneBuffers: (keepIds: string[]) =>
    ipcRenderer.invoke(IpcChannels.pruneBuffers, keepIds) as Promise<void>,
  getRecentFiles: () => ipcRenderer.invoke(IpcChannels.getRecentFiles) as Promise<string[]>,
  addRecentFile: (path: string) =>
    ipcRenderer.invoke(IpcChannels.addRecentFile, path) as Promise<string[]>,
  clearRecentFiles: () => ipcRenderer.invoke(IpcChannels.clearRecentFiles) as Promise<void>,
  getSetting: <T>(key: string) =>
    ipcRenderer.invoke(IpcChannels.getSetting, key) as Promise<T | undefined>,
  setSetting: (key: string, value: unknown) =>
    ipcRenderer.invoke(IpcChannels.setSetting, key, value) as Promise<void>,
  forceClose: () => ipcRenderer.invoke(IpcChannels.forceClose) as Promise<void>,
  onMenuCommand: (handler: (command: MenuCommand) => void) => {
    const listener = (_e: unknown, command: MenuCommand) => handler(command)
    ipcRenderer.on(IpcChannels.menuCommand, listener)
    return () => ipcRenderer.removeListener(IpcChannels.menuCommand, listener)
  },
  onOpenPath: (handler: (path: string) => void) => {
    const listener = (_e: unknown, path: string) => handler(path)
    ipcRenderer.on(IpcChannels.openPath, listener)
    return () => ipcRenderer.removeListener(IpcChannels.openPath, listener)
  },
  platform: process.platform
}

contextBridge.exposeInMainWorld('api', api)
