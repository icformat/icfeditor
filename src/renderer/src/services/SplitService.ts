import { IcfDocument, type IcfRecord } from 'icf.js'
import type { ICFWriterService } from './ICFWriterService'
import type { SplitOptions, SplitPart } from '../models/transform'
import { cloneMetadataWithRecordCount, bumpRevision } from '../utils/icfMetadata'

const encoder = new TextEncoder()

/**
 * Splits one ICF document into several (Prompt.md §Split) by record range,
 * schema, record count, or maximum file size. Every output keeps the source's
 * metadata, schemas, and masters so each part is independently valid. New logic
 * over the `icf.js` model.
 */
export class SplitService {
  constructor(private readonly writer: ICFWriterService) {}

  /**
   * @param modifiedAt ISO timestamp stamped into each part's `@modified`.
   *   Defaults to now; tests pass a fixed value for determinism.
   */
  split(
    doc: IcfDocument,
    baseName: string,
    options: SplitOptions,
    modifiedAt: string = new Date().toISOString()
  ): SplitPart[] {
    const records = doc.getRecords()
    switch (options.strategy) {
      case 'range':
        return this.byRange(doc, records, baseName, options, modifiedAt)
      case 'schema':
        return this.bySchema(doc, records, baseName, modifiedAt)
      case 'count':
        return this.byCount(doc, records, baseName, options.countPerFile ?? records.length, modifiedAt)
      case 'maxSize':
        return this.byMaxSize(doc, records, baseName, options.maxBytes ?? Infinity, modifiedAt)
    }
  }

  private byRange(
    doc: IcfDocument,
    records: IcfRecord[],
    baseName: string,
    options: SplitOptions,
    modifiedAt: string
  ): SplitPart[] {
    const start = Math.max(1, options.range?.start ?? 1)
    const end = Math.min(records.length, options.range?.end ?? records.length)
    const slice = records.slice(start - 1, end)
    return [this.makePart(doc, slice, `${baseName}.${start}-${end}`, modifiedAt)]
  }

  private bySchema(
    doc: IcfDocument,
    records: IcfRecord[],
    baseName: string,
    modifiedAt: string
  ): SplitPart[] {
    const groups = new Map<string, IcfRecord[]>()
    for (const rec of records) {
      const key = rec.getSchemaId() ?? 'default'
      const bucket = groups.get(key)
      if (bucket) bucket.push(rec)
      else groups.set(key, [rec])
    }
    return [...groups.entries()].map(([schema, group]) =>
      this.makePart(doc, group, `${baseName}.${schema}`, modifiedAt)
    )
  }

  private byCount(
    doc: IcfDocument,
    records: IcfRecord[],
    baseName: string,
    perFile: number,
    modifiedAt: string
  ): SplitPart[] {
    const size = Math.max(1, perFile)
    const parts: SplitPart[] = []
    for (let i = 0; i < records.length; i += size) {
      const slice = records.slice(i, i + size)
      parts.push(this.makePart(doc, slice, `${baseName}.part${parts.length + 1}`, modifiedAt))
    }
    return parts
  }

  private byMaxSize(
    doc: IcfDocument,
    records: IcfRecord[],
    baseName: string,
    maxBytes: number,
    modifiedAt: string
  ): SplitPart[] {
    // Greedy: grow a group until serializing it would exceed maxBytes, then cut.
    // Serializing per step is O(n²) in the worst case but is fine for the file
    // sizes this dialog targets; a streaming size estimate is a Phase-4 upgrade.
    const parts: SplitPart[] = []
    let group: IcfRecord[] = []
    for (const rec of records) {
      const candidate = [...group, rec]
      const text = this.writer.write(this.makeDoc(doc, candidate, modifiedAt))
      if (group.length > 0 && encoder.encode(text).length > maxBytes) {
        parts.push(this.makePart(doc, group, `${baseName}.part${parts.length + 1}`, modifiedAt))
        group = [rec]
      } else {
        group = candidate
      }
    }
    if (group.length > 0) {
      parts.push(this.makePart(doc, group, `${baseName}.part${parts.length + 1}`, modifiedAt))
    }
    return parts
  }

  private makeDoc(doc: IcfDocument, records: IcfRecord[], modifiedAt: string): IcfDocument {
    // Each part has its own record count, so override @records (the source's
    // explicit value would otherwise be emitted verbatim).
    const metadata = cloneMetadataWithRecordCount(doc.getMetadata(), records.length)
    // The source's @index (its ICX filename) and @checksum (over the whole file)
    // do not apply to a partial file, so drop them — a part should be re-indexed
    // and re-checksummed on its own.
    metadata.remove('index')
    metadata.remove('checksum')
    // A split part is new content derived from the source: bump its revision and
    // stamp the modification time.
    bumpRevision(metadata)
    metadata.put('modified', modifiedAt)
    return new IcfDocument(metadata, doc.getSchemas(), doc.getMasters(), records)
  }

  private makePart(
    doc: IcfDocument,
    records: IcfRecord[],
    suggestedName: string,
    modifiedAt: string
  ): SplitPart {
    return {
      suggestedName: `${suggestedName}.icf`,
      recordCount: records.length,
      text: this.writer.write(this.makeDoc(doc, records, modifiedAt))
    }
  }
}
