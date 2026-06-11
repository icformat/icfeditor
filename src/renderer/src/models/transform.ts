/** Reasons a merge cannot proceed cleanly, surfaced in the merge preview. */
export interface MergeConflict {
  kind: 'schemaMismatch' | 'duplicateRecordId' | 'masterKeyMismatch'
  message: string
  detail?: string
}

export interface MergePreview {
  sourceCount: number
  mergedRecordCount: number
  mergedMasterCount: number
  /** Master rows dropped as exact duplicates. */
  deduplicatedMasters: number
  conflicts: MergeConflict[]
  /** The merged document serialized to ICF, ready to save once accepted. */
  resultText: string
}

/** Strategies from Prompt.md §Split. */
export type SplitStrategy = 'range' | 'schema' | 'count' | 'maxSize'

export interface SplitOptions {
  strategy: SplitStrategy
  /** For 'range': inclusive 1-based record numbers, e.g. "100-500". */
  range?: { start: number; end: number }
  /** For 'count': records per output file. */
  countPerFile?: number
  /** For 'maxSize': maximum bytes per output file. */
  maxBytes?: number
}

/** One output produced by a split operation. */
export interface SplitPart {
  /** Suggested file name, e.g. "archive.part1.icf". */
  suggestedName: string
  recordCount: number
  text: string
}
