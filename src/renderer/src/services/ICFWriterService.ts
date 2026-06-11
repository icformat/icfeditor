import {
  write,
  writeWithChecksum,
  IcfWriter,
  type IcfDocument,
  type IcfNode
} from 'icf.js'

/**
 * Adapter over `icf.js` serialization. Faithful for parsed documents
 * (`parse → write → parse` round-trips); infers a schema for built nodes.
 */
export class ICFWriterService {
  private readonly writer = new IcfWriter()

  /** Serialize a document or built node to ICF text. */
  write(target: IcfDocument | IcfNode): string {
    return write(target)
  }

  /**
   * Serialize and emit a fresh `@checksum` over canonical content (spec §19).
   * Async because `icf.js` checksums use Web Crypto.
   */
  writeWithChecksum(target: IcfDocument | IcfNode): Promise<string> {
    return writeWithChecksum(target)
  }

  /** Canonical body text of one record — used to diff/compare records. */
  recordBody(doc: IcfDocument, record: Parameters<IcfWriter['recordBody']>[1]): string {
    return this.writer.recordBody(doc, record)
  }
}
