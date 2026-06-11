import { describe, it, expect } from 'vitest'
import { normalizeIndentation } from '@renderer/utils/normalizeIndentation'

describe('normalizeIndentation', () => {
  it('indents unindented content lines between directives by two spaces', () => {
    const input = ['@data', '', '@record id=D1', 'documentindex:', '= INV-1, 2026-01-01'].join('\n')
    const { text, changedLines } = normalizeIndentation(input)
    expect(text).toBe(
      ['@data', '', '@record id=D1', '  documentindex:', '  = INV-1, 2026-01-01'].join('\n')
    )
    expect(changedLines).toEqual([4, 5])
  })

  it('leaves directive lines and already-indented lines untouched', () => {
    const input = ['@schema', '  folderdata:', '    [a, b]'].join('\n')
    const { text, changedLines } = normalizeIndentation(input)
    expect(text).toBe(input)
    expect(changedLines).toEqual([])
  })

  it('preserves verbatim text-block contents (spec §18)', () => {
    const input = [
      '@record id=D1',
      'OCRText:',
      '  <<TEXT',
      'unindented inside block stays put',
      '  @record not a directive here',
      '  TEXT>>',
      'documentindex:'
    ].join('\n')
    const { text, changedLines } = normalizeIndentation(input)
    const out = text.split('\n')
    // The two content lines outside the block are indented…
    expect(out[1]).toBe('  OCRText:')
    expect(out[6]).toBe('  documentindex:')
    // …but the block body is preserved exactly.
    expect(out[3]).toBe('unindented inside block stays put')
    expect(out[4]).toBe('  @record not a directive here')
    expect(changedLines).toEqual([2, 7])
  })

  it('does not touch content before the first directive', () => {
    const input = ['stray line', '@data', 'record-ish'].join('\n')
    const { text } = normalizeIndentation(input)
    expect(text.split('\n')[0]).toBe('stray line')
    expect(text.split('\n')[2]).toBe('  record-ish')
  })
})
