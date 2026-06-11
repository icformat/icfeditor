import { describe, it, expect } from 'vitest'
import { ICFParserService } from '@renderer/services/ICFParserService'
import {
  listSchemaOptions,
  matchesSchemaFilter,
  reconcileFilter,
  DEFAULT_SCHEMA_LABEL
} from '@renderer/utils/schemaFilter'
import { fixture } from './helpers'

describe('schemaFilter helpers', () => {
  const parser = new ICFParserService()
  const text = fixture('sample.icf')
  const index = parser.buildIndex(text, parser.parse(text))

  it('lists used schemas with counts', () => {
    const options = listSchemaOptions(index)
    expect(options).toEqual([{ id: 'Invoice', label: 'Invoice', count: 3 }])
  })

  it('matches everything when the filter is empty', () => {
    expect(matchesSchemaFilter('Invoice', [])).toBe(true)
    expect(matchesSchemaFilter(null, [])).toBe(true)
  })

  it('matches only selected schemas', () => {
    expect(matchesSchemaFilter('Invoice', ['Invoice'])).toBe(true)
    expect(matchesSchemaFilter('Vendor', ['Invoice'])).toBe(false)
    // The default schema is represented by the empty id.
    expect(matchesSchemaFilter(null, [''])).toBe(true)
  })

  it('labels the default schema', () => {
    expect(DEFAULT_SCHEMA_LABEL).toBe('(default)')
  })

  it('reconciles a filter against the available options', () => {
    const options = listSchemaOptions(index)
    expect(reconcileFilter(['Invoice', 'Gone'], options)).toEqual(['Invoice'])
    expect(reconcileFilter([], options)).toEqual([])
  })
})
