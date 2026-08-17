import { useEffect, useRef, useState } from 'react'
import type { MenuCommand } from '@shared/ipc'
import type { WebApi } from './webApi'

/**
 * In-app menu bar for the web build — the browser has no native application
 * menu, so this renders the same File/Edit/View/Document/Transform/Help
 * structure as the Electron menu (src/main/menu.ts) and publishes the same
 * {@link MenuCommand}s onto the command bus. Keep the two structures in sync
 * when adding menu items.
 */

interface Item {
  label: string
  command?: MenuCommand
  href?: string
  keys?: string
  separatorAbove?: boolean
  /** Marks the dynamic Open Recent entry. */
  recent?: boolean
}

interface TopMenu {
  label: string
  items: Item[]
}

const MENUS: TopMenu[] = [
  {
    label: 'File',
    items: [
      { label: 'New', command: 'file.new' },
      { label: 'Open…', command: 'file.open', keys: 'Ctrl+O' },
      { label: 'Open Recent', recent: true },
      { label: 'Import…', command: 'file.import' },
      { label: 'Save', command: 'file.save', keys: 'Ctrl+S', separatorAbove: true },
      { label: 'Save As…', command: 'file.saveAs', keys: 'Ctrl+Shift+S' },
      { label: 'Save All', command: 'file.saveAll', keys: 'Ctrl+Alt+S' },
      { label: 'Properties…', command: 'file.properties', keys: 'Alt+Enter', separatorAbove: true }
    ]
  },
  {
    label: 'Edit',
    items: [
      { label: 'Find', command: 'edit.find', keys: 'Ctrl+F' },
      { label: 'Replace', command: 'edit.replace', keys: 'Ctrl+H' },
      { label: 'Toggle Bookmark', command: 'edit.toggleBookmark', keys: 'Ctrl+B', separatorAbove: true },
      { label: 'Next Bookmark', command: 'edit.nextBookmark', keys: 'Ctrl+Shift+B' },
      { label: 'Clear Bookmarks', command: 'edit.clearBookmarks' }
    ]
  },
  {
    label: 'View',
    items: [
      { label: 'Toggle View/Edit Mode', command: 'view.toggleMode', keys: 'Ctrl+Shift+M' },
      { label: 'Toggle Theme', command: 'view.toggleTheme', keys: 'Ctrl+Shift+V' },
      { label: 'Toggle Autosave', command: 'view.toggleAutosave' }
    ]
  },
  {
    label: 'Document',
    items: [
      { label: 'Validate', command: 'doc.validate', keys: 'F6' },
      { label: 'Regenerate ICX', command: 'icx.regenerate', keys: 'F5' },
      { label: 'Previous Record', command: 'record.previous', keys: 'F7', separatorAbove: true },
      { label: 'Next Record', command: 'record.next', keys: 'F8' },
      { label: 'Go To Record…', command: 'record.goto', keys: 'Ctrl+G' },
      { label: 'Insert Record', command: 'record.insert', separatorAbove: true },
      { label: 'Duplicate Record', command: 'record.duplicate' },
      { label: 'Delete Record', command: 'record.delete' }
    ]
  },
  {
    label: 'Transform',
    items: [
      { label: 'Merge Files…', command: 'transform.merge' },
      { label: 'Split File…', command: 'transform.split' },
      { label: 'Export…', command: 'doc.export' }
    ]
  },
  {
    label: 'Help',
    items: [
      { label: 'ICF Specification', href: 'https://icformat.org/icf/specification/v1.1/' },
      { label: 'ICX Specification', href: 'https://icformat.org/icx/specification/v1.2/' },
      { label: 'icformat.org', href: 'https://icformat.org' },
      { label: 'About ICF Editor', command: 'help.about', separatorAbove: true }
    ]
  }
]

export function WebMenuBar({ api }: { api: WebApi }) {
  const [open, setOpen] = useState<string | null>(null)
  const [recent, setRecent] = useState<string[]>([])
  const barRef = useRef<HTMLDivElement>(null)

  // Refresh the recent list whenever the File menu opens.
  useEffect(() => {
    if (open === 'File') void api.getRecentFiles().then(setRecent)
  }, [open, api])

  // Close on click-outside or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setOpen(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const run = (command: MenuCommand) => {
    setOpen(null)
    api.emitMenuCommand(command)
  }

  return (
    <div
      ref={barRef}
      role="menubar"
      className="flex shrink-0 select-none border-b border-app-border bg-app-surface text-xs"
    >
      {MENUS.map((menu) => (
        <div key={menu.label} className="relative">
          <button
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open === menu.label}
            className={`px-3 py-1 hover:bg-app-surface-hover ${open === menu.label ? 'bg-app-surface-hover' : ''}`}
            onClick={() => setOpen(open === menu.label ? null : menu.label)}
            onMouseEnter={() => open && setOpen(menu.label)}
          >
            {menu.label}
          </button>

          {open === menu.label && (
            <div
              role="menu"
              className="absolute left-0 top-full z-50 min-w-[240px] rounded-b border border-app-border bg-app-surface py-1 shadow-lg"
            >
              {menu.items.map((item) => (
                <div key={item.label}>
                  {item.separatorAbove && <div className="my-1 border-t border-app-border" />}
                  {item.recent ? (
                    <RecentItems
                      recent={recent}
                      onPick={(path) => {
                        setOpen(null)
                        api.emitOpenPath(path)
                      }}
                      onClear={() => {
                        void api.clearRecentFiles().then(() => setRecent([]))
                      }}
                    />
                  ) : item.href ? (
                    <a
                      role="menuitem"
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="block px-3 py-1 hover:bg-app-surface-hover"
                      onClick={() => setOpen(null)}
                    >
                      {item.label}
                    </a>
                  ) : (
                    <button
                      role="menuitem"
                      className="flex w-full items-center justify-between gap-6 px-3 py-1 text-left hover:bg-app-surface-hover"
                      onClick={() => item.command && run(item.command)}
                    >
                      <span>{item.label}</span>
                      {item.keys && <span className="text-app-muted">{item.keys}</span>}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/** The inline "Open Recent" section of the File menu. */
function RecentItems({
  recent,
  onPick,
  onClear
}: {
  recent: string[]
  onPick: (path: string) => void
  onClear: () => void
}) {
  return (
    <div className="border-y border-app-border/60 py-1">
      <div className="px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-app-muted">
        Open Recent
      </div>
      {recent.length === 0 ? (
        <div className="px-3 py-1 text-app-muted">No recent files</div>
      ) : (
        <>
          {recent.map((path) => (
            <button
              key={path}
              role="menuitem"
              className="block w-full truncate px-3 py-1 text-left hover:bg-app-surface-hover"
              title={path}
              onClick={() => onPick(path)}
            >
              {path}
            </button>
          ))}
          <button
            role="menuitem"
            className="block w-full px-3 py-1 text-left text-app-muted hover:bg-app-surface-hover"
            onClick={onClear}
          >
            Clear Recent
          </button>
        </>
      )}
    </div>
  )
}
