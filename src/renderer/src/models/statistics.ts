/** Aggregate document statistics (Prompt.md §Statistics). */
export interface DocumentStatistics {
  schemaCount: number
  masterTypeCount: number
  masterEntryCount: number
  recordCount: number
  /** Total document size in bytes (UTF-8). */
  fileSizeBytes: number
  /** Record byte-size distribution. */
  recordSize: {
    min: number
    max: number
    mean: number
    /** Histogram buckets: [upperBoundBytes, count]. */
    histogram: Array<[number, number]>
  }
  recordsPerSchema: Array<[string, number]>
  revision: string | null
  created: string | null
  modified: string | null
}
