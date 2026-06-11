import { useDocumentStore } from '../stores/documentStore'
import { PanelEmpty } from './TreePanel'

interface ValidationPanelProps {
  /** Jumps the editor to a diagnostic's line (Prompt.md: click jumps to record). */
  onJump: (line: number) => void
}

const SEVERITY_ICON = { error: '⛔', warning: '⚠', info: 'ⓘ' } as const
const SEVERITY_CLASS = {
  error: 'text-app-error',
  warning: 'text-app-warning',
  info: 'text-app-info'
} as const

/** Lists errors / warnings / info; clicking a row reveals its line. */
export function ValidationPanel({ onJump }: ValidationPanelProps) {
  const diagnostics = useDocumentStore((s) => s.diagnostics)

  if (diagnostics.length === 0) {
    return <PanelEmpty label="✓ No problems detected" />
  }

  return (
    <div className="h-full overflow-auto text-xs">
      {diagnostics.map((d, i) => (
        <div
          key={i}
          onClick={() => d.line > 0 && onJump(d.line)}
          className="flex cursor-pointer items-start gap-2 border-b border-app-border/40 px-2 py-1 hover:bg-app-surface-hover"
        >
          <span className={SEVERITY_CLASS[d.severity]}>{SEVERITY_ICON[d.severity]}</span>
          <span className="flex-1">
            {d.message}
            <span className="ml-2 text-app-muted">[{d.code}]</span>
          </span>
          {d.line > 0 && <span className="text-app-muted">Ln {d.line}</span>}
        </div>
      ))}
    </div>
  )
}
