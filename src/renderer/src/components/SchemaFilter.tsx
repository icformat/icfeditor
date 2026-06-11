import { useDocumentStore } from '../stores/documentStore'
import { useUiStore } from '../stores/uiStore'
import { listSchemaOptions } from '../utils/schemaFilter'

/**
 * Schema filter chips (Prompt.md §Record Filters). Toggling chips narrows the
 * record list to the selected schemas; with none selected, all records show.
 * Multiple selections are supported (the chips are independent toggles).
 */
export function SchemaFilter() {
  const index = useDocumentStore((s) => s.index)
  const filter = useUiStore((s) => s.schemaFilter)
  const setFilter = useUiStore((s) => s.setSchemaFilter)

  const options = index ? listSchemaOptions(index) : []
  // Only worth showing when there is more than one schema to choose between.
  if (options.length < 2) return null

  const toggle = (id: string) => {
    setFilter(filter.includes(id) ? filter.filter((x) => x !== id) : [...filter, id])
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-app-border px-2 py-1">
      <span className="mr-1 text-[11px] uppercase tracking-wide text-app-muted">Schemas</span>
      {options.map((option) => {
        const active = filter.includes(option.id)
        return (
          <button
            key={option.id}
            onClick={() => toggle(option.id)}
            aria-pressed={active}
            title={`${option.count} record${option.count === 1 ? '' : 's'}`}
            className={`rounded-full border px-2 py-0.5 text-[11px] ${
              active
                ? 'border-app-accent bg-app-accent text-white'
                : 'border-app-border text-app-muted hover:bg-app-surface-hover'
            }`}
          >
            {option.label} <span className="opacity-70">{option.count}</span>
          </button>
        )
      })}
      {filter.length > 0 && (
        <button
          onClick={() => setFilter([])}
          className="ml-1 text-[11px] text-app-accent hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  )
}
