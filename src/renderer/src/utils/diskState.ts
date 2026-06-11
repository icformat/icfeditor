/** A file's on-disk signature (mtime + size). */
export interface DiskState {
  mtimeMs: number
  size: number
}

/** Classification of how the on-disk file compares to the last-known signature. */
export type DiskChange = 'unknown' | 'same' | 'modified' | 'deleted'

/**
 * Compares the current on-disk state against the recorded signature.
 *  - `unknown` — no baseline (untitled, or not tracked), so no decision.
 *  - `deleted` — the file no longer exists.
 *  - `modified` — mtime or size differs from the baseline.
 *  - `same` — unchanged.
 */
export function diskChange(recorded: DiskState | null, current: DiskState | null): DiskChange {
  if (!recorded) return 'unknown'
  if (current === null) return 'deleted'
  if (current.mtimeMs !== recorded.mtimeMs || current.size !== recorded.size) return 'modified'
  return 'same'
}
