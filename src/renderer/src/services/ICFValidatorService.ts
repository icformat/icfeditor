import { validate, Severity, type ValidationMessage } from 'icf.js'
import type { Diagnostic } from '../models/validation'

export type { Diagnostic } from '../models/validation'

/**
 * Adapter over `icf.js` validation. `icf.js` natively covers schema, field
 * count, references, master references, duplicate id/uuid, directives,
 * indentation, and text-block checks (Prompt.md §ICF Validation), so this
 * service is mostly a mapping layer plus convenience grouping.
 */
export class ICFValidatorService {
  validate(text: string): Diagnostic[] {
    const result = validate(text)
    return result.getMessages().map((m) => this.toDiagnostic(m))
  }

  /** Groups diagnostics by 1-based line for fast tree-badge lookup. */
  byLine(diagnostics: Diagnostic[]): Map<number, Diagnostic[]> {
    const map = new Map<number, Diagnostic[]>()
    for (const d of diagnostics) {
      const bucket = map.get(d.line)
      if (bucket) bucket.push(d)
      else map.set(d.line, [d])
    }
    return map
  }

  private toDiagnostic(m: ValidationMessage): Diagnostic {
    const severity = m.getSeverity() === Severity.ERROR ? 'error' : 'warning'
    return {
      severity,
      code: m.getCode(),
      message: m.getMessage(),
      line: m.getLine()
    }
  }
}
