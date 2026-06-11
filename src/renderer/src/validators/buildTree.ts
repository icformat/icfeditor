import type { IcfDocument } from 'icf.js'
import type { TreeNode, TreeNodeStatus } from '../models/tree'
import type { DocumentIndex } from '../models/document'
import type { Diagnostic } from '../services/ICFValidatorService'

/** Picks the most severe status among a set of diagnostics. */
function worst(diags: Diagnostic[]): TreeNodeStatus {
  let status: TreeNodeStatus = 'none'
  for (const d of diags) {
    if (d.severity === 'error') return 'error'
    if (d.severity === 'warning') status = 'warning'
    else if (status === 'none') status = 'info'
  }
  return status
}

/** 1-based source lines of the document's sections, for tree → editor navigation. */
interface SectionLines {
  metadata: number
  data: number
  masters: number
  firstSchema: number
  /** schemaId ('' = default) → line of its `@schema` directive. */
  schemaIds: Map<string, number>
  /** master type name → line of its `Name:` header within `@masters`. */
  masterTypes: Map<string, number>
}

/**
 * Scans ICF text for the line of each directive/section header so the tree can
 * reveal the right place in the editor. `@data`/`@masters`/`@metadata` are
 * matched exactly (so `@schema-url` is not mistaken for `@schema`), and master
 * type headers (`Name:`) are collected only within the `@masters` section.
 */
function scanSectionLines(text: string): SectionLines {
  const lines = text.split(/\r?\n/)
  const result: SectionLines = {
    metadata: 1,
    data: 1,
    masters: 1,
    firstSchema: 1,
    schemaIds: new Map(),
    masterTypes: new Map()
  }
  let metadataSeen = false
  let dataSeen = false
  let mastersSeen = false
  let firstSchemaSeen = false
  let inMasters = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNo = i + 1

    if (/^@metadata(\s|$)/.test(line)) {
      if (!metadataSeen) {
        result.metadata = lineNo
        metadataSeen = true
      }
      inMasters = false
    } else if (/^@schema(\s|$)/.test(line)) {
      const id = line.match(/\bid=(\S+)/)?.[1] ?? ''
      if (!result.schemaIds.has(id)) result.schemaIds.set(id, lineNo)
      if (!firstSchemaSeen) {
        result.firstSchema = lineNo
        firstSchemaSeen = true
      }
      inMasters = false
    } else if (/^@masters(\s|$)/.test(line)) {
      if (!mastersSeen) {
        result.masters = lineNo
        mastersSeen = true
      }
      inMasters = true
    } else if (/^@data(\s|$)/.test(line)) {
      if (!dataSeen) {
        result.data = lineNo
        dataSeen = true
      }
      inMasters = false
    } else if (line.startsWith('@')) {
      inMasters = false
    } else if (inMasters) {
      const typeHeader = line.match(/^\s*([A-Za-z_]\w*)\s*:\s*$/)
      if (typeHeader && !result.masterTypes.has(typeHeader[1])) {
        result.masterTypes.set(typeHeader[1], lineNo)
      }
    }
  }
  return result
}

/**
 * Builds the document outline shown by the tree panel (Prompt.md §Tree View):
 * Metadata, Schemas, Masters (with per-type children), and Data (with one node
 * per record). Each node carries the source line it maps to (so clicking it
 * reveals that line) and the worst diagnostic status of the lines it spans.
 * This is the editor's own projection of the `icf.js` model — it lives under
 * `validators/` because it folds validation status into the structure.
 */
export function buildTree(
  doc: IcfDocument,
  index: DocumentIndex,
  diagnostics: Diagnostic[],
  text: string
): TreeNode[] {
  const nodes: TreeNode[] = []
  const meta = doc.getMetadata()
  const lineOf = scanSectionLines(text)

  // Diagnostics grouped by line for fast per-record lookup.
  const byLine = new Map<number, Diagnostic[]>()
  for (const d of diagnostics) {
    const bucket = byLine.get(d.line)
    if (bucket) bucket.push(d)
    else byLine.set(d.line, [d])
  }

  if (meta.hasUserMetadata()) {
    nodes.push({
      id: 'node-metadata',
      kind: 'metadata',
      label: 'Metadata',
      line: lineOf.metadata,
      status: 'none',
      children: []
    })
  }

  const schemas = doc.getSchemas()
  if (!schemas.isEmpty()) {
    nodes.push({
      id: 'node-schemas',
      kind: 'schema',
      label: 'Schemas',
      detail: `${schemas.size}`,
      line: lineOf.firstSchema,
      status: 'none',
      children: schemas.ids().map((id) => ({
        id: `node-schema-${id || 'default'}`,
        kind: 'schema' as const,
        label: id || '(default)',
        line: lineOf.schemaIds.get(id) ?? lineOf.firstSchema,
        status: 'none' as const,
        children: []
      }))
    })
  }

  const masters = doc.getMasters()
  if (!masters.isEmpty()) {
    nodes.push({
      id: 'node-masters',
      kind: 'masters',
      label: 'Masters',
      detail: `${masters.totalEntryCount()}`,
      line: lineOf.masters,
      status: 'none',
      children: masters.getTypes().map((type) => ({
        id: `node-master-${type}`,
        kind: 'masterType' as const,
        label: type,
        detail: `${masters.getType(type)?.size ?? 0}`,
        line: lineOf.masterTypes.get(type) ?? lineOf.masters,
        status: 'none' as const,
        children: []
      }))
    })
  }

  const dataChildren: TreeNode[] = index.records.map((loc) => {
    const diags: Diagnostic[] = []
    for (let line = loc.startLine; line <= loc.endLine; line++) {
      const bucket = byLine.get(line)
      if (bucket) diags.push(...bucket)
    }
    return {
      id: `node-record-${loc.index}`,
      kind: 'record' as const,
      label: loc.id ?? `#${loc.index + 1}`,
      detail: loc.schemaId ?? undefined,
      line: loc.startLine,
      status: worst(diags),
      children: []
    }
  })

  nodes.push({
    id: 'node-data',
    kind: 'data',
    label: 'Data',
    detail: `${index.records.length}`,
    line: lineOf.data,
    status: worst(diagnostics.filter((d) => d.line > 0)),
    children: dataChildren
  })

  return nodes
}
