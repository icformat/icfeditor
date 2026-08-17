import { useEffect, useState } from 'react'
import type { FileStat } from '@shared/ipc'
import { Dialog, DialogButton } from './Dialog'
import { useDocumentStore } from '../stores/documentStore'
import { buildFileProperties, type PropertyGroup } from '../utils/fileProperties'

/**
 * File → Properties: file-system facts (path, size, timestamps), content
 * counts, and the document's own directives, for the active tab. The disk
 * stat is fetched fresh on open so the size/dates reflect the file now, not
 * the signature captured at open/save time.
 */
export function FilePropertiesDialog({ onClose }: { onClose: () => void }) {
  const doc = useDocumentStore((s) => s.documents.find((d) => d.id === s.activeId) ?? null)
  const index = useDocumentStore((s) => s.index)
  const [stat, setStat] = useState<FileStat | null>(null)
  const [statLoaded, setStatLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (doc?.path && window.api) {
      void window.api.statFile(doc.path).then((s) => {
        if (!cancelled) {
          setStat(s)
          setStatLoaded(true)
        }
      })
    } else {
      setStatLoaded(true)
    }
    return () => {
      cancelled = true
    }
  }, [doc?.path])

  if (!doc) return null
  const groups: PropertyGroup[] = statLoaded ? buildFileProperties(doc, index, stat) : []

  return (
    <Dialog
      title={`Properties — ${doc.fileName}`}
      onClose={onClose}
      width={560}
      footer={<DialogButton onClick={onClose} variant="primary">Close</DialogButton>}
    >
      {groups.map((group) => (
        <section key={group.title} className="mb-3 last:mb-0">
          <h3 className="mb-1 font-semibold text-app-muted">{group.title}</h3>
          <table className="w-full border-collapse">
            <tbody>
              {group.rows.map((row) => (
                <tr key={row.label} className="align-top">
                  <td className="w-36 py-0.5 pr-3 text-app-muted">{row.label}</td>
                  <td className={`break-all py-0.5 ${row.mono ? 'font-mono' : ''}`}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </Dialog>
  )
}
