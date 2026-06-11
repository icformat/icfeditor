import { ensureDirectiveSpacing } from './ensureDirectiveSpacing'
import { normalizeIndentation } from './normalizeIndentation'

/** Result of the combined on-open normalization. */
export interface OnOpenNormalization {
  text: string
  /** 1-based lines (in `text`) that gained a blank line above a section directive. */
  spacedLines: number[]
  /** 1-based lines (in `text`) that were indented; empty when the indent pass was skipped. */
  indentedLines: number[]
}

/**
 * Combined on-open normalization with a safety guard.
 *
 * Two passes run for readability:
 *  1. {@link ensureDirectiveSpacing} — always applied (blank lines are ignored
 *     by the parser, so this can never change how the document parses).
 *  2. {@link normalizeIndentation} — applied **only if it does not introduce
 *     new structural errors**.
 *
 * The guard exists because indenting is not always safe: in well-formed ICF the
 * top-level node names sit at column 0 and their fields/rows are the indented
 * children, so blindly indenting every column-0 line would flatten the
 * node→field hierarchy and corrupt the parse (breaking every export). The guard
 * compares error counts before/after and keeps the indent only when it doesn't
 * make a parseable document worse — so valid files are left intact while genuinely
 * flat input is still tidied.
 *
 * `countErrors` is injected (rather than importing the validator) to keep this
 * helper pure and unit-testable.
 */
export function normalizeOnOpen(
  content: string,
  countErrors: (text: string) => number
): OnOpenNormalization {
  const spaced = ensureDirectiveSpacing(content)
  let text = spaced.text
  let indentedLines: number[] = []

  const indented = normalizeIndentation(text)
  if (indented.changedLines.length > 0 && countErrors(indented.text) <= countErrors(text)) {
    text = indented.text
    indentedLines = indented.changedLines
  }

  return { text, spacedLines: spaced.changedLines, indentedLines }
}
