import { describe, it, expect } from 'vitest'
import { ICFParserService } from '@renderer/services/ICFParserService'
import { ICFWriterService } from '@renderer/services/ICFWriterService'
import { SplitService } from '@renderer/services/SplitService'
import { fixture } from './helpers'

describe('SplitService', () => {
  const parser = new ICFParserService()
  const writer = new ICFWriterService()
  const split = new SplitService(writer)
  const doc = parser.parse(fixture('sample.icf'))

  it('splits by record count and the parts re-parse', () => {
    const parts = split.split(doc, 'sample', { strategy: 'count', countPerFile: 2 })
    expect(parts).toHaveLength(2)
    expect(parts[0].recordCount).toBe(2)
    expect(parts[1].recordCount).toBe(1)

    // Every part must still be a valid, parseable ICF document…
    for (const part of parts) {
      const reparsed = parser.parse(part.text)
      expect(reparsed.getRecordCount()).toBe(part.recordCount)
      // …and its @records metadata must match the part's record count, not the
      // source's original count (which was 3).
      expect(reparsed.getMetadata().getRecordsAsInt()).toBe(part.recordCount)
    }
  })

  it('splits by range', () => {
    const parts = split.split(doc, 'sample', { strategy: 'range', range: { start: 2, end: 3 } })
    expect(parts).toHaveLength(1)
    expect(parts[0].recordCount).toBe(2)
  })

  it('splits by schema', () => {
    const parts = split.split(doc, 'sample', { strategy: 'schema' })
    expect(parts).toHaveLength(1)
    expect(parts[0].suggestedName).toContain('Invoice')
  })

  it('drops @index and @checksum from each part', () => {
    const withMeta = parser.parse(
      [
        '@kind icf',
        '@version 1.0',
        '@revision 1',
        '@records 2',
        '@checksum sha256:abc123',
        '@index source.icx',
        '',
        '@schema',
        '',
        'customer:',
        '  [id, name]',
        '',
        '@data',
        '',
        '@record id=R1',
        '',
        'customer:',
        '  = 1, A',
        '',
        '@record id=R2',
        '',
        'customer:',
        '  = 2, B',
        ''
      ].join('\n')
    )
    const parts = split.split(
      withMeta,
      'src',
      { strategy: 'count', countPerFile: 1 },
      '2026-06-10T12:00:00Z'
    )
    expect(parts).toHaveLength(2)
    for (const part of parts) {
      const meta = parser.parse(part.text).getMetadata()
      expect(meta.getIndex()).toBeNull()
      expect(meta.getChecksum()).toBeNull()
      // The record count is still corrected, and the revision is bumped (1 -> 2).
      expect(meta.getRecordsAsInt()).toBe(1)
      expect(meta.getRevision()).toBe('2')
      // @modified is stamped with the supplied timestamp.
      expect(meta.getModified()).toBe('2026-06-10T12:00:00Z')
    }
  })
})
