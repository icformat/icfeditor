import { describe, it, expect } from 'vitest'
import { parseLenient } from 'icf.js'
import {
  buildFileProperties,
  truncateMiddle,
  utf8Size
} from '@renderer/utils/fileProperties'
import type { OpenDocument } from '@renderer/models/document'

const ICF = ['@kind icf', '@version 1.1', '@checksum sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', '@schema', '', 'Vendor:', '  [VendorID, Name]', '', '@data', '', '@record', '', 'Vendor:', '  = V1, ABC', ''].join('\n')

function doc(overrides: Partial<OpenDocument> = {}): OpenDocument {
  return {
    id: 'doc-1',
    path: 'C:\\data\\invoices.icf',
    fileName: 'invoices.icf',
    kind: 'icf',
    text: ICF,
    parsed: parseLenient(ICF),
    diagnostics: [],
    mode: 'view',
    dirty: false,
    disk: null,
    collapsed: {},
    bookmarks: [],
    notices: [],
    ...overrides
  }
}

function rows(groups: ReturnType<typeof buildFileProperties>, title: string) {
  return groups.find((g) => g.title === title)?.rows ?? []
}

function value(groups: ReturnType<typeof buildFileProperties>, title: string, label: string) {
  return rows(groups, title).find((r) => r.label === label)?.value
}

describe('buildFileProperties', () => {
  it('reports path, folder and disk size for a saved file', () => {
    const groups = buildFileProperties(doc(), null, { size: 1536, mtimeMs: 1e12, birthtimeMs: 1e12 })
    expect(value(groups, 'File', 'Path')).toBe('C:\\data\\invoices.icf')
    expect(value(groups, 'File', 'Folder')).toBe('C:\\data')
    expect(value(groups, 'File', 'Size on disk')).toBe('1.5 KB (1,536 bytes)')
    expect(value(groups, 'File', 'Kind')).toBe('ICF document')
    expect(value(groups, 'File', 'Unsaved changes')).toBe('No')
  })

  it('handles unsaved buffers (no path) without file-system rows', () => {
    const groups = buildFileProperties(doc({ path: null, dirty: true }), null, null)
    expect(value(groups, 'File', 'Path')).toBe('Not saved to disk')
    expect(value(groups, 'File', 'Folder')).toBeUndefined()
    expect(value(groups, 'File', 'Size on disk')).toBeUndefined()
    expect(value(groups, 'File', 'Unsaved changes')).toBe('Yes')
  })

  it('flags a path whose file no longer exists on disk', () => {
    const groups = buildFileProperties(doc(), null, null)
    expect(value(groups, 'File', 'Size on disk')).toBe('File not found on disk')
  })

  it('counts lines, records and problems in the Content group', () => {
    const index = { records: [{}, {}], byId: new Map(), bySchema: new Map() }
    const groups = buildFileProperties(
      doc({
        diagnostics: [
          { severity: 'error', message: 'x', line: 1 },
          { severity: 'warning', message: 'y', line: 2 }
        ] as OpenDocument['diagnostics']
      }),
      index as never,
      null
    )
    expect(value(groups, 'Content', 'Lines')).toBe(String(ICF.split('\n').length))
    expect(value(groups, 'Content', 'Records')).toBe('2')
    expect(value(groups, 'Content', 'Problems')).toBe('1 error(s), 1 warning(s)')
  })

  it('surfaces document directives from the parsed metadata', () => {
    const groups = buildFileProperties(doc(), null, null)
    expect(value(groups, 'Document directives', 'Format')).toBe('icf')
    expect(value(groups, 'Document directives', 'Version')).toBe('1.1')
    const checksum = value(groups, 'Document directives', 'Checksum')
    expect(checksum).toContain('sha256:')
    expect(checksum).toContain('…') // long value truncated for display
  })
})

describe('helpers', () => {
  it('utf8Size counts bytes, not characters', () => {
    expect(utf8Size('abc')).toBe(3)
    expect(utf8Size('é')).toBe(2)
  })

  it('truncateMiddle keeps short values intact and shortens long ones', () => {
    expect(truncateMiddle('short', 10)).toBe('short')
    const long = 'a'.repeat(30) + 'b'.repeat(30)
    const cut = truncateMiddle(long, 21)
    expect(cut.length).toBeLessThanOrEqual(21)
    expect(cut).toContain('…')
    expect(cut.startsWith('aaaa')).toBe(true)
    expect(cut.endsWith('bbbb')).toBe(true)
  })
})
