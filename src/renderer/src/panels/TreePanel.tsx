import { useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useDocumentStore } from '../stores/documentStore'
import { useUiStore } from '../stores/uiStore'
import { KindIcon, StatusBadge } from '../components/Icon'
import { flattenTree, type FlatRow } from '../utils/flattenTree'

interface TreePanelProps {
  /** Reveals the line for a clicked node in the editor. */
  onReveal: (line: number, recordIndex?: number) => void
}

/** Fixed row height (px) for the virtualizer's size estimate. */
const ROW_HEIGHT = 22

/**
 * Document outline (Prompt.md §Tree View) rendered as a **virtualized** flat
 * list so it scales to 100k+ records — only the rows in view are mounted
 * (Prompt.md §Performance). Collapse state and the schema filter are folded in
 * by {@link flattenTree} before virtualization.
 */
export function TreePanel({ onReveal }: TreePanelProps) {
  const tree = useDocumentStore((s) => s.tree)
  const collapsed = useDocumentStore(
    (s) => s.documents.find((d) => d.id === s.activeId)?.collapsed ?? EMPTY_COLLAPSED
  )
  const toggleCollapse = useDocumentStore((s) => s.toggleCollapse)
  const selected = useUiStore((s) => s.selectedRecord)
  const schemaFilter = useUiStore((s) => s.schemaFilter)

  const rows = useMemo(
    () => flattenTree(tree, collapsed, schemaFilter),
    [tree, collapsed, schemaFilter]
  )

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12
  })

  if (rows.length === 0) {
    return <PanelEmpty label="No document structure" />
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto text-xs" role="tree">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index]
          return (
            <div
              key={row.node.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: ROW_HEIGHT,
                transform: `translateY(${item.start}px)`
              }}
            >
              <TreeRow
                row={row}
                selected={selected}
                onToggle={toggleCollapse}
                onReveal={onReveal}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

const EMPTY_COLLAPSED: Record<string, boolean> = {}

function TreeRow({
  row,
  selected,
  onToggle,
  onReveal
}: {
  row: FlatRow
  selected: number | null
  onToggle: (nodeId: string) => void
  onReveal: (line: number, recordIndex?: number) => void
}) {
  const { node, depth, hasChildren, collapsed, filteredOut } = row
  const recordIndex =
    node.kind === 'record' ? Number(node.id.replace('node-record-', '')) : undefined
  const isSelected = recordIndex !== undefined && recordIndex === selected

  // Clicking the row always reveals the node's line in the editor (records also
  // select). Expand/collapse is handled by the chevron so navigation works for
  // container nodes (Schemas / Masters / Data) too, not just leaves.
  const reveal = () => onReveal(node.line, recordIndex)
  const toggle = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    onToggle(node.id)
  }

  return (
    <div
      role="treeitem"
      aria-expanded={hasChildren ? !collapsed : undefined}
      aria-selected={isSelected}
      tabIndex={0}
      onClick={reveal}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          reveal()
        } else if (hasChildren && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
          e.preventDefault()
          onToggle(node.id)
        }
      }}
      style={{ paddingLeft: depth * 14 + 6 }}
      className={`flex h-full cursor-pointer items-center gap-1 pr-2 outline-none hover:bg-app-surface-hover focus-visible:ring-1 focus-visible:ring-app-accent ${
        isSelected ? 'bg-app-surface-hover' : ''
      }`}
    >
      <span
        aria-hidden
        onClick={hasChildren ? toggle : undefined}
        className="w-3 text-center text-app-muted"
      >
        {hasChildren ? (collapsed ? '▸' : '▾') : ''}
      </span>
      <KindIcon kind={node.kind} />
      <span className="truncate">{node.label}</span>
      {node.detail && <span className="ml-1 text-app-muted">{node.detail}</span>}
      {node.kind === 'data' && filteredOut > 0 && (
        <span className="ml-1 text-app-muted">({filteredOut} filtered)</span>
      )}
      <StatusBadge status={node.status} />
    </div>
  )
}

export function PanelEmpty({ label }: { label: string }) {
  return <div className="p-3 text-xs text-app-muted">{label}</div>
}
