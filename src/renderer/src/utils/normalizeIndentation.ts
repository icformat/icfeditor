/** Outcome of {@link normalizeIndentation}. */
export interface IndentNormalizationResult {
  text: string
  /** 1-based line numbers that received the two-space indent. */
  changedLines: number[]
}

const INDENT = '  '

/**
 * On-open indentation normalizer (per project requirement). A non-directive,
 * non-empty line that sits at column 0 between directives is given a two-space
 * indent; this is applied to every such unindented content line in the file.
 *
 * Two regions are never touched:
 *  - directive lines (`@…`), which delimit the sections, and
 *  - the verbatim contents of preformatted text blocks (`<<TAG … TAG>>`, spec
 *    §18), whose whitespace must be preserved exactly.
 *
 * The returned `changedLines` are reported to the user in the Problems tab so
 * the rewrite is visible (and undoable in the editor).
 */
export function normalizeIndentation(text: string): IndentNormalizationResult {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)
  const changedLines: number[] = []

  let seenDirective = false
  let inTextBlock = false
  let blockTag = ''
  let blockIndent = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (inTextBlock) {
      // Close the block only on a matching tag at the same indent (spec §18).
      const close = line.match(/^(\s*)([A-Za-z_]\w*)>>\s*$/)
      if (close && close[1] === blockIndent && close[2] === blockTag) inTextBlock = false
      continue
    }

    // A text-block opener: everything until the matching close is verbatim.
    const open = line.match(/^(\s*)<<([A-Za-z_]\w*)\s*$/)
    if (open) {
      inTextBlock = true
      blockIndent = open[1]
      blockTag = open[2]
      continue
    }

    if (line.startsWith('@')) {
      seenDirective = true
      continue
    }

    // Blank lines carry no indentation to fix.
    if (line.trim() === '') continue

    // A non-directive content line at column 0, inside the directive region.
    if (seenDirective && /^\S/.test(line)) {
      lines[i] = INDENT + line
      changedLines.push(i + 1)
    }
  }

  return { text: lines.join(eol), changedLines }
}
