/** Result of a text replace: the new text and how many occurrences changed. */
export interface ReplaceResult {
  text: string
  count: number
}

/**
 * Replaces every occurrence of `search` (a literal substring, not a regex) with
 * `replacement` in `text`. Honors case sensitivity. The replacement is inserted
 * verbatim — `$`-sequences are not treated as backreferences.
 */
export function replaceOccurrences(
  text: string,
  search: string,
  replacement: string,
  caseSensitive: boolean
): ReplaceResult {
  if (search === '') return { text, count: 0 }
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(escaped, caseSensitive ? 'g' : 'gi')
  let count = 0
  const result = text.replace(regex, () => {
    count++
    return replacement
  })
  return { text: result, count }
}

/**
 * Replaces `search` only within the `[start, end)` character range of `text`,
 * leaving the rest untouched. Used for "Replace in selection".
 */
export function replaceInRange(
  text: string,
  start: number,
  end: number,
  search: string,
  replacement: string,
  caseSensitive: boolean
): ReplaceResult {
  const region = replaceOccurrences(text.slice(start, end), search, replacement, caseSensitive)
  return { text: text.slice(0, start) + region.text + text.slice(end), count: region.count }
}
