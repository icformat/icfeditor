/** One index entry extracted from an ICX document. */
export interface IcxRow {
  /** Index collection name (record type / master type, e.g. "Invoice"). */
  type: string
  recordId: string
  uuid: string
  checksum: string
}

/** Per-record comparison outcome between a freshly-derived and a stored ICX. */
export type RecordCompareStatus =
  /** Present in both with matching checksums (or no checksums to compare). */
  | 'match'
  /** Present in both but checksums differ — the record changed since indexing. */
  | 'checksumMismatch'
  /** In the source/fresh index but absent from the stored ICX — index is stale. */
  | 'added'
  /** In the stored ICX but no longer in the source — index references a dropped record. */
  | 'removed'

export interface RecordComparison {
  type: string
  recordId: string
  status: RecordCompareStatus
  freshChecksum: string
  storedChecksum: string
}

/** High-level metadata comparison (revision, counts, checksum) — see ICXGeneratorService. */
export interface IcxComparison {
  upToDate: boolean
  sourceRevision: string | null
  icxSourceRevision: string | null
  sourceRecordCount: number
  icxRecordCount: string | null
  sourceChecksum: string | null
  icxSourceChecksum: string | null
  issues: string[]
}

/** Full compare report rendered by the ICX panel. */
export interface IcxCompareReport {
  summary: IcxComparison
  rows: RecordComparison[]
  counts: Record<RecordCompareStatus, number>
}
