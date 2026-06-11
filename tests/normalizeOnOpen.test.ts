import { describe, it, expect } from 'vitest'
import { normalizeOnOpen } from '@renderer/utils/normalizeOnOpen'
import { ICFParserService } from '@renderer/services/ICFParserService'
import { ICFValidatorService } from '@renderer/services/ICFValidatorService'
import { ICFWriterService } from '@renderer/services/ICFWriterService'
import { ExportService } from '@renderer/services/ExportService'
import { ICXGeneratorService } from '@renderer/services/ICXGeneratorService'
import { fixture } from './helpers'

const parser = new ICFParserService()
const validator = new ICFValidatorService()
const countErrors = (t: string) => validator.validate(t).filter((d) => d.severity === 'error').length

describe('normalizeOnOpen', () => {
  it('does NOT indent a well-formed file (guard prevents corrupting the parse)', () => {
    const original = fixture('sample.icf')
    const { text, indentedLines } = normalizeOnOpen(original, countErrors)

    // The indent pass must be skipped — indenting column-0 node names would
    // flatten the hierarchy and break exports.
    expect(indentedLines).toEqual([])

    // The normalized document still parses with its full field structure intact.
    const doc = parser.parse(text)
    expect(doc.getRecordCount()).toBe(3)
    const record0 = doc.getRecord(0)!.getData()
    expect(record0.fieldNames()).toContain('folderdata')
    expect(record0.fieldNames()).toContain('documentindex')
    expect(record0.fieldNames()).toContain('lineindex')
  })

  it('keeps every export format intact after normalization of a valid file', async () => {
    const exporter = new ExportService(new ICFWriterService(), new ICXGeneratorService())
    const { text } = normalizeOnOpen(fixture('sample.icf'), countErrors)
    const doc = parser.parse(text)

    const json = JSON.parse((await exporter.export(doc, 'jsonPretty')).content)
    expect(json[0].folderdata).toBeDefined()
    expect(json[0].documentindex).toBeDefined()

    // CSV keeps a header row plus one row per record.
    const csvLines = (await exporter.export(doc, 'csv')).content.split('\n')
    expect(csvLines.length).toBe(1 + doc.getRecordCount())
  })

  it('still adds blank lines above section directives that lack them', () => {
    const flat = ['@kind icf', '@schema', 'customer:', '  [id, name]', '@data'].join('\n')
    const { spacedLines } = normalizeOnOpen(flat, countErrors)
    expect(spacedLines.length).toBeGreaterThan(0)
  })

  it('applies the indent only when it does not add errors', () => {
    // A guarded indent that would create errors is reverted, so the count stays 0
    // for an already-valid file.
    const original = fixture('sample.icf')
    const before = countErrors(original)
    const { text } = normalizeOnOpen(original, countErrors)
    expect(countErrors(text)).toBeLessThanOrEqual(before)
  })
})
