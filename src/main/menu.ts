import { app, Menu, shell, BrowserWindow } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import { IpcChannels, type MenuCommand } from '../shared/ipc.js'
import { settings } from './store.js'
import { basename } from 'node:path'

/** Sends a menu command to the focused renderer's command bus. */
function send(command: MenuCommand): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  win?.webContents.send(IpcChannels.menuCommand, command)
}

/** Asks the renderer to open a file by path (it reads + loads it). */
function openRecent(path: string): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  win?.webContents.send(IpcChannels.openPath, path)
}

/** Builds the dynamic "Open Recent" submenu from persisted settings. */
function recentSubmenu(): MenuItemConstructorOptions[] {
  const recent = settings.getRecentFiles()
  if (recent.length === 0) {
    return [{ label: 'No recent files', enabled: false }]
  }
  return [
    ...recent.map((path) => ({
      label: basename(path),
      sublabel: path,
      click: () => openRecent(path)
    })),
    { type: 'separator' as const },
    {
      label: 'Clear Recent',
      click: () => {
        settings.clearRecentFiles()
        buildMenu()
      }
    }
  ]
}

/**
 * Builds the application menu. Most items just forward a {@link MenuCommand}
 * to the renderer, which owns the actual editor behavior; the main process
 * only knows about windows and the OS.
 */
export function buildMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{ role: 'appMenu' as const }]
      : []),
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => send('file.new') },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => send('file.open') },
        { label: 'Open Recent', submenu: recentSubmenu() },
        { label: 'Import…', click: () => send('file.import') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('file.save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('file.saveAs') },
        { label: 'Save All', accelerator: 'CmdOrCtrl+Alt+S', click: () => send('file.saveAll') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => send('edit.undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', click: () => send('edit.redo') },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { label: 'Find', accelerator: 'CmdOrCtrl+F', click: () => send('edit.find') },
        { label: 'Replace', accelerator: 'CmdOrCtrl+H', click: () => send('edit.replace') },
        { type: 'separator' },
        { label: 'Toggle Bookmark', accelerator: 'CmdOrCtrl+B', click: () => send('edit.toggleBookmark') },
        { label: 'Next Bookmark', accelerator: 'CmdOrCtrl+Shift+B', click: () => send('edit.nextBookmark') },
        { label: 'Clear Bookmarks', click: () => send('edit.clearBookmarks') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle View/Edit Mode', click: () => send('view.toggleMode') },
        { label: 'Toggle Theme', click: () => send('view.toggleTheme') },
        { label: 'Toggle Autosave', click: () => send('view.toggleAutosave') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Document',
      submenu: [
        { label: 'Validate', accelerator: 'F6', click: () => send('doc.validate') },
        { label: 'Regenerate ICX', accelerator: 'F5', click: () => send('icx.regenerate') },
        { type: 'separator' },
        { label: 'Previous Record', accelerator: 'F7', click: () => send('record.previous') },
        { label: 'Next Record', accelerator: 'F8', click: () => send('record.next') },
        { label: 'Go To Record…', accelerator: 'CmdOrCtrl+G', click: () => send('record.goto') },
        { type: 'separator' },
        { label: 'Insert Record', click: () => send('record.insert') },
        { label: 'Duplicate Record', click: () => send('record.duplicate') },
        { label: 'Delete Record', click: () => send('record.delete') }
      ]
    },
    {
      label: 'Transform',
      submenu: [
        { label: 'Merge Files…', accelerator: 'CmdOrCtrl+Shift+G', click: () => send('transform.merge') },
        { label: 'Split File…', click: () => send('transform.split') },
        { label: 'Export…', click: () => send('doc.export') }
      ]
    },
    {
      role: 'help',
      submenu: [
        { label: 'ICF Specification', click: () => shell.openExternal('https://icformat.org/icf/specification/v1/') },
        { label: 'ICX Specification', click: () => shell.openExternal('https://icformat.org/icx/specification/v1/') },
        { label: 'icformat.org', click: () => shell.openExternal('https://icformat.org') },
        { type: 'separator' },
        { label: `About ${app.getName()}`, click: () => send('help.about') }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
