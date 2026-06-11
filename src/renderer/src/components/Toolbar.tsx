import type { MenuCommand } from '@shared/ipc'
import { useDocumentStore } from '../stores/documentStore'
import { useUiStore } from '../stores/uiStore'
import logoUrl from '../assets/editor-logo.svg'

interface ToolbarProps {
  dispatch: (command: MenuCommand) => void
}

interface ToolButton {
  label: string
  command: MenuCommand
  title: string
}

const FILE_BUTTONS: ToolButton[] = [
  { label: 'New', command: 'file.new', title: 'New document' },
  { label: 'Open', command: 'file.open', title: 'Open file (Ctrl+O)' },
  { label: 'Save', command: 'file.save', title: 'Save (Ctrl+S)' },
  { label: 'Save All', command: 'file.saveAll', title: 'Save all open files (Ctrl+Alt+S)' }
]

const DOC_BUTTONS: ToolButton[] = [
  { label: 'Validate', command: 'doc.validate', title: 'Validate (F6)' },
  { label: 'ICX', command: 'icx.regenerate', title: 'Regenerate ICX (F5)' }
]

const TRANSFORM_BUTTONS: ToolButton[] = [
  { label: 'Merge', command: 'transform.merge', title: 'Merge files' },
  { label: 'Split', command: 'transform.split', title: 'Split file' },
  { label: 'Export', command: 'doc.export', title: 'Export' }
]

/** The VS Code-style toolbar; thin row of command buttons + mode/theme toggles. */
export function Toolbar({ dispatch }: ToolbarProps) {
  const active = useDocumentStore((s) => s.documents.find((d) => d.id === s.activeId) ?? null)
  const theme = useUiStore((s) => s.theme)

  return (
    <div
      role="toolbar"
      aria-label="Main toolbar"
      className="flex items-center gap-1 border-b border-app-border bg-app-surface px-2 py-1"
    >
      <img src={logoUrl} alt="ICF Editor" title="ICF Editor" className="ml-1 mr-2 h-5 w-5" />
      {[FILE_BUTTONS, DOC_BUTTONS, TRANSFORM_BUTTONS].map((group, gi) => (
        <div key={gi} className="flex items-center gap-1">
          {gi > 0 && <div className="mx-1 h-4 w-px bg-app-border" />}
          {group.map((b) => (
            <button
              key={b.command}
              title={b.title}
              aria-label={b.title}
              onClick={() => dispatch(b.command)}
              className="rounded px-2 py-1 text-xs hover:bg-app-surface-hover"
            >
              {b.label}
            </button>
          ))}
        </div>
      ))}

      <div className="mx-1 h-4 w-px bg-app-border" />

      <button
        title="Toggle View/Edit mode (Ctrl+Shift+M)"
        onClick={() => dispatch('view.toggleMode')}
        disabled={!active}
        className="rounded px-2 py-1 text-xs hover:bg-app-surface-hover disabled:opacity-40"
      >
        {active?.mode === 'edit' ? '✏️ Edit' : '👁️ View'}
      </button>

      <button
        title="Toggle theme (Ctrl+Shift+V)"
        onClick={() => dispatch('view.toggleTheme')}
        className="rounded px-2 py-1 text-xs hover:bg-app-surface-hover"
      >
        {theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🖥️'} {theme}
      </button>
    </div>
  )
}
