import {
  IcfDocument,
  IcfMasters,
  IcfMetadata,
  IcfNode,
  IcfRecord,
  IcfSchemas,
  SchemaInference,
  write
} from 'icf.js'
import { parse as parseYaml } from 'yaml'
import { XMLParser } from 'fast-xml-parser'
import { baseName, extensionOf, stripExtension } from '../utils/format'

export type ImportFormat = 'json' | 'yaml' | 'xml' | 'csv'

export interface ImportResult {
  /** Suggested ICF file name (source base name + `.icf`). */
  fileName: string
  icf: string
}

export interface ImportOptions {
  /** When false, a CSV's first row is treated as data and fields are auto-named. */
  csvHasHeaders?: boolean
  /**
   * When true (default), emit a single record holding a collection of all rows
   * (`Name[]:` with `-` rows); when false, emit one single-row record per row.
   */
  preferCollections?: boolean
}

type Json = unknown
type FlatRecord = Record<string, string>

/**
 * Imports XML / JSON / YAML / CSV and converts it to ICF.
 *
 * Because those formats are not schema-constrained, every input record is
 * flattened to a flat key→value map (nested objects become dotted keys; arrays
 * are preserved as JSON in a single cell), and the schema is the **union of all
 * keys** seen across the data. Each record is emitted with a value for every
 * union key, using an empty value where that record lacks the key — exactly the
 * "all possible keys, empty when absent" model the import requires.
 *
 * Pure and synchronous: parsing + ICF construction with no I/O.
 */
export class ImportService {
  toIcf(content: string, fileNameOrPath: string, options: ImportOptions = {}): ImportResult {
    const format = this.detectFormat(fileNameOrPath)
    const { records, nodeName } = this.parse(content, format, options)
    const flat = records.map((r) => flattenRecord(r))
    const keys = unionKeys(flat)
    const base = stripExtension(baseName(fileNameOrPath))
    // Prefer the array key (e.g. `{ "invoices": [...] }` -> `invoices`, and the
    // XML element name); fall back to the file name when there is no key.
    const node = sanitizeNodeName(nodeName ?? base)
    const icf = buildIcf(node, keys, flat, options.preferCollections ?? true)
    return { fileName: `${base}.icf`, icf }
  }

  /** Resolves the import format from the file extension. */
  detectFormat(fileNameOrPath: string): ImportFormat {
    switch (extensionOf(fileNameOrPath)) {
      case 'json':
        return 'json'
      case 'yaml':
      case 'yml':
        return 'yaml'
      case 'xml':
        return 'xml'
      case 'csv':
        return 'csv'
      default:
        throw new Error(`Unsupported import format: ${fileNameOrPath}`)
    }
  }

  private parse(
    content: string,
    format: ImportFormat,
    options: ImportOptions
  ): { records: Json[]; nodeName: string | null } {
    switch (format) {
      case 'json':
        return extractRecords(JSON.parse(content))
      case 'yaml':
        return extractRecords(parseYaml(content))
      case 'xml': {
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: '@_',
          textNodeName: '#text'
        })
        return extractRecords(parser.parse(content))
      }
      case 'csv':
        return parseCsv(content, options.csvHasHeaders ?? true)
    }
  }
}

// --- record extraction ------------------------------------------------------

/**
 * Locates the collection of records in a parsed value: a top-level array is the
 * records; an object with an array-valued property uses that array (and its key
 * names the node); a single-object wrapper (e.g. an XML root) is unwrapped;
 * otherwise the value is treated as one record.
 */
function extractRecords(value: Json): { records: Json[]; nodeName: string | null } {
  if (Array.isArray(value)) return { records: value, nodeName: null }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, Json>
    const keys = Object.keys(obj)

    for (const key of keys) {
      if (Array.isArray(obj[key])) return { records: obj[key] as Json[], nodeName: key }
    }
    if (keys.length === 1 && obj[keys[0]] && typeof obj[keys[0]] === 'object') {
      const inner = extractRecords(obj[keys[0]])
      return inner.records.length > 0 ? inner : { records: [obj[keys[0]]], nodeName: keys[0] }
    }
    return { records: [obj], nodeName: null }
  }

  return { records: value == null ? [] : [value], nodeName: null }
}

