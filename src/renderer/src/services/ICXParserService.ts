import { parseLenient, type IcfDocument } from 'icf.js'

/**
 * An ICX file is itself an ICF document (its index rows are ordinary records),
 * so parsing reuses the ICF parser. This service exists as a named seam so the
 * UI can speak in ICX terms and so ICX-specific helpers have a home.
 */
export class ICXParserService {
  parse(text: string): IcfDocument {
    return parseLenient(text)
  }

  /** True if the document declares `@kind icx`. */
  isIcx(doc: IcfDocument): boolean {
    return doc.getMetadata().getKind() === 'icx'
  }
}
