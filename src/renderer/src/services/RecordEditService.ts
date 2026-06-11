import type { IcfDocument, SchemaNode } from 'icf.js'
import type { DocumentIndex, RecordLocation } from '../models/document'

/** Outcome of a structural edit: the new document text and which record to select. */
export interface RecordEditResult {
  text: string
  /** Record index to select/reveal afterwards, or null if none remain. */
  selectIndex: number | null
}

/**
 * Structural record operations (Prompt.md §Editor Features) performed as
 * **text surgery** on whole `@record` blocks. Because each operation moves,
 * copies, or removes an entire block, untouched records keep their exact
 * formatting and comments — unlike a full re-serialize. The caller applies the
 * returned text to Monaco, so Monaco's own undo stack captures the change.
 *
 * A record block spans `[startLine, endLine]` from the {@link DocumentIndex},
 * which by construction runs from the `@record` directive up to the line before
 * the next record (trailing blank lines included), so blocks are contiguous and
 * cover the whole data region.
 */
export class RecordEditService {
  /** Removes the record at `index`. */
  deleteRecord(text: string, index: DocumentIndex, recordIndex: number): RecordEditResult {
    const loc = index.records[recordIndex]
    if (!loc) return { text, selectIndex: recordIndex }
    const lines = text.split(/\r?\n/)
    const block = this.blockBounds(loc)
    lines.splice(block.start, block.count)
    const remaining = index.records.length - 1
    const selectIndex = remaining === 0 ? null : Math.min(recordIndex, remaining - 1)
    return { text: lines.join('\n'), selectIndex }
  }

  /** Inserts an exact copy of a record immediately after it. */
  duplicateRecord(text: string, index: DocumentIndex, recordIndex: number): RecordEditResult {
    return this.copyRecord(text, index, recordIndex, { resetIdentity: false })
  }

  /**
   * Inserts a copy of a record with a fresh `id` and the `uuid` cleared
   * (Prompt.md "Clone Record"), so the clone is independently identifiable.
   */
  cloneRecord(text: string, index: DocumentIndex, recordIndex: number): RecordEditResult {
    return this.copyRecord(text, index, recordIndex, { resetIdentity: true })
  }

  /** Swaps a record with the one above it. */
  moveRecordUp(text: string, index: DocumentIndex, recordIndex: number): RecordEditResult {
    if (recordIndex <= 0) return { text, selectIndex: recordIndex }
    return {
      text: this.swapBlocks(text, index.records[recordIndex - 1], index.records[recordIndex]),
      selectIndex: recordIndex - 1
    }
  }

  /** Swaps a record with the one below it. */
  moveRecordDown(text: string, index: DocumentIndex, recordIndex: number): RecordEditResult {
    if (recordIndex >= index.records.length - 1) return { text, selectIndex: recordIndex }
    return {
      text: this.swapBlocks(text, index.records[recordIndex], index.records[recordIndex + 1]),
      selectIndex: recordIndex + 1
    }
  }

  /**
   * Inserts a new, empty record after `recordIndex` (or at the end of `@data`
   * when `recordIndex` is null), using a skeleton derived from `doc`'s default
   * schema so the new block already has the right node/field shape.
   */
  insertRecord(
    text: string,
    index: DocumentIndex,
    doc: IcfDocument,
    recordIndex: number | null
  ): RecordEditResult {
    const lines = text.split(/\r?\n/)
    const newId = this.uniqueId(index)
    const skeleton = this.recordSkeleton(doc, newId)

    let insertAt: number
    let selectIndex: number
    if (recordIndex !== null && index.records[recordIndex]) {
      const block = this.blockBounds(index.records[recordIndex])
      insertAt = block.start + block.count
      selectIndex = recordIndex + 1
    } else if (index.records.length > 0) {
      const last = this.blockBounds(index.records[index.records.length - 1])
      insertAt = last.start + last.count
      selectIndex = index.records.length
    } else {
      insertAt = lines.length
      selectIndex = 0
    }

    lines.splice(insertAt, 0, ...skeleton)
    return { text: lines.join('\n'), selectIndex }
  }