// --- flattening -------------------------------------------------------------

/** Flattens one record to scalar key→value pairs (dotted keys; arrays as JSON). */
function flattenRecord(record: Json): FlatRecord {
  if (Array.isArray(record)) return { value: JSON.stringify(record) }
  if (record === null || typeof record !== 'object') {
    return { value: record == null ? '' : String(record) }
  }
  const out: FlatRecord = {}
  flattenInto(record as Record<string, Json>, '', out)
  return out
}

function flattenInto(obj: Record<string, Json>, prefix: string, out: FlatRecord): void {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v === null || v === undefined) out[key] = ''
    else if (Array.isArray(v)) out[key] = JSON.stringify(v)
    else if (typeof v === 'object') flattenInto(v as Record<string, Json>, key, out)
    else out[key] = String(v)
  }
}

/** The union of all keys across records, in first-seen order. */
function unionKeys(records: FlatRecord[]): string[] {
  const seen = new Set<string>()
  const keys: string[] = []
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!seen.has(key)) {
        seen.add(key)
        keys.push(key)
      }
    }
  }
  return keys
}

// --- CSV --------------------------------------------------------------------

function parseCsv(content: string, hasHeaders: boolean): { records: Json[]; nodeName: string | null } {
  const rows = csvRows(content).filter((r) => !(r.length === 1 && r[0] === '')) // skip blanks
  if (rows.length === 0) return { records: [], nodeName: null }

  let headers: string[]
  let dataRows: string[][]
  if (hasHeaders) {
    headers = rows[0]
    dataRows = rows.slice(1)
  } else {
    // No header row: synthesize Field1..FieldN over the widest row.
    const width = rows.reduce((max, r) => Math.max(max, r.length), 0)
    headers = Array.from({ length: width }, (_, i) => `Field${i + 1}`)
    dataRows = rows
  }

  const records = dataRows.map((r) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = r[i] ?? ''
    })
    return obj
  })
  return { records, nodeName: null }
}

/** RFC-4180-ish CSV tokenizer: handles quoted fields, escaped quotes, CRLF. */
function csvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
      continue
    }
    if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') {
      field += c
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

// --- ICF construction -------------------------------------------------------

/**
 * Builds ICF for a `<nodeName>` schema over the union `keys`.
 *
 * `preferCollections` (default) emits a single record whose body is a collection
 * of every row — `nodeName[]: [keys]` in the schema and one `@record` with `-`
 * rows — which is the compact, intended shape for flat tabular data. Otherwise
 * each row becomes its own single-row `@record`. Either way the schema is named
 * after the node (`@schema id=<nodeName>`, `@record schema=<nodeName>`).
 */
function buildIcf(
  nodeName: string,
  keys: string[],
  records: FlatRecord[],
  preferCollections: boolean
): string {
  if (records.length === 0) return `@kind icf\n@version 1.1\n\n@schema\n\n@data\n`
  const fields = keys.length > 0 ? keys : ['value']

  const metadata = new IcfMetadata()
  metadata.put('kind', 'icf')
  metadata.put('version', '1.1')
  const inference = new SchemaInference('value')
  const attributes = new Map([['schema', nodeName]])

  let recordList: IcfRecord[]
  if (preferCollections) {
    const body = IcfNode.object()
    const collection = body.putArray(nodeName)
    for (const record of records) {
      const row = collection.addObject()
      for (const key of fields) row.put(key, record[key] ?? '')
    }
    recordList = [new IcfRecord(attributes, body)]
  } else {
    recordList = records.map((record) => {
      const body = IcfNode.object()
      const node = body.putObject(nodeName)
      for (const key of fields) node.put(key, record[key] ?? '')
      return new IcfRecord(attributes, body)
    })
  }

  const schemas = new IcfSchemas()
  schemas.add(nodeName, inference.infer(recordList[0].getData()))
  return write(new IcfDocument(metadata, schemas, new IcfMasters(), recordList))
}

/** Coerces a name to a valid ICF object identifier. */
function sanitizeNodeName(name: string): string {
  const safe = name.replace(/[^A-Za-z0-9_]/g, '_')
  if (safe === '' || safe === '_') return 'Record'
  return /^[A-Za-z_]/.test(safe) ? safe : `_${safe}`
}
