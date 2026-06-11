import type { TreeNodeKind, TreeNodeStatus } from '../models/tree'

/** Glyphs for tree node kinds (Prompt.md §Tree View icons). */
const KIND_GLYPH: Record<TreeNodeKind, string> = {
  metadata: '🏷️',
  schema: '🧬',
  masters: '📚',
  masterType: '🔖',
  data: '🗂️',
  record: '📄'
}

const STATUS_GLYPH: Record<TreeNodeStatus, string> = {
  none: '',
  info: 'ⓘ',
  warning: '⚠',
  error: '⛔'
}

const STATUS_CLASS: Record<TreeNodeStatus, string> = {
  none: '',
  info: 'text-app-info',
  warning: 'text-app-warning',
  error: 'text-app-error'
}

export function KindIcon({ kind }: { kind: TreeNodeKind }) {
  return (
    <span aria-hidden className="inline-block w-4 text-center">
      {KIND_GLYPH[kind]}
    </span>
  )
}

export function StatusBadge({ status }: { status: TreeNodeStatus }) {
  if (status === 'none') return null
  return (
    <span aria-label={status} className={`ml-1 text-xs ${STATUS_CLASS[status]}`}>
      {STATUS_GLYPH[status]}
    </span>
  )
}
