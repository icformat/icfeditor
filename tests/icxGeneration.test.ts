import { describe, it, expect } from 'vitest'
import { IcxGenerator, joinTags, splitTags } from 'icf.js'
import { ICFParserService } from '@renderer/services/ICFParserService'
import { ICFWriterService } from '@renderer/services/ICFWriterService'
import { ICXGeneratorService } from '@renderer/services/ICXGeneratorService'
import { ICFValidatorService } from '@renderer/services/ICFValidatorService'
import { fixture } from './helpers'

const parser = new ICFParserService()
const writer = new ICFWriterService()
const generator = new ICXGeneratorService()
const validator = new ICFValidatorService()

describe('ICX generation targets spec v1.2', () => {
  const source = parser.parse(fixture('sample.icf'))

  it('generates ICX declaring @version 1.2 with a clean write → parse round trip', () => {
    const icx = generator.generate(source, 'sample.icf')
    expect(icx.getMetadata().getKind()).toBe('icx')
    expect(icx.getMetadata().getVersion()).toBe('1.2')
    expect(icx.getMetadata().getVersion()).toBe(IcxGenerator.DEFAULT_ICX_VERSION)

    const written = writer.write(icx)
    expect(written).toContain('@version 1.2')
    // Declared types index under their own names — no reserved `index[]`
    // shared structure, so the round trip carries no RESERVED_OBJECT_NAME
    // warning (in fact, no diagnostics at all).
    const diags = validator.validate(written)
    expect(diags.filter((d) => d.code === 'RESERVED_OBJECT_NAME')).toEqual([])
    expect(diags).toEqual([])

    const reparsed = parser.parse(written)
    expect(reparsed.getMetadata().getVersion()).toBe('1.2')
    expect(generator.extractRows(reparsed).length).toBeGreaterThan(0)
  })

  it('harvests typed master references into a Tags column that splitTags round-trips', () => {
    const icx = generator.generate(source, 'sample.icf')
    const invoiceRow = icx.getRecord(0)!.getData().get('Invoice')!.get(0)!
    // DOC1001 references Vendor:VEN100 and Project:PRJ001 in its documentindex.
    expect(invoiceRow.fieldNames()).toContain('Tags')
    const cell = invoiceRow.get('Tags')!.asText()
    const tags = splitTags(cell)
    expect(tags).toEqual(['Vendor:VEN100', 'Project:PRJ001'])
    // joinTags is the exact inverse (ICX v1.2 §7 `+`-joined syntax).
    expect(joinTags(tags)).toBe(cell)
  })

  it('copies a record summary= attribute into the Summary column', () => {
    // Record attributes are space-delimited, so the summary is one token.
    const withSummary = fixture('sample.icf').replace(
      '@record schema=Invoice id=DOC1001',
      '@record schema=Invoice id=DOC1001 summary=cement-and-steel-purchase'
    )
    const icx = generator.generate(parser.parse(withSummary), 'sample.icf')
    const rows = icx.getRecord(0)!.getData().get('Invoice')!.elements()
    expect(rows[0].get('Summary')?.asText()).toBe('cement-and-steel-purchase')
    // Other records carry an empty Summary cell (column exists once non-empty).
    expect(rows[1].get('Summary')?.asText()).toBe('')
    // The written form round-trips cleanly with the 8-field schema.
    expect(validator.validate(writer.write(icx))).toEqual([])
  })

  it('surfaces RESERVED_OBJECT_NAME for a legacy ICX 1.0 index[] structure', () => {
    const legacy = [
      '@kind icx',
      '@version 1.0',
      '',
      '@schema',
      '',
      'index[]:',
      '  [RecordID, UUID, Line, Offset, Size, Checksum]',
      '',
      '@data',
      '',
      '@record',
      '',
      'Invoice:',
      '  - DOC1, , 10, 100, 50, sha256:ccc',
      ''
    ].join('\n')
    const hit = validator.validate(legacy).find((d) => d.code === 'RESERVED_OBJECT_NAME')
    expect(hit).toBeDefined()
    expect(hit?.severity).toBe('warning')
  })
})
