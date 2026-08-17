import type { FileStat } from '@shared/ipc'
import type { DocumentIndex, OpenDocument } from '../models/document'
import { dirName, formatBytes } from './format'

/** One labeled value in the Properties dialog. */
export interface PropertyRow {
  label: string
  value: string
  /** Render in monospace (paths, checksums). */
  mono?: boolean
}

/** A titled group of rows (File / Content / Document sections). */
export interface PropertyGroup {
  title: string
  rows: PropertyRow[]
}

/** UTF-8 byte length of the in-memory text (what a save would write). */
export function utf8Size(text: string): number {
  return new TextEncoder().encode(text).length
}

/** Shortens a long value (e.g. a checksum) to `max` chars with an ellipsis. */
export function truncateMiddle(value: string, max = 40): string {
  if (value.length <= max) return value
  const half = Math.floor((max - 1) / 2)
  return `${value.slice(0, half)}…${value.slice(value.length - half)}`
}

function formatTime(ms: number | undefined): string {
  return ms === undefined || ms === 0 ? '—' : new Date(ms).toLocaleString()
}

function countLines(text: string): number {
  if (text === '') return 0
  let lines = 1
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') lines++
  return lines
}

/**
 * Builds the rows for File → Properties from the active document, its derived
 * index, and a fresh on-disk stat (`null` for unsaved buffers or deleted
 * files). Pure — the dialog only renders what this returns.
 */
export function buildFileProperties(
  doc: OpenDocument,
  index: DocumentIndex | null,
  stat: FileStat | null
): PropertyGroup[] {
  const file: PropertyRow[] = [
    { label: 'Name', value: doc.fileName },
    { label: 'Kind', value: doc.kind === 'icx' ? 'ICX index' : 'ICF document' }
  ]
  if (doc.path) {
    file.push(
      { label: 'Path', value: doc.path, mono: true },
      { label: 'Folder', value: dirName(doc.path), mono: true },
      {
        label: 'Size on disk',
        value: stat ? `${formatBytes(stat.size)} (${stat.size.toLocaleString()} bytes)` : 'File not found on disk'
      },
      { label: 'Created', value: formatTime(stat?.birthtimeMs) },
      { label: 'Modified', value: formatTime(stat?.mtimeMs) }
    )
  } else {
    file.push({ label: 'Path', value: 'Not saved to disk' })
  }
  file.push({ label: 'Unsaved changes', value: doc.dirty ? 'Yes' : 'No' })

  const bytes = utf8Size(doc.text)
  const errors = doc.diagnostics.filter((d) => d.severity === 'error').length
  const warnings = doc.diagnostics.filter((d) => d.severity === 'warning').length
  const content: PropertyRow[] = [
    { label: 'Size in editor', value: `${formatBytes(bytes)} (${bytes.toLocaleString()} bytes)` },
    { label: 'Lines', value: countLines(doc.text).toLocaleString() },
    { label: 'Characters', value: doc.text.length.toLocaleString() },
    { label: 'Records', value: (index?.records.length ?? 0).toLocaleString() },
    { label: 'Problems', value: errors + warnings === 0 ? 'None' : `${errors} error(s), ${warnings} warning(s)` }
  ]

  const groups: PropertyGroup[] = [
    { title: 'File', rows: file },
    { title: 'Content', rows: content }
  ]

  const meta = doc.parsed?.getMetadata()
  if (meta) {
    const rows: PropertyRow[] = []
    const push = (label: string, value: string | null, mono = false) => {
      if (value) rows.push({ label, value, mono })
    }
    push('Format', meta.getKind())
    push('Version', meta.getVersion())
    push('Encoding', meta.getEncoding())
    push('Hash method', meta.getHashMethod())
    push('Checksum', meta.getChecksum() && truncateMiddle(meta.getChecksum()!), true)
    push('Generator', meta.getGenerator())
    push('Created (directive)', meta.getCreated())
    push('Modified (directive)', meta.getModified())
    push('Revision', meta.getRevision())
    if (rows.length > 0) groups.push({ title: 'Document directives', rows })
  }

  return groups
}
