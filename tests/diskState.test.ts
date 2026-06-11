import { describe, it, expect } from 'vitest'
import { diskChange } from '@renderer/utils/diskState'

describe('diskChange', () => {
  const base = { mtimeMs: 1000, size: 50 }

  it('is unknown without a baseline', () => {
    expect(diskChange(null, base)).toBe('unknown')
    expect(diskChange(null, null)).toBe('unknown')
  })

  it('detects deletion', () => {
    expect(diskChange(base, null)).toBe('deleted')
  })

  it('detects modification by mtime or size', () => {
    expect(diskChange(base, { mtimeMs: 2000, size: 50 })).toBe('modified')
    expect(diskChange(base, { mtimeMs: 1000, size: 51 })).toBe('modified')
  })

  it('reports same when unchanged', () => {
    expect(diskChange(base, { mtimeMs: 1000, size: 50 })).toBe('same')
  })
})
