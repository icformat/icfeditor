import { useMemo } from 'react'
import { useDocumentStore } from '../stores/documentStore'
import { services } from '../services/container'
import { formatBytes } from '../utils/format'
import { PanelEmpty } from './TreePanel'

/** Document statistics (Prompt.md §Statistics). */
export function StatisticsPanel() {
  const active = useDocumentStore((s) => s.documents.find((d) => d.id === s.activeId) ?? null)

  const stats = useMemo(() => {
    if (!active?.parsed) return null
    return services.statistics.compute(active.parsed, active.text)
  }, [active?.parsed, active?.text])

  if (!stats) return <PanelEmpty label="No document statistics" />

  const rows: Array<[string, string]> = [
    ['Schemas', String(stats.schemaCount)],
    ['Master types', String(stats.masterTypeCount)],
    ['Master entries', String(stats.masterEntryCount)],
    ['Records', String(stats.recordCount)],
    ['File size', formatBytes(stats.fileSizeBytes)],
    ['Record size (min/mean/max)', `${stats.recordSize.min} / ${stats.recordSize.mean} / ${stats.recordSize.max} B`],
    ['Revision', stats.revision ?? '—'],
    ['Created', stats.created ?? '—'],
    ['Modified', stats.modified ?? '—']
  ]

  return (
    <div className="h-full overflow-auto p-2 text-xs">
      <table className="w-full">
        <tbody>
          {rows.map(([key, value]) => (
            <tr key={key} className="border-b border-app-border/50">
              <td className="py-1 pr-2 font-medium text-app-muted">{key}</td>
              <td className="py-1">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {stats.recordsPerSchema.length > 0 && (
        <>
          <h4 className="mt-3 mb-1 font-semibold text-app-muted">Records per schema</h4>
          {stats.recordsPerSchema.map(([schema, count]) => (
            <div key={schema} className="flex items-center gap-2 py-0.5">
              <span className="w-28 truncate">{schema}</span>
              <div className="h-2 flex-1 rounded bg-app-surface">
                <div
                  className="h-2 rounded bg-app-accent"
                  style={{ width: `${(count / stats.recordCount) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right text-app-muted">{count}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
