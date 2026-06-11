import {
  findMasterTypeSchema,
  type IcfDocument,
  type IcfNode,
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
// Compact object syntax (spec §12): `Name:val, val` — the node and its values
// on one line. Requires content after the colon so plain `Name:` headers (and
// `key: value` lines whose value is captured) are distinguished by the section.
const COMPACT_ROW = /^(\s*)([A-Za-z_]\w*):\s*(\S.*)$/

/**
 * Resolves the schema field (key) — and any referenced master entry — for the
 * value under a cursor position in ICF text. Used by the View-mode hover tooltip
 * so a value like `INV/001/25-26` shows its key (`InvoiceNo`), and a master id /
 * reference like `Vendor:VEN001` shows the full master record.
 *
 * Works on `=`/`-` value rows: it locates the hovered comma-cell, walks up to the
 * owning node and the enclosing `@record`/`@masters` section, then looks up the
 * field name from the schema (record schema, or the master-type schema).
 */
export function resolveFieldAt(
  text: string,
  lineNumber: number,
  column: number,
  doc: IcfDocument
): FieldHoverInfo | null {
  const lines = text.split(/\r?\n/)
  const line = lines[lineNumber - 1]
  if (line === undefined) return null

  // A `=`/`-` value row (owner is the nearest header above) or a compact
  // `Name:val, val` line (owner is on the line itself).
  const valueRow = line.match(VALUE_ROW)
  const compact = valueRow ? null : line.match(COMPACT_ROW)

  let owner: string | null
  let rest: string
  if (valueRow) {
    rest = valueRow[4]
    owner = findOwnerNode(lines, lineNumber - 2, valueRow[1].length)
  } else if (compact) {
    rest = compact[3]
    owner = compact[2]
  } else {
    return null
  }
  if (!owner) return null

  const restStart = line.length - rest.length // 0-based index where values begin
  const delimiter = doc.getMetadata().getDelimiterChar()
  const escape = doc.getMetadata().getEscapeChar()

  const cells = splitCells(rest, delimiter, escape)
  const rel = column - 1 - restStart
  const cellIndex = cells.findIndex((c) => rel >= c.start && rel <= c.end)
  if (cellIndex === -1) return null
  const cell = cells[cellIndex]
  const cellText = rest.slice(cell.start, cell.end).trim()
  const startColumn = restStart + cell.start + 1
  const endColumn = restStart + cell.end + 1

  // Determine the section (@record vs @masters); skip @schema/@metadata so the
  // hover only fires on actual record/master data.
  const { section, schemaId } = findSection(lines, lineNumber - 2)
  if (section !== 'data' && section !== 'masters') return null

  let fieldName: string | null = null
  if (section === 'masters') {
    fieldName = findMasterTypeSchema(doc.getSchemas(), owner)?.getFields()[cellIndex] ?? null
  } else {
    const schema = doc.getSchemas().get(schemaId) ?? doc.getSchemas().getDefault()
    fieldName = schema ? (findNode(schema, owner)?.getFields()[cellIndex] ?? null) : null
  }

  const master = resolveMaster(doc, cellText)
  if (!fieldName && !master) return null
  return { fieldName, startColumn, endColumn, master }
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

/** Nearest `Name:` header line above `from` at an indent shallower than `indent`. */
function findOwnerNode(lines: string[], from: number, indent: number): string | null {
  for (let i = from; i >= 0; i--) {
    const l = lines[i]
    if (l.trim() === '') continue
    const ind = (l.match(/^(\s*)/)?.[1].length) ?? 0
    if (ind < indent) {
      return l.match(NODE_HEADER)?.[2] ?? null
    }
  }
  return null
}

type Section = 'data' | 'masters' | 'schema' | 'metadata' | 'unknown'

/** Walks up to the enclosing section directive. */
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
 * Resolves a `Type:Id` reference, or a bare value matching a master entry's
 * primary-key id *or* its `uuid` field (case-insensitive). Matching on UUID lets
 * hovering a master's UUID value show the same full record as hovering its id.
 */
function resolveMaster(doc: IcfDocument, value: string): MasterEntryInfo | null {
  const masters = doc.getMasters()
  if (masters.isEmpty() || value === '') return null

  // 1. An explicit `Type:Id` reference.
  if (/^[A-Za-z_]\w*:.+$/.test(value)) {
    const referenced = masters.resolveReference(value)
    if (referenced) return toEntryInfo(value.slice(0, value.indexOf(':')), referenced)
  }

  // 2. A bare value: match any entry by its primary key (first field) or UUID.
  for (const type of masters.getTypes()) {
    const entries = masters.getType(type)?.elements() ?? []
    for (const entry of entries) {
      if (!entry.isObject()) continue
      const names = entry.fieldNames()
      const primaryKey = names[0]
      const uuidField = names.find((n) => /^uuid$/i.test(n))
      if (
        (primaryKey && entry.get(primaryKey)?.asText() === value) ||
        (uuidField && entry.get(uuidField)?.asText() === value)
      ) {
        return toEntryInfo(type, entry)
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
