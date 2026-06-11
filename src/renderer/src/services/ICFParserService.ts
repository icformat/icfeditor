import { parse, parseLenient, IcfParser, type IcfDocument } from 'icf.js'
import type { DocumentIndex, RecordLocation } from '../models/document'

/**
 * Adapter over `icf.js` parsing. The live editor uses {@link parseLenient} so a
 * half-typed document still yields a best-effort model; {@link parseStrict} is
 * used where a throw-on-error guarantee is wanted (e.g. before a transform).
 *
 * It also builds a {@link DocumentIndex} mapping records to their text lines —
 * `icf.js` does not retain source offsets, so we recover them with a light line
 * scan of the original text. This index powers navigation, search, and filters.
 */
export class ICFParserService {
  /** Best-effort parse; never throws on content errors. */
  parse(text: string): IcfDocument {
    return parseLenient(text)
  }

  /** Strict parse; throws `IcfParseError` when error-level diagnostics exist. */
  parseStrict(text: string): IcfDocument {
    return parse(text)
  }

  /** Exposes the lower-level parser for callers that want diagnostics inline. */
  parseWithMessages(text: string) {
    const result = new IcfParser().parse(text)
    return { document: result.getDocument(), messages: result.getMessages() }
  }

  /**
   * Builds the record→line index by scanning for `@record` directives. Line and
   * record ordering in the text matches the parsed record order (the parser
   * preserves document order), so we zip the two together.
   */
  buildIndex(text: string, doc: IcfDocument): DocumentIndex {
    const lines = text.split(/\r?\n/)
    const recordStartLines: number[] = []
    for (let i = 0; i < lines.length; i++) {
      // A record directive is `@record` optionally followed by attributes.
      if (/^@record(\s|$)/.test(lines[i].trimStart())) recordStartLines.push(i + 1)
    }

    const records: RecordLocation[] = []
    const byId = new Map<string, RecordLocation>()
    const bySchema = new Map<string, number[]>()

    const docRecords = doc.getRecords()
    for (let i = 0; i < docRecords.length; i++) {
      const rec = docRecords[i]
      const startLine = recordStartLines[i] ?? 0
      const endLine = (recordStartLines[i + 1] ?? lines.length + 1) - 1
      const schemaId = rec.getSchemaId()
      const loc: RecordLocation = {
        index: i,
        id: rec.getId(),
        uuid: rec.getUuid(),
        schemaId,
        startLine,
        endLine
      }
      records.push(loc)
      if (loc.id) byId.set(loc.id, loc)
      const key = schemaId ?? ''
      const bucket = bySchema.get(key)
      if (bucket) bucket.push(i)
      else bySchema.set(key, [i])
    }

    return { records, byId, bySchema }
  }
}
