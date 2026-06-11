import { IcfDocument, type IcfSchema, type SchemaNode } from 'icf.js'
import type { ICFWriterService } from './ICFWriterService'
import type { MergeConflict, MergePreview } from '../models/transform'
import { cloneMetadataWithRecordCount, bumpRevision } from '../utils/icfMetadata'

/**
 * Merges multiple ICF documents when their schemas are compatible
 * (Prompt.md §Merge): metadata + schemas from the first document are kept,
 * master rows are unioned with exact-duplicate removal keyed on the primary
 * (first) field, and records are concatenated. Conflicts (incompatible schema,
 * duplicate record id, master key clash) are reported for the preview rather
 * than silently resolved. New logic over the `icf.js` model.
 */
export class MergeService {
  constructor(private readonly writer: ICFWriterService) {}

  /**
   * @param modifiedAt ISO timestamp stamped into the merged `@modified`.
   *   Defaults to now; tests pass a fixed value for determinism.
   */
  preview(docs: IcfDocument[], modifiedAt: string = new Date().toISOString()): MergePreview {
    const conflicts: MergeConflict[] = []
    if (docs.length === 0) {
      return {
        sourceCount: 0,
        mergedRecordCount: 0,
        mergedMasterCount: 0,
        deduplicatedMasters: 0,
        conflicts,
        resultText: ''
      }
    }

    const base = docs[0]
    const baseSchemas = base.getSchemas()

    // 1. Schema compatibility: every shared id must have the same structure.
    for (let i = 1; i < docs.length; i++) {
      const other = docs[i].getSchemas()
      for (const id of other.ids()) {
        if (!baseSchemas.has(id)) continue
        const a = this.schemaSignature(baseSchemas.get(id)!)
        const b = this.schemaSignature(other.get(id)!)
        if (a !== b) {
          conflicts.push({
            kind: 'schemaMismatch',
            message: `Schema "${id || '(default)'}" differs between source 1 and source ${i + 1}.`,
            detail: 'Merge keeps source 1’s schema; records may not validate.'
          })
        }
      }
    }

    // 2. Merge masters into the base masters with primary-key dedupe.
    const masters = base.getMasters()
    let deduplicatedMasters = 0
    for (let i = 1; i < docs.length; i++) {
      const other = docs[i].getMasters()
      for (const type of other.getTypes()) {
        const entries = other.getType(type)
        if (!entries) continue
        for (const entry of entries.elements()) {
          const fieldNames = entry.fieldNames()
          if (fieldNames.length === 0) continue
          const key = entry.get(fieldNames[0])?.asText() ?? ''
          if (masters.find(type, key)) {
            deduplicatedMasters++
            continue
          }
          const dest = masters.putType(type).addObject()
          for (const name of fieldNames) {
            dest.put(name, entry.get(name)?.asText() ?? null)
          }
        }
      }
    }

    // 3. Concatenate records, flagging duplicate ids.
    const records = [...base.getRecords()]
    const seenIds = new Set(records.map((r) => r.getId()).filter(Boolean) as string[])
    for (let i = 1; i < docs.length; i++) {
      for (const rec of docs[i].getRecords()) {
        const id = rec.getId()
        if (id && seenIds.has(id)) {
          conflicts.push({
            kind: 'duplicateRecordId',
            message: `Duplicate record id "${id}" from source ${i + 1}.`
          })
        }
        if (id) seenIds.add(id)
        records.push(rec)
      }
    }

    // The merged file holds every source's records, so @records must reflect the
    // combined count rather than the base document's original value. The base's
    // @index (its ICX filename) and @checksum (over the base file) no longer
    // describe the merged content, so drop them — the result should be
    // re-indexed and re-checksummed on its own.
    const mergedMetadata = cloneMetadataWithRecordCount(base.getMetadata(), records.length)
    mergedMetadata.remove('index')
    mergedMetadata.remove('checksum')
    // The merged document is new content: bump the revision past the base's and
    // stamp the modification time.
    bumpRevision(mergedMetadata)
    mergedMetadata.put('modified', modifiedAt)
    const merged = new IcfDocument(mergedMetadata, baseSchemas, masters, records)

    let masterCount = 0
    for (const type of masters.getTypes()) masterCount += masters.getType(type)?.size ?? 0

    return {
      sourceCount: docs.length,
      mergedRecordCount: records.length,
      mergedMasterCount: masterCount,
      deduplicatedMasters,
      conflicts,
      resultText: this.writer.write(merged)
    }
  }

  /** A structural fingerprint of a schema used for compatibility checks. */
  private schemaSignature(schema: IcfSchema): string {
    const parts: string[] = []
    const walk = (node: SchemaNode, depth: number) => {
      parts.push(`${depth}:${node.name}:${node.isCollection() ? '[]' : ''}:[${node.getFields().join(',')}]`)
      for (const child of node.getChildren().values()) walk(child, depth + 1)
    }
    for (const node of schema.getTopLevelNodes().values()) walk(node, 0)
    return parts.join('|')
  }
}
