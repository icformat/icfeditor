import { describe, it, expect } from 'vitest'
import { ICFParserService } from '@renderer/services/ICFParserService'
import { ICFWriterService } from '@renderer/services/ICFWriterService'
import { ICXGeneratorService } from '@renderer/services/ICXGeneratorService'
import { ExportService } from '@renderer/services/ExportService'
import { fixture } from './helpers'

describe('ExportService', () => {
  const parser = new ICFParserService()
  const exporter = new ExportService(new ICFWriterService(), new ICXGeneratorService())
  const text = fixture('sample.icf')
  const doc = parser.parse(text)

  it('exports valid JSON', async () => {
    const result = await exporter.export(doc, 'jsonPretty')
    expect(result.extension).toBe('json')
    expect(() => JSON.parse(result.content)).not.toThrow()
  })

  it('exports a CSV header plus a row per record', async () => {
    const result = await exporter.export(doc, 'csv')
    const lines = result.content.split('\n')
    expect(lines.length).toBe(1 + doc.getRecordCount())
  })

  it('exports a fully-populated ICX (records and masters)', async () => {
    const icx = await exporter.export(doc, 'icx', { sourceFileName: 'sample.icf', sourceText: text })
    expect(icx.extension).toBe('icx')
    expect(icx.content).toContain('@kind icx')

    // Re-parse the emitted ICX and assert positional + checksum fields are filled.
    const icxGen = new ICXGeneratorService()
    const rows = icxGen.extractRows(parser.parse(icx.content))
    const invoice = rows.find((r) => r.recordId === 'DOC1001')!
    const vendor = rows.find((r) => r.recordId === 'VEN100')!

    // Records: checksum present (UUID came from the @record attribute).
    expect(invoice.checksum).toMatch(/^sha256:/)
    // Masters: checksum present too (previously the editor emitted a blank skeleton).
    expect(vendor.checksum).toMatch(/^sha256:/)

    // Master Line/Offset/Size are filled (not in the library — added by the editor).
    const parsedIcx = parser.parse(icx.content)
    const vendorRow = parsedIcx.getRecord(0)!.getData().get('Vendor')!.get(0)!
    expect(Number(vendorRow.get('Line')?.asText())).toBeGreaterThan(0)
    expect(Number(vendorRow.get('Size')?.asText())).toBeGreaterThan(0)
  })

  it('copies a master UUID field (case-insensitive) into the ICX', async () => {
    // A masters schema that declares a UUID keyword, with values per entry.
    const withUuid = [
      '@kind icf',
      '@version 1.0',
      '',
      '@schema id=Masters',
      '',
      'Vendor[]:',
      '  [VendorID, UUID, Phone]',
      '',
      '@masters',
      '',
      'Vendor:',
      '  - VEN100, 550e8400-e29b-41d4-a716-446655440000, 9876543210',
      '',
      '@data',
      '',
      '@record schema=Masters id=R1',
      '',
      'Vendor:',
      '  = VEN100, 550e8400-e29b-41d4-a716-446655440000, 9876543210',
      ''
    ].join('\n')

    const source = parser.parse(withUuid)
    const icx = await exporter.export(source, 'icx', { sourceText: withUuid })
    const parsedIcx = parser.parse(icx.content)
    const vendorRow = parsedIcx.getRecord(0)!.getData().get('Vendor')!.get(0)!
    expect(vendorRow.get('UUID')?.asText()).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('exports YAML', async () => {
    expect((await exporter.export(doc, 'yaml')).content.length).toBeGreaterThan(0)
  })
})
