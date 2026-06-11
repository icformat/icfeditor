import { useEffect, useMemo, useState } from 'react'
import type { IcfDocument } from 'icf.js'
import { useDocumentStore } from '../stores/documentStore'
import { services } from '../services/container'
import type { IcxCompareReport, RecordCompareStatus } from '../models/icx'
import { PanelEmpty } from './TreePanel'

/** One side of the comparison, from an open tab or loaded from disk. */
interface DocRef {
  doc: IcfDocument
  text: string
  name: string
}

const STATUS_META: Record<RecordCompareStatus, { glyph: string; label: string; cls: string }> = {
  match: { glyph: '✓', label: 'Up to date', cls: 'text-app-success' },
  checksumMismatch: { glyph: '≠', label: 'Changed (checksum)', cls: 'text-app-warning' },
  added: { glyph: '+', label: 'Missing from index (stale)', cls: 'text-app-error' },
  removed: { glyph: '−', label: 'Dropped record (stale)', cls: 'text-app-error' }
}

/**
 * ICX compare view (Prompt.md §ICX Support). Pairs the active ICF with its
 * stored ICX — auto-detected from open tabs via `@index`/`@source`, or loaded
 * from disk — then shows the metadata summary (revision/sourcerevision, counts,
 * checksum) plus a per-record table flagging missing/stale/changed indexes.
 */
export function IcxComparePanel() {
  const active = useDocumentStore((s) => s.documents.find((d) => d.id === s.activeId) ?? null)
  const documents = useDocumentStore((s) => s.documents)
  const [loaded, setLoaded] = useState<DocRef | null>(null)
  const [report, setReport] = useState<IcxCompareReport | null>(null)
  const [busy, setBusy] = useState(false)

  // Resolve the ICF (source) and ICX (stored) sides from the active document,
  // its open counterpart, and any file loaded into this panel.
  const { source, icx, needs } = useMemo(
    () => resolvePair(active, documents, loaded),
    [active, documents, loaded]
  )

  // Run the (async) comparison whenever either side's text changes.
  useEffect(() => {
    let live = true
    if (!source || !icx) {
      setReport(null)
      return
    }
    setBusy(true)
    services.icxGenerator
      .comparePerRecord(source.doc, icx.doc, source.text)
      .then((result) => live && setReport(result))
      .finally(() => live && setBusy(false))
    return () => {
      live = false
    }
  }, [source?.text, icx?.text, source, icx])

  const loadCounterpart = async () => {
    const files = await window.api.openFileDialog({ multi: false })
    const file = files[0]
    if (!file) return
    setLoaded({ doc: services.parser.parse(file.content), text: file.content, name: file.path })
  }

  if (!active?.parsed) return <PanelEmpty label="Open an ICF or ICX file to compare" />

  return (
    <div className="flex h-full flex-col text-xs">
      <div className="flex items-center gap-2 border-b border-app-border p-2">
        <span className="text-app-muted">ICF:</span>
        <span className="font-mono">{source?.name ?? '—'}</span>
        <span className="text-app-muted">ICX:</span>
        <span className="font-mono">{icx?.name ?? '—'}</span>
        {needs && (
          <button
            onClick={loadCounterpart}
            className="ml-auto rounded border border-app-border px-2 py-0.5 hover:bg-app-surface-hover"
          >
            Load {needs} file…
          </button>
        )}
      </div>

      {!source || !icx ? (
        <PanelEmpty
          label={
            needs === 'ICX'
              ? 'No matching ICX found. Generate one (F5) or load it.'
              : 'No matching ICF found. Open or load the source file.'
          }
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          {report && <Summary report={report} busy={busy} />}
          {report && <RecordTable report={report} />}
        </div>
      )}
    </div>
  )
}

