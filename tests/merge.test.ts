import { describe, it, expect } from 'vitest'
import { ICFParserService } from '@renderer/services/ICFParserService'
import { ICFWriterService } from '@renderer/services/ICFWriterService'
import { MergeService } from '@renderer/services/MergeService'
import { fixture } from './helpers'

describe('MergeService', () => {
  const parser = new ICFParserService()
  const writer = new ICFWriterService()
  const merge = new MergeService(writer)

  it('merges two compatible documents and deduplicates masters', () => {
    const a = parser.parse(fixture('sample.icf'))
    const b = parser.parse(fixture('sample.icf'))

    const preview = merge.preview([a, b], '2026-06-10T12:00:00Z')

    // Records concatenate (3 + 3); masters dedupe to the original 3 entries.
    expect(preview.mergedRecordCount).toBe(6)
    expect(preview.mergedMasterCount).toBe(3)
    expect(preview.deduplicatedMasters).toBe(3)

    // Identical ids across sources are flagged as conflicts.
    expect(preview.conflicts.some((c) => c.kind === 'duplicateRecordId')).toBe(true)

    // The merged text is itself valid ICF.
    const mergedDoc = parser.parse(preview.resultText)
    expect(mergedDoc.getRecordCount()).toBe(6)
    // @records reflects the combined count, not the base document's original 3.
    expect(mergedDoc.getMetadata().getRecordsAsInt()).toBe(6)
    // The base's whole-file @index / @checksum no longer apply, so they're dropped
    // (the sample source declares @index sample.icx).
    expect(mergedDoc.getMetadata().getIndex()).toBeNull()
    expect(mergedDoc.getMetadata().getChecksum()).toBeNull()
    // The base @revision (1) is bumped for the new merged content.
    expect(mergedDoc.getMetadata().getRevision()).toBe('2')
    // @modified is stamped with the supplied timestamp.
    expect(mergedDoc.getMetadata().getModified()).toBe('2026-06-10T12:00:00Z')
  })
})
