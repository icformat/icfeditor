import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { registerIpcHandlers } from './ipc.js'
import { buildMenu } from './menu.js'
import { IpcChannels } from '../shared/ipc.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Window icon for dev and Linux (packaged Windows/macOS use the icon embedded by
// electron-builder from build/). `build/` is not bundled into the app, so this
// resolves only when running from the project tree; missing → Electron ignores it.
const windowIcon = join(__dirname, '../../build/icon.png')

/** Path passed on the CLI / via file association, delivered to the renderer once ready. */
let pendingOpenPath: string | null = null

/** Windows the renderer has cleared for closing (unsaved-changes guard satisfied). */
const closeApproved = new WeakSet<BrowserWindow>()

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#1e1e1e',
    title: 'ICF Editor',
    ...(existsSync(windowIcon) ? { icon: windowIcon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => {
    win.show()
    if (pendingOpenPath) {
      win.webContents.send(IpcChannels.openPath, pendingOpenPath)
      pendingOpenPath = null
    }
  })

  // Guard against closing with unsaved changes: defer to the renderer, which
  // shows the "Save changes?" dialog and calls back via the forceClose IPC.
  win.on('close', (event) => {
    if (closeApproved.has(win)) return
    event.preventDefault()
    win.webContents.send(IpcChannels.menuCommand, 'app.requestClose')
  })

  // Open external links in the OS browser, never in-app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

// A file passed as an argument (Windows/Linux file association or CLI).
const fileArg = process.argv.find((a) => a.endsWith('.icf') || a.endsWith('.icx'))
if (fileArg) pendingOpenPath = fileArg

// macOS file association.
app.on('open-file', (event, path) => {
  event.preventDefault()
  const win = BrowserWindow.getAllWindows()[0]
  if (win) win.webContents.send(IpcChannels.openPath, path)
  else pendingOpenPath = path
})

// The renderer calls this once the user has resolved unsaved changes; it marks
// the window approved and re-issues the close, which now passes the guard.
ipcMain.handle(IpcChannels.forceClose, (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    closeApproved.add(win)
    win.close()
  }
})

app.whenReady().then(() => {
  registerIpcHandlers()
  buildMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
