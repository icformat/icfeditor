/** Human-readable byte size, e.g. 1536 -> "1.5 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

/** Strips a directory path to its file name. */
export function baseName(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

/** File extension without the dot, lowercased. */
export function extensionOf(path: string): string {
  const name = baseName(path)
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

/** Directory portion of a path (everything up to the last separator). */
export function dirName(path: string): string {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return idx === -1 ? '' : path.slice(0, idx)
}

/** Joins a directory and file name with the directory's separator. */
export function joinPath(dir: string, name: string): string {
  if (!dir) return name
  const sep = dir.includes('\\') ? '\\' : '/'
  return `${dir}${sep}${name}`
}

/** Strips the final extension from a file name (keeps the rest). */
export function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? name : name.slice(0, dot)
}
