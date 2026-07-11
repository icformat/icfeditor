/** Export targets from Prompt.md §Export (+ resolved ICF, spec v1.1 Phase 5). */
export type ExportFormat =
  | 'icf'
  | 'icfResolved'
  | 'icx'
  | 'json'
  | 'jsonPretty'
  | 'jsonCompact'
  | 'csv'
  | 'xml'
  | 'yaml'

export interface ExportResult {
  format: ExportFormat
  /** Suggested file extension (no dot). */
  extension: string
  content: string
}
