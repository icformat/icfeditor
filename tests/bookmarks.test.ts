import { describe, it, expect } from 'vitest'
import { toggleBookmark, nextBookmark, previousBookmark } from '@renderer/utils/bookmarks'

describe('bookmark helpers', () => {
  it('adds a bookmark in sorted order', () => {
    expect(toggleBookmark([10, 30], 20)).toEqual([10, 20, 30])
    expect(toggleBookmark([], 5)).toEqual([5])
  })

  it('removes an existing bookmark', () => {
    expect(toggleBookmark([10, 20, 30], 20)).toEqual([10, 30])
  })

  it('finds the next bookmark, wrapping past the end', () => {
    expect(nextBookmark([10, 20, 30], 15)).toBe(20)
    expect(nextBookmark([10, 20, 30], 30)).toBe(10)
    expect(nextBookmark([], 5)).toBeNull()
  })

  it('finds the previous bookmark, wrapping before the start', () => {
    expect(previousBookmark([10, 20, 30], 25)).toBe(20)
    expect(previousBookmark([10, 20, 30], 10)).toBe(30)
    expect(previousBookmark([], 5)).toBeNull()
  })
})
