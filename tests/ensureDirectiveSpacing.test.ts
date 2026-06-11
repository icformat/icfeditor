import { describe, it, expect } from 'vitest'
import { ensureDirectiveSpacing } from '@renderer/utils/ensureDirectiveSpacing'

describe('ensureDirectiveSpacing', () => {
  it('inserts a blank only above section directives, leaving metadata directives tight', () => {
    const input = ['@kind icf', '@version 1.0', '@data'].join('\n')
    const { text, changedLines } = ensureDirectiveSpacing(input)
    // @version is a metadata directive (no blank); @data is a section (blank above).
    expect(text).toBe(['@kind icf', '@version 1.0', '', '@data'].join('\n'))
    expect(changedLines).toEqual([4])
  })

  it('treats @schema as a section but @schema-url as a metadata directive', () => {
    const input = ['@kind icf', '@schema-url https://x', '@schema id=Invoice'].join('\n')
    const { text } = ensureDirectiveSpacing(input)
    expect(text).toBe(
      ['@kind icf', '@schema-url https://x', '', '@schema id=Invoice'].join('\n')
    )
  })

  it('does not add a blank above a section directive at the file start', () => {
    const input = ['@data', '@record id=D1'].join('\n')
    const { text, changedLines } = ensureDirectiveSpacing(input)
    expect(text).toBe(['@data', '', '@record id=D1'].join('\n'))
    expect(changedLines).toEqual([3])
  })

  it('leaves existing blank lines untouched (no collapsing)', () => {
    const input = ['@kind icf', '', '', '@data'].join('\n')
    const { text } = ensureDirectiveSpacing(input)
    expect(text).toBe(input)
  })

  it('does not treat @-lines inside a text block as directives', () => {
    const input = [
      '@kind icf',
      '@data',
      '',
      '@record id=D1',
      'OCRText:',
      '  <<TEXT',
      '@record looks like a directive but is verbatim',
      '  TEXT>>'
    ].join('\n')
    const out = ensureDirectiveSpacing(input).text.split('\n')
    // The real @data and @record gained blanks…
    expect(out).toContain('@data')
    expect(out[out.indexOf('@data') - 1]).toBe('')
    // …but the line inside the block is untouched (no blank inserted above it).
    const idx = out.indexOf('@record looks like a directive but is verbatim')
    expect(out[idx - 1]).toBe('  <<TEXT')
  })

  it('handles a file that does not start with @kind without a leading blank', () => {
    const input = ['@version 1.0', '@data'].join('\n')
    const { text } = ensureDirectiveSpacing(input)
    expect(text.split('\n')[0]).toBe('@version 1.0') // no leading blank line
    expect(text).toBe(['@version 1.0', '', '@data'].join('\n'))
  })
})
