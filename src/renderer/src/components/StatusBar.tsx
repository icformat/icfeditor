import { useDocumentStore } from '../stores/documentStore'
import { useUiStore } from '../stores/uiStore'
import { matchesSchemaFilter } from '../utils/schemaFilter'

/** Bottom status bar: mode, record count, error/warning tallies, kind. */
export function StatusBar() {
  const active = useDocumentStore((s) => s.documents.find((d) => d.id === s.activeId) ?? null)
  const diagnostics = useDocumentStore((s) => s.diagnostics)
  const index = useDocumentStore((s) => s.index)
  const selected = useUiStore((s) => s.selectedRecord)
  const schemaFilter = useUiStore((s) => s.schemaFilter)
  const autosave = useUiStore((s) => s.autosave)
  const setAutosave = useUiStore((s) => s.setAutosave)

  const errors = diagnostics.filter((d) => d.severity === 'error').length
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length

  const total = index?.records.length ?? 0
  const visible =
    schemaFilter.length === 0
      ? total
      : (index?.records.filter((r) => matchesSchemaFilter(r.schemaId, schemaFilter)).length ?? 0)

  return (
    <div className="flex items-center justify-between bg-app-accent px-3 py-0.5 text-xs text-white">
      <div className="flex items-center gap-4">
        <span>{active ? (active.mode === 'edit' ? 'EDIT' : 'VIEW') : '—'}</span>
        <span>⛔ {errors}</span>
        <span>⚠ {warnings}</span>
      </div>
      <div className="flex items-center gap-4">
        {index && (
          <span>
            {schemaFilter.length > 0 ? `${visible} / ${total}` : total} records
          </span>
        )}
        {selected !== null && <span>Record #{selected + 1}</span>}
        <button
          onClick={() => setAutosave(!autosave)}
          title="Toggle autosave"
          aria-label={`Autosave ${autosave ? 'on' : 'off'}, toggle`}
          aria-pressed={autosave}
          className="hover:underline"
        >
          Autosave: {autosave ? 'On' : 'Off'}
        </button>
        {active && <span className="uppercase">{active.kind}</span>}
        <span>UTF-8</span>
      </div>
    </div>
  )
}
