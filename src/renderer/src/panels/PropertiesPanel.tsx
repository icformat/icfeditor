import { useDocumentStore, type RecordOp } from '../stores/documentStore'
import { useUiStore } from '../stores/uiStore'
import { PanelEmpty } from './TreePanel'

/** Buttons in the record action bar (only active in Edit mode). */
const RECORD_ACTIONS: Array<{ op: RecordOp; label: string; title: string }> = [
  { op: 'insert', label: '＋', title: 'Insert record after' },
  { op: 'duplicate', label: '⧉', title: 'Duplicate record' },
  { op: 'clone', label: '⎘', title: 'Clone record (new id)' },
  { op: 'moveUp', label: '↑', title: 'Move record up' },
  { op: 'moveDown', label: '↓', title: 'Move record down' },
  { op: 'delete', label: '🗑', title: 'Delete record' }
]

/** Record information panel (Prompt.md §Record Information Panel). */
export function PropertiesPanel() {
  const active = useDocumentStore((s) => s.documents.find((d) => d.id === s.activeId) ?? null)
  const diagnostics = useDocumentStore((s) => s.diagnostics)
  const index = useDocumentStore((s) => s.index)
  const editRecord = useDocumentStore((s) => s.editRecord)
  const selected = useUiStore((s) => s.selectedRecord)

  if (!active?.parsed || selected === null) {
    return <PanelEmpty label="Select a record to see its properties" />
  }

  const editable = active.mode === 'edit'

  const record = active.parsed.getRecord(selected)
  const loc = index?.records[selected]
  if (!record) return <PanelEmpty label="Record not found" />

  const recordDiags = loc
    ? diagnostics.filter((d) => d.line >= loc.startLine && d.line <= loc.endLine)
    : []
  const status =
    recordDiags.some((d) => d.severity === 'error')
      ? 'Invalid'
      : recordDiags.length > 0
        ? 'Warnings'
        : 'Valid'

  const rows: Array<[string, string]> = [
    ['Record ID', record.getId() ?? '—'],
    ['UUID', record.getUuid() ?? '—'],
    ['Schema', record.getSchemaId() ?? '(default)'],
    ['Created', record.getCreated() ?? '—'],
    ['Modified', record.getModified() ?? '—'],
    ['Revision', record.getRevision() ?? '—'],
    ['Validation', status]
  ]

  return (
    <div className="h-full overflow-auto p-2 text-xs">
      <div className="mb-2 flex items-center gap-1" role="toolbar" aria-label="Record actions">
        {RECORD_ACTIONS.map((action) => (
          <button
            key={action.op}
            title={editable ? action.title : `${action.title} (switch to Edit mode)`}
            disabled={!editable}
            onClick={() => editRecord(action.op, selected)}
            className="rounded border border-app-border px-2 py-0.5 hover:bg-app-surface-hover disabled:opacity-40"
          >
            {action.label}
          </button>
        ))}
      </div>
      <table className="w-full">
        <tbody>
          {rows.map(([key, value]) => (
            <tr key={key} className="border-b border-app-border/50">
              <td className="py-1 pr-2 font-medium text-app-muted">{key}</td>
              <td className="py-1 break-all">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {[...record.getAttributes().entries()].length > 0 && (
        <>
          <h4 className="mt-3 mb-1 font-semibold text-app-muted">Attributes</h4>
          <table className="w-full">
            <tbody>
              {[...record.getAttributes().entries()].map(([key, value]) => (
                <tr key={key}>
                  <td className="py-0.5 pr-2 text-app-muted">{key}</td>
                  <td className="py-0.5 break-all">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
