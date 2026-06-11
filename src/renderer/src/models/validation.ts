/** A validation diagnostic flattened for the UI (panel + tree badges + markers). */
export interface Diagnostic {
  severity: 'error' | 'warning' | 'info'
  code: string
  message: string
  /** 1-based line, or 0 when not line-anchored. */
  line: number
}
