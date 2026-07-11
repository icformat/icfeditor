import { describe, it, expect } from 'vitest'
import { ICFValidatorService } from '@renderer/services/ICFValidatorService'

// Master-to-master (foreign-key) references: a master row may reference another
// master via the `Type:Id` syntax. The editor's validator delegates to icf.js,
// which resolves the reference and warns (non-fatally) on a dangling one.
const BASE = [
  '@kind icf',
  '@schema',
  '',
  'masters:',
  '  Vendor[]:',
  '    [VendorID, Name]',
  '  Project[]:',
  '    [ProjectID, Name, VendorRef]',
  '',
  '@masters',
  '',
  'Vendor:',
  '  - V001, ABC Developers',
  'Project:',
  '  - P001, XYZ Project, {REF}',
  '',
  '@data',
  ''
].join('\n')

describe('ICFValidatorService — master-to-master references', () => {
  const validator = new ICFValidatorService()

  it('accepts a resolvable foreign-key reference', () => {
    const diags = validator.validate(BASE.replace('{REF}', 'Vendor:V001'))
    expect(diags.some((d) => d.code === 'UNRESOLVED_MASTER_REFERENCE')).toBe(false)
  })

  it('warns (not errors) on a dangling foreign-key reference', () => {
    const diags = validator.validate(BASE.replace('{REF}', 'Vendor:V999'))
    const ref = diags.find((d) => d.code === 'UNRESOLVED_MASTER_REFERENCE')
    expect(ref).toBeDefined()
    expect(ref!.severity).toBe('warning')
    expect(ref!.message).toContain('Vendor:V999')
  })
})
