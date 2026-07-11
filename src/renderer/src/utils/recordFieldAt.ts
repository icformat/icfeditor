import {
  findMasterTypeSchema,
  type IcfDocument,
  type IcfNode,
  type IcfRecord,
  type IcfSchema,
  type SchemaNode
} from 'icf.js'

/** A resolved master entry: its type and ordered key/value pairs. */
export interface MasterEntryInfo {
  type: string
  fields: Array<{ key: string; value: string }>
}

/** What the hover at a given position should show. */
export interface FieldHoverInfo {
  /** The schema field name (key) for the hovered value, if resolvable. */
  fieldName: string | null
  /** The hovered cell's 1-based column span, for highlighting. */
  startColumn: number
  endColumn: number
  /** A master entry, when the hovered value is (or references) a master record. */
  master: MasterEntryInfo | null
}

const NODE_HEADER = /^(\s*)([A-Za-z_]\w*)(\[\])?\s*:\s*$/
const VALUE_ROW = /^(\s*)([=-])(\s*)(.*)$/
// Compact object syntax (spec §43): `Name:val, val` — the node and its values
// on one line. Requires content after the colon so plain `Name:` headers (and
// `key: value` lines whose value is captured) are distinguished by the section.
const COMPACT_ROW = /^(\s*)([A-Za-z_]\w*):\s*(\S.*)$/
// Reference candidate `Type:Id` (v1.1 EBNF: type may contain `.` and `-`).
const REFERENCE = /^[A-Za-z_][\w.-]*:\S+$/

/** One physical line of a logical row: where its value text starts, and the text. */
interface Segment {
  /** 0-based line index. */
  lineIdx: number
  /** 0-based column where the segment's value text begins. */
  start: number
  text: string
}

/**
 * Resolves the schema field (key) — and any referenced master entry — for the
 * value under a cursor position in ICF text. Used by the View-mode hover tooltip
 * so a value like `INV/001/25-26` shows its key (`InvoiceNo`), and a master id /
 * reference like `Vendor:VEN001` shows the full master record.
 *
 * Works on `=`/`-` value rows and compact `Name:val` rows, including multiline
 * rows (spec v1.1 §59): when the row continues across lines via a trailing
 * unescaped delimiter, the cell → field mapping is computed over the whole
 * *logical* row, so hovering a continuation line resolves the right field.
 * References resolve primary-first (spec v1.1 §45): the enclosing record's
 * `primary=` objects shadow global masters. `!annotation:` heads and their
 * entry rows (spec v1.1 §25/§46) never resolve to a field.
 */
