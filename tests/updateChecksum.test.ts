import { describe, it, expect } from 'vitest'
import { withUpdatedChecksum } from '@renderer/utils/updateChecksum'
import { ICFParserService } from '@renderer/services/ICFParserService'
import { fixture } from './helpers'

const parser = new ICFParserService()
const checksumOf = (text: string) => parser.parse(text).getMetadata().getChecksum()

describe('withUpdatedChecksum', () => {
  it('inserts a sha256 @checksum when none is present', async () => {
    const text = fixture('sample.icf')
    expect(checksumOf(text)).toBeNull()

    const updated = await withUpdatedChecksum(text)
    expect(checksumOf(updated)).toMatch(/^sha256:[0-9a-f]+$/)
  })

  it('replaces an existing @checksum in place (no duplicate line)', async () => {
    const text = ['@kind icf', '@version 1.0', '@checksum sha256:stale', '', '@schema', '', 'a:', '  [x]', '', '@data', '']
      .join('\n')
    const updated = await withUpdatedChecksum(text)
    const checksumLines = updated.split('\n').filter((l) => l.startsWith('@checksum'))
    expect(checksumLines).toHaveLength(1)
    expect(checksumLines[0]).not.toContain('stale')
    expect(checksumOf(updated)).toMatch(/^sha256:/)
  })

  it('changes the checksum when content changes, and is stable otherwise', async () => {
    const a = await withUpdatedChecksum(fixture('sample.icf'))
    const again = await withUpdatedChecksum(a)
    // Re-checksumming the same content yields the same value (it excludes the
    // @checksum line itself, so it is idempotent).
    expect(checksumOf(again)).toBe(checksumOf(a))

    const changed = await withUpdatedChecksum(fixture('sample.icf').replace('Cement', 'Concrete'))
    expect(checksumOf(changed)).not.toBe(checksumOf(a))
  })

  it('leaves the rest of the text byte-for-byte intact', async () => {
    const text = fixture('sample.icf')
    const updated = await withUpdatedChecksum(text)
    // Removing the inserted @checksum line should give back the original text.
    const withoutChecksum = updated
      .split('\n')
      .filter((l) => !l.startsWith('@checksum'))
      .join('\n')
    expect(withoutChecksum).toBe(text)
  })

  it('updates @checksum on an ICX file too, without disturbing @sourcechecksum', async () => {
    // Modern ICX 1.1 shape: the shared structure is `recordindex[]` (the ICX
    // 1.0 name `index[]` collides with the reserved directive name).
    const icx = [
      '@kind icx',
      '@version 1.1',
      '@source sample.icf',
      '@hashmethod sha256',
      '@sourcechecksum sha256:aaa',
      '@sourcefilechecksum sha256:bbb',
      '@records 1',
      '',
      '@schema',
      '',
      'recordindex[]:',
      '  [RecordID, UUID, Line, Offset, Size, Checksum]',
      '',
      '@data',
      '',
      '@record',
      '',
      'Invoice:',
      '  - DOC1, , 10, 100, 50, sha256:ccc',
      ''
    ].join('\n')

    const meta = parser.parse(await withUpdatedChecksum(icx)).getMetadata()
    expect(meta.getKind()).toBe('icx')
    expect(meta.getChecksum()).toMatch(/^sha256:[0-9a-f]+$/)
    // The source-related checksums are the ICX's own concern and must be left alone.
    expect(meta.getSourceChecksum()).toBe('sha256:aaa')
    expect(meta.getSourceFileChecksum()).toBe('sha256:bbb')
  })
})
