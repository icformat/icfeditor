import { describe, it, expect } from 'vitest'
import { ICFParserService } from '@renderer/services/ICFParserService'
import { buildTree } from '@renderer/validators/buildTree'
import type { TreeNode } from '@renderer/models/tree'
import { fixture } from './helpers'

const parser = new ICFParserService()

function build(text: string): TreeNode[] {
  const doc = parser.parse(text)
  return buildTree(doc, parser.buildIndex(text, doc), [], text)
}

/** Finds a node by id anywhere in the tree. */
function find(nodes: TreeNode[], id: string): TreeNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n
    const child = find(n.children, id)
    if (child) return child
  }
  return undefined
}

describe('buildTree section line mapping', () => {
  const text = fixture('sample.icf')
  const lines = text.split('\n')
  const tree = build(text)

  const lineText = (n: TreeNode | undefined) => (n ? lines[n.line - 1] : undefined)

  it('maps Metadata / Schemas / Masters / Data to their directive lines', () => {
    expect(lineText(find(tree, 'node-metadata'))).toContain('@metadata')
    expect(lineText(find(tree, 'node-schemas'))).toContain('@schema')
    expect(lineText(find(tree, 'node-masters'))).toContain('@masters')
    expect(lineText(find(tree, 'node-data'))).toContain('@data')
  })

  it('maps a schema id to its @schema line', () => {
    const node = find(tree, 'node-schema-Invoice')
    expect(node).toBeDefined()
    expect(lineText(node)).toBe('@schema id=Invoice')
  })

  it('maps a master type to its header line within @masters', () => {
    const vendor = find(tree, 'node-master-Vendor')
    expect(lineText(vendor)).toBe('Vendor:')
    const project = find(tree, 'node-master-Project')
    expect(lineText(project)).toBe('Project:')
  })

  it('does not confuse @schema-url with @schema', () => {
    const withUrl = ['@kind icf', '@schema-url https://x', '', '@schema id=S', '', '@data', ''].join(
      '\n'
    )
    const t = build(withUrl)
    const node = find(t, 'node-schema-S')
    expect(withUrl.split('\n')[(node?.line ?? 0) - 1]).toBe('@schema id=S')
  })
})
