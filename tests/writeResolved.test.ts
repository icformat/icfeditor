import { describe, it, expect } from 'vitest'
import { ICFParserService } from '@renderer/services/ICFParserService'
import { ICFWriterService } from '@renderer/services/ICFWriterService'
import { ICXGeneratorService } from '@renderer/services/ICXGeneratorService'
import { ExportService } from '@renderer/services/ExportService'
import { fixture } from './helpers'

const parser = new ICFParserService()
const writer = new ICFWriterService()

describe('writeResolved (ICF v1.1 Phase-5 resolved export)', () => {
  it('drops annotation lines and applies overrides on the v1.1 fixture', () => {
    const doc = parser.parse(fixture('sample_v11.icf'))
    const resolved = writer.writeResolved(doc)
    const lines = resolved.split('\n')

    // No `!` annotation lines survive (schema or row annotations).
    expect(lines.some((l) => l.trimStart().startsWith('!'))).toBe(false)
    expect(resolved).not.toContain('!defaults')
    expect(resolved).not.toContain('!overrides')

    // The `!overrides: amount=12500` on EMP1's first salary row is applied…
    expect(resolved).toContain('designation:DES1, Jan, 2026, 12500')
    // …and the following row keeps its own value.
    expect(resolved).toContain('designation:DES2, Feb, 2026, 13000')
    // Default-covered fields stay present as plain row values.
    expect(resolved).toContain('= 2, Anand, anand@example.com, Department:D01, employed')

    // The parsed source document itself is untouched (raw value kept).
    const raw = doc.getRecord(0)!.getData().get('salary')!.get(0)!
    expect(raw.get('amount')?.asText()).toBe('12000')
  })

  it('materializes !defaults for fields missing from a row', () => {
    const text = [
      '@kind icf',
      '@version 1.1',
      '',
      '@schema',
      '',
      'employee[]:',
      '  [empid, empname]',
      '  !defaults:',
      '    = empstatus=employed',
      '',
      '@data',
      '',
      '@record id=R1',
      '',
      'employee:',
      '  - 1, Anand',
      ''
    ].join('\n')
    const resolved = writer.writeResolved(parser.parse(text))
    // The default appears as a plain field: schema widened, value filled.
    expect(resolved).toContain('[empid, empname, empstatus]')
    expect(resolved).toContain('- 1, Anand, employed')
    expect(resolved).not.toContain('!defaults')
  })

  it('is exposed as the icfResolved export format', async () => {
    const exporter = new ExportService(writer, new ICXGeneratorService())
    const doc = parser.parse(fixture('sample_v11.icf'))
    const result = await exporter.export(doc, 'icfResolved')
    expect(result.extension).toBe('icf')
    expect(result.content).toContain('designation:DES1, Jan, 2026, 12500')
    expect(result.content).not.toContain('!overrides')
  })
})
