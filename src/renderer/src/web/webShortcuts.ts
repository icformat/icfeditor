import type { MenuCommand } from '@shared/ipc'

/** The subset of KeyboardEvent this mapper reads (kept narrow for tests). */
export interface KeyLike {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

/**
 * Maps a keydown to the menu command the **native menu accelerator** would have
 * fired in the desktop build. Only shortcuts the OS menu owned live here — the
 * in-app handler in `useAppCommands` keeps covering F7/F8/Ctrl+Shift+M/
 * Ctrl+Shift+V, and Monaco keeps undo/redo/clipboard. Returns null for keys the
 * browser (or Monaco) should keep: notably Ctrl+N/Ctrl+W, which Chromium
 * reserves and never delivers to the page anyway.
 *
 * Every non-null result must be `preventDefault()`ed by the caller, because the
 * browser binds most of these itself (Ctrl+S save page, Ctrl+O open, Ctrl+F
 * find-in-page, F5 reload…).
 */
export function commandForKey(e: KeyLike): MenuCommand | null {
  const mod = e.ctrlKey || e.metaKey
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key

  if (mod && !e.altKey) {
    if (key === 'o' && !e.shiftKey) return 'file.open'
    if (key === 's' && e.shiftKey) return 'file.saveAs'
    if (key === 's') return 'file.save'
    if (key === 'f' && !e.shiftKey) return 'edit.find'
    if (key === 'h' && !e.shiftKey) return 'edit.replace'
    if (key === 'b' && e.shiftKey) return 'edit.nextBookmark'
    if (key === 'b') return 'edit.toggleBookmark'
    if (key === 'g' && !e.shiftKey) return 'record.goto'
  }
  if (mod && e.altKey && key === 's') return 'file.saveAll'
  if (!mod && e.altKey && e.key === 'Enter') return 'file.properties'
  if (!mod && !e.altKey && !e.shiftKey) {
    if (e.key === 'F5') return 'icx.regenerate'
    if (e.key === 'F6') return 'doc.validate'
  }
  return null
}
