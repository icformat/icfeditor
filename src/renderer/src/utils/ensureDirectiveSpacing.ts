/** Outcome of {@link ensureDirectiveSpacing}. */
export interface DirectiveSpacingResult {
  text: string
  /** 1-based line numbers (in the returned text) of directives that gained a blank line above. */
  changedLines: number[]
}

/**
 * The section markers that open a major part of an ICF/ICX document. Only these
 * get a blank line above them; metadata directives (`@version`, `@encoding`,
 * `@schema-url`, …) are left in their tight header block.
 */
const SECTION_DIRECTIVES = new Set(['metadata', 'schema', 'masters', 'data', 'record'])

/** The directive keyword of a line, or null if the line is not a directive. */
function directiveName(line: string): string | null {
  const match = line.match(/^@(\S+)/)
  return match ? match[1] : null
}

/**
 * On-open readability normalizer (per project requirement): every **section**
 * directive (`@metadata`, `@schema`, `@masters`, `@data`, `@record`) should be
 * preceded by one empty line. When the line directly above is non-empty, a
 * single blank line is inserted. Note `@schema` is a section but `@schema-url`
 * is not — the keyword is matched exactly.
 *
 * Never modified:
 *  - metadata directives (`@kind`, `@version`, `@schema-url`, …),
 *  - a section directive that is already the first line of the file,
 *  - `@`-lines inside a verbatim text block (`<<TAG … TAG>>`, spec §18), which
 *    are ordinary text, not directives.
 *
 * Existing blank lines are left as-is (multiple blanks are not collapsed); this
 * only ever *adds* a blank, matching the requirement to "add it automatically".
 */
export function ensureDirectiveSpacing(text: string): DirectiveSpacingResult {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)
  const out: string[] = []
  const changedLines: number[] = []

  let inTextBlock = false
  let blockTag = ''
  let blockIndent = ''

  for (const line of lines) {
    if (inTextBlock) {
      const close = line.match(/^(\s*)([A-Za-z_]\w*)>>\s*$/)
      if (close && close[1] === blockIndent && close[2] === blockTag) inTextBlock = false
      out.push(line)
      continue
    }

    const open = line.match(/^(\s*)<<([A-Za-z_]\w*)\s*$/)
    if (open) {
      inTextBlock = true
      blockIndent = open[1]
      blockTag = open[2]
      out.push(line)
      continue
    }

    const name = directiveName(line)
    const isSection = name !== null && SECTION_DIRECTIVES.has(name)
    const prevNonEmpty = out.length > 0 && out[out.length - 1].trim() !== ''

    // Insert a blank above a section directive when one is missing and it is not
    // the very first line of the file.
    if (isSection && out.length > 0 && prevNonEmpty) {
      out.push('')
      out.push(line)
      changedLines.push(out.length) // 1-based position of the directive
    } else {
      out.push(line)
    }
  }

  return { text: out.join(eol), changedLines }
}
