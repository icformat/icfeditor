/** Search dimensions from Prompt.md §Search. */
export type SearchMode = 'text' | 'recordId' | 'uuid' | 'schema' | 'fullText'

export interface SearchQuery {
  term: string
  mode: SearchMode
  caseSensitive: boolean
}

/** One match, with enough location info to decorate Monaco and the tree. */
export interface SearchHit {
  recordIndex: number
  recordId: string | null
  /** 1-based line of the match. */
  line: number
  /** Column range (1-based) of the match within the line, when known. */
  startColumn?: number
  endColumn?: number
  /** The matched line text, for the results list preview. */
  preview: string
}

export interface SearchResults {
  query: SearchQuery
  hits: SearchHit[]
}
