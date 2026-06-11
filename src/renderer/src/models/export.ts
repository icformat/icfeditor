/** Export targets from Prompt.md §Export. */
export type ExportFormat =
  | 'icf'
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