export function resolveFieldAt(
  text: string,
  lineNumber: number,
  column: number,
  doc: IcfDocument
): FieldHoverInfo | null {
  const lines = text.split(/\r?\n/)
  if (lines[lineNumber - 1] === undefined) return null

  const delimiter = doc.getMetadata().getDelimiterChar()
  const escape = doc.getMetadata().getEscapeChar()

  // The logical row containing the hovered line (multiline-continuation aware).
  const row = findLogicalRow(lines, lineNumber - 1, delimiter, escape)
  if (!row) return null
  const { startIdx, segments } = row

  const startLine = lines[startIdx]
  const valueRow = startLine.match(VALUE_ROW)
  const compact = valueRow ? null : startLine.match(COMPACT_ROW)

  // A `=`/`-` row's owner is the nearest header above; a compact row carries
  // its owner on the line itself.
  let owner: string | null
  if (valueRow) owner = findOwnerNode(lines, startIdx - 1, valueRow[1].length)
  else if (compact) owner = compact[2]
  else return null
  if (!owner) return null

  const segIdx = segments.findIndex((s) => s.lineIdx === lineNumber - 1)
  if (segIdx === -1) return null
  const seg = segments[segIdx]
  const relInSeg = column - 1 - seg.start
  if (relInSeg < 0 || relInSeg > seg.text.length) return null

  // Cells are computed over the joined logical row (spec §59: the multiline
  // form is semantically identical to the single-line form).
  const logical = segments.map((s) => s.text).join('')
  let offsetBefore = 0
  for (let i = 0; i < segIdx; i++) offsetBefore += segments[i].text.length
  const cells = splitCells(logical, delimiter, escape)
  const rel = offsetBefore + relInSeg
  const cellIndex = cells.findIndex((c) => rel >= c.start && rel <= c.end)
  if (cellIndex === -1) return null
  const cell = cells[cellIndex]
  const cellText = logical.slice(cell.start, cell.end).trim()
  // The highlight span is the hovered cell clamped to the hovered line.
  const startColumn = seg.start + Math.max(cell.start - offsetBefore, 0) + 1
  const endColumn = seg.start + Math.min(cell.end - offsetBefore, seg.text.length) + 1

  // Determine the section (@record vs @masters); skip @schema/@metadata so the
  // hover only fires on actual record/master data.
  const { section, schemaId } = findSection(lines, startIdx - 1)
  if (section !== 'data' && section !== 'masters') return null

  let fieldName: string | null = null
  if (section === 'masters') {
    fieldName = findMasterTypeSchema(doc.getSchemas(), owner)?.getFields()[cellIndex] ?? null
  } else {
    const schema = doc.getSchemas().get(schemaId) ?? doc.getSchemas().getDefault()
    fieldName = schema ? (findNode(schema, owner)?.getFields()[cellIndex] ?? null) : null
  }

  const record = section === 'data' ? recordAt(lines, startIdx, doc) : null
  const master = resolveMaster(doc, record, cellText, section, owner)
  if (!fieldName && !master) return null
  return { fieldName, startColumn, endColumn, master }
}

/** 0-based length of a line's leading whitespace. */
function indentOf(line: string): number {
  return line.match(/^(\s*)/)?.[1].length ?? 0
}

/**
 * True when `line` (ignoring trailing whitespace) ends with an unescaped
 * delimiter — the marker that a row continues on the next line (spec v1.1 §59).
 */
function endsWithTrailingDelimiter(line: string, delimiter: string, escape: string): boolean {
  const t = line.replace(/\s+$/, '')
  if (t === '' || t[t.length - 1] !== delimiter) return false
  let escapes = 0
  for (let i = t.length - 2; i >= 0 && t[i] === escape; i--) escapes++
  return escapes % 2 === 0
}

/**
 * True when a line has continuation shape (the icf.js binding rule): non-blank,
 * not structural — does not start with `@`, `=`, `-`, `!`, `[` or `<<` — and
 * does not end with an unescaped `:` (a declaration opener).
 */
