/** Node categories rendered in the tree panel, each with its own icon. */
export type TreeNodeKind =
  | 'metadata'
  | 'schema'
  | 'masters'
  | 'masterType'
  | 'data'
  | 'record'

/** Highest-severity diagnostic touching a node, for the tree badge. */
export type TreeNodeStatus = 'none' | 'info' | 'warning' | 'error'

/** A node in the document outline shown by the tree panel. */
export interface TreeNode {
  id: string
  kind: TreeNodeKind
  label: string
  /** Secondary label, e.g. schema name on a record row. */
  detail?: string
  /** 1-based line to reveal when the node is clicked. */
  line: number
  status: TreeNodeStatus
  children: TreeNode[]
}
