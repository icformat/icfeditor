import { describe, it, expect } from 'vitest'
import { ICFParserService } from '@renderer/services/ICFParserService'
import { fixture } from './helpers'

describe('ICFParserService', () => {
  const parser = new ICFParserService()
  const text = fixture('sample.icf')

  it('parses all records', () => {
    const doc = parser.parse(text)
    expect(doc.getRecordCount()).toBe(3)
  })

  it('builds a record index keyed by id and schema', () => {
    const doc = parser.parse(text)
    const index = parser.buildIndex(text, doc)

    expect(index.records).toHaveLength(3)
    expect(index.byId.get('DOC1001')?.uuid).toBe('550e8400-e29b-41d4-a716-446655440001')
    expect(index.bySchema.get('Invoice')).toEqual([0, 1, 2])

    // The first record directive sits on a line that actually says @record.
    const start = index.byId.get('DOC1001')!.startLine
    expect(text.split(/\r?\n/)[start - 1]).toContain('@record')
  })

  it('round-trips through parseStrict without throwing', () => {
    expect(() => parser.parseStrict(text)).not.toThrow()
  })
})
