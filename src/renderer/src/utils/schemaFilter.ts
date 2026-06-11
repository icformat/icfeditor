import type { DocumentIndex } from '../models/document'

/** Sentinel label for records with no `schema=` attribute (default schema). */
export const DEFAULT_SCHEMA_LABEL = '(default)'

/** One selectable schema in the filter, with how many records use it. */
export interface SchemaOption {
  /** The raw schema id ('' for the default schema). */
  id: string
  label: string
  count: number
}

/**
 * Lists the schemas actually used by the document's records, in first-seen
 * order, with per-schema record counts (Prompt.md §Record Filters). Derived
 * from the {@link DocumentIndex} so it reflects real usage, not just declared
 * schemas.
 */
export function listSchemaOptions(index: DocumentIndex): SchemaOption[] {
  const order: string[] = []
  const counts = new Map<string, number>()
  for (const record of index.records) {
    const id = record.schemaId ?? ''
    if (!counts.has(id)) order.push(id)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return order.map((id) => ({
    id,
    label: id === '' ? DEFAULT_SCHEMA_LABEL : id,
    count: counts.get(id) ?? 0
  }))
}

/**
 * Whether a record of `schemaId` passes the active filter. An empty filter
 * shows everything (Prompt.md: "Multiple schema selections should be
 * supported"); otherwise the record's schema must be selected.
 */
export function matchesSchemaFilter(schemaId: string | null | undefined, filter: string[]): boolean {
  if (filter.length === 0) return true
  return filter.includes(schemaId ?? '')
}

/** Removes any selected ids that no longer exist in the document. */
export function reconcileFilter(filter: string[], options: SchemaOption[]): string[] {
  if (filter.length === 0) return filter
  const valid = new Set(options.map((o) => o.id))
  return filter.filter((id) => valid.has(id))
}
