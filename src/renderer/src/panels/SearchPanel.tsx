import { useState } from 'react'
import { useDocumentStore } from '../stores/documentStore'
import { services } from '../services/container'
import { replaceOccurrences, replaceInRange } from '../utils/replace'
import type { SearchMode, SearchResults } from '../models/search'

const MODES: Array<{ id: SearchMode; label: string }> = [
  { id: 'text', label: 'Text' },
  { id: 'recordId', label: 'Record ID' },
  { id: 'uuid', label: 'UUID' },
  { id: 'schema', label: 'Schema' },
  { id: 'fullText', label: 'Full text' }
]

type ReplaceScope = 'document' | 'selection'

interface SearchPanelProps {
  onJump: (line: number) => void
  /** Current editor selection as character offsets, or null when none. */
  getSelection: () => { start: number; end: number } | null
}

/** Multi-mode search + replace (Prompt.md §Search). Results jump the editor on click. */
export function SearchPanel({ onJump, getSelection }: SearchPanelProps) {
  const active = useDocumentStore((s) => s.documents.find((d) => d.id === s.activeId) ?? null)
  const index = useDocumentStore((s) => s.index)
  const updateText = useDocumentStore((s) => s.updateText)
  const [term, setTerm] = useState('')
  const [mode, setMode] = useState<SearchMode>('text')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [results, setResults] = useState<SearchResults | null>(null)
  const [replacement, setReplacement] = useState('')
  const [replaceScope, setReplaceScope] = useState<ReplaceScope>('document')
  const [replaceStatus, setReplaceStatus] = useState<string | null>(null)

  // Replace only applies to free-text searches (record id / uuid / schema modes
  // match metadata, not editable body text).
  const canReplace = mode === 'text' || mode === 'fullText'
  // Replace edits the document, so it is disabled in View mode (read-only).
  const editable = active?.mode === 'edit'

  const run = () => {
    if (!active || !index) return
    setResults(services.search.search(active.text, index, { term, mode, caseSensitive }))
  }

  const runReplace = () => {
    if (!active || term === '' || !editable) return
    let result
    if (replaceScope === 'selection') {
      const sel = getSelection()
      if (!sel || sel.start === sel.end) {
        setReplaceStatus('Select text in the editor first.')
        return
      }
      result = replaceInRange(active.text, sel.start, sel.end, term, replacement, caseSensitive)
    } else {
      result = replaceOccurrences(active.text, term, replacement, caseSensitive)
    }
    if (result.count > 0) updateText(active.id, result.text)
    setReplaceStatus(`Replaced ${result.count} occurrence${result.count === 1 ? '' : 's'}.`)
  }

  return (
    <div className="flex h-full flex-col text-xs">
      <div className="flex flex-wrap items-center gap-1 border-b border-app-border p-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder="Search…"
          className="flex-1 rounded border border-app-border bg-app-bg px-2 py-1 outline-none focus:border-app-accent"
        />
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as SearchMode)}
          className="rounded border border-app-border bg-app-bg px-1 py-1"
        >
          {MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1" title="Case sensitive">
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
          />
          Aa
        </label>
        <button onClick={run} className="rounded bg-app-accent px-2 py-1 text-white">
          Go
        </button>
      </div>

      {canReplace && (
        <div className="flex flex-wrap items-center gap-1 border-b border-app-border p-2">
          <input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runReplace()}
            placeholder="Replace with…"
            disabled={!editable}
            className="flex-1 rounded border border-app-border bg-app-bg px-2 py-1 outline-none focus:border-app-accent disabled:opacity-40"
          />
          <label className="flex items-center gap-1 text-app-muted" title="Where to replace">
            in
            <select
              value={replaceScope}
              onChange={(e) => setReplaceScope(e.target.value as ReplaceScope)}
              disabled={!editable}
              className="rounded border border-app-border bg-app-bg px-1 py-1 disabled:opacity-40"
            >
              <option value="document">Full document</option>
              <option value="selection">Selection</option>
            </select>
          </label>
          <button
            onClick={runReplace}
            disabled={!editable || term === ''}
            title={
              !editable
                ? 'Switch to Edit mode to replace'
                : term === ''
                  ? 'Enter search text above first'
                  : 'Replace the search text'
            }
            className="rounded bg-app-accent px-2 py-1 text-white disabled:opacity-40"
          >
            Go
          </button>
          {!editable && (
            <span className="w-full text-app-muted">Replace is available in Edit mode.</span>
          )}
          {editable && replaceStatus && (
            <span className="w-full text-app-muted">{replaceStatus}</span>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {results && (
          <div className="px-2 py-1 text-app-muted">{results.hits.length} matches</div>
        )}
        {results?.hits.map((hit, i) => (
          <div
            key={i}
            onClick={() => onJump(hit.line)}
            className="cursor-pointer border-b border-app-border/40 px-2 py-1 hover:bg-app-surface-hover"
          >
            <span className="text-app-muted">Ln {hit.line}</span>
            {hit.recordId && <span className="ml-2 text-app-accent">{hit.recordId}</span>}
            <div className="truncate font-mono">{hit.preview}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
