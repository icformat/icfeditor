import { describe, it, expect } from 'vitest'
import { ICFParserService } from '@renderer/services/ICFParserService'
import { ICFValidatorService } from '@renderer/services/ICFValidatorService'
import { buildTree } from '@renderer/validators/buildTree'
import type { TreeNode } from '@renderer/models/tree'
import { fixture } from './helpers'

const parser = new ICFParserService()
const validator = new ICFValidatorService()

/** Finds a node by id anywhere in the tree. */
function find(nodes: TreeNode[], id: string): TreeNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n
    const child = find(n.children, id)
    if (child) return child
  }
  return undefined
}

describe('ICF v1.1 validation (diagnostic codes surface through the service)', () => {
  it('warns UNKNOWN_ANNOTATION for a non-standard, non-namespaced annotation', () => {
    const text = [
      '@kind icf',
      '@version 1.1',
      '',
      '@schema',
      '',
      'employee:',
      '  [empid, empname]',
      '  !custom:',
      '    = something',
      '',
      '@data',
      ''
    ].join('\n')
    const diags = validator.validate(text)
    const hit = diags.find((d) => d.code === 'UNKNOWN_ANNOTATION')
    expect(hit).toBeDefined()
    expect(hit?.severity).toBe('warning')
    expect(hit?.line).toBe(8)
  })

  it('warns REQUIRED_FIELD_MISSING and UNIQUE_CONSTRAINT_VIOLATION from !constraints', () => {
    const text = [
      '@kind icf',
      '@version 1.1',
      '',
      '@schema',
      '',
      'employee[]:',
      '  [empid, empemail]',
      '  !constraints:',
      '    = empemail:required, empid:unique',
      '',
      '@data',
      '',
      '@record id=R1',
      '',
      'employee:',
      '  - 1, ',
      '  - 1, x@y.z',
      ''
    ].join('\n')
    const diags = validator.validate(text)
    const required = diags.find((d) => d.code === 'REQUIRED_FIELD_MISSING')
    const unique = diags.find((d) => d.code === 'UNIQUE_CONSTRAINT_VIOLATION')
    expect(required?.severity).toBe('warning')
    expect(required?.line).toBe(16)
    expect(unique?.severity).toBe('warning')
    expect(unique?.line).toBe(17)
    // Constraints never make the document invalid (warnings only).
    expect(diags.every((d) => d.severity !== 'error')).toBe(true)
  })

  it('errors ANNOTATION_WITHOUT_OWNER for a top-level schema annotation', () => {
    const text = ['@kind icf', '@version 1.1', '', '@schema', '', '!defaults:', '  = a=b', '', '@data', ''].join('\n')
    const diags = validator.validate(text)
    const hit = diags.find((d) => d.code === 'ANNOTATION_WITHOUT_OWNER')
    expect(hit?.severity).toBe('error')
    expect(hit?.line).toBe(6)
  })

  it('accepts the v1.1 kitchen-sink fixture without diagnostics', () => {
    expect(validator.validate(fixture('sample_v11.icf'))).toEqual([])
  })
})

describe('ICF v1.1 parsing and record index', () => {
  const text = fixture('sample_v11.icf')
  const doc = parser.parse(text)

  it('counts records correctly with annotations and multiline rows present', () => {
    expect(doc.getRecordCount()).toBe(2)
    const index = parser.buildIndex(text, doc)
    expect(index.records).toHaveLength(2)
    const lines = text.split(/\r?\n/)
    for (const id of ['EMP1', 'EMP2']) {
      const loc = index.byId.get(id)
      expect(loc).toBeDefined()
      expect(lines[loc!.startLine - 1]).toContain('@record')
      expect(lines[loc!.startLine - 1]).toContain(`id=${id}`)
    }
    expect(index.bySchema.get('Employee')).toEqual([0, 1])
  })

  it('joins a multiline row into one logical row (spec §59)', () => {
    const row = doc.getRecord(0)!.getData().get('salary')!.get(0)!
    expect(row.get('desigref')?.asText()).toBe('designation:DES1')
    expect(row.get('month')?.asText()).toBe('Jan')
    expect(row.get('year')?.asText()).toBe('2026')
    expect(row.get('amount')?.asText()).toBe('12000')
  })

  it('keeps the raw model unchanged but exposes !overrides and resolved data', () => {
    const row = doc.getRecord(0)!.getData().get('salary')!.get(0)!
    expect(row.isObject() && row.getOverrides().get('amount')).toBe('12500')
    // Phase-5 resolution applies the override on a copy only.
    const resolved = doc.getResolvedRecordData(0)!
    expect(resolved.get('salary')?.get(0)?.get('amount')?.asText()).toBe('12500')
    expect(row.get('amount')?.asText()).toBe('12000')
  })

  it('exposes primary= record attributes and primary-first resolution', () => {
    expect(doc.getRecord(0)!.getPrimary()).toEqual(['designation'])
    // The same reference resolves per-record: DES1 is Manager in EMP1 but
    // Director in EMP2 (record-local primary objects shadow nothing globally).
    expect(doc.resolveReference(doc.getRecord(0), 'designation:DES1')?.get('designame')?.asText()).toBe('Manager')
    expect(doc.resolveReference(doc.getRecord(1), 'designation:DES1')?.get('designame')?.asText()).toBe('Director')
    // Global masters still resolve.
    expect(doc.resolveReference(null, 'Department:D01')?.get('deptname')?.asText()).toBe('Engineering')
  })
})

describe('buildTree with v1.1 annotation lines', () => {
  const text = [
    '@kind icf',
    '@version 1.1',
    '',
    '@schema id=S',
    '',
    'employee:',
    '  [empid]',
    '  !defaults:',
    '    = empstatus=employed',
    '',
    '@masters',
    '',
    'Vendor:',
    '  - VEN1, X',
    '  !com.example.audit:',
    '    = source=import',
    '',
    'Project:',
    '  - PRJ1, Y',
    '',
    '@data',
    '',
    '@record schema=S id=R1',
    '',
    'employee:',
    '  = 1',
    ''
  ].join('\n')
  const lines = text.split('\n')
  const doc = parser.parse(text)
  const tree = buildTree(doc, parser.buildIndex(text, doc), [], text)

  it('keeps section and master-type line mapping undisturbed by ! lines', () => {
    expect(lines[(find(tree, 'node-schema-S')?.line ?? 0) - 1]).toBe('@schema id=S')
    expect(lines[(find(tree, 'node-master-Vendor')?.line ?? 0) - 1]).toBe('Vendor:')
    expect(lines[(find(tree, 'node-master-Project')?.line ?? 0) - 1]).toBe('Project:')
    expect(lines[(find(tree, 'node-data')?.line ?? 0) - 1]).toBe('@data')
  })

  it('lists exactly the real master types and records', () => {
    const masters = find(tree, 'node-masters')
    expect(masters?.children.map((c) => c.label)).toEqual(['Vendor', 'Project'])
    const data = find(tree, 'node-data')
    expect(data?.children).toHaveLength(1)
    expect(data?.children[0].label).toBe('R1')
  })
})