function Summary({ report, busy }: { report: IcxCompareReport; busy: boolean }) {
  const { summary, counts } = report
  return (
    <div className="border-b border-app-border p-2">
      <div className="mb-2 flex items-center gap-2">
        {busy ? (
          <span className="text-app-muted">Comparing…</span>
        ) : summary.upToDate && counts.added === 0 && counts.removed === 0 && counts.checksumMismatch === 0 ? (
          <span className="font-semibold text-app-success">✓ Index is up to date</span>
        ) : (
          <span className="font-semibold text-app-warning">⚠ Index is stale</span>
        )}
      </div>

      <table className="w-full">
        <tbody>
          <Row label="ICF revision / ICX @sourcerevision" value={`${summary.sourceRevision ?? '—'} / ${summary.icxSourceRevision ?? '—'}`} />
          <Row label="Records (ICF / ICX)" value={`${summary.sourceRecordCount} / ${summary.icxRecordCount ?? '—'}`} />
          <Row
            label="Checksum (ICF @checksum / ICX @sourcechecksum)"
            value={checksumVerdict(summary.sourceChecksum, summary.icxSourceChecksum)}
          />
        </tbody>
      </table>

      <div className="mt-2 flex flex-wrap gap-3">
        <Tally status="match" n={counts.match} />
        <Tally status="checksumMismatch" n={counts.checksumMismatch} />
        <Tally status="added" n={counts.added} />
        <Tally status="removed" n={counts.removed} />
      </div>

      {summary.issues.length > 0 && (
        <ul className="mt-2 list-disc pl-4 text-app-warning">
          {summary.issues.map((issue, i) => (
            <li key={i}>{issue}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RecordTable({ report }: { report: IcxCompareReport }) {
  // Show problems first; matches are collapsed into the tally above.
  const problems = report.rows.filter((r) => r.status !== 'match')
  if (problems.length === 0) {
    return <p className="p-2 text-app-success">Every indexed record matches the source.</p>
  }
  return (
    <table className="w-full">
      <thead className="sticky top-0 bg-app-surface text-app-muted">
        <tr>
          <th className="px-2 py-1 text-left">Type</th>
          <th className="px-2 py-1 text-left">Record ID</th>
          <th className="px-2 py-1 text-left">Status</th>
        </tr>
      </thead>
      <tbody>
        {problems.map((row, i) => {
          const meta = STATUS_META[row.status]
          return (
            <tr key={i} className="border-b border-app-border/40">
              <td className="px-2 py-1">{row.type}</td>
              <td className="px-2 py-1 font-mono">{row.recordId}</td>
              <td className={`px-2 py-1 ${meta.cls}`}>
                {meta.glyph} {meta.label}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-app-border/40">
      <td className="py-1 pr-2 text-app-muted">{label}</td>
      <td className="py-1 font-mono">{value}</td>
    </tr>
  )
}

function Tally({ status, n }: { status: RecordCompareStatus; n: number }) {
  const meta = STATUS_META[status]
  return (
    <span className={meta.cls}>
      {meta.glyph} {n} {meta.label.toLowerCase()}
    </span>
  )
}

function checksumVerdict(icf: string | null, icx: string | null): string {
  if (!icf || !icx) return 'not available'
  return icf === icx ? 'match' : 'differ'
}

/**
 * Resolves the ICF/ICX pair. `needs` names the side still missing so the UI can
 * offer a "Load … file" button. Matching uses the ICF's `@index` and the ICX's
 * `@source` directive, falling back to a file loaded into the panel.
 */
function resolvePair(
  active: ReturnType<typeof useDocumentStore.getState>['documents'][number] | null,
  documents: ReturnType<typeof useDocumentStore.getState>['documents'],
  loaded: DocRef | null
): { source: DocRef | null; icx: DocRef | null; needs: 'ICF' | 'ICX' | null } {
  if (!active?.parsed) return { source: null, icx: null, needs: null }

  const activeRef: DocRef = { doc: active.parsed, text: active.text, name: active.fileName }
  const activeIsIcx = (active.parsed.getMetadata().getKind() ?? active.kind) === 'icx'

  const openDocRef = (predicate: (d: (typeof documents)[number]) => boolean): DocRef | null => {
    const match = documents.find((d) => d.parsed !== null && predicate(d))
    return match?.parsed ? { doc: match.parsed, text: match.text, name: match.fileName } : null
  }

  if (activeIsIcx) {
    const icx = activeRef
    const sourceName = active.parsed.getMetadata().getSource()
    const source =
      (loaded && (loaded.doc.getMetadata().getKind() ?? 'icf') === 'icf' ? loaded : null) ??
      openDocRef(
        (d) =>
          d.kind === 'icf' &&
          (d.fileName === sourceName || d.parsed!.getMetadata().getIndex() === active.fileName)
      )
    return { source, icx, needs: source ? null : 'ICF' }
  }

  const source = activeRef
  const indexName = active.parsed.getMetadata().getIndex()
  const icx =
    (loaded && (loaded.doc.getMetadata().getKind() ?? '') === 'icx' ? loaded : null) ??
    openDocRef(
      (d) =>
        d.kind === 'icx' &&
        (d.fileName === indexName || d.parsed!.getMetadata().getSource() === active.fileName)
    )
  return { source, icx, needs: icx ? null : 'ICX' }
}
