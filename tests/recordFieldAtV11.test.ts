import { describe, it, expect } from 'vitest'
import { resolveFieldAt } from '@renderer/utils/recordFieldAt'
import { ICFParserService } from '@renderer/services/ICFParserService'
import { fixture } from './helpers'

const parser = new ICFParserService()

const ICF = fixture('sample_v11.icf')
const doc = parser.parse(ICF)
const lines = ICF.split(/\r?\n/)

/** 1-based [line, column] of the first occurrence of `needle`. */
function locate(needle: string): [number, number] {
  for (let i = 0; i < lines.length; i++) {
    const col = lines[i].indexOf(needle)
    if (col !== -1) return [i + 1, col + 1]
  }
  throw new Error(`not found: ${needle}`)
}

describe('resolveFieldAt with ICF v1.1 documents', () => {
  it('resolves the first cell on the FIRST line of a multiline row', () => {
    // `- designation:DES1,` — the row start of the multiline salary row.
    const [line, col] = locate('designation:DES1,')
    const info = resolveFieldAt(ICF, line, col, doc)
    expect(info?.fieldName).toBe('desigref')
    // Highlight span covers the cell on that physical line.
    expect(info?.startColumn).toBeLessThanOrEqual(col)
    expect(info?.endColumn).toBeGreaterThan(col)
  })

  it('resolves the right field on a CONTINUATION line of a multiline row', () => {
    // `    Jan,` — second cell of the logical row.
    const [monthLine, monthCol] = locate('Jan,')
    expect(resolveFieldAt(ICF, monthLine, monthCol, doc)?.fieldName).toBe('month')
    // `    12000` — the final continuation line, fourth cell.
    const [amountLine, amountCol] = locate('12000')
    const info = resolveFieldAt(ICF, amountLine, amountCol, doc)
    expect(info?.fieldName).toBe('amount')
    expect(info?.startColumn).toBe(amountCol)
    expect(info?.endColumn).toBe(amountCol + '12000'.length)
  })

  it('resolves a primary reference to the record-local object (spec §45)', () => {
    const [line, col] = locate('designation:DES1,')
    const info = resolveFieldAt(ICF, line, col, doc)
    expect(info?.master?.type).toBe('designation')
    expect(info?.master?.fields).toEqual([
      { key: 'desigid', value: 'DES1' },
      { key: 'designame', value: 'Manager' }
    ])
  })

  it('resolves the same reference per-record (EMP2 sees its own DES1)', () => {
    const line = lines.findIndex((l) => l.includes('designation:DES1, Jan, 2026, 22000')) + 1
    const col = lines[line - 1].indexOf('designation:DES1') + 1
    const info = resolveFieldAt(ICF, line, col, doc)
    expect(info?.fieldName).toBe('desigref')
    expect(info?.master?.fields.find((f) => f.key === 'designame')?.value).toBe('Director')
  })

  it('still resolves global master references', () => {
    const [line, col] = locate('Department:D01')
    const info = resolveFieldAt(ICF, line, col, doc)
    expect(info?.fieldName).toBe('department')
    expect(info?.master?.type).toBe('Department')
    expect(info?.master?.fields).toEqual([
      { key: 'deptid', value: 'D01' },
      { key: 'deptname', value: 'Engineering' }
    ])
  })

  it('still resolves a bare master id inside @masters', () => {
    const line = lines.findIndex((l) => l.includes('- D02, Finance')) + 1
    const col = lines[line - 1].indexOf('D02') + 1
    const info = resolveFieldAt(ICF, line, col, doc)
    expect(info?.fieldName).toBe('deptid')
    expect(info?.master?.type).toBe('Department')
  })

  it('returns null on !annotation heads and their entry rows', () => {
    // Row annotation in @data.
    const [headLine] = locate('!overrides:')
    expect(resolveFieldAt(ICF, headLine, lines[headLine - 1].indexOf('!') + 1, doc)).toBeNull()
    const [entryLine, entryCol] = locate('amount=12500')
    expect(resolveFieldAt(ICF, entryLine, entryCol, doc)).toBeNull()
    // Schema annotation entries never resolve either.
    const [defLine, defCol] = locate('empstatus=employed')
    expect(resolveFieldAt(ICF, defLine, defCol, doc)).toBeNull()
    // Multiline annotation entry continuation (`empemail:required` under
    // `= empid:unique,`) must not resolve — its logical row is an annotation
    // entry, not a data row.
    const [consLine, consCol] = locate('empemail:required')
    expect(resolveFieldAt(ICF, consLine, consCol, doc)).toBeNull()
  })
})
