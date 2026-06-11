import type { MenuCommand } from '@shared/ipc'

/** A keyboard shortcut definition, used by the Tips panel and the key handler. */
export interface Shortcut {
  command: MenuCommand
  keys: string
  label: string
}

/**
 * The canonical shortcut map (Prompt.md §Keyboard Shortcuts). The main-process
 * menu owns the OS accelerators; this table drives the in-app key handler for
 * shortcuts without menu items and documents them in the Tips panel.
 */
export const SHORTCUTS: Shortcut[] = [
  { command: 'file.save', keys: 'Ctrl+S', label: 'Save' },
  { command: 'edit.undo', keys: 'Ctrl+Z', label: 'Undo' },
  { command: 'edit.redo', keys: 'Ctrl+Y', label: 'Redo' },
  { command: 'edit.find', keys: 'Ctrl+F', label: 'Find' },
  { command: 'edit.replace', keys: 'Ctrl+H', label: 'Replace' },
  { command: 'edit.toggleBookmark', keys: 'Ctrl+B', label: 'Toggle Bookmark' },
  { command: 'edit.nextBookmark', keys: 'Ctrl+Shift+B', label: 'Next Bookmark' },
  { command: 'record.goto', keys: 'Ctrl+G', label: 'Go To Record' },
  { command: 'view.toggleMode', keys: 'Ctrl+Shift+M', label: 'Toggle View/Edit Mode' },
  { command: 'view.toggleTheme', keys: 'Ctrl+Shift+V', label: 'Toggle Theme' },
  { command: 'icx.regenerate', keys: 'F5', label: 'Regenerate ICX' },
  { command: 'doc.validate', keys: 'F6', label: 'Validate' },
  { command: 'record.previous', keys: 'F7', label: 'Previous Record' },
  { command: 'record.next', keys: 'F8', label: 'Next Record' }
]
