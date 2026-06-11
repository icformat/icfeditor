import { describe, it, expect } from 'vitest'
import { ICFParserService } from '@renderer/services/ICFParserService'
import { StatisticsService } from '@renderer/services/StatisticsService'
import { fixture } from './helpers'

describe('StatisticsService', () => {
  const parser = new ICFParserService()
  const stats = new StatisticsService()
  const text = fixture('sample.icf')

  it('computes counts and sizes', () => {
    const doc = parser.parse(text)
    const result = stats.compute(doc, text)

    expect(result.recordCount).toBe(3)
    expect(result.schemaCount).toBe(1)
    expect(result.masterTypeCount).toBe(2)
    expect(result.masterEntryCount).toBe(3)
    expect(result.fileSizeBytes).toBeGreaterThan(0)
    expect(result.recordSize.max).toBeGreaterThanOrEqual(result.recordSize.min)
    expect(result.recordsPerSchema).toEqual([['Invoice', 3]])
    expect(result.revision).toBe('1')
  })
})
