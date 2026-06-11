import { describe, it, expect } from 'vitest'
import { ICFParserService } from '@renderer/services/ICFParserService'
import { RecordEditService } from '@renderer/services/RecordEditService'
import { fixture } from './helpers'

/** Re-parses text and returns [recordCount, orderedIds]. */
function inspect(parser: ICFParserService, text: string): [number, (string | null)[]] {
  const doc = parser.parse(text)
  return [doc.getRecordCount(), doc.getRecords().map((r) => r.getId())]
}

describe('RecordEditService', () => {
  const parser = new ICFParserService()
  const edit = new RecordEditService()
  const original = fixture('sample.icf')

  function index(text: string) {
    return parser.buildIndex(text, parser.parse(text))
  }

  it('deletes a record', () => {
    const result = edit.deleteRecord(original, index(original), 1)
    const [count, ids] = inspect(parser, result.text)
    expect(count).toBe(2)
    expect(ids).toEqual(['DOC1001', 'DOC3001'])
    expect(result.selectIndex).toBe(1)
  })

  it('duplicates a record verbatim', () => {
    const result = edit.duplicateRecord(original, index(original), 0)
    const [count, ids] = inspect(parser, result.text)
    expect(count).toBe(4)
    // The duplicate keeps the same id and sits immediately after the original.
    expect(ids[0]).toBe('DOC1001')
    expect(ids[1]).toBe('DOC1001')
    expect(result.selectIndex).toBe(1)
  })

  it('clones a record with a fresh id and no uuid', () => {
    const result = edit.cloneRecord(original, index(original), 0)
    const doc = parser.parse(result.text)
    expect(doc.getRecordCount()).toBe(4)
    const clone = doc.getRecord(1)!
    expect(clone.getId()).not.toBe('DOC1001')
    expect(clone.getUuid()).toBeNull()
  })

  it('moves a record down and back up', () => {
    const down = edit.moveRecordDown(original, index(original), 0)
    expect(inspect(parser, down.text)[1]).toEqual(['DOC2001', 'DOC1001', 'DOC3001'])
    expect(down.selectIndex).toBe(1)

    const up = edit.moveRecordUp(down.text, index(down.text), 1)
    expect(inspect(parser, up.text)[1]).toEqual(['DOC1001', 'DOC2001', 'DOC3001'])
  })

  it('inserts a new record after the selected one and it parses', () => {
    const result = edit.insertRecord(original, index(original), parser.parse(original), 0)
    const [count, ids] = inspect(parser, result.text)
    expect(count).toBe(4)
    expect(ids[1]).toMatch(/^RECORD_/)
    expect(result.selectIndex).toBe(1)
  })

  it('move is a no-op at the boundaries', () => {
    expect(edit.moveRecordUp(original, index(original), 0).text).toBe(original)
    expect(edit.moveRecordDown(original, index(original), 2).text).toBe(original)
  })
})
