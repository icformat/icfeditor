import type { DocumentIndex } from '../models/document'
import type { SearchHit, SearchQuery, SearchResults } from '../models/search'

/**
 * Editor-level search over the document text + derived {@link DocumentIndex}
 * (Prompt.md §Search). Returns hits with line/column ranges so the caller can
 * decorate Monaco and scroll the tree. `icf.js` has no search API; this is new
 * logic built on the parsed model.
 */
export class SearchService {
  search(text: string, index: DocumentIndex, query: SearchQuery): SearchResults {
    const term = query.caseSensitive ? query.term : query.term.toLowerCase()
    if (!term) return { query, hits: [] }

    switch (query.mode) {
      case 'recordId':
        return { query, hits: this.byRecordId(index, term, query.caseSensitive) }
      case 'uuid':
        return { query, hits: this.byUuid(index, term, query.caseSensitive) }
      case 'schema':
        return { query, hits: this.bySchema(index, term, query.caseSensitive) }
      case 'text':
      case 'fullText':
      default:
        return { query, hits: this.byText(text, index, term, query.caseSensitive) }
    }
  }

  /** Filters record indices to those whose schema is in `schemaIds`. */
  filterBySchemas(index: DocumentIndex, schemaIds: string[]): number[] {
    if (schemaIds.length === 0) return index.records.map((r) => r.index)
    const wanted = new Set(schemaIds)
    return index.records.filter((r) => wanted.has(r.schemaId ?? '')).map((r) => r.index)
  }

  private byText(
    text: string,
    index: DocumentIndex,
    term: string,
    caseSensitive: boolean
  ): SearchHit[] {
    const lines = text.split(/\r?\n/)
    const hits: SearchHit[] = []
    for (let i = 0; i < lines.length; i++) {
      const haystack = caseSensitive ? lines[i] : lines[i].toLowerCase()
      const col = haystack.indexOf(term)
      if (col === -1) continue
      const recordIndex = this.recordIndexForLine(index, i + 1)
      hits.push({
        recordIndex,
        recordId: index.records[recordIndex]?.id ?? null,
        line: i + 1,
        startColumn: col + 1,
        endColumn: col + 1 + term.length,
        preview: lines[i].trim()
      })
    }
    return hits
  }

  private byRecordId(index: DocumentIndex, term: string, caseSensitive: boolean): SearchHit[] {
    return index.records
      .filter((r) => r.id && this.matches(r.id, term, caseSensitive))
      .map((r) => ({
        recordIndex: r.index,
        recordId: r.id,
        line: r.startLine,
        preview: `@record id=${r.id}`
      }))
  }

  private byUuid(index: DocumentIndex, term: string, caseSensitive: boolean): SearchHit[] {
    return index.records
      .filter((r) => r.uuid && this.matches(r.uuid, term, caseSensitive))
      .map((r) => ({
        recordIndex: r.index,
        recordId: r.id,
        line: r.startLine,
        preview: `uuid=${r.uuid}`
      }))
  }

  private bySchema(index: DocumentIndex, term: string, caseSensitive: boolean): SearchHit[] {
    return index.records
      .filter((r) => r.schemaId && this.matches(r.schemaId, term, caseSensitive))
      .map((r) => ({
        recordIndex: r.index,
        recordId: r.id,
        line: r.startLine,
        preview: `schema=${r.schemaId} id=${r.id ?? ''}`.trim()
      }))
  }

  private matches(value: string, term: string, caseSensitive: boolean): boolean {
    return (caseSensitive ? value : value.toLowerCase()).includes(term)
  }

  /** Record index whose [startLine, endLine] contains `line`; -1 if none. */
  private recordIndexForLine(index: DocumentIndex, line: number): number {
    for (const r of index.records) {
      if (line >= r.startLine && line <= r.endLine) return r.index
    }
    return -1
  }
}
