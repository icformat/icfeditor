/**
 * Bookmark helpers (Prompt.md §Editor Features). Bookmarks are 1-based line
 * numbers kept sorted and unique per open document. Pure functions so they are
 * trivially testable and reused by the store and editor.
 */

/** Adds or removes a line, returning a new sorted, de-duplicated array. */
export function toggleBookmark(lines: number[], line: number): number[] {
  if (lines.includes(line)) return lines.filter((l) => l !== line)
  return [...lines, line].sort((a, b) => a - b)
}

/**
 * The next bookmark strictly after `fromLine`, wrapping to the first when past
 * the end. Returns null when there are no bookmarks.
 */
export function nextBookmark(lines: number[], fromLine: number): number | null {
  if (lines.length === 0) return null
  const sorted = [...lines].sort((a, b) => a - b)
  return sorted.find((l) => l > fromLine) ?? sorted[0]
}

/**
 * The previous bookmark strictly before `fromLine`, wrapping to the last when
 * before the first. Returns null when there are no bookmarks.
 */
export function previousBookmark(lines: number[], fromLine: number): number | null {
  if (lines.length === 0) return null
  const sorted = [...lines].sort((a, b) => a - b)
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i] < fromLine) return sorted[i]
  }
  return sorted[sorted.length - 1]
}
