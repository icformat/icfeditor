import { describe, it, expect } from 'vitest'
import { resolveFieldAt } from '@renderer/utils/recordFieldAt'
import { ICFParserService } from '@renderer/services/ICFParserService'

const parser = new ICFParserService()

const ICF = [
  '@kind icf',
  '@version 1.0',
  '',
  '@schema id=Masters',
  '',
  'Vendor[]:',
  '  [VendorID, UUID, Phone, Email]',
  '',
  '@schema id=Invoice',
  '',
  'documentindex:',
  '  [InvoiceNo, InvoiceDate, VendorRef]',
  '',
  'summary:',
  '  [Status, Total]',
  '',
  '@masters',
  '',
  'Vendor:',
  '  - VEN001, 550e8400-e29b-41d4-a716-446655440000, 9876543210, v@example.com',
  '',
  '@data',
  '',
  '@record schema=Invoice id=INV1',
  '',
  'documentindex:',
  '  = INV/001/25-26, 2026-05-01, Vendor:VEN001',
  '',
  'summary:Open, 5000',
  ''
].join('\n')

const doc = parser.parse(ICF)
const lines = ICF.split('\n')

/** 1-based [line, column] of the first occurrence of `needle`. */
function locate(needle: string): [number, number] {
  for (let i = 0; i < lines.length; i++) {
    const col = lines[i].indexOf(needle)
    if (col !== -1) return [i + 1, col + 1]
  }
  throw new Error(`not found: ${needle}`)
}

describe('resolveFieldAt', () => {
  it('shows the field key for a plain record value', () => {
    const [line, col] = locate('INV/001/25-26')
    const info = resolveFieldAt(ICF, line, col, doc)
    expect(info?.fieldName).toBe('InvoiceNo')
    expect(info?.master).toBeNull()
  })

  it('resolves the second cell to its field', () => {
    const [line, col] = locate('2026-05-01')
    expect(resolveFieldAt(ICF, line, col, doc)?.fieldName).toBe('InvoiceDate')
  })

  it('shows the field AND the full master entry for a Type:Id reference', () => {
    const [line, col] = locate('Vendor:VEN001')
    const info = resolveFieldAt(ICF, line, col, doc)
    expect(info?.fieldName).toBe('VendorRef')
    expect(info?.master?.type).toBe('Vendor')
    expect(info?.master?.fields).toEqual([
      { key: 'VendorID', value: 'VEN001' },
      { key: 'UUID', value: '550e8400-e29b-41d4-a716-446655440000' },
      { key: 'Phone', value: '9876543210' },
      { key: 'Email', value: 'v@example.com' }
    ])
  })

  it('shows the master entry when hovering a master id in the @masters section', () => {
    // The VEN001 inside the `- VEN001, ...` master row.
    const line = lines.findIndex((l) => l.includes('- VEN001')) + 1
    const col = lines[line - 1].indexOf('VEN001') + 1
    const info = resolveFieldAt(ICF, line, col, doc)
    expect(info?.fieldName).toBe('VendorID')
    expect(info?.master?.type).toBe('Vendor')
    expect(info?.master?.fields[0]).toEqual({ key: 'VendorID', value: 'VEN001' })
  })

  it('also resolves the full master entry when hovering its UUID value', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const line = lines.findIndex((l) => l.includes(uuid)) + 1
    const col = lines[line - 1].indexOf(uuid) + 1
    const info = resolveFieldAt(ICF, line, col, doc)
    expect(info?.fieldName).toBe('UUID')
    // Hovering the UUID shows the same Vendor record as hovering the id.
    expect(info?.master?.type).toBe('Vendor')
    expect(info?.master?.fields.find((f) => f.key === 'VendorID')?.value).toBe('VEN001')
  })

  it('resolves field keys on a compact Name:val, val line', () => {
    const [line] = locate('summary:Open, 5000')
    const openCol = lines[line - 1].indexOf('Open') + 1
    const totalCol = lines[line - 1].indexOf('5000') + 1
    expect(resolveFieldAt(ICF, line, openCol, doc)?.fieldName).toBe('Status')
    expect(resolveFieldAt(ICF, line, totalCol, doc)?.fieldName).toBe('Total')
  })

  it('does not mis-resolve a data field that collides with a master primary key', () => {
    // Two containers both keyed by `id`; a `serialcode` master has id == 1.
    // Hovering the `1` in the lineindexes data row must show the lineindexes
    // field — never the serialcode master (the first id==1 match).
    const collide = [
      '@kind icf',
      '@version 1.0',
      '',
      '@schema id=Main',
      '',
      'serialcode[]:',
      '  [id, sequence, code]',
      '',
      'lineindexes[]:',
      '  [id, rowindexname, createdby]',
      '',
      '@masters',
      '',
      'serialcode:',
      '  - 1, 100, ABC',
      '',
      '@data',
      '',
      '@record schema=Main id=R1',
      '',
      'lineindexes:',
      '  - 1, Bill Items, admin',
      ''
    ].join('\n')
    const cdoc = parser.parse(collide)
    const clines = collide.split('\n')
    const dataLine = clines.findIndex((l) => l.includes('- 1, Bill Items')) + 1
    const col = clines[dataLine - 1].indexOf('1') + 1
    const info = resolveFieldAt(collide, dataLine, col, cdoc)
    expect(info?.fieldName).toBe('id')
    expect(info?.master).toBeNull()

    // …but hovering the same id inside the serialcode master row still resolves
    // to the serialcode master (scoped to the owning type).
    const mLine = clines.findIndex((l) => l.includes('- 1, 100, ABC')) + 1
    const mCol = clines[mLine - 1].indexOf('1') + 1
    const mInfo = resolveFieldAt(collide, mLine, mCol, cdoc)
    expect(mInfo?.master?.type).toBe('serialcode')
    expect(mInfo?.master?.fields[0]).toEqual({ key: 'id', value: '1' })
  })

  it('returns null for non-value lines and schema/metadata sections', () => {
    expect(resolveFieldAt(ICF, locate('@record schema=Invoice')[0], 1, doc)).toBeNull()
    expect(resolveFieldAt(ICF, locate('documentindex:')[0], 1, doc)).toBeNull()
    // A field-list line inside @schema must not produce a hover.
    const [schemaLine, schemaCol] = locate('[Status, Total]')
    expect(resolveFieldAt(ICF, schemaLine, schemaCol + 1, doc)).toBeNull()
  })
})
