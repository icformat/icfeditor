import { describe, it, expect } from 'vitest'
import { flattenTree } from '@renderer/utils/flattenTree'
import type { TreeNode } from '@renderer/models/tree'

function record(index: number, schema: string): TreeNode {
  return {
    id: `node-record-${index}`,
    kind: 'record',
    label: `R${index}`,
    detail: schema,
    line: index + 1,
    status: 'none',
    children: []
  }
}

function dataNode(children: TreeNode[]): TreeNode {
  return {
    id: 'node-data',
    kind: 'data',
    label: 'Data',
    line: 1,
    status: 'none',
    children
  }
}

describe('flattenTree', () => {
  const tree = [dataNode([record(0, 'A'), record(1, 'B'), record(2, 'A')])]

  it('expands all visible rows by default', () => {
    const rows = flattenTree(tree, {}, [])
    expect(rows).toHaveLength(4) // data + 3 records
    expect(rows[0].hasChildren).toBe(true)
    expect(rows[0].depth).toBe(0)
    expect(rows[1].depth).toBe(1)
  })

  it('hides children of a collapsed node', () => {
    const rows = flattenTree(tree, { 'node-data': true }, [])
    expect(rows).toHaveLength(1)
    expect(rows[0].collapsed).toBe(true)
  })

  it('applies the schema filter and reports the hidden count', () => {
    const rows = flattenTree(tree, {}, ['A'])
    expect(rows).toHaveLength(3) // data + 2 'A' records
    expect(rows[0].filteredOut).toBe(1)
    expect(rows.slice(1).every((r) => r.node.detail === 'A')).toBe(true)
  })

  it('scales to 100k records', () => {
    const many = Array.from({ length: 100_000 }, (_, i) => record(i, i % 2 ? 'A' : 'B'))
    const big = [dataNode(many)]
    const rows = flattenTree(big, {}, [])
    expect(rows).toHaveLength(100_001)
    // Filtering halves the records.
    expect(flattenTree(big, {}, ['A'])).toHaveLength(1 + 50_000)
  })
})
