import { describe, it, expect } from 'vitest'
import { write } from 'icf.js'
import { ICFParserService } from '@renderer/services/ICFParserService'
import { ICXGeneratorService } from '@renderer/services/ICXGeneratorService'
import { RecordEditService } from '@renderer/services/RecordEditService'
import { fixture } from './helpers'

describe('ICXGeneratorService — compare', () => {
  const parser = new ICFParserService()
  const icx = new ICXGeneratorService()
  const edit = new RecordEditService()
  const sourceText = fixture('sample.icf')
  const source = parser.parse(sourceText)

  it('extracts index rows from a generated ICX', () => {
    const generated = icx.generate(source, 'sample.icf')
    const rows = icx.extractRows(generated)
    const ids = rows.map((r) => r.recordId)
    // 3 master entries (VEN100, VEN200, PRJ001) + 3 invoice records.
    expect(rows).toHaveLength(6)
    expect(ids).toContain('DOC1001')
    expect(ids).toContain('VEN100')
  })

  it('sets @sourcerevision from the source @revision when regenerating', async () => {
    // The source fixture declares @revision 1.
    const full = await icx.generateFull(source, { sourceFileName: 'sample.icf', sourceText })
    expect(full.getMetadata().getSourceRevision()).toBe('1')

    // It tracks the source revision: bump the source and regenerate.
    const bumped = parser.parse(sourceText.replace('@revision 1', '@revision 7'))
    const full2 = await icx.generateFull(bumped, { sourceText: sourceText.replace('@revision 1', '@revision 7') })
    expect(full2.getMetadata().getSourceRevision()).toBe('7')

    // A regenerated index agrees with its source on revision (no revision issue).
    const cmp = icx.compare(source, full)
    expect(cmp.icxSourceRevision).toBe('1')
    expect(cmp.issues.some((i) => /revision/i.test(i))).toBe(false)
  })

  it('reports an up-to-date index when ICF and ICX agree', async () => {
    const storedIcxDoc = await icx.generateWithChecksums(source, { sourceText })
    const stored = parser.parse(write(storedIcxDoc))
    const report = await icx.comparePerRecord(source, stored, sourceText)

    expect(report.counts.added).toBe(0)
    expect(report.counts.removed).toBe(0)
    expect(report.counts.checksumMismatch).toBe(0)
    expect(report.counts.match).toBe(6)
  })

  it('flags an added record as a stale index', async () => {
    // Build an ICX for the original, then add a record to the source.
    const storedIcxDoc = await icx.generateWithChecksums(source, { sourceText })
    const stored = parser.parse(write(storedIcxDoc))

    const index = parser.buildIndex(sourceText, source)
    const grown = edit.insertRecord(sourceText, index, source, 0)
    const grownDoc = parser.parse(grown.text)

    const report = await icx.comparePerRecord(grownDoc, stored, grown.text)
    expect(report.counts.added).toBe(1) // the new record is missing from the index
    expect(report.rows.some((r) => r.status === 'added')).toBe(true)
  })

  it('flags a checksum mismatch when a record changes', async () => {
    const storedIcxDoc = await icx.generateWithChecksums(source, { sourceText })
    const stored = parser.parse(write(storedIcxDoc))

    // Change a value inside DOC1001 (Cement -> Concrete) without adding records.
    const changedText = sourceText.replace('Cement', 'Concrete')
    const changedDoc = parser.parse(changedText)

    const report = await icx.comparePerRecord(changedDoc, stored, changedText)
    expect(report.counts.checksumMismatch).toBeGreaterThanOrEqual(1)
  })
})
