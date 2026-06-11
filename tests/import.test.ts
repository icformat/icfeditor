import { describe, it, expect } from 'vitest'
import { ImportService } from '@renderer/services/ImportService'
import { ICFParserService } from '@renderer/services/ICFParserService'

const importer = new ImportService()
const parser = new ICFParserService()

type ImportOpts = { csvHasHeaders?: boolean; preferCollections?: boolean }

/** The schema node name the import produced (the wrapper/collection node). */
function nodeNameOf(content: string, name: string, options?: ImportOpts) {
  const { icf } = importer.toIcf(content, name, options)
  return parser.parse(icf).getRecord(0)!.getData().fieldNames()[0]
}

/** Flattens an IcfObject node into a plain key/value map. */
function objToMap(node: { fieldNames(): string[]; get(k: string): { asText(): string } | null }) {
  const map: Record<string, string> = {}
  for (const key of node.fieldNames()) map[key] = node.get(key)!.asText()
  return map
}

/**
 * Imports → parses the ICF → returns the logical rows as key/value maps,
 * handling both the collection shape (one record, array node) and the
 * one-record-per-row shape (object node).
 */
function importToRecords(content: string, name: string, options?: ImportOpts) {
  const { icf } = importer.toIcf(content, name, options)
  const rows: Record<string, string>[] = []
  for (const r of parser.parse(icf).getRecords()) {
    const body = r.getData()
    const node = body.get(body.fieldNames()[0])!
    if (node.isArray()) node.elements().forEach((el) => rows.push(objToMap(el)))
    else rows.push(objToMap(node))
  }
  return rows
}

describe('ImportService', () => {
  it('imports JSON, unioning keys and filling empty for missing ones', () => {
    const json = JSON.stringify([
      { id: 'A', name: 'Alpha' },
      { id: 'B', city: 'Coimbatore' }
    ])
    const records = importToRecords(json, 'data.json')
    // Union of keys: id, name, city — record B has empty name, record A empty city.
    expect(records[0]).toEqual({ id: 'A', name: 'Alpha', city: '' })
    expect(records[1]).toEqual({ id: 'B', name: '', city: 'Coimbatore' })
  })

  it('flattens nested objects to dotted keys', () => {
    const json = JSON.stringify([{ id: 'A', addr: { city: 'CBE', pin: '641001' } }])
    const records = importToRecords(json, 'nested.json')
    expect(records[0]).toEqual({ id: 'A', 'addr.city': 'CBE', 'addr.pin': '641001' })
  })

  it('imports YAML', () => {
    const yaml = ['- id: A', '  qty: 10', '- id: B', '  unit: kg'].join('\n')
    const records = importToRecords(yaml, 'data.yaml')
    expect(records).toEqual([
      { id: 'A', qty: '10', unit: '' },
      { id: 'B', qty: '', unit: 'kg' }
    ])
  })

  it('imports CSV with a header row', () => {
    const csv = ['id,name,city', 'A,Alpha,', 'B,,Coimbatore'].join('\n')
    const records = importToRecords(csv, 'data.csv')
    expect(records[0]).toEqual({ id: 'A', name: 'Alpha', city: '' })
    expect(records[1]).toEqual({ id: 'B', name: '', city: 'Coimbatore' })
  })

  it('imports XML, using the repeated element as records', () => {
    const xml = '<rows><row><id>A</id><name>Alpha</name></row><row><id>B</id><city>CBE</city></row></rows>'
    const records = importToRecords(xml, 'data.xml')
    expect(records[0].id).toBe('A')
    expect(records[0].name).toBe('Alpha')
    expect(records[0].city).toBe('') // union key, empty for record A
    expect(records[1]).toEqual({ id: 'B', name: '', city: 'CBE' })
  })

  it('names the output .icf after the source and produces valid ICF', () => {
    const { fileName, icf } = importer.toIcf('[{"a":1}]', '/path/to/orders.json')
    expect(fileName).toBe('orders.icf')
    expect(parser.parse(icf).getRecordCount()).toBe(1)
  })

  it('uses the array key as the node name for JSON, else the file name', () => {
    // Keyed array → node named after the key.
    expect(nodeNameOf('{"invoices":[{"no":"1"}]}', 'data.json')).toBe('invoices')
    // Bare array → node named after the file.
    expect(nodeNameOf('[{"no":"1"}]', 'orders.json')).toBe('orders')
  })

  it('honors "My CSV has headers" = false by auto-naming fields', () => {
    const csv = ['A,Alpha', 'B,Beta'].join('\n')
    const records = importToRecords(csv, 'data.csv', { csvHasHeaders: false })
    // No header row consumed: both rows are data, fields auto-named Field1/Field2.
    expect(records).toEqual([
      { Field1: 'A', Field2: 'Alpha' },
      { Field1: 'B', Field2: 'Beta' }
    ])
  })

  it('prefers a collection by default: one record holding all rows', () => {
    const csv = ['SNo,Name,Class', '1,Angel,III', '2,Baby,III'].join('\n')
    const { icf } = importer.toIcf(csv, 'students.csv')
    const doc = parser.parse(icf)
    // A single @record whose body node is a collection of every row.
    expect(doc.getRecordCount()).toBe(1)
    const node = doc.getRecord(0)!.getData().get('students')!
    expect(node.isArray()).toBe(true)
    expect(node.size).toBe(2)
  })

  it('emits one record per row when preferCollections is false', () => {
    const csv = ['SNo,Name,Class', '1,Angel,III', '2,Baby,III'].join('\n')
    const { icf } = importer.toIcf(csv, 'students.csv', { preferCollections: false })
    const doc = parser.parse(icf)
    expect(doc.getRecordCount()).toBe(2)
    // Each record's node is a single-row object, not a collection.
    expect(doc.getRecord(0)!.getData().get('students')!.isArray()).toBe(false)
  })

  it('rejects unsupported formats', () => {
    expect(() => importer.toIcf('x', 'file.txt')).toThrow(/Unsupported/)
  })
})
