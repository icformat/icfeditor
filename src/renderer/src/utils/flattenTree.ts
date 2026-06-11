import type { TreeNode } from '../models/tree'
import { matchesSchemaFilter } from './schemaFilter'

/** A tree node positioned for flat (virtualized) rendering. */
export interface FlatRow {
  node: TreeNode
  depth: number
  /** True when the node has children (so the caller can show a twisty). */
  hasChildren: boolean
  /** True when this node's children are collapsed. */
  collapsed: boolean
  /** Number of record children hidden by the schema filter (data node only). */
  filteredOut: number
}

/**
 * Flattens the document outline into the ordered list of *visible* rows, honoring
 * per-node collapse state and the schema filter. This is what makes the tree
 * scale to 100k+ records: the flat list feeds a virtualizer that only mounts the
 * rows in view (Prompt.md §Performance). Pure and allocation-light so it is cheap
 * to recompute and trivial to test.
 */
export function flattenTree(
  nodes: TreeNode[],
  collapsed: Record<string, boolean>,
  schemaFilter: string[]
): FlatRow[] {
  const rows: FlatRow[] = []

  const walk = (node: TreeNode, depth: number) => {
    // Record nodes are subject to the schema filter.
    const visibleChildren = node.children.filter(
      (child) => child.kind !== 'record' || matchesSchemaFilter(child.detail, schemaFilter)
    )
    const isCollapsed = collapsed[node.id] === true

    rows.push({
      node,
      depth,
      hasChildren: visibleChildren.length > 0,
      collapsed: isCollapsed,
      filteredOut: node.children.length - visibleChildren.length
    })

    if (!isCollapsed) {
      for (const child of visibleChildren) walk(child, depth + 1)
    }
  }

  for (const node of nodes) walk(node, 0)
  return rows
}
