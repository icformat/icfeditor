import type { IcfDocument } from 'icf.js'
import type { DocumentStatistics } from '../models/statistics'

const encoder = new TextEncoder()

/**
 * Computes document statistics (Prompt.md §Statistics) from the parsed model
 * plus the raw text. Record byte sizes are measured from the text by scanning
 * `@record` blocks, which reflects on-disk size faithfully (the parser does not
 * retain offsets). When `text` is omitted, size-derived fields are zeroed.
 */
export class StatisticsService {
  compute(doc: IcfDocument, text = ''): DocumentStatistics {
    const meta = doc.getMetadata()
    const records = doc.getRecords()
    const masters = doc.getMasters()

    const recordSizes = text ? this.recordByteSizes(text) : []
    const fileSizeBytes = text ? encoder.encode(text).length : 0

    const recordsPerSchema = new Map<string, number>()
    for (const r of records) {
      const key = r.getSchemaId() ?? '(default)'
      recordsPerSchema.set(key, (recordsPerSchema.get(key) ?? 0) + 1)
    }

    let masterEntryCount = 0
    for (const type of masters.getTypes()) {
      masterEntryCount += masters.getType(type)?.size ?? 0
    }

    return {
      schemaCount: doc.getSchemas().size,
      masterTypeCount: masters.typeCount(),
      masterEntryCount,
      recordCount: records.length,
      fileSizeBytes,
      recordSize: this.summarizeSizes(recordSizes),
      recordsPerSchema: [...recordsPerSchema.entries()],
      revision: meta.getRevision(),
      created: meta.getCreated(),
      modified: meta.getModified()
    }
  }

  /** Byte size of each `@record` block (directive line through the line before the next record). */
  private recordByteSizes(text: string): number[] {
    const lines = text.split(/\r?\n/)
    const starts: number[] = []
    for (let i = 0; i < lines.length; i++) {
      if (/^@record(\s|$)/.test(lines[i].trimStart())) starts.push(i)
    }
    const sizes: number[] = []
    for (let s = 0; s < starts.length; s++) {
      const from = starts[s]
      const to = starts[s + 1] ?? lines.length
      const block = lines.slice(from, to).join('\n')
      sizes.push(encoder.encode(block).length)
    }
    return sizes
  }

  private summarizeSizes(sizes: number[]): DocumentStatistics['recordSize'] {
    if (sizes.length === 0) {
      return { min: 0, max: 0, mean: 0, histogram: [] }
    }
    const min = Math.min(...sizes)
    const max = Math.max(...sizes)
    const mean = Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length)

    // Five buckets across the observed range.
    const buckets = 5
    const span = Math.max(1, max - min)
    const histogram: Array<[number, number]> = Array.from({ length: buckets }, (_, i) => [
      min + Math.ceil(((i + 1) * span) / buckets),
      0
    ])
    for (const size of sizes) {
      let idx = Math.floor(((size - min) / span) * buckets)
      if (idx >= buckets) idx = buckets - 1
      histogram[idx][1]++
    }
    return { min, max, mean, histogram }
  }
}