  // --- internals ------------------------------------------------------------

  private copyRecord(
    text: string,
    index: DocumentIndex,
    recordIndex: number,
    options: { resetIdentity: boolean }
  ): RecordEditResult {
    const loc = index.records[recordIndex]
    if (!loc) return { text, selectIndex: recordIndex }
    const lines = text.split(/\r?\n/)
    const block = this.blockBounds(loc)
    let copy = lines.slice(block.start, block.start + block.count)
    if (options.resetIdentity) copy = this.resetIdentity(copy, this.uniqueId(index))
    lines.splice(block.start + block.count, 0, ...copy)
    return { text: lines.join('\n'), selectIndex: recordIndex + 1 }
  }

  /** 0-based start line and line count of a record block. */
  private blockBounds(loc: RecordLocation): { start: number; count: number } {
    const start = loc.startLine - 1
    const count = Math.max(1, loc.endLine - loc.startLine + 1)
    return { start, count }
  }

  private swapBlocks(text: string, first: RecordLocation, second: RecordLocation): string {
    const lines = text.split(/\r?\n/)
    const a = this.blockBounds(first)
    const b = this.blockBounds(second)
    const blockA = lines.slice(a.start, a.start + a.count)
    const blockB = lines.slice(b.start, b.start + b.count)
    // Rebuild: everything before A, then B, then A, then everything after B.
    const before = lines.slice(0, a.start)
    const after = lines.slice(b.start + b.count)
    return [...before, ...blockB, ...blockA, ...after].join('\n')
  }

  /** Rewrites the `@record` directive line of a copied block with a new id, dropping uuid. */
  private resetIdentity(block: string[], newId: string): string[] {
    const result = [...block]
    const directiveIdx = result.findIndex((l) => l.trimStart().startsWith('@record'))
    if (directiveIdx === -1) return result
    let line = result[directiveIdx]
    line = line.replace(/\buuid=\S+/g, '').replace(/\s+/g, ' ').trimEnd()
    if (/\bid=\S+/.test(line)) line = line.replace(/\bid=\S+/, `id=${newId}`)
    else line = `${line} id=${newId}`
    result[directiveIdx] = line
    return result
  }

  /** A record id not already present in the document, e.g. RECORD_4. */
  private uniqueId(index: DocumentIndex): string {
    let n = index.records.length + 1
    let id = `RECORD_${n}`
    while (index.byId.has(id)) id = `RECORD_${++n}`
    return id
  }

  /** Builds an empty record block (array of lines) from the default schema. */
  private recordSkeleton(doc: IcfDocument, newId: string): string[] {
    const schema = doc.getSchemas().getDefault()
    const schemaId = doc.getSchemas().ids().find((id) => id !== '')
    const directive = schemaId ? `@record schema=${schemaId} id=${newId}` : `@record id=${newId}`
    const lines: string[] = ['', directive, '']
    if (schema && !schema.isEmpty()) {
      for (const node of schema.getTopLevelNodes().values()) {
        lines.push(...this.nodeSkeleton(node, 0))
      }
    }
    return lines
  }

  /** Empty-value skeleton for one schema node (recurses into containers). */
  private nodeSkeleton(node: SchemaNode, depth: number): string[] {
    const pad = '  '.repeat(depth)
    const children = [...node.getChildren().values()]
    if (children.length > 0) {
      const out = [`${pad}${node.name}:`, '']
      for (const child of children) out.push(...this.nodeSkeleton(child, depth + 1))
      return out
    }
    const fields = node.getFields()
    const emptyRow = fields.length > 0 ? fields.map(() => '').join(', ') : ''
    const marker = node.isCollection() ? '-' : '='
    return [`${pad}${node.name}:`, `${pad}  ${marker} ${emptyRow}`, '']
  }
}
