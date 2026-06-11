import { describe, it, expect } from 'vitest'
import { replaceOccurrences, replaceInRange } from '@renderer/utils/replace'

describe('replaceOccurrences', () => {
  it('replaces all occurrences and counts them', () => {
    const r = replaceOccurrences('a A a', 'a', 'X', true)
    expect(r.text).toBe('X A X')
    expect(r.count).toBe(2)
  })

  it('is case-insensitive when requested', () => {
    const r = replaceOccurrences('a A a', 'a', 'X', false)
    expect(r.text).toBe('X X X')
    expect(r.count).toBe(3)
  })

  it('treats search as a literal (no regex) and inserts replacement verbatim', () => {
    const r = replaceOccurrences('total = a.b', 'a.b', '$1', true)
    expect(r.text).toBe('total = $1') // `.` not a wildcard, `$1` inserted literally
    expect(r.count).toBe(1)
  })

  it('returns the text unchanged for an empty search', () => {
    expect(replaceOccurrences('abc', '', 'X', true)).toEqual({ text: 'abc', count: 0 })
  })
})

describe('replaceInRange', () => {
  it('replaces only within the given offsets', () => {
    // "aaa aaa" — replace 'a' only in the first word [0,3).
    const r = replaceInRange('aaa aaa', 0, 3, 'a', 'b', true)
    expect(r.text).toBe('bbb aaa')
    expect(r.count).toBe(3)
  })
})
