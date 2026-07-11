import { SHORTCUTS } from '../commands/shortcuts'

/** Tips & help panel (Prompt.md §Tips Panel + §Help): shortcuts, examples, links. */
export function TipsPanel() {
  return (
    <div className="h-full overflow-auto p-3 text-xs">
      <h4 className="mb-1 font-semibold text-app-muted">Keyboard shortcuts</h4>
      <table className="mb-4 w-full">
        <tbody>
          {SHORTCUTS.map((s) => (
            <tr key={s.command}>
              <td className="py-0.5 pr-3">{s.label}</td>
              <td className="py-0.5 font-mono text-app-accent">{s.keys}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 className="mb-1 font-semibold text-app-muted">Best practices</h4>
      <ul className="mb-4 list-disc pl-4 text-app-muted">
        <li>Declare each schema once; store records positionally.</li>
        <li>Use masters for repeated data and reference them as <code>Type:Id</code>.</li>
        <li>Regenerate ICX (F5) after edits so checksums and counts stay in sync.</li>
        <li>Keep indentation at 2 spaces; avoid tabs.</li>
      </ul>

      <h4 className="mb-1 font-semibold text-app-muted">Specifications</h4>
      <ul className="list-disc pl-4">
        <li>
          <a className="text-app-accent" href="https://icformat.org/icf/specification/v1.1/" target="_blank" rel="noreferrer">
            ICF 1.1 specification
          </a>
        </li>
        <li>
          <a className="text-app-accent" href="https://icformat.org/icx/specification/v1.1/" target="_blank" rel="noreferrer">
            ICX 1.1 specification
          </a>
        </li>
        <li>
          <a className="text-app-accent" href="https://icformat.org" target="_blank" rel="noreferrer">
            icformat.org
          </a>
        </li>
      </ul>
    </div>
  )
}
