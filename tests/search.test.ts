import { describe, it, expect } from 'vitest'
import { ICFParserService } from '@renderer/services/ICFParserService'
import { SearchService } from '@renderer/services/SearchService'
import { fixture } from './helpers'

describe('SearchService', () => {
  const parser = new ICFParserService()
  const search = new SearchService()
  const text = fixture('sample.icf')
  const doc = parser.parse(text)
  const index = parser.buildIndex(text, doc)

  it('finds free text and associates it with a record', () => {
    const results = search.search(text, index, { term: 'Cement', mode: 'text', caseSensitive: false })
    expect(results.hits.length).toBeGreaterThan(0)
    expect(results.hits[0].recordId).toBe('DOC1001')
  })

  it('jumps to a record by id', () => {
    const results = search.search(text, index, {
      term: 'DOC2001',
      mode: 'recordId',
      caseSensitive: false
    })
    expect(results.hits).toHaveLength(1)
    expect(results.hits[0].recordIndex).toBe(1)
  })

  it('filters record indices by schema', () => {
    expect(search.filterBySchemas(index, ['Invoice'])).toEqual([0, 1, 2])
    expect(search.filterBySchemas(index, ['Nonexistent'])).toEqual([])
  })
})
