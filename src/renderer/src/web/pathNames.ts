/**
 * Pseudo-path helpers for the web build. Browsers never reveal real file-system
 * paths, so the web API layer keys documents by file *name*; when two distinct
 * files share a name, the later one gets a numbered variant so the document
 * store (which dedupes tabs by path) keeps them apart.
 */

/** Splits `invoice.icf` into `["invoice", ".icf"]` (no dot → empty ext). */
function splitExtension(name: string): [string, string] {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return [name, '']
  return [name.slice(0, dot), name.slice(dot)]
}

/**
 * Returns `name` unchanged when it is not in `taken`, else the first free
 * numbered variant: `invoice.icf` → `invoice (2).icf`, `invoice (3).icf`, …
 */
export function uniqueName(taken: Iterable<string>, name: string): string {
  const set = new Set(taken)
  if (!set.has(name)) return name
  const [stem, ext] = splitExtension(name)
  for (let n = 2; ; n++) {
    const candidate = `${stem} (${n})${ext}`
    if (!set.has(candidate)) return candidate
  }
}