function isContinuationShaped(line: string, escape: string): boolean {
  const t = line.trim()
  if (t === '') return false
  if (/^[@=\-![]/.test(t) || t.startsWith('<<')) return false
  if (t.endsWith(':')) {
    let escapes = 0
    for (let i = t.length - 2; i >= 0 && t[i] === escape; i--) escapes++
    if (escapes % 2 === 0) return false
  }
  return true
}

/**
 * Locates the logical row containing line `idx`: its row-start line plus every
 * continuation segment. `=`/`-` lines always start their own row (they are
 * never continuations). Any other hovered line is first interpreted as a
 * continuation — climbing back over trailing-delimiter lines to a plausible
 * row start, then verifying with a forward pass that mirrors icf.js's rules
 * (each continuation must sit deeper than the row-start line) — and otherwise
 * as a compact row of its own. Annotation heads (`!x:`) match nothing here.
 */
function findLogicalRow(
  lines: string[],
  idx: number,
  delimiter: string,
  escape: string
): { startIdx: number; segments: Segment[] } | null {
  const line = lines[idx]
  if (VALUE_ROW.test(line)) {
    return { startIdx: idx, segments: accumulateRow(lines, idx, delimiter, escape) }
  }

  if (isContinuationShaped(line, escape)) {
    // Candidate row starts, topmost first. A compact-shaped line inside the
    // chain is ambiguous (it may itself be a continuation), so every one is a
    // candidate and the forward pass decides.
    for (const start of rowStartCandidates(lines, idx, delimiter, escape)) {
      const segments = accumulateRow(lines, start, delimiter, escape)
      if (segments.some((s) => s.lineIdx === idx)) return { startIdx: start, segments }
    }
  }

  if (COMPACT_ROW.test(line)) {
    return { startIdx: idx, segments: accumulateRow(lines, idx, delimiter, escape) }
  }
  return null
}

/**
 * Walks up a trailing-delimiter chain from `idx`, collecting the lines that
 * could start the logical row, ordered topmost first.
 */
function rowStartCandidates(
  lines: string[],
  idx: number,
  delimiter: string,
  escape: string
): number[] {
  const candidates: number[] = []
  let cur = idx
  for (;;) {
    let p = cur - 1
    while (p >= 0 && lines[p].trim() === '') p-- // blanks persist a pending row
    if (p < 0) break
    const prev = lines[p]
    if (!endsWithTrailingDelimiter(prev, delimiter, escape)) break
    if (VALUE_ROW.test(prev)) {
      candidates.push(p) // definite start: `=`/`-` rows are never continuations
      break
    }
    if (COMPACT_ROW.test(prev)) {
      candidates.push(p) // possible start — but may itself be a continuation
      if (!isContinuationShaped(prev, escape)) break
      cur = p
      continue
    }
    if (!isContinuationShaped(prev, escape)) break
    cur = p
  }
  return candidates.reverse()
}

/**
 * Accumulates the full logical row starting at `startIdx` (a `=`/`-` or
 * compact row line): while the last segment ends with a trailing unescaped
 * delimiter, deeper-indented continuation-shaped lines are appended
 * (blank lines in between are skipped), per spec v1.1 §59 and the icf.js
 * pending-row rules.
 */
function accumulateRow(
  lines: string[],
  startIdx: number,
  delimiter: string,
  escape: string
): Segment[] {
  const startLine = lines[startIdx]
  const vm = startLine.match(VALUE_ROW)
  const cm = vm ? null : startLine.match(COMPACT_ROW)
  const rest = vm ? vm[4] : cm ? cm[3] : null
  if (rest === null) return []

  const rowIndent = indentOf(startLine)
  const segments: Segment[] = [
    { lineIdx: startIdx, start: startLine.length - rest.length, text: rest }
  ]
  let k = startIdx + 1
  while (endsWithTrailingDelimiter(segments[segments.length - 1].text, delimiter, escape)) {
    while (k < lines.length && lines[k].trim() === '') k++
    if (k >= lines.length) break
    const l = lines[k]
    if (!isContinuationShaped(l, escape) || indentOf(l) <= rowIndent) break
    const start = indentOf(l)
    segments.push({ lineIdx: k, start, text: l.slice(start) })
    k++
  }
  return segments
}

/** Splits a value row into comma-cells, honoring the escape char, with spans. */
function splitCells(
  rest: string,
  delimiter: string,
  escape: string
): Array<{ start: number; end: number }> {
  const cells: Array<{ start: number; end: number }> = []
  let start = 0
  let escaped = false
  for (let i = 0; i < rest.length; i++) {
    if (escaped) {
      escaped = false
      continue
    }
    if (rest[i] === escape) {
      escaped = true
      continue
    }
    if (rest[i] === delimiter) {
      cells.push({ start, end: i })
      start = i + 1
    }
  }
  cells.push({ start, end: rest.length })
  return cells
}

/**
 * Nearest `Name:` header line above `from` at an indent shallower than
 * `indent`. A shallower `!annotation:` head instead means the row is one of
 * the annotation's entry rows (spec v1.1 §25/§46) — annotations own no data
 * rows, so those deliberately resolve to nothing.
 */
function findOwnerNode(lines: string[], from: number, indent: number): string | null {
  for (let i = from; i >= 0; i--) {
    const l = lines[i]
    if (l.trim() === '') continue
    const ind = indentOf(l)
    if (ind < indent) {
      if (l.trimStart().startsWith('!')) return null
      return l.match(NODE_HEADER)?.[2] ?? null
    }
  }
  return null
}

type Section = 'data' | 'masters' | 'schema' | 'metadata' | 'unknown'

/**
 * Walks up to the enclosing section directive. `!annotation:` lines and their
 * entries can never match a section directive (they never start with `@`), so
 * they are skipped naturally.
 */
function findSection(lines: string[], from: number): { section: Section; schemaId: string } {
  for (let i = from; i >= 0; i--) {
    const l = lines[i]
    if (/^@record(\s|$)/.test(l)) return { section: 'data', schemaId: l.match(/\bschema=(\S+)/)?.[1] ?? '' }
    if (/^@masters(\s|$)/.test(l)) return { section: 'masters', schemaId: '' }
    if (/^@data(\s|$)/.test(l)) return { section: 'data', schemaId: '' }
    if (/^@schema(\s|$)/.test(l)) return { section: 'schema', schemaId: '' }
    if (/^@metadata(\s|$)/.test(l)) return { section: 'metadata', schemaId: '' }
  }
  return { section: 'unknown', schemaId: '' }
}

/**
 * The parsed record enclosing the line at `startIdx`, found by counting
 * `@record` directives above it (the parser preserves document order, so the
 * Nth directive is the Nth parsed record).
 */
function recordAt(lines: string[], startIdx: number, doc: IcfDocument): IcfRecord | null {
  let count = 0
  for (let i = 0; i < startIdx; i++) {
    if (/^@record(\s|$)/.test(lines[i])) count++
  }
  return count > 0 ? (doc.getRecord(count - 1) ?? null) : null
}

/** Depth-first search for a schema node by name (records may nest, e.g. BillItems). */
function findNode(schema: IcfSchema, name: string): SchemaNode | null {
  const stack = [...schema.getTopLevelNodes().values()]
  while (stack.length > 0) {
    const node = stack.pop()!
    if (node.name === name) return node
    for (const child of node.getChildren().values()) stack.push(child)
  }
  return null
}

/**
 * Resolves a master entry for the hovered value:
 *
 * 1. An explicit `Type:Id` reference (valid anywhere) — resolved in spec v1.1
 *    §45 order: the enclosing record's `primary=` objects first, then global
 *    masters (`IcfDocument.resolveReference` implements exactly that order).
 * 2. A bare value, **only inside the `@masters` section and only against the
 *    owning master type** — matched by primary-key id or `uuid` (so hovering a
 *    master's id or UUID shows its record).
 *
 * The bare-value case is deliberately scoped to the owner type. A plain data
 * field (e.g. a container's `id`) that happens to equal some master's primary
 * key must not be mis-resolved to the wrong master — which is what a global
 * scan across all master types did, picking the first matching type.
 */
function resolveMaster(
  doc: IcfDocument,
  record: IcfRecord | null,
  value: string,
  section: Section,
  owner: string
): MasterEntryInfo | null {
  if (value === '') return null

  // 1. An explicit `Type:Id` reference, primary-first (record-local primary
  //    objects shadow a same-named global master type).
  if (REFERENCE.test(value)) {
    const referenced = doc.resolveReference(record, value)
    if (referenced) return toEntryInfo(value.slice(0, value.indexOf(':')), referenced)
  }

  // 2. A bare master id / UUID — only when hovering inside the master's own
  //    type in the `@masters` section.
  const masters = doc.getMasters()
  if (section === 'masters' && owner && !masters.isEmpty()) {
    for (const entry of masters.getType(owner)?.elements() ?? []) {
      if (!entry.isObject()) continue
      const names = entry.fieldNames()
      const primaryKey = names[0]
      const uuidField = names.find((n) => /^uuid$/i.test(n))
      if (
        (primaryKey && entry.get(primaryKey)?.asText() === value) ||
        (uuidField && entry.get(uuidField)?.asText() === value)
      ) {
        return toEntryInfo(owner, entry)
      }
    }
  }
  return null
}

/** Flattens a master entry node into ordered key/value pairs. */
function toEntryInfo(type: string, entry: IcfNode): MasterEntryInfo {
  return {
    type,
    fields: entry.fieldNames().map((key) => ({ key, value: entry.get(key)?.asText() ?? '' }))
  }
}
